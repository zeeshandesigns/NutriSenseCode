"""
Full evaluation of the best checkpoint.

Produces:
  results.json              — top-1 / top-3 accuracy, per-class accuracy
  confusion_matrix.png      — heatmap (top-40 most-confused classes if > 40 total)
  per_class_accuracy.png    — sorted bar chart with mean line
  evaluation/gradcam_samples/ — blended Grad-CAM PNGs (one per class)
  gradcam_index.json        — {label: supabase_url} after upload

Usage:
    python evaluate.py \
        --checkpoint   /kaggle/working/nutrisense_0.82_ep12.pth \
        --dataset_dir  /kaggle/input/nutrisense-unified \
        --class_index  /kaggle/working/class_index.json \
        --output_dir   /kaggle/working/evaluation \
        --gradcam_samples 15
"""

import argparse
import json
import os
import random

import matplotlib.pyplot as plt
import numpy as np
import seaborn as sns
import torch
from PIL import Image
from sklearn.metrics import confusion_matrix
from torch.utils.data import DataLoader

from torch.utils.data import random_split

from dataset import FoodDataset, get_transforms
from gradcam import generate_gradcam
from model import build_model

IMG_EXTS = {".jpg", ".jpeg", ".png", ".webp"}

# South-Asian class labels — Grad-CAM sampling prioritises these so the
# demo always shows attention maps for desi food, not random Western dishes.
SOUTH_ASIAN_CLASSES = {
    "aloo_paratha", "anda_paratha", "biryani", "bun_kebab", "channay",
    "chapli_kebab", "chicken_karahi", "daal", "dahi_bhalla", "doodh_patti",
    "gol_gappa", "gulab_jamun", "haleem", "halwa_puri", "jalebi", "karahi",
    "kheer", "naan_bread", "nihari_lahori", "paya", "rabri", "sajji",
    "samosa", "shami_kebab", "suji_halwa",
}


@torch.no_grad()
def run_eval(model, loader, device):
    model.eval()
    all_preds, all_labels, all_top3 = [], [], []
    for images, labels in loader:
        images = images.to(device)
        out = model(images)
        top3 = out.topk(3, dim=1).indices.cpu().tolist()
        all_preds.extend([t[0] for t in top3])
        all_labels.extend(labels.tolist())
        all_top3.extend(top3)
    return np.array(all_preds), np.array(all_labels), all_top3


def plot_confusion_matrix(cm_arr, class_names, path, max_classes=40):
    if len(class_names) > max_classes:
        errs = cm_arr.copy()
        np.fill_diagonal(errs, 0)
        idx = np.argsort(errs.sum(axis=1))[-max_classes:]
        cm_arr = cm_arr[np.ix_(idx, idx)]
        class_names = [class_names[i] for i in idx]

    fig, ax = plt.subplots(figsize=(max(12, len(class_names) // 2),
                                    max(10, len(class_names) // 2)))
    sns.heatmap(cm_arr, annot=len(class_names) <= 20, fmt="d",
                xticklabels=class_names, yticklabels=class_names,
                cmap="Blues", ax=ax)
    ax.set_xlabel("Predicted")
    ax.set_ylabel("True")
    ax.set_title("Confusion Matrix")
    plt.tight_layout()
    fig.savefig(path, dpi=150)
    plt.close(fig)
    print(f"Confusion matrix → {path}")


def plot_per_class(per_class_acc, class_names, path):
    pairs = sorted(zip(class_names, per_class_acc), key=lambda x: x[1])
    names, accs = zip(*pairs)
    fig, ax = plt.subplots(figsize=(10, max(6, len(names) * 0.22)))
    ax.barh(names, [a * 100 for a in accs], color="steelblue")
    ax.axvline(np.mean(accs) * 100, color="red", linestyle="--",
               label=f"Mean {np.mean(accs) * 100:.1f}%")
    ax.set_xlabel("Top-1 Accuracy (%)")
    ax.set_title("Per-Class Accuracy")
    ax.legend()
    plt.tight_layout()
    fig.savefig(path, dpi=150)
    plt.close(fig)
    print(f"Per-class chart → {path}")


def generate_gradcam_samples(model, dataset_dir, class_index, output_dir, n=15):
    import pathlib
    gc_dir = os.path.join(output_dir, "gradcam_samples")
    os.makedirs(gc_dir, exist_ok=True)

    label_to_idx = {v: int(k) for k, v in class_index.items()}
    sa_samples, other_samples = [], []
    for label, idx in label_to_idx.items():
        class_dir = pathlib.Path(dataset_dir) / label
        if class_dir.exists():
            imgs = [p for p in class_dir.iterdir() if p.suffix.lower() in IMG_EXTS]
            if imgs:
                entry = (random.choice(imgs), label, idx)
                (sa_samples if label in SOUTH_ASIAN_CLASSES else other_samples).append(entry)

    random.shuffle(sa_samples)
    random.shuffle(other_samples)
    # Prioritise South-Asian classes; fill remainder with others
    selected = sa_samples[:n] + other_samples[: max(0, n - len(sa_samples))]
    print(f"  Grad-CAM picks: {len(selected)} total ({sum(1 for s in selected if s[1] in SOUTH_ASIAN_CLASSES)} South Asian)")
    model_cpu = model.cpu()

    for img_path, label, idx in selected:
        try:
            img = Image.open(img_path).convert("RGB")
            overlay = generate_gradcam(model_cpu, img, target_class=idx)

            fig, axes = plt.subplots(1, 2, figsize=(8, 4))
            axes[0].imshow(img);      axes[0].set_title("Original"); axes[0].axis("off")
            axes[1].imshow(overlay);  axes[1].set_title("Grad-CAM"); axes[1].axis("off")
            fig.suptitle(label.replace("_", " ").title())

            out_path = os.path.join(gc_dir, f"{label}_gradcam.png")
            fig.savefig(out_path, dpi=120, bbox_inches="tight")
            plt.close(fig)
            print(f"  Grad-CAM saved: {out_path}")
        except Exception as e:
            print(f"  Skipped {label}: {e}")

    return gc_dir


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--checkpoint",      required=True)
    parser.add_argument("--dataset_dir",     required=True)
    parser.add_argument("--class_index",     required=True)
    parser.add_argument("--output_dir",      default="./evaluation")
    parser.add_argument("--batch_size",      type=int, default=32)
    parser.add_argument("--num_workers",     type=int, default=2)
    parser.add_argument("--gradcam_samples", type=int, default=15)
    args = parser.parse_args()

    os.makedirs(args.output_dir, exist_ok=True)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    with open(args.class_index, encoding="utf-8") as f:
        class_index = json.load(f)
    num_classes = len(class_index)
    class_names = [class_index[str(i)] for i in range(num_classes)]

    ckpt = torch.load(args.checkpoint, map_location=device)
    model = build_model(num_classes)
    model.load_state_dict(ckpt["state_dict"])
    model.to(device)

    full = FoodDataset(args.dataset_dir, class_index, augment=False)
    val_size = int(len(full) * 0.2)
    train_size = len(full) - val_size
    _, val_ds = random_split(
        full, [train_size, val_size],
        generator=torch.Generator().manual_seed(42),
    )
    val_loader = DataLoader(val_ds, batch_size=args.batch_size,
                            shuffle=False, num_workers=args.num_workers)
    print(f"Eval set: {len(val_ds):,} images (held-out 20% split, seed=42)")

    print("Running evaluation…")
    preds, labels, top3_preds = run_eval(model, val_loader, device)

    top1 = (preds == labels).mean()
    top3 = np.mean([labels[i] in top3_preds[i] for i in range(len(labels))])
    print(f"Top-1: {top1*100:.2f}%   Top-3: {top3*100:.2f}%")

    per_class_acc = []
    for i in range(num_classes):
        mask = labels == i
        per_class_acc.append(float((preds[mask] == i).mean()) if mask.sum() else 0.0)

    sorted_idx = np.argsort(per_class_acc)
    print("\nWorst 5:", [f"{class_names[i]} {per_class_acc[i]*100:.1f}%" for i in sorted_idx[:5]])
    print("Best  5:", [f"{class_names[i]} {per_class_acc[i]*100:.1f}%" for i in sorted_idx[-5:]])

    cm_arr = confusion_matrix(labels, preds, labels=list(range(num_classes)))
    plot_confusion_matrix(cm_arr, class_names,
                          os.path.join(args.output_dir, "confusion_matrix.png"))
    plot_per_class(per_class_acc, class_names,
                   os.path.join(args.output_dir, "per_class_accuracy.png"))

    results = {
        "top1_accuracy": round(float(top1), 4),
        "top3_accuracy": round(float(top3), 4),
        "num_classes": num_classes,
        "per_class": {class_names[i]: round(per_class_acc[i], 4) for i in range(num_classes)},
    }
    with open(os.path.join(args.output_dir, "results.json"), "w") as f:
        json.dump(results, f, indent=2)
    print(f"results.json → {args.output_dir}")

    print(f"\nGenerating {args.gradcam_samples} Grad-CAM samples…")
    generate_gradcam_samples(model, args.dataset_dir, class_index,
                             args.output_dir, args.gradcam_samples)
    print("\nEvaluation complete. Download evaluation/ from Kaggle output.")


if __name__ == "__main__":
    main()
