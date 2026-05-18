# Phase 4 wire-up scripts

These run **after** Modal's `train_pipeline` finishes. They drop the trained
artifacts into the apps so the demo runs against the real model instead of
the mock predictions.

## End-to-end (copy-paste this whole block once Modal finishes)

```bash
# 1. Pull all training outputs from Modal Volume locally
mkdir -p outputs/evaluation/gradcam_samples
modal volume get nutrisense /model.onnx                       ./outputs/
modal volume get nutrisense /model_class_index.json           ./outputs/
modal volume get nutrisense /class_index.json                 ./outputs/
modal volume get nutrisense /evaluation                       ./outputs/ --recursive

# 2. Drop ONNX + class index into backend/data/
python scripts/install_model.py --src ./outputs

# 3. Upload Grad-CAM PNGs to Supabase and populate data/gradcam_index.json
# (Requires SUPABASE_URL + SUPABASE_SERVICE_KEY — load via backend/.env)
pip install supabase
python scripts/upload_gradcams.py --src ./outputs/evaluation/gradcam_samples

# 4. Update the 3 frontend ablation tables with real numbers
python scripts/update_ablation.py --src ./outputs/evaluation/ablation_results.csv

# 5. Switch backend out of mock mode
#    Edit backend/.env: MOCK_MODE=false
python backend/test_api.py    # confirms model_loaded: true

# 6. Review and commit
git diff backend/data/ data/gradcam_index.json web mobile
```

## Individual script docs

- [`install_model.py`](install_model.py) — copies `model.onnx` and
  `class_index.json` from `--src` into `backend/data/`.
- [`upload_gradcams.py`](upload_gradcams.py) — uploads `*_gradcam.png` files
  to the Supabase `gradcam` bucket and writes the URL mapping to
  `data/gradcam_index.json`.
- [`update_ablation.py`](update_ablation.py) — reads `ablation_results.csv`
  and rewrites the `ABLATION` array in `web/Landing.tsx`,
  `web/Profile.tsx`, and `mobile/profile/model.tsx`.

## Sanity-check before viva

```bash
curl https://your-render-url.onrender.com/health     # model_loaded: true
curl -F image=@karahi.jpg \
     -F user_goal=muscle_gain \
     https://your-render-url.onrender.com/predict    # full response
```
