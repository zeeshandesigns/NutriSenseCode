"""
NutriSense AI — Modal training pipeline.

Runs the full Kaggle-equivalent flow (curate → train → ablate → evaluate → export)
on Modal's GPU infrastructure. No 12-hour session cap, no flaky web UI.

Estimated cost on A10G ($1.10/hr) for the full pipeline:
    setup_datasets   ~30-60 min CPU   (~$0.20)
    train_pipeline   ~4-6 hrs A10G    (~$5-7)
                                      ─────
                                      ~$5.50-7.50 total

Usage:
    pip install modal
    modal token new                                    # one-time auth
    modal secret create kaggle \\
        KAGGLE_USERNAME=<your-username> \\
        KAGGLE_KEY=<your-classic-token>                # one-time secret

    modal run model/modal_train.py::setup_datasets     # first time only (~30-60 min)
    modal run model/modal_train.py::train_pipeline     # ~4-6 hrs

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
    .pip_install("kaggle>=1.6.0")
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
        # Skip if directory exists and is non-empty
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


# ── Step 2: end-to-end training pipeline on a GPU ──────────────────────────
@app.function(
    image=gpu_image,
    gpu="A10G",                       # A100 or H100 for faster (and more $$$)
    volumes={"/data": volume},
    timeout=10 * 60 * 60,             # 10 hr cap; pipeline expected ~4-6 hrs
    cpu=4.0,
    memory=16384,
)
def train_pipeline():
    """End-to-end: curate → train → ablate → evaluate → export ONNX."""
    import glob, os, re, subprocess
    from pathlib import Path

    # 1. Pull latest model/ scripts from GitHub
    code_dir = Path("/tmp/nutrisense")
    if not code_dir.exists():
        print("Cloning repo…")
        subprocess.run(
            ["git", "clone", "--depth", "1", REPO_URL, str(code_dir)],
            check=True,
        )
    model_dir = code_dir / "model"

    # 2. Define paths
    raw     = Path("/data/raw")
    unified = "/data/unified_dataset"
    work    = "/data"
    eval_d  = "/data/evaluation"
    ckpts   = "/data/checkpoints"
    for d in [unified, eval_d, ckpts]:
        os.makedirs(d, exist_ok=True)

    food101 = str(raw / "kmader/food41/images")
    khana   = str(raw / "kashyap077/indian-food/Images")
    deshi   = str(raw / "shaidurpranto/deshifoodbd/food_data_english/food_data_english/images")
    scraped = str(raw / "sameen03/nutrisense-scraped/scraped")

    # 3. Sanity-check paths before burning GPU time
    print("=== Path verification ===")
    all_ok = True
    for name, p in [("FOOD101", food101), ("KHANA", khana),
                    ("DESHI",  deshi),    ("SCRAPED", scraped)]:
        ok = os.path.exists(p)
        print(f"  {'✓' if ok else '✗ MISSING'}  {name}: {p}")
        all_ok = all_ok and ok
    if not all_ok:
        raise RuntimeError("Some dataset paths missing — run `setup_datasets` first")

    env = {**os.environ, "PYTHONUNBUFFERED": "1"}
    class_index = f"{work}/class_index.json"

    # 4. Curate ──────────────────────────────────────────────────────────────
    print("\n=== Step 1/5: Curating datasets ===")
    subprocess.run([
        "python", str(model_dir / "curate_classes.py"),
        "--food101",     food101,
        "--khana",       khana,
        "--deshi",       deshi,
        "--scraped",     scraped,
        "--output",      unified,
        "--min_images",  "100",
    ], check=True, env=env)
    volume.commit()  # snapshot in case training crashes

    # 5. Train (two-phase) ───────────────────────────────────────────────────
    print("\n=== Step 2/5: Two-phase training ===")
    subprocess.run([
        "python", str(model_dir / "train.py"),
        "--dataset_dir",   unified,
        "--class_index",   class_index,
        "--output_dir",    ckpts,
        "--batch_size",    "64",        # bigger batch — A10G has 24 GB
        "--phase1_epochs", "5",
        "--phase2_epochs", "15",
        "--patience",      "3",
        "--num_workers",   "4",
    ], check=True, env=env)
    volume.commit()

    # 6. Pick best checkpoint
    pths = glob.glob(f"{ckpts}/nutrisense_*.pth")
    if not pths:
        raise RuntimeError("No checkpoint was saved by train.py")
    best = max(pths, key=lambda p: float(re.search(r"_(\d+\.\d+)_", p).group(1)))
    print(f"\nBest checkpoint: {best}")

    # 7. Ablation ────────────────────────────────────────────────────────────
    print("\n=== Step 3/5: Ablation study ===")
    subprocess.run([
        "python", str(model_dir / "ablation.py"),
        "--dataset_dir", unified,
        "--class_index", class_index,
        "--output_dir",  eval_d,
        "--epochs",      "4",     # trimmed from 8 — still meaningful comparison
        "--batch_size",  "64",
    ], check=True, env=env)
    volume.commit()

    # 8. Evaluate + Grad-CAM ─────────────────────────────────────────────────
    print("\n=== Step 4/5: Evaluation + Grad-CAM ===")
    subprocess.run([
        "python", str(model_dir / "evaluate.py"),
        "--checkpoint",      best,
        "--dataset_dir",     unified,
        "--class_index",     class_index,
        "--output_dir",      eval_d,
        "--gradcam_samples", "25",
    ], check=True, env=env)
    volume.commit()

    # 9. Export to ONNX ──────────────────────────────────────────────────────
    print("\n=== Step 5/5: Export to ONNX ===")
    subprocess.run([
        "python", str(model_dir / "export.py"),
        "--checkpoint", best,
        "--output",     f"{work}/model.onnx",
    ], check=True, env=env)
    volume.commit()

    # 10. Summary ────────────────────────────────────────────────────────────
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
    print("Fetch outputs:")
    print("  modal volume get nutrisense /model.onnx ./outputs/")
    print("  modal volume get nutrisense /class_index.json ./outputs/")
    print("  modal volume get nutrisense /evaluation ./outputs/ --recursive")


# ── Optional: a tiny smoke test that doesn't burn GPU time ─────────────────
@app.function(image=cpu_image, volumes={"/data": volume}, cpu=1.0)
def list_volume():
    """Quick sanity check — lists what's in /data on the Volume."""
    import os
    for root, _, files in os.walk("/data", followlinks=False):
        depth = root.replace("/data", "").count("/")
        if depth > 3:
            continue
        indent = "  " * depth
        print(f"{indent}{os.path.basename(root)}/  ({len(files)} files)")
