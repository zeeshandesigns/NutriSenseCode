# NutriSense AI — Backend & AI Build Guide

> **For the AI:** You are building the backend and ML pipeline for NutriSense AI — a Pakistani and South Asian food recognition system. Read this entire document before writing a single line of code. Every decision here has a reason. Do not substitute libraries, change endpoint paths, or alter the response shape without coordinating with the frontend team — they are building against a fixed contract.
>
> **For the developer:** Give this file + `CONTEXT.md` to your AI at the start of each session. Say: *"I am working on Phase X. Build it exactly as specified."*

---

## Project Overview

NutriSense AI lets users photograph Pakistani and South Asian dishes to identify them and understand their nutritional context. The frontend (React Native + Expo mobile app, React + Vite web dashboard) is handled by a separate team. Your job is to:

1. Build and train the EfficientNetB0 CNN model (on Kaggle)
2. Build the Flask REST API that serves predictions (on Render)
3. Set up Supabase (schema, storage buckets)

---

## What the Frontend Consumes (do not change these contracts)

### POST /predict

```
Request: multipart/form-data
  image     File    JPEG or PNG, already compressed to <500KB by the client
  user_goal string  'weight_loss' | 'muscle_gain' | 'curious'

Response 200:
{
  "top_prediction": { "label": "chicken_karahi", "confidence": 0.91 },
  "top_3": [
    { "label": "chicken_karahi", "confidence": 0.91 },
    { "label": "chicken_handi",  "confidence": 0.06 },
    { "label": "butter_chicken", "confidence": 0.03 }
  ],
  "low_confidence": false,
  "nutrition": { "calories": 320, "protein": 28, "carbs": 8, "fat": 19 },
  "insight": "Karahi is a high-protein dish — well suited to your muscle-gain goal...",
  "gradcam_sample_url": "https://...supabase.co/storage/v1/object/public/gradcam/chicken_karahi.png",
  "processing_time_ms": 1240
}

Response 400: { "error": "No image file in request" }
```

Rules the frontend depends on:
- `low_confidence: true` when `top_prediction.confidence < 0.70`
- `gradcam_sample_url` is optional — omit the key if no precomputed image exists
- Food labels use underscores: `"chicken_karahi"`, `"halwa_puri"` — frontend converts to display names
- `nutrition` must always be a valid JSON object (not null); use `{"calories": 0, "protein": 0, "carbs": 0, "fat": 0, "note": "unavailable"}` as fallback

### GET /health
```json
{ "status": "ok", "model_loaded": true, "classes": 100 }
```

### GET /classes
```json
{ "0": "biryani", "1": "chicken_karahi", "2": "halwa_puri" }
```

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| ML framework | PyTorch + torchvision | Best ecosystem for custom fine-tuning; Kaggle GPU support is native |
| Model | EfficientNetB0 | 5.3M params; CPU-deployable; 97.54% accuracy on Food-101 with fine-tuning (IJIIS 2024); best accuracy/size ratio vs MobileNetV2, ResNet50, EfficientNetB7 |
| Inference runtime | ONNX Runtime (onnxruntime) | Faster than PyTorch at inference; ~200MB vs PyTorch's ~700MB; fits Render's 512MB free RAM |
| API framework | Flask | Python-native; minimal overhead; ONNX runtime and image processing are Python libraries |
| AI insights | OpenRouter — `qwen/qwen-2.5-72b-instruct` | Free tier with no per-minute rate limit; OpenAI-compatible API |
| Nutrition data | Local JSON file | No API dependency; desi food values are more accurate when manually sourced; instant lookup |
| Database/Auth | Supabase (PostgreSQL + Storage) | Shared with frontend; RLS handles data isolation; free tier |
| Training | Kaggle Notebooks | Free GPU (P100/T4); Pakistani dataset already on Kaggle; notebooks persist |
| Hosting | Render (free tier) | Free Python web service; 512MB RAM; persistent disk for model files |

---

## Critical Constraints

| Constraint | Value | Why It Matters |
|---|---|---|
| Render free RAM | 512 MB | Must use ONNX-only in Flask — PyTorch alone is ~700MB and will OOM |
| Confidence threshold | 0.70 | Below this → `low_confidence: true` → frontend shows disambiguation picker |
| Image input size | 224 × 224 | EfficientNetB0 standard; must match training preprocessing exactly |
| ImageNet normalisation | mean=[0.485,0.456,0.406] std=[0.229,0.224,0.225] | Must match training transforms exactly or inference accuracy drops to near-zero |
| Grad-CAM | Precomputed only | Do NOT load PyTorch in Flask — generates heatmaps during evaluation on Kaggle, uploads to Supabase Storage, serves as static URLs |
| OpenRouter model string | `qwen/qwen-2.5-72b-instruct` | Use exactly this — free-tier route on OpenRouter |
| ONNX opset | 17 | Stable with onnxruntime 1.18+ |

---

## Repository Structure (what you will create)

```
backend/
├── app.py               Flask entry point
├── predict.py           ONNX inference
├── nutrition.py         Local JSON nutrition lookup
├── insights.py          OpenRouter (Qwen) API call
├── gradcam_api.py       Precomputed Grad-CAM URL lookup
├── config.py            Environment variable loading
├── routes/
│   ├── __init__.py
│   ├── predict_bp.py    POST /predict
│   ├── health_bp.py     GET /health
│   └── classes_bp.py    GET /classes
├── requirements.txt
├── Procfile
└── .env.example

model/
├── scrape.py            Image scraper for gap-fill classes
├── curate_classes.py    Dataset merger + curation
├── dataset.py           PyTorch Dataset class
├── model.py             EfficientNetB0 definition
├── train.py             Two-phase training loop
├── ablation.py          Model comparison study
├── evaluate.py          Accuracy metrics + confusion matrix
├── gradcam.py           Grad-CAM heatmap generation
├── export.py            PyTorch → ONNX export
├── requirements.txt
└── nutrisense_training.ipynb   Kaggle notebook

data/
├── class_index.json     {"0": "biryani", "1": "karahi", ...}
├── nutrition_db.json    {"biryani": {"calories": 290, ...}, ...}
└── gradcam_index.json   {"biryani": "https://...supabase.co/...", ...}
```

---

## Environment Variables

```bash
# backend/.env
OPENROUTER_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
MODEL_PATH=./model.onnx
CLASS_INDEX_PATH=./data/class_index.json
NUTRITION_DB_PATH=./data/nutrition_db.json
GRADCAM_INDEX_PATH=./data/gradcam_index.json
CONFIDENCE_THRESHOLD=0.70
```

---

---

# Phase 1 — Dataset Curation

**Goal:** Produce a unified, deduplicated, quality-filtered dataset of ~100 food classes, each with ≥300 images, ready for training on Kaggle.

**Why this dataset strategy:** The original Pakistani Food Dataset (Tahir 2020) has only ~49 images per class — far too few for reliable CNN fine-tuning. The Khana 2025 dataset (131K images, 80 Indian food classes) covers most overlapping dishes at 1,600+/class. We supplement with DeshiFoodBD (Bangladeshi dishes that overlap with Pakistani cuisine) and self-scraped images for Pakistani-specific dishes not in any existing dataset.

### Step 1 — Download datasets

| Dataset | Source | What it covers |
|---|---|---|
| Food-101 | [Kaggle — kmader/food41](https://www.kaggle.com/datasets/kmader/food41) | 101 general food classes, 1,000 images each |
| Khana 2025 | [khana.omkar.xyz](https://khana.omkar.xyz/) or arXiv:2509.06006 | 80 Indian food classes, ~1,638/class |
| DeshiFoodBD | [Mendeley Data](https://data.mendeley.com/datasets/tczzndbprx/1) | 19 Bangladeshi dishes, ~285/class |
| Pakistani dataset (Tahir 2020) | Kaggle search: "Pakistani Food Dataset" | 100 Pakistani classes, ~49/class — supplementary only |

### Step 2 — Create `model/scrape.py`

Scrapes Google Images and Bing for Pakistani gap-fill classes using `icrawler` (free, no API key required). Queries each dish in English and transliterated Urdu.

Gap-fill classes to scrape (target 400 images each):
```python
GAP_FILL_CLASSES = [
    ("halwa_puri",    ["halwa puri Pakistani breakfast", "حلوہ پوری"]),
    ("paya",          ["paya Pakistani trotters curry", "پائے"]),
    ("gol_gappa",     ["gol gappa pani puri Pakistani", "گول گپے"]),
    ("nihari_lahori", ["nihari lahori Pakistani", "لاہوری نہاری"]),
    ("channay",       ["channay chana Pakistani street food"]),
    ("dahi_bhalla",   ["dahi bhalla Pakistani chaat"]),
    ("shami_kebab",   ["shami kebab Pakistani fried"]),
    ("bun_kebab",     ["bun kebab Pakistani street burger"]),
    ("anda_paratha",  ["anda paratha Pakistani egg paratha breakfast"]),
    ("aloo_paratha",  ["aloo paratha Pakistani stuffed flatbread"]),
    ("karahi",        ["Pakistani karahi chicken wok"]),
    ("sajji",         ["sajji Balochi whole roasted lamb"]),
    ("chapli_kebab",  ["chapli kebab Peshawari Pakistani"]),
    ("doodh_patti",   ["doodh patti Pakistani chai tea"]),
    ("jalebi",        ["jalebi Pakistani sweet fried"]),
    ("gulab_jamun",   ["gulab jamun Pakistani dessert syrup"]),
    ("rabri",         ["rabri Pakistani sweet dessert"]),
    ("kheer",         ["kheer Pakistani rice pudding"]),
    ("suji_halwa",    ["suji halwa Pakistani semolina"]),
    ("haleem",        ["haleem Pakistani wheat meat stew"]),
]
```

Install: `pip install icrawler`

For each class:
1. Create output directory `./scraped/{label}/`
2. Run `GoogleImageCrawler` with each query variant
3. Run `BingImageCrawler` as fallback
4. After scraping: manually review and delete watermarked/wrong/blurry images
5. Target: 300–500 clean images per class

Usage: `python scrape.py --output_dir ./scraped --target 400`

### Step 3 — Create `model/curate_classes.py`

Merges all four dataset sources into one unified directory. Handles:
- Duplicate class names across datasets (e.g. "biryani" in Food-101, Khana, DeshiFoodBD → pool all images)
- Underscore/hyphen/space normalisation in class names
- Minimum image threshold: drop any class with < 300 images after merging
- Outputs `class_index.json` (sorted alphabetically, deterministic indices) and `dataset_stats.csv`

**Alias map** (maps non-canonical names to canonical labels):
```python
ALIAS_MAP = {
    "fried_rice":    "biryani",        # visually similar; merge
    "biryani_rice":  "biryani",        # Khana variant name
    "nehari":        "nihari_lahori",  # DeshiFoodBD spelling
    "roshogolla":    "gulab_jamun",    # similar syrup sweets
    "paratha":       "aloo_paratha",
    "daal_mash":     "daal",
    "daal_chana":    "daal",
}
```

Usage:
```bash
python curate_classes.py \
  --food101     /path/to/food-101/images \
  --khana       /path/to/khana \
  --deshi       /path/to/deshifoodbd \
  --scraped     ./scraped \
  --pakdataset  /path/to/pakistani-food-dataset \
  --output      ./unified_dataset \
  --min_images  300
```

Output: `class_index.json`, `dataset_stats.csv`

### Step 4 — Populate `data/nutrition_db.json`

Manually populate nutrition values for all ~100 classes. Source from [USDA FoodData Central](https://fdc.nal.usda.gov/) — search each dish name and use values for a standard serving.

Format:
```json
{
  "biryani":        { "calories": 290, "protein": 12, "carbs": 38, "fat": 10 },
  "chicken_karahi": { "calories": 320, "protein": 28, "carbs":  8, "fat": 19 },
  "halwa_puri":     { "calories": 480, "protein":  9, "carbs": 62, "fat": 22 },
  "nihari_lahori":  { "calories": 380, "protein": 30, "carbs":  6, "fat": 26 },
  "samosa":         { "calories": 250, "protein":  5, "carbs": 28, "fat": 14 }
}
```

Tips:
- Values are per standard serving (not per 100g)
- For Pakistani dishes not in USDA, use published Pakistani nutrition tables or estimate from ingredients
- Every class in `class_index.json` must have an entry — use zeros with a note for any unknowns

### Done when:
- `unified_dataset/` has ~100 subdirectories, each with ≥300 images
- `class_index.json` exists with correct label-to-index mapping
- `dataset_stats.csv` shows no class with < 300 images
- `nutrition_db.json` has an entry for every class in `class_index.json`

---

# Phase 2 — Model Training

**Goal:** Train EfficientNetB0 using two-phase transfer learning on Kaggle GPU. Produce a `.pth` checkpoint.

**Why two-phase training:** Phase 1 (frozen backbone) teaches the classifier head which EfficientNet features correspond to which food class. Phase 2 (partially unfrozen) adapts the feature extractor to the food domain specifically. Training end-to-end from the start on a small dataset causes catastrophic forgetting of ImageNet features.

### Step 1 — Create `model/dataset.py`

PyTorch `Dataset` class that:
- Loads images from the unified dataset directory
- Applies different augmentation for train vs validation split
- Computes class weights for imbalanced classes

**Training augmentation:**
```python
transforms.Compose([
    transforms.Resize((256, 256)),
    transforms.RandomCrop(224),
    transforms.RandomHorizontalFlip(),
    transforms.RandomRotation(15),
    transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.1, hue=0.05),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    transforms.RandomErasing(p=0.1),
])
```

**Validation transforms (no augmentation):**
```python
transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])
```

**Class weight computation:**
```python
from sklearn.utils.class_weight import compute_class_weight
weights = compute_class_weight('balanced', classes=np.array(range(n_classes)), y=all_labels)
# Pass to CrossEntropyLoss(weight=torch.tensor(weights, dtype=torch.float32).to(device))
```

**Train/val split:** 80/20, seeded with `torch.Generator().manual_seed(42)` for reproducibility.

`build_dataloaders(dataset_dir, class_index_path, batch_size=32, num_workers=2)` → returns `(train_loader, val_loader, class_weights, num_classes)`

### Step 2 — Create `model/model.py`

```python
from torchvision.models import efficientnet_b0, EfficientNet_B0_Weights

def build_model(num_classes: int) -> nn.Module:
    model = efficientnet_b0(weights=EfficientNet_B0_Weights.IMAGENET1K_V1)
    in_features = model.classifier[1].in_features  # 1280
    model.classifier = nn.Sequential(
        nn.Dropout(p=0.3, inplace=True),
        nn.Linear(in_features, num_classes),
    )
    return model

def freeze_backbone(model):
    for param in model.parameters():
        param.requires_grad = False
    for param in model.classifier.parameters():
        param.requires_grad = True

def unfreeze_last_n(model, n=20):
    layers = list(model.features.children())
    for layer in layers[-n:]:
        for param in layer.parameters():
            param.requires_grad = True
    for param in model.classifier.parameters():
        param.requires_grad = True
```

### Step 3 — Create `model/train.py`

Two-phase training with checkpoint saving and early stopping.

**Phase 1 — Feature extraction (frozen backbone):**
- Epochs: 5
- Optimizer: `Adam(classifier_params_only, lr=1e-3)`
- Loss: `CrossEntropyLoss(weight=class_weights)`
- Save checkpoint after each epoch if `val_acc` improves

**Phase 2 — Fine-tuning (last 20 layers unfrozen):**
- Epochs: up to 15
- Optimizer: `Adam(all_unfrozen_params, lr=1e-4)`
- Scheduler: `ReduceLROnPlateau(optimizer, patience=2, factor=0.5)`
- Early stopping: patience=3 (stop if val_acc doesn't improve for 3 epochs)
- Continue saving checkpoints on improvement

**Checkpoint format:**
```python
torch.save({
    'state_dict': model.state_dict(),
    'epoch': epoch,
    'val_acc': val_acc,
    'class_index': class_index,   # embed the index so the .pth is self-contained
}, f'nutrisense_{val_acc:.4f}_ep{epoch}.pth')
```

**Checkpoint naming:** Include val_acc in filename so you can identify the best one at a glance.

Usage:
```bash
python train.py \
  --dataset_dir  ./unified_dataset \
  --class_index  ./class_index.json \
  --output_dir   ./checkpoints \
  --phase1_epochs 5 \
  --phase2_epochs 15 \
  --patience      3
```

### Step 4 — Create `model/nutrisense_training.ipynb`

Kaggle notebook that orchestrates the entire pipeline. Upload this and all `model/` Python files as a Kaggle dataset called `nutrisense-code`.

Notebook cells (in order):
1. Install: `!pip install -q icrawler onnx onnxruntime`
2. Set paths (Kaggle input paths for each dataset)
3. Run `curate_classes.py` — merge + filter + generate `class_index.json`
4. Print dataset stats from `dataset_stats.csv`
5. Run `train.py` — Phase 1 + Phase 2
6. Find best checkpoint (glob + regex on filename)
7. Run `ablation.py` (Phase 3)
8. Run `evaluate.py` (Phase 3)
9. Display `confusion_matrix.png` with `IPython.display.Image`
10. Display `per_class_accuracy.png`
11. Run `export.py` — produce `model.onnx`
12. List output files for download

### Done when:
- Notebook runs end-to-end without errors on Kaggle T4 GPU
- `nutrisense_{val_acc:.4f}_ep{n}.pth` checkpoint saved with val_acc ≥ 0.70
- Loss curves show convergence (decreasing, no runaway divergence)

---

# Phase 3 — Ablation + Evaluation

**Goal:** Compare model architectures, compute final accuracy metrics, generate confusion matrix and Grad-CAM samples. Produce all viva deliverables.

### Step 1 — Create `model/ablation.py`

Trains EfficientNetB0, MobileNetV2, and ResNet50 on the **same** train/val split with **identical** hyperparameters. Outputs `ablation_results.csv`.

```python
CANDIDATES = {
    "EfficientNetB0": lambda n: efficientnet_b0_with_head(n),
    "MobileNetV2":    lambda n: mobilenet_v2_with_head(n),
    "ResNet50":       lambda n: resnet50_with_head(n),
}
```

For each candidate:
- Same 8 epochs (shorter than full training — purpose is comparison, not max accuracy)
- Same loss (CrossEntropyLoss with class weights)
- Same Adam lr=1e-3
- Measure top-1 and top-3 accuracy on validation set
- Record parameter count and training time

Output CSV columns: `model, params_M, top1_acc, top3_acc, train_time_min`

### Step 2 — Create `model/evaluate.py`

Full evaluation of the best checkpoint.

Produces:
1. **`results.json`**: top-1 accuracy, top-3 accuracy, per-class accuracy dict
2. **`confusion_matrix.png`**: seaborn heatmap. If > 40 classes, show only the top-40 most confused classes (sort by off-diagonal errors)
3. **`per_class_accuracy.png`**: horizontal bar chart sorted ascending; red dashed line at mean

Print to console:
- Overall top-1 and top-3
- 5 best-performing classes with accuracy
- 5 worst-performing classes with accuracy

### Step 3 — Create `model/gradcam.py`

**Why precomputed:** PyTorch is ~700MB. Loading it alongside Flask would exceed Render's 512MB free RAM limit. Instead: generate Grad-CAM on Kaggle during evaluation, upload PNGs to Supabase Storage, serve as static URLs.

Implementation:
1. Hook into `model.features[-1]` (last conv block of EfficientNetB0) for forward activations and backward gradients
2. Compute: `cam = relu(sum(grad_weights * activations, dim=channel))`
3. Normalise 0–1, resize to original image size, apply jet colormap
4. Blend with original image at alpha=0.45

`generate_gradcam(model, image_pil, target_class=None) → PIL.Image`
- If `target_class=None`, use top predicted class

`gradcam_to_base64(model, image_pil, target_class=None) → str`
- Returns base64-encoded PNG for inline display

After evaluation, for each class: pick 1-2 representative images → generate heatmap → save as `{label}_gradcam.png` → upload to Supabase Storage bucket `gradcam/` → record public URL in `gradcam_index.json`:

```json
{
  "biryani":        "https://xyz.supabase.co/storage/v1/object/public/gradcam/biryani_gradcam.png",
  "chicken_karahi": "https://xyz.supabase.co/storage/v1/object/public/gradcam/chicken_karahi_gradcam.png"
}
```

Upload to Supabase Storage using the Python supabase client or direct REST API with service key.

### Done when:
- `ablation_results.csv` shows EfficientNetB0 outperforming MobileNetV2 and ResNet50
- `results.json` shows top-1 ≥ 70%, top-3 ≥ 88%
- `confusion_matrix.png` renders clearly
- `gradcam_index.json` has entries for at least 20 classes
- All Grad-CAM PNGs visible at their Supabase public URLs

---

# Phase 4 — Flask API

**Goal:** A production-ready Flask backend that loads the ONNX model once at startup and serves predictions via three endpoints.

**Why ONNX-only (no PyTorch in Flask):** `onnxruntime` CPU wheel is ~12MB. PyTorch CPU wheel is ~700MB. Render free tier RAM is 512MB. Loading PyTorch in Flask will cause OOM errors on the first request. All Grad-CAM work is precomputed in Phase 3.

### File structure

```
backend/
├── app.py
├── config.py
├── predict.py
├── nutrition.py
├── insights.py
├── gradcam_api.py
├── routes/__init__.py
├── routes/predict_bp.py
├── routes/health_bp.py
├── routes/classes_bp.py
├── requirements.txt
├── Procfile
└── .env.example
```

### `config.py`

Load all environment variables with `python-dotenv`. Fail fast if `OPENROUTER_API_KEY` is missing (unless `MOCK_MODE=true`).

```python
import os
from dotenv import load_dotenv

load_dotenv()

MOCK_MODE = os.environ.get("MOCK_MODE", "false").lower() == "true"

OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
if not OPENROUTER_API_KEY and not MOCK_MODE:
    raise RuntimeError("OPENROUTER_API_KEY is required (or set MOCK_MODE=true).")

SUPABASE_URL         = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
MODEL_PATH           = os.environ.get("MODEL_PATH", "./model.onnx")
CLASS_INDEX_PATH     = os.environ.get("CLASS_INDEX_PATH", "./data/class_index.json")
NUTRITION_DB_PATH    = os.environ.get("NUTRITION_DB_PATH", "./data/nutrition_db.json")
GRADCAM_INDEX_PATH   = os.environ.get("GRADCAM_INDEX_PATH", "./data/gradcam_index.json")
CONFIDENCE_THRESHOLD = float(os.environ.get("CONFIDENCE_THRESHOLD", "0.70"))
```

### `predict.py`

ONNX inference. Load model once at startup, reuse across requests.

```python
import json, time
import numpy as np
import onnxruntime as ort
from PIL import Image
from io import BytesIO
from config import MODEL_PATH, CLASS_INDEX_PATH, CONFIDENCE_THRESHOLD

IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
IMAGENET_STD  = np.array([0.229, 0.224, 0.225], dtype=np.float32)

_session = None
_class_index = {}

def load_model():
    global _session, _class_index
    _session = ort.InferenceSession(MODEL_PATH, providers=["CPUExecutionProvider"])
    with open(CLASS_INDEX_PATH, encoding="utf-8") as f:
        _class_index = json.load(f)
    print(f"Model loaded: {len(_class_index)} classes")

def _preprocess(image_bytes: bytes) -> np.ndarray:
    img = Image.open(BytesIO(image_bytes)).convert("RGB").resize((224, 224), Image.BILINEAR)
    arr = np.array(img, dtype=np.float32) / 255.0
    arr = (arr - IMAGENET_MEAN) / IMAGENET_STD
    arr = arr.transpose(2, 0, 1)[np.newaxis, ...]  # CHW, add batch dim
    return arr

def _softmax(logits: np.ndarray) -> np.ndarray:
    e = np.exp(logits - logits.max())
    return e / e.sum()

def run_inference(image_bytes: bytes) -> dict:
    t0 = time.perf_counter()
    tensor = _preprocess(image_bytes)
    input_name = _session.get_inputs()[0].name
    logits = _session.run(None, {input_name: tensor})[0][0]
    probs = _softmax(logits)
    top3_idx = probs.argsort()[::-1][:3]
    top3 = [{"label": _class_index[str(i)], "confidence": round(float(probs[i]), 4)} for i in top3_idx]
    return {
        "top_prediction": top3[0],
        "top_3": top3,
        "low_confidence": top3[0]["confidence"] < CONFIDENCE_THRESHOLD,
        "processing_time_ms": round((time.perf_counter() - t0) * 1000),
    }

def get_class_index() -> dict:
    return _class_index
```

### `nutrition.py`

Local JSON lookup. Normalises keys (spaces → underscores, lowercase). Returns a zeroed fallback object — never returns null because the frontend always renders the nutrition field.

```python
import json
from config import NUTRITION_DB_PATH

_db = {}
_FALLBACK = {"calories": 0, "protein": 0, "carbs": 0, "fat": 0, "note": "Nutrition data unavailable"}

def load_nutrition_db():
    global _db
    with open(NUTRITION_DB_PATH, encoding="utf-8") as f:
        _db = json.load(f)
    print(f"Nutrition DB loaded: {len(_db)} entries")

def get_nutrition(food_label: str) -> dict:
    key = food_label.lower().replace(" ", "_").replace("-", "_")
    if key in _db:
        return _db[key]
    # Try base name (e.g. "nihari_lahori" → "nihari")
    base = key.rsplit("_", 1)[0]
    if base in _db:
        return _db[base]
    return _FALLBACK
```

### `insights.py`

OpenRouter (Qwen) chat-completions call with a structured prompt. Goal context is injected silently — the user never sees it.

```python
import requests
from config import OPENROUTER_API_KEY

OPENROUTER_URL   = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_MODEL = "qwen/qwen-2.5-72b-instruct"

GOAL_CONTEXT = {
    "weight_loss": "The user wants to lose weight — mention calorie density and whether this dish is light or heavy.",
    "muscle_gain": "The user wants to build muscle — focus on protein content and how this dish fits a high-protein diet.",
    "curious":     "The user just wants to understand their food — give a balanced, informative explanation.",
}

SYSTEM_PROMPT = (
    "You are a friendly, culturally-aware nutrition assistant for South Asian cuisine. "
    "Write exactly 2-3 sentences in plain English that: "
    "(1) briefly describe what the dish is and what makes it nutritionally notable, "
    "(2) give one practical insight relevant to the user's goal. "
    "Use a warm, non-judgmental tone. Never call food unhealthy or bad. "
    "Do not mention specific gram weights; use phrases like 'a good source of protein'."
)

def generate_insight(food_label: str, nutrition: dict, user_goal: str = "curious") -> str:
    dish = food_label.replace("_", " ").title()
    goal_note = GOAL_CONTEXT.get(user_goal, GOAL_CONTEXT["curious"])
    user_message = (
        f"Food: {dish}\n"
        f"Nutrition per serving: {nutrition.get('calories','?')} kcal, "
        f"{nutrition.get('protein','?')}g protein, "
        f"{nutrition.get('carbs','?')}g carbs, "
        f"{nutrition.get('fat','?')}g fat\n"
        f"Goal context: {goal_note}\n\n"
        "Write the 2-3 sentence insight now:"
    )
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://nutrisense.vercel.app",
        "X-Title": "NutriSense AI",
    }
    payload = {
        "model": OPENROUTER_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user",   "content": user_message},
        ],
        "max_tokens": 150,
        "temperature": 0.7,
    }
    try:
        resp = requests.post(OPENROUTER_URL, json=payload, headers=headers, timeout=15)
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"].strip()
    except Exception:
        return f"{dish} is a popular South Asian dish. Enjoy it as part of a balanced diet."
```

### `gradcam_api.py`

Loads precomputed Grad-CAM URL index. Returns URL for the predicted class, or `None` if not available. Never loads PyTorch.

```python
import json, os
from config import GRADCAM_INDEX_PATH

_index = {}

def load_gradcam_index():
    global _index
    if not os.path.exists(GRADCAM_INDEX_PATH):
        print("No gradcam_index.json — Grad-CAM URLs will not be served")
        return
    with open(GRADCAM_INDEX_PATH, encoding="utf-8") as f:
        _index = json.load(f)
    print(f"Grad-CAM index loaded: {len(_index)} entries")

def get_gradcam_url(food_label: str) -> str | None:
    return _index.get(food_label) or _index.get(food_label.replace(" ", "_"))
```

### `routes/predict_bp.py`

```python
from flask import Blueprint, jsonify, request
from predict import run_inference
from nutrition import get_nutrition
from insights import generate_insight
from gradcam_api import get_gradcam_url

predict_bp = Blueprint("predict", __name__)

@predict_bp.route("/predict", methods=["POST"])
def predict():
    if "image" not in request.files:
        return jsonify({"error": "No image file in request"}), 400
    image_bytes = request.files["image"].read()
    if not image_bytes:
        return jsonify({"error": "Empty image file"}), 400

    user_goal = request.form.get("user_goal", "curious")
    result = run_inference(image_bytes)
    food_label = result["top_prediction"]["label"]

    nutrition = get_nutrition(food_label)
    insight   = generate_insight(food_label, nutrition, user_goal)

    response = {**result, "nutrition": nutrition, "insight": insight}

    url = get_gradcam_url(food_label)
    if url:
        response["gradcam_sample_url"] = url

    return jsonify(response)
```

### `routes/health_bp.py`

```python
from flask import Blueprint, jsonify
from predict import _session, get_class_index

health_bp = Blueprint("health", __name__)

@health_bp.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "model_loaded": _session is not None, "classes": len(get_class_index())})
```

### `routes/classes_bp.py`

```python
from flask import Blueprint, jsonify
from predict import get_class_index

classes_bp = Blueprint("classes", __name__)

@classes_bp.route("/classes", methods=["GET"])
def classes():
    return jsonify(get_class_index())
```

### `app.py`

```python
import os
from flask import Flask
from flask_cors import CORS
from predict import load_model
from nutrition import load_nutrition_db
from gradcam_api import load_gradcam_index
from routes.predict_bp import predict_bp
from routes.health_bp import health_bp
from routes.classes_bp import classes_bp

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": [
    "http://localhost:*",
    "https://*.vercel.app",
    "https://nutrisense*.vercel.app",
]}})

app.register_blueprint(predict_bp)
app.register_blueprint(health_bp)
app.register_blueprint(classes_bp)

with app.app_context():
    load_model()
    load_nutrition_db()
    load_gradcam_index()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
```

### `requirements.txt`

```
flask>=3.0.0
flask-cors>=4.0.0
onnxruntime>=1.18.0
Pillow>=10.0.0
numpy>=1.26.0
requests>=2.31.0
python-dotenv>=1.0.0
gunicorn>=21.2.0
```

No `torch` or `torchvision` — these are training-only dependencies.

### `Procfile`

```
web: gunicorn app:app
```

### `.env.example`

```
MOCK_MODE=true
OPENROUTER_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
MODEL_PATH=./model.onnx
CLASS_INDEX_PATH=./data/class_index.json
NUTRITION_DB_PATH=./data/nutrition_db.json
GRADCAM_INDEX_PATH=./data/gradcam_index.json
CONFIDENCE_THRESHOLD=0.70
```

### Done when:
- `python app.py` starts without errors
- `GET /health` returns `{"status": "ok", "model_loaded": true, "classes": 100}`
- `POST /predict` with a food photo returns correct label, nutrition, and an AI-generated insight (OpenRouter/Qwen)
- Postman test with a karahi photo returns confidence ≥ 0.70

---

# Phase 5 — ONNX Export + Deployment

**Goal:** Export the best PyTorch checkpoint to ONNX, deploy Flask to Render, set up Supabase, push everything to GitHub.

### Step 1 — `model/export.py`

```python
import argparse, json
import torch
from model import build_model

def export(checkpoint_path: str, output_path: str):
    ckpt = torch.load(checkpoint_path, map_location="cpu")
    class_index = ckpt["class_index"]
    model = build_model(len(class_index))
    model.load_state_dict(ckpt["state_dict"])
    model.eval()
    dummy = torch.zeros(1, 3, 224, 224)
    torch.onnx.export(
        model, dummy, output_path,
        input_names=["image"], output_names=["logits"],
        dynamic_axes={"image": {0: "batch"}, "logits": {0: "batch"}},
        opset_version=17,
    )
    # Save class index alongside
    index_path = output_path.replace(".onnx", "_class_index.json")
    with open(index_path, "w") as f:
        json.dump(class_index, f, indent=2)
    print(f"Exported: {output_path} ({len(class_index)} classes)")
```

Usage: `python export.py --checkpoint nutrisense_0.82_ep12.pth --output model.onnx`

Download from Kaggle: `model.onnx`, `class_index.json`, `gradcam_index.json`

### Step 2 — Supabase Setup

Run the schema SQL (from `CONTEXT.md` Section 9) in the Supabase SQL Editor.

Create storage buckets:
- `scan-images` — public read, for user scan photos uploaded by the mobile/web app
- `gradcam` — public read, for Grad-CAM PNG heatmaps uploaded during evaluation

Upload Grad-CAM PNGs from Kaggle evaluation output to the `gradcam` bucket. Each file should be named `{label}_gradcam.png`.

Populate `gradcam_index.json` with the resulting public URLs.

### Step 3 — Render Deployment

1. Push `backend/` to GitHub (in the `main` branch of `zeeshandesigns/NutriSense`)
2. Render dashboard → New Web Service → connect GitHub repo
3. Root directory: `backend`
4. Build command: `pip install -r requirements.txt`
5. Start command: `gunicorn app:app`
6. Add environment variables from `.env` (copy all keys)
7. Add a persistent disk → mount path `/opt/render/project/src/data`
8. Upload `model.onnx`, `class_index.json`, `nutrition_db.json`, `gradcam_index.json` to the disk

After deploy:
- Confirm cold start completes in < 45 seconds
- `GET https://nutrisense-api.onrender.com/health` returns `{"status": "ok", "model_loaded": true}`

### Done when:
- `GET /health` returns 200 from the live Render URL
- `POST /predict` with a karahi photo returns correct label, nutrition, insight, and Grad-CAM URL
- Vercel web app and Expo mobile app both successfully call the Render endpoint

---

## Verification Checklist

Run through this before the viva demo.

| # | Check | Expected |
|---|---|---|
| 1 | `GET /health` | `{"status": "ok", "model_loaded": true, "classes": 100}` |
| 2 | `POST /predict` — karahi photo | label: "chicken_karahi", confidence ≥ 0.70 |
| 3 | `POST /predict` — ambiguous photo | `low_confidence: true`, 3 plausible options in `top_3` |
| 4 | `POST /predict` — nutrition field | Values populated; not zeros; not null |
| 5 | `POST /predict` — insight field | 2–3 sentences, culturally appropriate, references user goal |
| 6 | `POST /predict` — gradcam_sample_url | Valid Supabase Storage URL, image loads |
| 7 | Ablation CSV | EfficientNetB0 has highest top-1 accuracy of the three |
| 8 | Confusion matrix | Rendered and saved; shows main confusion pairs (e.g. karahi / handi) |
| 9 | Render cold start | < 45 seconds from first request to response |
| 10 | Render warm request | < 3 seconds end-to-end for `/predict` |

---

## Common Pitfalls

| Problem | Fix |
|---|---|
| OOM on Render | Verify `requirements.txt` has no `torch` or `torchvision` — ONNX Runtime only |
| Wrong predictions everywhere | Check ImageNet normalisation values exactly match training; verify 224×224 resize uses BILINEAR |
| OpenRouter returns 429 | Free tier route may be congested; add a simple retry with 1s sleep, or fall back to the canned insight |
| ONNX export fails | Ensure `model.eval()` is called before export; use `opset_version=17` |
| CORS errors from mobile | Expo dev client sends from `localhost` — ensure `"http://localhost:*"` is in CORS origins |
| Supabase RLS blocks backend | Backend uses the `service_role` key (bypasses RLS); frontend uses the `anon` key (RLS applies) |
| Class index mismatch | The `class_index.json` embedded in the `.pth` and the one in `data/` must be identical — use the one from the checkpoint |
