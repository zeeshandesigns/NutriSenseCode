# 1. Application

## 1.1 Project Overview

**NutriSense AI** is a cross-platform food-recognition system trained specifically on Pakistani and South Asian cuisine. A user takes a photograph of a dish from a phone or uploads one from a web browser, and the system returns the dish name, calories / protein / carbs / fat per standard serving, and a short, goal-personalised nutritional insight — without any manual entry.

The motivation is a documented research and product gap. Mainstream nutrition applications (MyFitnessPal, Cronometer, Noom) are built around Western food databases and recognition models trained on Food-101, a dataset with near-zero South Asian representation. Pakistani users receive missing results, incorrect calorie estimates, or complete recognition failure for everyday dishes such as *karahi*, *halwa puri*, *nihari* and *paya*. Scientific Reports (2025) confirms that no quality dataset for South Asian cuisine exists in the mainstream food-recognition literature; Tahir et al. (2020) is the only published Pakistani food dataset and contains only ~49 images per class, insufficient for reliable CNN fine-tuning. JMIR (2024) further reports that 70 % of users abandon health applications within 100 days, primarily because of manual food entry.

NutriSense AI fills this gap with a fine-tuned EfficientNetB0 trained on a curated multi-source dataset (Food-101, Indian Food 2026, DeshiFoodBD, and a self-scraped Pakistani gap-fill set) and ships the model end-to-end through a Flask inference API, a React Native mobile application, and a React + Vite web dashboard.

## 1.2 Headline Metrics

| Metric | Value |
|---|---|
| Classes recognised | **270** (Pakistani, South Asian, and Western dishes) |
| Top-1 accuracy on held-out validation | **82.65 %** |
| Top-3 accuracy on held-out validation | **93.65 %** |
| Model size (ONNX) | ~21 MB |
| End-to-end scan latency (WiFi, warm) | ~1.5 seconds |
| Backend memory footprint on Render free tier | < 512 MB |
| Confidence threshold for auto-accept | 0.70 (else top-3 picker shown) |

## 1.3 System Architecture

```
+------------------+     +--------------------+
|  React Native    |     |  React + Vite      |
|  (Expo Router)   |     |  + Tailwind        |
|  mobile app      |     |  web dashboard     |
+--------+---------+     +----------+---------+
         |                          |
         +----------+---------------+
                    |  multipart/form-data
                    v
         +----------------------------------+
         |   Flask API  (hosted on Render)  |
         |   -- predict.py    (ONNX runtime)|
         |   -- nutrition.py  (local JSON)  |
         |   -- insights.py   (OpenRouter)  |
         |   -- gradcam_api.py (static URLs)|
         +-----------------+----------------+
                           |
                           v
         +----------------------------------+
         |  Supabase                        |
         |  -- PostgreSQL (auth + scans)    |
         |  -- Storage (images + Grad-CAM)  |
         +----------------------------------+
```

The four runtime tiers run independently:
- **Mobile** and **Web** are pure clients. They authenticate against Supabase directly (anon key + RLS), POST a compressed image to the Flask API, and read the user's own scan history from Supabase.
- **Flask API** is stateless and ONNX-only at inference time (no PyTorch in the deployed container), keeping the resident set under the 512 MB Render free-tier ceiling.
- **Supabase** provides PostgreSQL, Auth, and Storage in one service. Row-Level Security policies (`auth.uid() = user_id`) prevent any user from reading another user's scans.

## 1.4 Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Model | **EfficientNetB0** (5.3 M params) | Best accuracy / size ratio for 224×224 inputs; small enough as ONNX for free-tier hosting |
| Training | PyTorch on Modal A10G GPU | Reproducible script-based pipeline, no session caps, $7 total spend |
| Inference | **ONNX Runtime (CPU)** | 20–40 % faster than PyTorch for single-image inference; tiny memory footprint |
| Backend | Flask 3 + gunicorn | Minimal overhead; three endpoints (`/health`, `/classes`, `/predict`) |
| Database / Auth / Storage | **Supabase** (PostgreSQL + Auth + Storage) | All-in-one free tier with RLS, S3-compatible storage, and JWT-based auth |
| LLM insights | **OpenRouter** — `qwen/qwen-2.5-72b-instruct` | OpenAI-compatible API, free tier, picked after Gemini quota issues |
| Mobile | React Native 0.81 + Expo SDK 54 + Expo Router | File-based routing, single codebase for iOS + Android, EAS Build for APKs |
| Web | React 19 + Vite 5 + Tailwind 4 | Fast dev loop; standard tooling; Vite preset deploys cleanly on Vercel |
| Hosting | Render (backend) · Vercel (web) · EAS (Android APK) | All free tiers; covered in detail in §3 — Hosting |

## 1.5 Feature List by Surface

### Web (React + Vite, hosted on Vercel)

- Landing page with hero illustration and call-to-action
- Email + password sign-up and sign-in via Supabase Auth (with email-verification UX)
- Protected dashboard with drag-and-drop / click-to-select image upload
- Top-3 disambiguation banner when model confidence falls below 0.70
- ResultCard showing food name, confidence, nutrition grid (kcal / protein / carbs / fat), and a 2–3 sentence insight
- History table with sort toggle (by date or calories) and inline expand-on-row for insight text
- Insights page with weekly bar / line / pie charts (suppressed below 3 scans, with empty-state CTA)
- Chatbot page with 4 suggested prompts and OpenRouter-powered replies
- Profile page with editable goal and dietary restrictions, plus an "About the Model" accordion

### Mobile (React Native + Expo, distributed as Android APK)

- Email + password sign-up and sign-in
- Onboarding flow for new users: goal selection → dietary restrictions → intro → first scan
- 4-tab navigation: **Scan**, **History**, **Insights**, **Profile**
- Camera capture or gallery picker; client-side compression to ≤ 500 KB before upload
- Top-3 disambiguation screen for low-confidence predictions
- ResultCard with nutrition grid + insight + optional Grad-CAM thumbnail
- Date-grouped history list with thumbnail images and on-tap read-only result view
- Insights bar chart (≥ 3 scans required) with empty / insufficient-data states
- Profile screen with email, goal, restrictions, "About the Model" page, and sign-out
- Session persisted across app restarts via `expo-secure-store`

### Backend (Flask, hosted on Render)

- `GET /health` — service status, `model_loaded` flag, class count
- `GET /classes` — full class-index mapping (270 entries)
- `POST /predict` — multipart image + `user_goal`; returns `top_prediction`, `top_3`, `low_confidence`, `nutrition`, `insight`, `gradcam_sample_url`, `processing_time_ms`
- ONNX Runtime inference on CPU with 224×224 ImageNet normalisation
- Local-JSON nutrition lookup with graceful fallback for missing entries
- OpenRouter (Qwen 2.5 72B) insight generation, goal-personalised, with hard-coded fallback string on API failure
- Mock mode (`MOCK_MODE=true`) for frontend development before the trained model is available
- CORS enabled for the mobile and web origins
- Five-test integration suite (`test_api.py`) runnable against any deployed instance

## 1.6 Academic Contribution

The primary academic contribution is the **fine-tuned EfficientNetB0 trained on a curated multi-source South Asian food dataset** — a documented and cited research gap. The dataset combines:

| Source | Classes | Role |
|---|---|---|
| Food-101 (kmader/food41) | 101 | Western baseline |
| Indian Food 2026 (kashyap077) | 236 | South Asian backbone |
| DeshiFoodBD (shaidurpranto) | 19 | Bangladeshi overlap |
| nutrisense-scraped (sameen03) | 13 | Pakistani gap-fill for dishes absent elsewhere |
| **Unified, after curation** | **270 classes** | **all classes ≥ 100 images, ~256 K total images** |

A formal **ablation study** compares EfficientNetB0 against MobileNetV2 and ResNet50 on the same 80 / 20 train / validation split with identical hyperparameters, justifying the architecture choice on accuracy, parameter count, and inference time. **Grad-CAM** heatmaps visualise the model's attention regions for representative South Asian dishes and are surfaced in-app via the "About the Model" page.

The applications (mobile + web) serve as the deployment vehicle and viva-demonstration mechanism; they are not themselves the academic contribution.

## 1.7 Screenshots

Selected screens captured from the production deployment (web at https://nutrisenseai.tech, mobile via EAS-built Android APK).

> Insert screenshots inline at the positions below before final submission. Recommended capture list:
>
> 1. **Web — Landing page** (hero, value proposition, CTA)
> 2. **Web — Sign-up / sign-in screen**
> 3. **Web — Dashboard with upload zone**
> 4. **Web — ResultCard after a successful scan**
> 5. **Web — History table with sort toggle**
> 6. **Mobile — Onboarding goal-selection screen**
> 7. **Mobile — Scan tab with camera / gallery buttons**
> 8. **Mobile — ResultCard with nutrition grid + insight**
> 9. **Mobile — Low-confidence top-3 picker**
> 10. **Mobile — History tab grouped by date**

| Figure | Caption |
|---|---|
| Fig 1 | Web landing page (https://nutrisenseai.tech) |
| Fig 2 | Web ResultCard after scanning a karahi photograph |
| Fig 3 | Web history table with date-sort active |
| Fig 4 | Mobile scan tab on Android (Galaxy A52, production APK) |
| Fig 5 | Mobile ResultCard with goal-personalised insight |
| Fig 6 | Mobile low-confidence top-3 picker |
| Fig 7 | Mobile history grouped by date with thumbnails |
| Fig 8 | "About the Model" page showing ablation table |

---

*End of Section 1 — Application.*
