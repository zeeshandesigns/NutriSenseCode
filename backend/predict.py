import json
import os
import random
import time

import numpy as np
from PIL import Image
from io import BytesIO

from config import CLASS_INDEX_PATH, CONFIDENCE_THRESHOLD, MOCK_MODE, MODEL_PATH

IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
IMAGENET_STD  = np.array([0.229, 0.224, 0.225], dtype=np.float32)

_session = None
_class_index: dict[str, str] = {}


def load_model():
    global _session, _class_index

    with open(CLASS_INDEX_PATH, encoding="utf-8") as f:
        _class_index = json.load(f)

    if MOCK_MODE:
        print(f"[MOCK] Model not loaded — mock predictions enabled ({len(_class_index)} classes)")
        return

    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(
            f"Model file not found: {MODEL_PATH}\n"
            "Run model training on Modal (model/modal_train.py) and copy model.onnx here, "
            "or set MOCK_MODE=true in .env for development."
        )

    import onnxruntime as ort
    _session = ort.InferenceSession(MODEL_PATH, providers=["CPUExecutionProvider"])
    print(f"Model loaded: {MODEL_PATH} ({len(_class_index)} classes)")


def _preprocess(image_bytes: bytes) -> np.ndarray:
    img = Image.open(BytesIO(image_bytes)).convert("RGB")
    img = img.resize((224, 224), Image.BILINEAR)
    arr = np.array(img, dtype=np.float32) / 255.0
    arr = (arr - IMAGENET_MEAN) / IMAGENET_STD
    arr = arr.transpose(2, 0, 1)[np.newaxis, ...]
    return arr


def _softmax(logits: np.ndarray) -> np.ndarray:
    e = np.exp(logits - logits.max())
    return e / e.sum()


def _mock_inference() -> dict:
    """Returns a realistic fake prediction for development without a trained model."""
    south_asian = [
        v for v in _class_index.values()
        if v in {
            "biryani", "karahi", "chicken_karahi", "halwa_puri", "nihari_lahori",
            "samosa", "haleem", "chapli_kebab", "shami_kebab", "naan_bread",
            "daal", "channay", "paya", "sajji", "jalebi", "gulab_jamun",
            "kheer", "gol_gappa", "dahi_bhalla", "aloo_paratha",
        }
    ]
    all_labels = list(_class_index.values())
    top1_label = random.choice(south_asian) if south_asian else random.choice(all_labels)
    top1_conf = round(random.uniform(0.62, 0.96), 4)

    # Generate two plausible alternatives with lower confidence
    others = [v for v in all_labels if v != top1_label]
    alt1, alt2 = random.sample(others, 2)
    remaining = round(1 - top1_conf, 4)
    alt1_conf = round(remaining * random.uniform(0.5, 0.8), 4)
    alt2_conf = round(remaining - alt1_conf, 4)

    top3 = [
        {"label": top1_label, "confidence": top1_conf},
        {"label": alt1,       "confidence": alt1_conf},
        {"label": alt2,       "confidence": alt2_conf},
    ]
    return {
        "top_prediction": top3[0],
        "top_3": top3,
        "low_confidence": top1_conf < CONFIDENCE_THRESHOLD,
        "processing_time_ms": random.randint(180, 420),
    }


def run_inference(image_bytes: bytes) -> dict:
    if MOCK_MODE:
        time.sleep(0.2)  # simulate latency
        return _mock_inference()

    t0 = time.perf_counter()
    tensor = _preprocess(image_bytes)
    input_name = _session.get_inputs()[0].name
    logits = _session.run(None, {input_name: tensor})[0][0]
    probs = _softmax(logits)
    top3_idx = probs.argsort()[::-1][:3]
    top3 = [
        {"label": _class_index[str(i)], "confidence": round(float(probs[i]), 4)}
        for i in top3_idx
    ]
    return {
        "top_prediction": top3[0],
        "top_3": top3,
        "low_confidence": top3[0]["confidence"] < CONFIDENCE_THRESHOLD,
        "processing_time_ms": round((time.perf_counter() - t0) * 1000),
    }


def get_class_index() -> dict:
    return _class_index


def is_model_loaded() -> bool:
    return _session is not None
