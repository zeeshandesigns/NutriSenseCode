"""
Install a freshly-trained ONNX model into backend/data/.

Usage:
    # After `modal volume get nutrisense /model.onnx ./outputs/` etc.
    python scripts/install_model.py --src ./outputs

Or to pull directly from Modal:
    modal volume get nutrisense /model.onnx ./outputs/
    modal volume get nutrisense /class_index.json ./outputs/
    modal volume get nutrisense /model_class_index.json ./outputs/
    python scripts/install_model.py --src ./outputs

Effect:
    backend/data/model.onnx               ← from outputs/model.onnx
    backend/data/class_index.json         ← from outputs/class_index.json
                                            (or outputs/model_class_index.json)
    data/class_index.json                 ← same (so it's also referenced by
                                            curate/train re-runs locally)

After running, edit backend/.env and set:
    MOCK_MODE=false
    MODEL_PATH=./data/model.onnx
    CLASS_INDEX_PATH=./data/class_index.json
Then restart the backend and run `python backend/test_api.py` —
`model_loaded` should now be true.
"""

import argparse
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--src", required=True,
                        help="Directory containing model.onnx + class_index.json")
    args = parser.parse_args()

    src = Path(args.src)
    if not src.exists():
        raise SystemExit(f"--src directory does not exist: {src}")

    onnx_src = src / "model.onnx"
    if not onnx_src.exists():
        raise SystemExit(f"Missing {onnx_src}")

    # Class index — train.py writes class_index.json; export.py writes
    # model_class_index.json. They should be identical; prefer the latter
    # since it's embedded with the model.
    cls_src = src / "model_class_index.json"
    if not cls_src.exists():
        cls_src = src / "class_index.json"
    if not cls_src.exists():
        raise SystemExit(f"Missing class_index.json in {src}")

    backend_data = ROOT / "backend" / "data"
    backend_data.mkdir(parents=True, exist_ok=True)
    repo_data = ROOT / "data"

    targets = [
        (onnx_src, backend_data / "model.onnx"),
        (cls_src,  backend_data / "class_index.json"),
        (cls_src,  repo_data    / "class_index.json"),
    ]
    for s, d in targets:
        shutil.copy2(s, d)
        size_mb = d.stat().st_size / 1e6
        print(f"  ✓ {d}  ({size_mb:.2f} MB)")

    print("\nNext: set MOCK_MODE=false in backend/.env and restart the backend.")


if __name__ == "__main__":
    main()
