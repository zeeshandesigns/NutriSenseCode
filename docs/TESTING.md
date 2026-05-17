# NutriSense AI — Quality & System Testing

**Project:** NutriSense AI — Pakistani & South Asian Food Recognition System
**Document version:** 1.0
**Date:** 2026-05-10
**Companion document:** [TEST_CASES.md](TEST_CASES.md) — detailed test cases
**Authors:** Frontend & Backend/AI Teams

---

## 1. Introduction

### 1.1 Purpose

This document describes the testing strategy, scope, environment, and execution approach for the NutriSense AI system. It serves as the formal quality-assurance plan submitted as part of the Application deliverable (Final Year Project, IT Specialization).

### 1.2 Scope

Testing covers all four major subsystems:

1. **ML Pipeline** — EfficientNetB0 training, evaluation, ONNX export (offline, on Kaggle GPU)
2. **Flask Backend** — `/predict`, `/health`, `/classes` endpoints; ONNX inference; nutrition lookup; OpenRouter insight generation
3. **React Native Mobile App** — 4-tab navigation, scan, history, insights, profile, chatbot
4. **React Web Dashboard** — landing, login, scan upload, history, insights, chatbot, profile

Out of scope for this round of testing: load testing beyond demo scale (>100 concurrent users), security penetration testing, accessibility (WCAG) audit, internationalisation, and offline mode (the system requires network connectivity by design).

### 1.3 Quality Objectives

| Objective | Target |
|---|---|
| Functional correctness — all 47 documented test cases | ≥ 90% pass rate |
| End-to-end scan latency (mobile, WiFi) | ≤ 5 seconds |
| Backend cold-start time (Render free tier) | ≤ 45 seconds |
| Backend warm-request time (`/predict`) | ≤ 3 seconds |
| Model top-1 accuracy on held-out validation set | ≥ 70% |
| Model top-3 accuracy on held-out validation set | ≥ 85% |
| Zero critical (P0) defects at submission |  |
| Cross-platform data consistency (web ↔ mobile) | 100% |

---

## 2. Testing Strategy

A **layered testing pyramid** is followed:

```
                    ┌─────────────────────┐
                    │  Acceptance / Viva  │   ← Manual, demo-driven
                    └─────────────────────┘
                  ┌─────────────────────────┐
                  │   System / End-to-End   │   ← Manual + scripted
                  └─────────────────────────┘
              ┌─────────────────────────────────┐
              │  Integration (backend + DB)     │   ← Manual via test_api.py
              └─────────────────────────────────┘
        ┌─────────────────────────────────────────────┐
        │   Component / Unit (model, transforms)      │   ← Light coverage
        └─────────────────────────────────────────────┘
```

For a 4-person FYP team on a 7-week timeline, exhaustive unit testing is not the highest-value use of effort. The team prioritises:

- **System / End-to-End** tests — the demo flows that the viva will exercise
- **Integration** tests on the backend — `test_api.py` is automated and run on every backend change
- **Model evaluation** — ablation study + held-out validation
- **Manual UAT** — the team plays the role of three personas (Ahmed, Sana, Bilal — see SRS §2.4) and walks through every screen

### 2.1 Test Types Applied

| Test type | Coverage | How performed |
|---|---|---|
| **Unit testing** | Limited to pure functions (e.g. nutrition key normalisation, softmax) | Manual code inspection during reviews |
| **Integration testing** | Backend API end-to-end | `backend/test_api.py` — 5 automated tests |
| **System testing** | Mobile + Web full flows | Manual walkthrough of each TC in [TEST_CASES.md](TEST_CASES.md) |
| **Acceptance testing** | Personas (Ahmed, Sana, Bilal) complete their goals end-to-end | Manual, scripted per persona |
| **Cross-platform testing** | Sign up on web → see scans on mobile, and vice versa | Manual with two devices |
| **Performance testing** | Scan latency, cold-start time, RAM footprint on Render | Stopwatch + Render dashboard |
| **Compatibility testing** | iOS Safari, Chrome desktop, Chrome Android, Expo Go (Android + iOS) | Manual smoke tests |
| **Usability testing** | First-time-user can complete scan within 3 min | Persona walkthrough timing |
| **Security smoke testing** | Row-Level Security policies enforced; service-role key not in client code | Code grep + manual cross-account test |
| **Model evaluation** | Top-1, top-3, per-class accuracy on held-out 20% val split | Automated via `model/evaluate.py` |
| **Ablation study** | EfficientNetB0 vs MobileNetV2 vs ResNet50 | Automated via `model/ablation.py` |

---

## 3. Test Environment

### 3.1 Hardware

| Role | Device | Purpose |
|---|---|---|
| Mobile (Android) | Samsung Galaxy A52 (Android 13) | Primary mobile test device; Expo Go + production APK |
| Mobile (iOS) | iPhone 12 (iOS 17) | Secondary; smoke tests via Expo Go |
| Desktop | Windows 11, Chrome 122+ | Primary web target |
| Desktop | macOS Sonoma, Safari 17 | Secondary web target |
| Mobile web | Galaxy A52 + Chrome | Responsive smoke test |
| Server | Render Free Tier — 512 MB RAM, 0.1 vCPU | Backend production target |

### 3.2 Software

| Component | Version |
|---|---|
| Python | 3.12 |
| Flask | 3.0+ |
| onnxruntime | 1.18+ |
| Node.js | 20+ |
| React | 19.2 |
| React Native | 0.81 |
| Expo SDK | 54 |
| Vite | 5.4 |
| Supabase JS | 2.104 |
| PyTorch (training only) | 2.2+ |

### 3.3 Data

| Dataset | Purpose | Size |
|---|---|---|
| Food-101 (kmader/food41) | Western baseline | 101K images, 101 classes |
| Indian Food 2026 (kashyap077) | South Asian backbone | 156K images, 236 classes |
| DeshiFoodBD (shaidurpranto) | Bangladeshi overlap | ~5K images, 19 classes |
| nutrisense-scraped (sameen03) | Pakistani gap-fill | ~2.2K images, 13 classes |
| **Unified, after curation** | **270 classes, all ≥100 images** | **~256K images** |

Training/validation split: 80/20, seeded with `torch.Generator().manual_seed(42)` for reproducibility.

### 3.4 External Services

- **Supabase** (Postgres + Auth + Storage) — free tier
- **Render** (Flask backend hosting) — free tier
- **Vercel** (web hosting) — free tier
- **OpenRouter** (`qwen/qwen-2.5-72b-instruct`) — free tier
- **Kaggle GPU** (T4 x2) — for training only

---

## 4. Test Execution Approach

### 4.1 Phases of Testing

| Phase | When | What | Owner |
|---|---|---|---|
| 1. Component | During development | Unit checks during PR review | Each dev |
| 2. Integration (backend) | After every backend change | `python test_api.py` against local server (mock or real mode) | Backend team |
| 3. System (mobile) | After every mobile feature merge | Walk through related TCs from [TEST_CASES.md](TEST_CASES.md) | Frontend team |
| 4. System (web) | Same | Same | Frontend team |
| 5. Cross-platform | Weekly | Sign up on web, verify on mobile (and reverse) | Both teams |
| 6. UAT — persona walkthroughs | One week before viva | 3 personas × 5 tasks each | Whole team |
| 7. Performance | Once before viva | Stopwatch + Render dashboard | Backend team |
| 8. Pre-viva dry-run | Day before viva | Full demo end-to-end on production URLs | Whole team |

### 4.2 Defect Severity

| Severity | Definition | Example | Resolution time |
|---|---|---|---|
| **P0 — Critical** | App unusable; core demo fails | Backend doesn't start; scan endpoint 500s | Same day |
| **P1 — High** | A documented feature is broken | Onboarding skip-button doesn't save | 1-2 days |
| **P2 — Medium** | Feature works but UX degraded | History thumbnails missing on web scans | 3-5 days |
| **P3 — Low** | Cosmetic or minor inconvenience | Chart tick labels truncate | Before final report |

**Submission gate:** zero P0, ≤2 P1, P2/P3 documented in the bug log.

### 4.3 Defect Lifecycle

`Open → In Progress → Fixed → Verified → Closed`

Defects are tracked in the [Bug Log](#10-bug-log) section of this document (this is appropriate for an FYP-scale project; a real product would use a tracker like GitHub Issues or Jira).

---

## 5. Functional Testing

The 47 test cases in [TEST_CASES.md](TEST_CASES.md) cover all functional requirements (FR-01 through FR-30 in [SRS.md](SRS.md) §4).

Traceability of FR → TC:

| FR | Requirement | Covered by |
|---|---|---|
| FR-01 — 100-class classifier | TC-API-03, TC-SCAN-MOB-04 |
| FR-02 — Top-3 with confidence | TC-API-03 |
| FR-03 — Auto-accept when conf ≥ 0.70 | TC-SCAN-MOB-04 |
| FR-04 — Low-conf picker | TC-SCAN-MOB-05, TC-SCAN-MOB-06, TC-SCAN-WEB-04 |
| FR-05 — ONNX-only inference | TC-API-01 (memory <512MB confirms) |
| FR-06 — 224×224 ImageNet normalisation | Verified via `predict.py` code review |
| FR-07 — Inference ≤ 3 seconds | TC-PERF-01 |
| FR-08 — Calories/protein/carbs/fat returned | TC-API-03, TC-SCAN-MOB-04 |
| FR-09 — Nutrition from local JSON | Verified via `nutrition.py` code review |
| FR-10 — Fallback for missing nutrition | TC-EDGE-01 |
| FR-12 — 2-3 sentence insight | TC-API-03, TC-API-05 |
| FR-13 — Insight personalised by goal | TC-API-05 |
| FR-14 — Warm, non-judgmental tone | Manual review of 5 sample insights (see §7.2) |
| FR-15 — Graceful fallback if API fails | TC-CHAT-03, fallback string in `insights.py` |
| FR-17 — Email/password auth | TC-AUTH-01, TC-AUTH-02 |
| FR-18 — Session persists | TC-AUTH-05 |
| FR-19 — Auto profiles row | TC-AUTH-01 (verified via Supabase Table editor) |
| FR-20 — RLS isolation | TC-EDGE-04 |
| FR-21 — Onboarding for new users only | TC-ONB-01, TC-ONB-06 |
| FR-22 — Scan saved to DB | TC-SCAN-MOB-07 |
| FR-23 — Image uploaded to Storage | TC-SCAN-MOB-08, TC-SCAN-WEB-05 |
| FR-24 — Upload failure non-fatal | TC-SCAN-MOB-09 |
| FR-26 — Cross-platform history | TC-XPLAT-01 |
| FR-27 to FR-30 — Grad-CAM | Verified by inspecting `gradcam_index.json` after Phase 4 wire-up |

---

## 6. Non-Functional Testing

### 6.1 Performance

| Metric | Target | Measurement method | Pass/Fail |
|---|---|---|---|
| NFR-01 — End-to-end scan latency, WiFi | < 5 sec | Stopwatch from shutter to ResultCard | ☐ |
| NFR-02 — Backend `/predict` time | < 3 sec | `processing_time_ms` in API response | ☐ |
| NFR-03 — Render cold start | < 45 sec | `time curl /health` after 15-min idle | ☐ |
| NFR-04 — ONNX file size | < 25 MB | `ls -lh model.onnx` | ☐ |
| NFR-05 — Backend RAM | < 512 MB | Render dashboard → Memory chart | ☐ |

### 6.2 Accuracy (Model)

| Metric | Target | Source |
|---|---|---|
| NFR-06 — Top-1 (overall) | ≥ 70% | `evaluation/results.json` |
| NFR-07 — Top-3 (overall) | ≥ 85% | Same |
| NFR-08 — Top-1 (South Asian classes) | ≥ 65% | `evaluation/results.json` per-class subset |
| NFR-09 — EfficientNetB0 > MobileNetV2 | Positive margin | `evaluation/ablation_results.csv` |

### 6.3 Reliability

- All API failures return structured JSON `{"error": "<message>"}` — never raw stack traces (verified by code review of `routes/predict_bp.py`)
- Storage upload failure is non-fatal — TC-SCAN-MOB-09 confirms
- Network errors surface as user-friendly alerts with retry — TC-EDGE-02

### 6.4 Security

- **RLS enabled** on `profiles` and `scans` tables (verified in `supabase/schema.sql`)
- **Service-role key never in client code** — verified by `grep -r "SUPABASE_SERVICE_KEY" mobile/ web/` returning zero matches
- **Auth tokens in SecureStore (mobile), not AsyncStorage** — verified in `mobile/lib/supabase.ts`
- **`.env` files git-ignored** — verified in `.gitignore`
- Cross-account access test — TC-EDGE-04

### 6.5 Usability

- **First scan within 3 minutes** of app launch — measured during persona walkthroughs (§7)
- **No "unhealthy" or "bad" language** in copy — grep against `mobile/`, `web/`, `backend/insights.py` returns zero matches
- **Empty states have CTAs** — TC-HIST-02, TC-INS-01

---

## 7. Acceptance Testing — Persona Walkthroughs

Conducted one week before viva. Each tester is briefed to act as the persona, then completes the tasks without help. Time and friction points are logged.

### 7.1 Persona 1 — Ahmed (24, muscle gain)

| Task | Pass criterion |
|---|---|
| Sign up, set goal = muscle_gain | Lands on `/scan` with goal saved |
| Scan a karahi photo | Result shown ≤ 5 sec; insight references protein |
| Ask chatbot "Is karahi good for muscle gain?" | Reply addresses karahi + muscle gain |
| Check history after 3 scans | All 3 visible, date-grouped |
| View "About the Model" | All 3 cards render |

### 7.2 Persona 2 — Sana (27, busy med student)

| Task | Pass criterion |
|---|---|
| Sign up, set goal = curious | Onboarding ≤ 60 sec |
| Scan one dish during a meal | No friction; result clear |
| Open insights after 3 scans | Bar chart of top dishes renders |
| Re-open app the next day | Session persisted; lands on scan |

### 7.3 Persona 3 — Bilal (21, weight loss)

| Task | Pass criterion |
|---|---|
| Sign up, set goal = weight_loss + Halal | Both saved |
| Scan a heavy dish (e.g. paya) | Insight mentions calorie density, not judgmental |
| Get a low-confidence result | Picker appears; selecting works |

### 7.4 Insight Tone Review

Manual review of 5 random insights for tone compliance with NFR-18. Reviewer checks: no "unhealthy/bad/avoid"; warm + culturally appropriate; mentions user's goal.

| # | Dish | Goal | Insight excerpt | Tone OK? |
|---|---|---|---|---|
| 1 | _to fill_ | weight_loss | _to fill_ | ☐ |
| 2 | _to fill_ | muscle_gain | _to fill_ | ☐ |
| 3 | _to fill_ | curious | _to fill_ | ☐ |
| 4 | _to fill_ | muscle_gain | _to fill_ | ☐ |
| 5 | _to fill_ | weight_loss | _to fill_ | ☐ |

---

## 8. Model Evaluation Results

To be filled in after Kaggle training completes.

### 8.1 Overall Accuracy

| Metric | Value | Target | Pass? |
|---|---|---|---|
| Top-1 accuracy | __% | ≥ 70% | ☐ |
| Top-3 accuracy | __% | ≥ 85% | ☐ |
| Top-1 (South Asian subset) | __% | ≥ 65% | ☐ |

### 8.2 Ablation Study

| Model | Params (M) | Top-1 | Top-3 | Train time |
|---|---|---|---|---|
| EfficientNetB0 (chosen) | __ | __% | __% | __ min |
| MobileNetV2 | __ | __% | __% | __ min |
| ResNet50 | __ | __% | __% | __ min |

Winner: **__** — fill in after Kaggle output (`evaluation/ablation_results.csv`).

### 8.3 Confusion Matrix

See `evaluation/confusion_matrix.png` (top-40 most-confused classes shown).

### 8.4 Per-Class Accuracy

See `evaluation/per_class_accuracy.png`. Discussion of worst-performing classes and likely causes (image scarcity for Pakistani classes, visual similarity in karahi/handi/qorma family) belongs in the Final Report.

---

## 9. Test Execution Summary

To be filled in as tests run.

| Module | Total TCs | Pass | Fail | Blocked | Not Executed | Pass Rate |
|---|---|---|---|---|---|---|
| Authentication | 6 | _ | _ | _ | _ | _% |
| Onboarding | 6 | _ | _ | _ | _ | _% |
| Scan — Mobile | 10 | _ | _ | _ | _ | _% |
| Scan — Web | 5 | _ | _ | _ | _ | _% |
| History | 6 | _ | _ | _ | _ | _% |
| Insights & Chatbot | 5 | _ | _ | _ | _ | _% |
| Profile | 4 | _ | _ | _ | _ | _% |
| Backend API | 6 | _ | _ | _ | _ | _% |
| Cross-Platform | 2 | _ | _ | _ | _ | _% |
| Performance | 3 | _ | _ | _ | _ | _% |
| Edge Cases | 4 | _ | _ | _ | _ | _% |
| **Total** | **47** | **_** | **_** | **_** | **_** | **_%** |

---

## 10. Bug Log

| Bug ID | Title | Severity | Reported | Owner | Status | Resolution |
|---|---|---|---|---|---|---|
| BUG-001 | Confirm-screen pick shows correct label but stale nutrition/insight | P2 | 2026-05-09 | Backend | Open | Needs `/lookup?label=X` endpoint or top_3 nutrition pre-fetch |
| BUG-002 | React fragment-without-key warning in `web/HistoryTable.tsx` | P3 | 2026-05-09 | Frontend | Open | Convert `<>` to keyed `<Fragment>` |
| BUG-003 | Web `Today.tsx` doesn't show photo preview before/with ResultCard | P3 | 2026-05-09 | Frontend | Open | Pass `URL.createObjectURL(file)` down to ResultCard |
| BUG-004 | Mobile Profile screen is read-only (web is editable) | P2 | 2026-05-09 | Frontend | Open | Add chip/button editors mirroring web Profile |
| ... | _add as found_ | | | | | |

---

## 11. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Render free-tier OOM on first model load | Medium | High | ONNX-only at runtime (no PyTorch); confirmed RSS < 512 MB in TC-PERF-03 |
| Kaggle training run hits 12-hr session cap | Medium | Medium | Reduced ablation epochs from 8 → 3; trained model can also be split across two sessions using kernel-version outputs as inputs |
| OpenRouter rate limit during viva | Low | Medium | Fallback insight string in `insights.py`; mock-mode also available |
| Demo Wi-Fi unreliable during viva | Medium | High | Pre-download production APK and use mobile data hotspot as backup |
| Cross-platform sync confusion at viva | Low | Low | Test TC-XPLAT-01 the day before |
| ML accuracy below 70% target | Low | High | Conservative ablation guarantees; can re-train with more epochs if needed |

---

## 12. Sign-off

| Role | Name | Date | Signature |
|---|---|---|---|
| Project Lead | _________________________ | __________ | __________ |
| Frontend Lead | _________________________ | __________ | __________ |
| Backend/AI Lead | _________________________ | __________ | __________ |
| Supervisor | _________________________ | __________ | __________ |

---

**End of testing document.**
