# NutriSense AI — Test Cases

**Project:** NutriSense AI — Pakistani & South Asian Food Recognition System
**Document version:** 1.0
**Date:** 2026-05-10
**Total test cases:** 47
**Authors:** Frontend & Backend/AI Teams

---

## Test Case Format

Each test case follows the structure:

| Field | Meaning |
|---|---|
| **TC-ID** | Unique identifier (TC-<module>-<number>) |
| **Module** | Subsystem under test |
| **Priority** | High / Medium / Low |
| **Pre-conditions** | What must be true before test starts |
| **Steps** | Numbered actions performed by the tester |
| **Expected Result** | What should happen if the system is correct |
| **Status** | Pass / Fail / Blocked / Not Executed |

---

## 1. Authentication (Mobile + Web)

### TC-AUTH-01 — New user can sign up with email and password
- **Priority:** High
- **Pre-conditions:** App installed, internet available, email address not already registered
- **Steps:**
  1. Launch the app (mobile or web)
  2. On login screen, tap/click "Don't have an account? Sign up"
  3. Enter a valid email (e.g. `tester+1@example.com`)
  4. Enter a password of 6+ characters
  5. Tap "Create Account"
- **Expected Result:** Account created in Supabase Auth, `profiles` row auto-inserted via trigger with `onboarding_complete=false`, app navigates to `/onboarding/goal` on mobile (or to dashboard on web — onboarding not yet on web)
- **Status:** ☐ Pass ☐ Fail

### TC-AUTH-02 — Existing user can sign in with valid credentials
- **Priority:** High
- **Pre-conditions:** Account already exists
- **Steps:** Launch app → enter email and password → tap "Sign In"
- **Expected Result:** Session created, navigates to `/(tabs)/scan` (mobile) or `/dashboard` (web)
- **Status:** ☐ Pass ☐ Fail

### TC-AUTH-03 — Sign-in fails with wrong password
- **Priority:** High
- **Pre-conditions:** Account exists
- **Steps:** Enter correct email but wrong password → tap "Sign In"
- **Expected Result:** Error alert/message displayed ("Invalid login credentials"); user remains on login screen
- **Status:** ☐ Pass ☐ Fail

### TC-AUTH-04 — Sign-in fails with non-existent account
- **Priority:** Medium
- **Pre-conditions:** Email not registered
- **Steps:** Enter random email + any password → tap "Sign In"
- **Expected Result:** Error alert/message displayed; remains on login screen
- **Status:** ☐ Pass ☐ Fail

### TC-AUTH-05 — Session persists across app restart (mobile)
- **Priority:** High
- **Pre-conditions:** User signed in on mobile
- **Steps:**
  1. Sign in successfully
  2. Force-close app
  3. Re-open app
- **Expected Result:** No login prompt; lands on `/(tabs)/scan` directly (session restored via SecureStore)
- **Status:** ☐ Pass ☐ Fail

### TC-AUTH-06 — Sign-out clears session and returns to login
- **Priority:** Medium
- **Pre-conditions:** Signed-in session
- **Steps:** Profile tab/page → tap "Sign Out"
- **Expected Result:** Session cleared; redirected to login screen
- **Status:** ☐ Pass ☐ Fail

---

## 2. Onboarding (Mobile)

### TC-ONB-01 — New user is redirected to onboarding/goal
- **Priority:** High
- **Pre-conditions:** Just-signed-up user with `onboarding_complete=false`
- **Steps:** Sign up → wait for navigation
- **Expected Result:** App lands on `/onboarding/goal` screen
- **Status:** ☐ Pass ☐ Fail

### TC-ONB-02 — Selecting a goal saves it and advances to restrictions
- **Priority:** High
- **Pre-conditions:** On `/onboarding/goal`
- **Steps:** Tap "Build Muscle" card
- **Expected Result:** `profiles.goal` updated to `muscle_gain` in Supabase; navigates to `/onboarding/restrictions`
- **Status:** ☐ Pass ☐ Fail

### TC-ONB-03 — Selecting multiple restrictions and continuing saves them
- **Priority:** Medium
- **Pre-conditions:** On `/onboarding/restrictions`
- **Steps:** Toggle Halal + Vegetarian → tap "Continue"
- **Expected Result:** `profiles.restrictions` updated to `['halal','vegetarian']`; navigates to `/onboarding/intro`
- **Status:** ☐ Pass ☐ Fail

### TC-ONB-04 — Skip restrictions still advances to intro
- **Priority:** Low
- **Pre-conditions:** On `/onboarding/restrictions`
- **Steps:** Without selecting any chip, tap "Skip for now"
- **Expected Result:** Navigates to `/onboarding/intro`; `restrictions` remains empty `{}`
- **Status:** ☐ Pass ☐ Fail

### TC-ONB-05 — Intro "Scan Your First Meal" completes onboarding
- **Priority:** High
- **Pre-conditions:** On `/onboarding/intro`
- **Steps:** Tap "Scan Your First Meal"
- **Expected Result:** `profiles.onboarding_complete` set to `true`; navigates to `/(tabs)/scan`
- **Status:** ☐ Pass ☐ Fail

### TC-ONB-06 — Returning user skips onboarding
- **Priority:** High
- **Pre-conditions:** User has `onboarding_complete=true`
- **Steps:** Sign out → sign back in
- **Expected Result:** Lands directly on `/(tabs)/scan`, no onboarding screens shown
- **Status:** ☐ Pass ☐ Fail

---

## 3. Food Scan — Mobile

### TC-SCAN-MOB-01 — Camera capture launches camera and returns image
- **Priority:** High
- **Pre-conditions:** Mobile app open on Scan tab; camera permission granted
- **Steps:** Tap "Camera" button → take a photo → tap Use
- **Expected Result:** App navigates to `/(tabs)/scan/result` with the `uri` param; loading spinner shows
- **Status:** ☐ Pass ☐ Fail

### TC-SCAN-MOB-02 — Camera permission denied is handled
- **Priority:** Medium
- **Pre-conditions:** Camera permission previously denied
- **Steps:** Tap "Camera"
- **Expected Result:** No crash; permission prompt re-shown or graceful no-op
- **Status:** ☐ Pass ☐ Fail

### TC-SCAN-MOB-03 — Gallery picker returns image
- **Priority:** High
- **Pre-conditions:** Gallery has at least one image
- **Steps:** Tap "Gallery" → select an image
- **Expected Result:** Navigates to result screen with image URI
- **Status:** ☐ Pass ☐ Fail

### TC-SCAN-MOB-04 — High-confidence scan shows ResultCard
- **Priority:** Critical
- **Pre-conditions:** Backend reachable; image is a clear karahi photo
- **Steps:** Capture/select karahi photo → wait for result
- **Expected Result:** Within 5 seconds: ResultCard renders with food name, confidence ≥ 0.70, nutrition grid (4 cells), 2-3 sentence insight
- **Status:** ☐ Pass ☐ Fail

### TC-SCAN-MOB-05 — Low-confidence scan shows top-3 picker
- **Priority:** High
- **Pre-conditions:** Backend returns `low_confidence: true`
- **Steps:** Submit an ambiguous photo (blurry or non-food)
- **Expected Result:** App navigates to `/(tabs)/scan/confirm`; three Card options shown with confidence percentages; "None of these — go back" link visible
- **Status:** ☐ Pass ☐ Fail

### TC-SCAN-MOB-06 — Selecting a top-3 alternative shows ResultCard with chosen label
- **Priority:** High
- **Pre-conditions:** On confirm screen
- **Steps:** Tap alternative #2 (e.g. "Chicken Handi")
- **Expected Result:** Returns to result screen; ResultCard shows "Chicken Handi" as the label; persists to Supabase
- **Status:** ☐ Pass ☐ Fail
- **Notes:** Known limitation — `nutrition` and `insight` may still reflect original top-1 dish (open issue for follow-up endpoint)

### TC-SCAN-MOB-07 — Scan is saved to Supabase `scans` table
- **Priority:** High
- **Pre-conditions:** A successful scan just completed
- **Steps:** Open Supabase dashboard → Table editor → `scans`
- **Expected Result:** New row exists with correct `user_id`, `food_label`, `confidence`, `top_3` JSON, `nutrition` JSON, `insight`, `image_url`, `created_at` close to now
- **Status:** ☐ Pass ☐ Fail

### TC-SCAN-MOB-08 — Image uploads to Supabase Storage `scan-images`
- **Priority:** High
- **Pre-conditions:** A successful scan just completed; internet available
- **Steps:** Supabase dashboard → Storage → `scan-images` → check user folder
- **Expected Result:** File exists at `{userId}/{timestamp}.jpg`; matches the `image_url` saved in `scans` row
- **Status:** ☐ Pass ☐ Fail

### TC-SCAN-MOB-09 — Storage upload failure is non-fatal
- **Priority:** Medium
- **Pre-conditions:** `scan-images` bucket missing or RLS misconfigured
- **Steps:** Submit a scan
- **Expected Result:** ResultCard still renders; row inserted with `image_url = null`; no app crash
- **Status:** ☐ Pass ☐ Fail

### TC-SCAN-MOB-10 — Backend unreachable shows error alert
- **Priority:** Medium
- **Pre-conditions:** Backend stopped or wrong API URL
- **Steps:** Submit any scan
- **Expected Result:** Alert with error message; navigates back to scan tab; no crash
- **Status:** ☐ Pass ☐ Fail

---

## 4. Food Scan — Web

### TC-SCAN-WEB-01 — Drag-and-drop uploads file
- **Priority:** High
- **Pre-conditions:** Logged in, on Dashboard
- **Steps:** Drag a `.jpg` file onto the UploadZone
- **Expected Result:** Zone shows loading state; result renders within 5 seconds
- **Status:** ☐ Pass ☐ Fail

### TC-SCAN-WEB-02 — Click-to-select uploads file
- **Priority:** High
- **Pre-conditions:** Logged in, on Dashboard
- **Steps:** Click UploadZone → choose file from file picker
- **Expected Result:** Same as above
- **Status:** ☐ Pass ☐ Fail

### TC-SCAN-WEB-03 — Non-image file is rejected
- **Priority:** Low
- **Pre-conditions:** Logged in
- **Steps:** Try to drop a `.pdf` file
- **Expected Result:** UploadZone rejects the file; no upload triggered
- **Status:** ☐ Pass ☐ Fail

### TC-SCAN-WEB-04 — Low-confidence shows alternative options
- **Priority:** Medium
- **Pre-conditions:** Backend returns `low_confidence: true`
- **Steps:** Upload an ambiguous image
- **Expected Result:** ResultCard renders with amber "Low confidence — alternatives: ..." banner listing other top-3 entries
- **Status:** ☐ Pass ☐ Fail

### TC-SCAN-WEB-05 — Web scan saves image to Supabase Storage
- **Priority:** High
- **Pre-conditions:** Successful web scan
- **Steps:** Check Supabase Storage `scan-images` bucket
- **Expected Result:** File present at `{userId}/{timestamp}.{ext}`; `image_url` populated in `scans` row
- **Status:** ☐ Pass ☐ Fail

---

## 5. History

### TC-HIST-01 — History tab shows date-grouped scans (mobile)
- **Priority:** High
- **Pre-conditions:** User has ≥1 scan today and ≥1 scan from yesterday
- **Steps:** Open History tab
- **Expected Result:** Scans grouped under date headers ("Saturday, 10 May" etc.); newest first
- **Status:** ☐ Pass ☐ Fail

### TC-HIST-02 — Empty state on history (mobile)
- **Priority:** Low
- **Pre-conditions:** User has zero scans
- **Steps:** Open History tab
- **Expected Result:** Message: "No scans yet — try scanning your next meal!"
- **Status:** ☐ Pass ☐ Fail

### TC-HIST-03 — Tapping a history item shows full ResultCard read-only (mobile)
- **Priority:** Medium
- **Pre-conditions:** ≥1 scan exists
- **Steps:** Tap any history row
- **Expected Result:** Navigates to `/(tabs)/history/[id]`; ResultCard renders; no Share button
- **Status:** ☐ Pass ☐ Fail

### TC-HIST-04 — History updates after new scan (mobile)
- **Priority:** High
- **Pre-conditions:** History tab visible
- **Steps:** Switch to Scan → complete a scan → switch back to History
- **Expected Result:** New scan appears at top of list (useFocusEffect triggers refresh)
- **Status:** ☐ Pass ☐ Fail

### TC-HIST-05 — History table renders on web with sort toggle
- **Priority:** Medium
- **Pre-conditions:** Logged in, ≥1 scan
- **Steps:** Open History page → toggle "Sort: Calories"
- **Expected Result:** Rows re-order by `nutrition.calories` descending
- **Status:** ☐ Pass ☐ Fail

### TC-HIST-06 — Web history row expands to show insight
- **Priority:** Low
- **Pre-conditions:** Scan with non-empty insight
- **Steps:** Click row
- **Expected Result:** Inline expansion shows insight text with light-green background
- **Status:** ☐ Pass ☐ Fail

---

## 6. Insights & Chatbot

### TC-INS-01 — Empty state when 0 scans this week
- **Priority:** Medium
- **Pre-conditions:** No scans in last 7 days
- **Steps:** Open Insights tab/page
- **Expected Result:** Empty illustration + "Scan Now" CTA visible
- **Status:** ☐ Pass ☐ Fail

### TC-INS-02 — Insufficient-data state when 1-2 scans
- **Priority:** Low
- **Pre-conditions:** User has 1 or 2 scans this week
- **Steps:** Open Insights
- **Expected Result:** Stats card visible; chart suppressed; message "Scan X more meal(s) to see weekly patterns"
- **Status:** ☐ Pass ☐ Fail

### TC-INS-03 — Charts render when ≥3 scans
- **Priority:** Medium
- **Pre-conditions:** ≥3 scans in last 7 days
- **Steps:** Open Insights
- **Expected Result:** Bar chart (mobile) or line + pie charts (web) render with real counts
- **Status:** ☐ Pass ☐ Fail

### TC-CHAT-01 — Chatbot shows suggested prompts initially
- **Priority:** Low
- **Pre-conditions:** No prior messages
- **Steps:** Open chatbot page
- **Expected Result:** Empty state with 4 suggested questions ("Is karahi good for muscle gain?" etc.)
- **Status:** ☐ Pass ☐ Fail

### TC-CHAT-02 — Chatbot returns relevant 2-4 sentence answer
- **Priority:** Medium
- **Pre-conditions:** OpenRouter API key configured in env
- **Steps:** Send "Is karahi good for muscle gain?"
- **Expected Result:** Reply within 5 seconds; 2-4 sentences referencing karahi/muscle/protein; user-bubble right, assistant-bubble left
- **Status:** ☐ Pass ☐ Fail

### TC-CHAT-03 — Chatbot handles API failure gracefully
- **Priority:** Low
- **Pre-conditions:** Invalid OpenRouter key OR rate-limited
- **Steps:** Send a message
- **Expected Result:** Fallback bubble shows "Sorry, I could not reach the AI right now..."; no crash
- **Status:** ☐ Pass ☐ Fail

---

## 7. Profile

### TC-PROF-01 — Profile displays email + goal + restrictions
- **Priority:** Medium
- **Pre-conditions:** User logged in with goal + restrictions set
- **Steps:** Open Profile tab/page
- **Expected Result:** Email shown; goal label correct ("Build Muscle"); restrictions shown as chips or "None"
- **Status:** ☐ Pass ☐ Fail

### TC-PROF-02 — Web profile edits goal and saves to Supabase
- **Priority:** Medium
- **Pre-conditions:** Logged in on web
- **Steps:** Profile → tap "Lose Weight" → click "Save Changes"
- **Expected Result:** `profiles.goal` updated; persists across page reload
- **Status:** ☐ Pass ☐ Fail

### TC-PROF-03 — About the Model screen renders all sections (mobile)
- **Priority:** Medium
- **Pre-conditions:** On Profile tab
- **Steps:** Tap "About the Model"
- **Expected Result:** Architecture card, Ablation card (3 rows), Limitations card all visible
- **Status:** ☐ Pass ☐ Fail

### TC-PROF-04 — About the Model accordion expands (web)
- **Priority:** Low
- **Pre-conditions:** On Profile page
- **Steps:** Click "About the Model" header
- **Expected Result:** Accordion expands with architecture + ablation table + limitations
- **Status:** ☐ Pass ☐ Fail

---

## 8. Backend API (Direct testing via curl / Postman)

### TC-API-01 — GET /health returns model status
- **Priority:** Critical
- **Pre-conditions:** Backend running (mock or real mode)
- **Steps:** `curl http://localhost:5000/health`
- **Expected Result:** `200 OK`, body: `{"status":"ok","model_loaded":<bool>,"classes":<int>}`
- **Status:** ☐ Pass ☐ Fail

### TC-API-02 — GET /classes returns full index
- **Priority:** Medium
- **Pre-conditions:** Backend running
- **Steps:** `curl http://localhost:5000/classes`
- **Expected Result:** `200 OK`; JSON object with integer-string keys mapping to label strings; `len == classes` from /health
- **Status:** ☐ Pass ☐ Fail

### TC-API-03 — POST /predict with valid image returns full response
- **Priority:** Critical
- **Pre-conditions:** Backend running with real ONNX model
- **Steps:** `curl -F image=@karahi.jpg -F user_goal=muscle_gain http://localhost:5000/predict`
- **Expected Result:** `200 OK`; body contains `top_prediction`, `top_3` (length 3), `low_confidence` (bool), `nutrition` (object), `insight` (string), `processing_time_ms` (int)
- **Status:** ☐ Pass ☐ Fail

### TC-API-04 — POST /predict with no image returns 400
- **Priority:** Medium
- **Pre-conditions:** Backend running
- **Steps:** `curl -X POST http://localhost:5000/predict`
- **Expected Result:** `400 Bad Request`; body: `{"error":"No image file in request"}`
- **Status:** ☐ Pass ☐ Fail

### TC-API-05 — All three user_goal values produce valid insights
- **Priority:** Medium
- **Pre-conditions:** Backend running with OpenRouter key configured
- **Steps:** POST same image with `user_goal` = weight_loss, then muscle_gain, then curious
- **Expected Result:** Each response has `insight` non-empty; tone matches goal (weight_loss mentions calorie density, muscle_gain mentions protein, curious is balanced)
- **Status:** ☐ Pass ☐ Fail

### TC-API-06 — Backend confidence threshold flags low-confidence
- **Priority:** High
- **Pre-conditions:** Backend running with real model; threshold = 0.70
- **Steps:** POST an ambiguous image (blurry / non-food)
- **Expected Result:** `low_confidence: true` and `top_prediction.confidence < 0.70`
- **Status:** ☐ Pass ☐ Fail

---

## 9. Cross-Platform

### TC-XPLAT-01 — Sign up on web → see history on mobile
- **Priority:** High
- **Pre-conditions:** Mobile + web apps installed
- **Steps:**
  1. Sign up on web with `tester@example.com`
  2. Complete a scan on web
  3. Sign in on mobile with the same email
- **Expected Result:** History tab on mobile shows the web-uploaded scan
- **Status:** ☐ Pass ☐ Fail

### TC-XPLAT-02 — Web scan with image is viewable as mobile history thumbnail
- **Priority:** Medium
- **Pre-conditions:** Web Today.tsx uploads image to storage (post-A4 fix)
- **Steps:** Complete web scan → check mobile history
- **Expected Result:** Mobile history thumbnail shows the uploaded image (not the placeholder fork emoji)
- **Status:** ☐ Pass ☐ Fail

---

## 10. Performance

### TC-PERF-01 — End-to-end scan latency on mobile (WiFi)
- **Priority:** High
- **Pre-conditions:** Mobile connected to WiFi; backend on Render (warm)
- **Steps:** Capture photo → measure time until ResultCard renders
- **Expected Result:** ≤ 5 seconds for the full pipeline (image compression + upload + inference + insight + nutrition)
- **Status:** ☐ Pass ☐ Fail

### TC-PERF-02 — Backend cold-start time on Render
- **Priority:** Medium
- **Pre-conditions:** Render service idle for > 15 min
- **Steps:** `time curl https://<render-url>/health`
- **Expected Result:** First response within 45 seconds; subsequent within 1 second
- **Status:** ☐ Pass ☐ Fail

### TC-PERF-03 — Backend memory under load
- **Priority:** Low
- **Pre-conditions:** Render dashboard open
- **Steps:** Hit `/predict` ~20 times in 1 min
- **Expected Result:** RSS stays under 512 MB (Render free-tier limit)
- **Status:** ☐ Pass ☐ Fail

---

## 11. Edge Cases & Error Handling

### TC-EDGE-01 — Nutrition data missing falls back gracefully
- **Priority:** Low
- **Pre-conditions:** Backend returns nutrition with `note: "unavailable"` and zero values
- **Steps:** Render a scan whose label has no nutrition entry
- **Expected Result:** ResultCard shows "Nutrition data not available for this dish" instead of empty cells
- **Status:** ☐ Pass ☐ Fail

### TC-EDGE-02 — Network failure during scan shows retry option
- **Priority:** Medium
- **Pre-conditions:** Toggle airplane mode mid-request
- **Steps:** Start scan → enable airplane mode
- **Expected Result:** Error alert shown; app remains usable; user can retry
- **Status:** ☐ Pass ☐ Fail

### TC-EDGE-03 — Very large image (>5 MB) is handled
- **Priority:** Low
- **Pre-conditions:** Camera high-resolution mode
- **Steps:** Capture an 8 MB photo and submit
- **Expected Result:** Mobile `expo-image-manipulator` resizes to 800px / 0.7 quality before sending → backend receives <500 KB → succeeds
- **Status:** ☐ Pass ☐ Fail

### TC-EDGE-04 — Row-Level Security prevents cross-user data access
- **Priority:** High (security)
- **Pre-conditions:** Two test users (A and B) each with scans
- **Steps:** Open Supabase JS client as User A → query `scans` for User B's `user_id`
- **Expected Result:** Empty array returned (RLS enforced); no error revealed
- **Status:** ☐ Pass ☐ Fail

---

## Test Coverage Summary

| Module | Test Cases | Critical / High Priority |
|---|---|---|
| Authentication | 6 | 4 |
| Onboarding | 6 | 3 |
| Scan — Mobile | 10 | 5 |
| Scan — Web | 5 | 2 |
| History | 6 | 2 |
| Insights & Chatbot | 5 | 0 |
| Profile | 4 | 0 |
| Backend API | 6 | 3 |
| Cross-Platform | 2 | 1 |
| Performance | 3 | 1 |
| Edge Cases | 4 | 1 |
| **Total** | **47** | **22** |

---

## Execution Log Template

Use this when you run the test suite for the final report. Add a row per test case with date, tester initials, and outcome.

| TC-ID | Date | Tester | Result | Notes |
|---|---|---|---|---|
| TC-AUTH-01 | 2026-05-XX | ZH | ☐ Pass | |
| TC-AUTH-02 | 2026-05-XX | ZH | ☐ Pass | |
| ... | | | | |

---

**End of test cases document.**
