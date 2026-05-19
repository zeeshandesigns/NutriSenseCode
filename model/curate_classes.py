"""
Merges Food-101, Khana 2025, DeshiFoodBD, self-scraped, and the Tahir 2020
Pakistani dataset into one unified directory.

Steps:
1. Normalise class folder names (spaces/hyphens → underscores, lowercase)
2. Apply alias map to merge duplicate class names across datasets
3. Drop classes with < min_images after merging
4. Write class_index.json (alphabetically sorted, deterministic) and dataset_stats.csv

Usage:
    python curate_classes.py \
        --food101     /path/to/food-101/images \
        --khana       /path/to/khana \
        --deshi       /path/to/deshifoodbd \
        --scraped     ./scraped \
        --pakdataset  /path/to/pakistani-food-dataset \
        --output      ./unified_dataset \
        --min_images  300
"""

import argparse
import csv
import json
import os
import shutil
from pathlib import Path

# Modal Volume copies are slow (~3 files/sec for many small files).
# Symlinks are O(1) regardless of file count and PIL/torchvision read
# through them transparently. Falls back to copy on filesystems that
# don't support symlinks (e.g. Windows without dev mode).
USE_SYMLINKS = os.environ.get("CURATE_USE_SYMLINKS", "1") == "1"

# Maps non-canonical source names → canonical label used in training
ALIAS_MAP = {
    "fried_rice":     "biryani",
    "biryani_rice":   "biryani",
    "nehari":         "nihari_lahori",
    "roshogolla":     "gulab_jamun",
    "paratha":        "aloo_paratha",
    "daal_mash":      "daal",
    "daal_chana":     "daal",
    "dal":            "daal",
    "naan":           "naan_bread",
    "bread_naan":     "naan_bread",
}

IMG_EXTS = {".jpg", ".jpeg", ".png", ".webp"}


def normalise(name: str) -> str:
    return name.lower().replace(" ", "_").replace("-", "_")


def canonical(name: str) -> str:
    n = normalise(name)
    return ALIAS_MAP.get(n, n)


def copy_images(src: Path, dest: Path, label: str) -> int:
    if not src.exists():
        return 0
    dest.mkdir(parents=True, exist_ok=True)
    count = 0
    for img in src.iterdir():
        if img.suffix.lower() in IMG_EXTS:
            dst_path = dest / f"{label}_{img.stem}{img.suffix}"
            if dst_path.exists() or dst_path.is_symlink():
                continue
            if USE_SYMLINKS:
                try:
                    os.symlink(img.resolve(), dst_path)
                except OSError:
                    shutil.copy2(img, dst_path)
            else:
                shutil.copy2(img, dst_path)
            count += 1
    return count


def ingest_dataset(root: Path, output: Path, tag: str) -> dict[str, int]:
    if not root or not root.exists():
        print(f"  Skipping {tag}: path not found")
        return {}
    totals: dict[str, int] = {}
    for class_dir in sorted(root.iterdir()):
        if not class_dir.is_dir():
            continue
        label = canonical(class_dir.name)
        dest = output / label
        n = copy_images(class_dir, dest, label)
        if n:
            totals[label] = totals.get(label, 0) + n
    print(f"  [{tag}] contributed {sum(totals.values())} images across {len(totals)} classes")
    return totals


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--food101",    default=None)
    parser.add_argument("--khana",      default=None)
    parser.add_argument("--deshi",      default=None)
    parser.add_argument("--scraped",    default=None)
    parser.add_argument("--pakdataset", default=None)
    parser.add_argument("--output",     required=True)
    parser.add_argument("--min_images", type=int, default=300)
    args = parser.parse_args()

    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True)

    print("=== Ingesting datasets ===")
    for path, tag in [
        (args.food101,    "Food-101"),
        (args.khana,      "Khana-2025"),
        (args.deshi,      "DeshiFoodBD"),
        (args.scraped,    "Self-scraped"),
        (args.pakdataset, "Pakistani-dataset"),
    ]:
        ingest_dataset(Path(path) if path else None, output, tag)

    print("\n=== Applying minimum image filter ===")
    stats = []
    dropped = []
    for class_dir in sorted(output.iterdir()):
        if not class_dir.is_dir():
            continue
        imgs = [f for f in class_dir.iterdir() if f.suffix.lower() in IMG_EXTS]
        n = len(imgs)
        if n < args.min_images:
            shutil.rmtree(class_dir)
            dropped.append((class_dir.name, n))
        else:
            stats.append((class_dir.name, n))

    if dropped:
        print(f"Dropped {len(dropped)} under-represented classes:")
        for name, n in dropped:
            print(f"  {name}: {n} images (need {args.min_images})")

    stats.sort(key=lambda x: x[0])

    # Write class_index.json
    class_index = {str(i): name for i, (name, _) in enumerate(stats)}
    index_path = Path(args.output).parent / "class_index.json"
    with open(index_path, "w", encoding="utf-8") as f:
        json.dump(class_index, f, indent=2, ensure_ascii=False)

    # Write dataset_stats.csv
    stats_path = Path(args.output).parent / "dataset_stats.csv"
    with open(stats_path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["index", "label", "image_count"])
        for i, (name, n) in enumerate(stats):
            w.writerow([i, name, n])

    total = sum(n for _, n in stats)
    print(f"\n=== Final dataset ===")
    print(f"Classes: {len(stats)}")
    print(f"Total images: {total:,}")
    print(f"Mean per class: {total // max(len(stats), 1):,}")
    print(f"Min per class: {min(n for _, n in stats) if stats else 0}")
    print(f"\nclass_index.json → {index_path}")
    print(f"dataset_stats.csv → {stats_path}")


if __name__ == "__main__":
    main()
