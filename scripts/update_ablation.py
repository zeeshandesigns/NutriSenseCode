"""
Replace placeholder ablation tables in the 3 frontend files with real numbers
from a freshly-trained ablation_results.csv.

Usage:
    modal volume get nutrisense /evaluation/ablation_results.csv ./outputs/
    python scripts/update_ablation.py --src ./outputs/ablation_results.csv

Effect:
    web/src/pages/Landing.tsx          → ABLATION array updated
    web/src/pages/Profile.tsx          → ABLATION array updated
    mobile/app/(tabs)/profile/model.tsx → ABLATION array updated

CSV format (output of model/ablation.py):
    model,params_M,top1_acc,top3_acc,train_time_min
    EfficientNetB0,5.3,80.62,93.21,42.5
    MobileNetV2,3.4,74.10,89.05,38.2
    ResNet50,25.6,76.20,90.30,72.1
"""

import argparse
import csv
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

TARGETS = [
    ROOT / "web" / "src" / "pages" / "Landing.tsx",
    ROOT / "web" / "src" / "pages" / "Profile.tsx",
    ROOT / "mobile" / "app" / "(tabs)" / "profile" / "model.tsx",
]

ABLATION_BLOCK_RE = re.compile(
    r"(const ABLATION = \[)(.*?)(\])",
    re.DOTALL,
)


def format_row(row: dict, highlight: bool) -> str:
    model = row["model"]
    if highlight:
        model = f"{model} (ours)"
    return (
        "  { "
        f'model: "{model}", '
        f'params: "{float(row["params_M"]):.1f}M", '
        f'top1: "{float(row["top1_acc"]):.1f}%", '
        f'top3: "{float(row["top3_acc"]):.1f}%", '
        f"highlight: {'true' if highlight else 'false'} "
        "},\n"
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--src", required=True, help="Path to ablation_results.csv")
    args = parser.parse_args()

    with open(args.src, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    if not rows:
        raise SystemExit("ablation_results.csv is empty")

    # EfficientNetB0 is the highlighted one (our claim)
    new_block = "\n" + "".join(
        format_row(r, highlight=r["model"].startswith("EfficientNetB0"))
        for r in rows
    )

    for target in TARGETS:
        if not target.exists():
            print(f"  ⚠ skipping (not found): {target}")
            continue
        text = target.read_text(encoding="utf-8")
        if not ABLATION_BLOCK_RE.search(text):
            print(f"  ⚠ no ABLATION block matched in {target}")
            continue
        new_text = ABLATION_BLOCK_RE.sub(
            lambda m: f"{m.group(1)}{new_block}{m.group(3)}",
            text, count=1,
        )
        target.write_text(new_text, encoding="utf-8")
        print(f"  ✓ updated {target}")

    print("\nReview the diff before committing — the script does a regex replace.")
    print("Suggested:  git diff web mobile")


if __name__ == "__main__":
    main()
