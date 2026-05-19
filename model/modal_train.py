"""
NutriSense AI — Modal training pipeline.

Runs the full Kaggle-equivalent flow (curate → train → ablate → evaluate → export)
on Modal's infrastructure. No 12-hour session cap, no flaky web UI.

Estimated cost:
    setup_datasets   ~30-60 min CPU   (~$0.20)        — once per Volume
    train_pipeline   ~5-7 hrs A10G    (~$6-8)
                                      ─────
                                      ~$6-8 total

Usage:
    pip install modal
    modal token new                                    # one-time auth
    modal secret create kaggle \\
        KAGGLE_USERNAME=<your-username> \\
        KAGGLE_KEY=<your-classic-token>                # one-time secret

    modal run --detach model/modal_train.py::setup_datasets     # first time only
    modal run --detach model/modal_train.py::train_pipeline     # ~5-7 hrs

    # --detach is critical: it tells Modal to keep the function running even
    # if your local terminal disconnects. Without --detach, any local
    # disconnect cancels the run mid-flight.

    # Fetch outputs to your machine:
    modal volume get nutrisense /model.onnx                   ./outputs/
    modal volume get nutrisense /class_index.json             ./outputs/
    modal volume get nutrisense /evaluation                   ./outputs/ --recursive

Architecture notes:
- Raw datasets live on the Volume (/data/raw/, persistent).
- Unified dataset (curate output) lives in container-local /tmp (NOT
  Volume) because Modal Volume's file-count limit doesn't tolerate
  ~264K small entries. /tmp is ephemeral SSD inside the container.
- Final outputs (model.onnx, evaluation/, checkpoints/) write back to
  the Volume.
- curate uses os.symlink from /tmp/unified_dataset/<class>/<file>.jpg
  → /data/raw/<source>/<class>/<file>.jpg. Symlinks are O(1) per file
  and PIL reads through them transparently.
- curate runs in the same GPU container as train_pipeline (~5-10 min
  on local SSD) because /tmp doesn't transfer between containers. The
  GPU cost during curate is negligible (~$0.18).

To upgrade to A100 (~2x faster, ~2x cost), change gpu="A10G" → gpu="A100".
"""

import modal

APP_NAME = "nutrisense-training"
VOLUME_NAME = "nutrisense"
REPO_URL = "https://github.com/zeeshandesigns/NutriSense.git"

# Datasets to download from Kaggle. Tuple is (kaggle slug, local subdir under /data/raw/).
DATASETS = [
    ("kmader/food41",                                            "kmader/food41"),
    ("kashyap077/indian-food-images-for-model-fine-tuning-2026", "kashyap077/indian-food"),
    ("shaidurpranto/deshifoodbd",                                "shaidurpranto/deshifoodbd"),
    ("sameen03/nutrisense-scraped",                              "sameen03/nutrisense-scraped"),
]

# ── Container images ────────────────────────────────────────────────────────
cpu_image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("git")
    .pip_install("kaggle>=1.6.0", "Pillow>=10.0.0", "numpy<2.0", "pandas>=2.2.0")
)

gpu_image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("git")
    .pip_install(
        "torch", "torchvision",
        extra_index_url="https://download.pytorch.org/whl/cu121",
    )
    .pip_install(
        "onnx>=1.16.0", "onnxruntime>=1.18.0", "onnxscript",
        "Pillow>=10.0.0", "numpy<2.0",
        "scikit-learn>=1.4.0", "matplotlib>=3.8.0",
        "seaborn>=0.13.0", "pandas>=2.2.0",
    )
)

app = modal.App(APP_NAME)
volume = modal.Volume.from_name(VOLUME_NAME, create_if_missing=True)
kaggle_secret = modal.Secret.from_name("kaggle")


# ── Step 1: download all datasets to the Volume (run once) ─────────────────
@app.function(
    image=cpu_image,
    volumes={"/data": volume},
    secrets=[kaggle_secret],
    timeout=4 * 60 * 60,
    cpu=2.0,
    memory=4096,
)
def setup_datasets():
    """Download Kaggle datasets to /data/raw/. Idempotent — skips datasets already present."""
    import json, os, subprocess
    from pathlib import Path

    # Write Kaggle credentials in the format the CLI expects
    cred_dir = Path("/root/.kaggle")
    cred_dir.mkdir(exist_ok=True)
    cred_file = cred_dir / "kaggle.json"
    cred_file.write_text(json.dumps({
        "username": os.environ["KAGGLE_USERNAME"],
        "key":      os.environ["KAGGLE_KEY"],
    }))
    cred_file.chmod(0o600)

    raw_dir = Path("/data/raw")
    raw_dir.mkdir(parents=True, exist_ok=True)

    for slug, dest_path in DATASETS:
        dest = raw_dir / dest_path
        if dest.exists() and any(dest.iterdir()):
            size_mb = sum(f.stat().st_size for f in dest.rglob("*") if f.is_file()) / 1e6
            print(f"  ✓ Already present: {slug}  ({size_mb:,.0f} MB)")
            continue
        dest.mkdir(parents=True, exist_ok=True)
        print(f"  ⬇ Downloading {slug} → {dest}")
        subprocess.run(
            ["kaggle", "datasets", "download", "-d", slug,
             "-p", str(dest), "--unzip"],
            check=True,
        )
        size_mb = sum(f.stat().st_size for f in dest.rglob("*") if f.is_file()) / 1e6
        print(f"  ✓ Done: {slug}  ({size_mb:,.0f} MB)")

    volume.commit()
    print("\nAll datasets staged in /data/raw/")


# ── Step 2: end-to-end on GPU (curate to /tmp, train, ablate, evaluate, export) ─
@app.function(
    image=gpu_image,
    gpu="A10G",                       # A100 or H100 for faster (and more $$$)
    volumes={"/data": volume},
    timeout=10 * 60 * 60,             # 10 hr cap
    cpu=4.0,
    memory=16384,
)
def train_pipeline():
    """Pre-stage raw data → Curate → Train → Ablate → Evaluate → Export ONNX."""
    import glob, os, re, shutil, subprocess, time
    from multiprocessing import Pool
    from pathlib import Path

    # 1. Pull latest model/ scripts ─────────────────────────────────────────
    code_dir = Path("/tmp/nutrisense")
    if not code_dir.exists():
        print("Cloning repo…")
        subprocess.run(
            ["git", "clone", "--depth", "1", REPO_URL, str(code_dir)],
            check=True,
        )
    model_dir = code_dir / "model"

    vol_raw = Path("/data/raw")
    vol_paths = {
        "food101": vol_raw / "kmader/food41/images",
        "khana":   vol_raw / "kashyap077/indian-food/Images",
        "deshi":   vol_raw / "shaidurpranto/deshifoodbd/food_data_english/food_data_english/images",
        "scraped": vol_raw / "sameen03/nutrisense-scraped/scraped",
    }

    print("=== Volume path verification ===")
    for name, p in vol_paths.items():
        ok = p.exists()
        print(f"  {'✓' if ok else '✗ MISSING'}  {name}: {p}")
        if not ok:
            raise RuntimeError(f"Missing input: {p} — run setup_datasets first")

    # 2. Pre-stage raw data to /tmp (local SSD) ─────────────────────────────
    # CRITICAL: training MUST read from local SSD. Reading from Modal Volume
    # in a DataLoader hot path = network round-trip per image = GPU starves.
    # v4 ran for 3 hours with 0.163 CPU cores in use because DataLoader workers
    # spent all their time waiting on Volume reads.
    local_raw = Path("/tmp/raw")
    local_paths = {k: local_raw / k for k in vol_paths}

    print("\n=== Pre-staging raw data to /tmp (local SSD) ===")
    t0 = time.time()
    for name, src in vol_paths.items():
        dst = local_paths[name]
        if dst.exists() and any(dst.iterdir()):
            print(f"  ✓ Already staged: {name}")
            continue
        dst.mkdir(parents=True, exist_ok=True)
        # Build list of (src_file, dst_file) for parallel copy
        pairs = []
        for cls_dir in sorted(src.iterdir()):
            if not cls_dir.is_dir():
                continue
            local_cls = dst / cls_dir.name
            local_cls.mkdir(exist_ok=True)
            for f in cls_dir.iterdir():
                if f.is_file():
                    pairs.append((str(f), str(local_cls / f.name)))
        print(f"  ⬇ {name}: copying {len(pairs):,} files…")
        ct0 = time.time()
        with Pool(processes=16) as pool:
            pool.starmap(shutil.copy2, pairs, chunksize=200)
        dt = time.time() - ct0
        print(f"  ✓ {name}: {len(pairs):,} files in {dt:.0f}s "
              f"({len(pairs)/(dt+0.01):.0f} files/s)")
    print(f"\n  Total staging: {time.time()-t0:.0f}s")

    # /tmp paths used everywhere from here on
    food101 = str(local_paths["food101"])
    khana   = str(local_paths["khana"])
    deshi   = str(local_paths["deshi"])
    scraped = str(local_paths["scraped"])

    unified = "/tmp/unified_dataset"
    work    = "/tmp"
    eval_d  = "/data/evaluation"
    ckpts   = "/data/checkpoints"
    for d in [eval_d, ckpts]:
        os.makedirs(d, exist_ok=True)
    os.makedirs(unified, exist_ok=True)

    class_index = f"{work}/class_index.json"
    env = {**os.environ, "PYTHONUNBUFFERED": "1", "CURATE_USE_SYMLINKS": "1"}

    # 2. Curate (symlinks to /tmp — fast) ───────────────────────────────────
    print("\n=== Step 1/5: Curating to /tmp ===")
    subprocess.run([
        "python", "-u", str(model_dir / "curate_classes.py"),
        "--food101",    food101,
        "--khana",      khana,
        "--deshi",      deshi,
        "--scraped",    scraped,
        "--output",     unified,
        "--min_images", "100",
    ], check=True, env=env)

    # Snapshot the curate metadata to the Volume so we can recover if needed
    shutil.copy2(f"{work}/class_index.json", "/data/class_index.json")
    shutil.copy2(f"{work}/dataset_stats.csv", "/data/dataset_stats.csv")
    volume.commit()

    # 3. Train (two-phase) ───────────────────────────────────────────────────
    print("\n=== Step 2/5: Two-phase training ===")
    subprocess.run([
        "python", "-u", str(model_dir / "train.py"),
        "--dataset_dir",   unified,
        "--class_index",   class_index,
        "--output_dir",    ckpts,
        "--batch_size",    "64",         # bigger batch — A10G has 24 GB
        "--phase1_epochs", "5",
        "--phase2_epochs", "15",
        "--patience",      "3",
        "--num_workers",   "8",
    ], check=True, env=env)
    volume.commit()

    # 4. Pick best checkpoint
    pths = glob.glob(f"{ckpts}/nutrisense_*.pth")
    if not pths:
        raise RuntimeError("No checkpoint was saved by train.py")
    best = max(pths, key=lambda p: float(re.search(r"_(\d+\.\d+)_", p).group(1)))
    print(f"\nBest checkpoint: {best}")

    # 5. Ablation ────────────────────────────────────────────────────────────
    print("\n=== Step 3/5: Ablation study ===")
    subprocess.run([
        "python", "-u", str(model_dir / "ablation.py"),
        "--dataset_dir", unified,
        "--class_index", class_index,
        "--output_dir",  eval_d,
        "--epochs",      "4",
        "--batch_size",  "64",
    ], check=True, env=env)
    volume.commit()

    # 6. Evaluate + Grad-CAM ─────────────────────────────────────────────────
    print("\n=== Step 4/5: Evaluation + Grad-CAM ===")
    subprocess.run([
        "python", "-u", str(model_dir / "evaluate.py"),
        "--checkpoint",      best,
        "--dataset_dir",     unified,
        "--class_index",     class_index,
        "--output_dir",      eval_d,
        "--gradcam_samples", "25",
    ], check=True, env=env)
    volume.commit()

    # 7. Export to ONNX ──────────────────────────────────────────────────────
    print("\n=== Step 5/5: Export to ONNX ===")
    subprocess.run([
        "python", "-u", str(model_dir / "export.py"),
        "--checkpoint", best,
        "--output",     "/data/model.onnx",
    ], check=True, env=env)
    volume.commit()

    # Summary
    print("\n=== Outputs in /data ===")
    for f in [
        "model.onnx", "model_class_index.json", "class_index.json", "dataset_stats.csv",
        "evaluation/ablation_results.csv", "evaluation/results.json",
        "evaluation/confusion_matrix.png", "evaluation/per_class_accuracy.png",
    ]:
        p = f"/data/{f}"
        size = os.path.getsize(p) if os.path.exists(p) else 0
        print(f"  {'✓' if size > 0 else '✗'}  {f}  ({size:,} bytes)")

    n_gradcams = len(glob.glob(f"{eval_d}/gradcam_samples/*.png"))
    print(f"  ✓  evaluation/gradcam_samples/  ({n_gradcams} PNGs)")

    print("\nPipeline complete.")


# ── Helper: clean stale unified_dataset (run if you need a fresh curate) ───
@app.function(image=cpu_image, volumes={"/data": volume}, cpu=2.0, timeout=10 * 60)
def reset_unified():
    """Wipe /data/unified_dataset/ so curate starts from scratch."""
    import os, shutil
    target = "/data/unified_dataset"
    if os.path.exists(target):
        shutil.rmtree(target)
        print(f"✓ Removed {target}")
    for f in ["/data/class_index.json", "/data/dataset_stats.csv"]:
        if os.path.exists(f):
            os.remove(f)
            print(f"✓ Removed {f}")
    volume.commit()
    print("Ready for a fresh curate.")


# ── Smoke test: list Volume contents ───────────────────────────────────────
@app.function(image=cpu_image, volumes={"/data": volume}, cpu=1.0)
def list_volume():
    """Lists what's in /data on the Volume — useful for debugging."""
    import os
    for root, _, files in os.walk("/data", followlinks=False):
        depth = root.replace("/data", "").count("/")
        if depth > 3:
            continue
        indent = "  " * depth
        print(f"{indent}{os.path.basename(root)}/  ({len(files)} files)")
