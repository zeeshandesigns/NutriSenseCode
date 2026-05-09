"""
Exports the best PyTorch checkpoint to ONNX for CPU inference on Render.
PyTorch is NOT needed at runtime after this — only onnxruntime.

Usage:
    python export.py \
        --checkpoint nutrisense_0.82_ep12.pth \
        --output     model.onnx
"""

import argparse
import json

import torch

from model import build_model


def export_onnx(checkpoint_path: str, output_path: str):
    ckpt = torch.load(checkpoint_path, map_location="cpu")
    class_index = ckpt["class_index"]
    num_classes = len(class_index)

    model = build_model(num_classes)
    model.load_state_dict(ckpt["state_dict"])
    model.eval()

    dummy = torch.zeros(1, 3, 224, 224)
    torch.onnx.export(
        model,
        dummy,
        output_path,
        input_names=["image"],
        output_names=["logits"],
        dynamic_axes={"image": {0: "batch"}, "logits": {0: "batch"}},
        opset_version=17,
    )

    # Embed class index alongside the model file
    index_path = output_path.replace(".onnx", "_class_index.json")
    with open(index_path, "w", encoding="utf-8") as f:
        json.dump(class_index, f, indent=2, ensure_ascii=False)

    val_acc = ckpt.get("val_acc")
    val_acc_str = f"{val_acc:.4f}" if isinstance(val_acc, (int, float)) else "?"
    print(f"ONNX model   → {output_path}")
    print(f"Class index  → {index_path}")
    print(f"Classes: {num_classes}  Val acc at export: {val_acc_str}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--checkpoint", required=True)
    parser.add_argument("--output",     default="model.onnx")
    args = parser.parse_args()
    export_onnx(args.checkpoint, args.output)
