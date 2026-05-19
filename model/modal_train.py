"""
NutriSense AI — Modal training pipeline.

Runs the full Kaggle-equivalent flow (curate → train → ablate → evaluate → export)
on Modal's infrastructure. No 12-hour session cap, no flaky web UI.

Estimated cost per stage:
    setup_datasets   ~30-60 min CPU   (~$0.20)        — once per Volume
    curate           ~5-10 min CPU    (~$0.05)         — symlinks, fast
    train_pipeline   ~4-6 hrs A10G    (~$5-7)
                                      ─────
                                      ~$5.50-7.50 total

Usage:
    pip install modal
    modal token new                                    # one-time auth
    modal secret create kaggle \\
        KAGGLE_USERNAME=<your-username> \\
        KAGGLE_KEY=<your-classic-token>                # one-time secret

    modal run --detach model/modal_train.py::setup_datasets     # first time only (~30-60 min)
    modal run --detach model/modal_train.py::curate              # ~5-10 min CPU
    modal run --detach model/modal_train.py::train_pipeline      # ~4-6 hrs GPU

    # --detach is critical for long runs: it tells Modal to keep the function
    # running even if your local terminal disconnects (Wi-Fi blip, laptop sleep,
    # closing the shell, etc.). Without --detach, any local disconnect cancels
    # the run mid-flight. We learned this the hard way.

    # curate is split out of train_pipeline because:
    # 1. It's CPU work only — running it on A10G wasted ~$1/hr while we waited.
    # 2. The first attempt had curate burn 90 min before we caught that
    #    shutil.copy2 across 264K files on a Modal Volume is glacially slow
    #    (~3 files/sec = ~23 hours). curate_classes.py now uses os.symlink
    #    which is O(1) per file.

    # Fetch outputs to your machine:
    modal volume get nutrisense /model.onnx                   ./outputs/
    modal volume get nutrisense /class_index.json             ./outputs/
    modal volume get nutrisense /evaluation                   ./outputs/ --recursive

To upgrade to A100 (~2x faster, ~2x cost), change gpu="A10G" → gpu="A100".
To upgrade to H100 (~4x faster, ~3.5x cost), change to gpu="H100".
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


# ── Step 2: curate unified dataset (CPU only — symlinks, fast) ─────────────
@app.function(
    image=cpu_image,
    volumes={"/data": volume},
    timeout=2 * 60 * 60,
    cpu=4.0,
    memory=4096,
)
def curate():
    """Build the unified_dataset using symlinks. ~5-10 min for 264K files."""
    import os, subprocess
    from pathlib import Path

    # Clone the latest curate_classes.py
    code_dir = Path("/tmp/nutrisense")
    if not code_dir.exists():
        print("Cloning repo…")
        subprocess.run(
            ["git", "clone", "--depth", "1", REPO_URL, str(code_dir)],
            check=True,
        )
    model_dir = code_dir / "model"

    raw = Path("/data/raw")
    food101 = str(raw / "kmader/food41/images")
    khana   = str(raw / "kashyap077/indian-food/Images")
    deshi   = str(raw / "shaidurpranto/deshifoodbd/food_data_english/food_data_english/images")
    scraped = str(raw / "sameen03/nutrisense-scraped/scraped")

    print("=== Path verification ===")
    for name, p in [("FOOD101", food101), ("KHANA", khana),
                    ("DESHI",  deshi),    ("SCRAPED", scraped)]:
        ok = os.path.exists(p)
        print(f"  {'✓' if ok else '✗ MISSING'}  {name}: {p}")
        if not ok:
            raise RuntimeError(f"Missing input: {p} — run setup_datasets first")

    unified = "/data/unified_dataset"
    os.makedirs(unified, exist_ok=True)

    env = {**os.environ, "PYTHONUNBUFFERED": "1", "CURATE_USE_SYMLINKS": "1"}

    print("\n=== Curating with symlinks ===")
    subprocess.run([
        "python", "-u", str(model_dir / "curate_classes.py"),
        "--food101",    food101,
        "--khana",      khana,
        "--deshi",      deshi,
        "--scraped",    scraped,
        "--output",     unified,
        "--min_images", "100",
    ], check=True, env=env)

    volume.commit()

    # Summary
    classes = sorted(os.listdir(unified))
    total = sum(len(os.listdir(os.path.join(unified, c))) for c in classes
                if os.path.isdir(os.path.join(unified, c)))
    print(f"\n✓ Curate complete: {len(classes)} classes, {total:,} total entries")


# ── Step 3: train, ablate, evaluate, export — pure GPU work ────────────────
@app.function(
    image=gpu_image,
    gpu="A10G",                       # A100 or H100 for faster (and more $$$)
    volumes={"/data": volume},
    timeout=10 * 60 * 60,             # 10 hr cap
    cpu=4.0,
    memory=16384,
)
def train_pipeline():
    """Train → Ablate → Evaluate → Export ONNX. Assumes `curate` has already run."""
    import glob, os, re, subprocess
    from pathlib import Path

    code_dir = Path("/tmp/nutrisense")
    if not code_dir.exists():
        print("Cloning repo…")
        subprocess.run(
            ["git", "clone", "--depth", "1", REPO_URL, str(code_dir)],
            check=True,
        )
    model_dir = code_dir / "model"

    unified = "/data/unified_dataset"
    work    = "/data"
    eval_d  = "/data/evaluation"
    ckpts   = "/data/checkpoints"
    for d in [eval_d, ckpts]:
        os.makedirs(d, exist_ok=True)

    class_index = f"{work}/class_index.json"

    # Sanity checks
    if not os.path.exists(unified) or not os.listdir(unified):
        raise RuntimeError("unified_dataset is empty — run `curate` first")
    if not os.path.exists(class_index):
        raise RuntimeError(f"{class_index} not found — run `curate` first")

    env = {**os.environ, "PYTHONUNBUFFERED": "1"}

    # 1. Train (two-phase) ───────────────────────────────────────────────────
    print("\n=== Step 1/4: Two-phase training ===")
    subprocess.run([
        "python", "-u", str(model_dir / "train.py"),
        "--dataset_dir",   unified,
        "--class_index",   class_index,
        "--output_dir",    ckpts,
        "--batch_size",    "64",         # bigger batch — A10G has 24 GB
        "--phase1_epochs", "5",
        "--phase2_epochs", "15",
        "--patience",      "3",
        "--num_workers",   "4",
    ], check=True, env=env)
    volume.commit()

    # 2. Pick best checkpoint
    pths = glob.glob(f"{ckpts}/nutrisense_*.pth")
    if not pths:
        raise RuntimeError("No checkpoint was saved by train.py")
    best = max(pths, key=lambda p: float(re.search(r"_(\d+\.\d+)_", p).group(1)))
    print(f"\nBest checkpoint: {best}")

    # 3. Ablation ────────────────────────────────────────────────────────────
    print("\n=== Step 2/4: Ablation study ===")
    subprocess.run([
        "python", "-u", str(model_dir / "ablation.py"),
        "--dataset_dir", unified,
        "--class_index", class_index,
        "--output_dir",  eval_d,
        "--epochs",      "4",
        "--batch_size",  "64",
    ], check=True, env=env)
    volume.commit()

    # 4. Evaluate + Grad-CAM ─────────────────────────────────────────────────
    print("\n=== Step 3/4: Evaluation + Grad-CAM ===")
    subprocess.run([
        "python", "-u", str(model_dir / "evaluate.py"),
        "--checkpoint",      best,
        "--dataset_dir",     unified,
        "--class_index",     class_index,
        "--output_dir",      eval_d,
        "--gradcam_samples", "25",
    ], check=True, env=env)
    volume.commit()

    # 5. Export to ONNX ──────────────────────────────────────────────────────
    print("\n=== Step 4/4: Export to ONNX ===")
    subprocess.run([
        "python", "-u", str(model_dir / "export.py"),
        "--checkpoint", best,
        "--output",     f"{work}/model.onnx",
    ], check=True, env=env)
    volume.commit()

    # Summary
    print("\n=== Outputs in /data ===")
    for f in [
        "model.onnx", "model_class_index.json", "class_index.json", "dataset_stats.csv",
        "evaluation/ablation_results.csv", "evaluation/results.json",
        "evaluation/confusion_matrix.png", "evaluation/per_class_accuracy.png",
    ]:
        p = f"{work}/{f}"
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
