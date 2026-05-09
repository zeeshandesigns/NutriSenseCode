# NutriSense AI — Frontend Build Guide

> **For the AI:** You are building the frontend for NutriSense AI — a Pakistani and South Asian food recognition app. Read this entire document before writing a single line of code. Every decision here has a reason. Do not substitute libraries, rename files, or change the API contract without explicit instruction.
>
> **For the developer:** Give this file to your AI at the start of each session along with the specific phase you are working on. Say: *"I am working on Phase X. Build it exactly as specified."*

---

## Project Overview

NutriSense AI lets users photograph Pakistani and South Asian dishes to instantly identify them and understand their nutritional context — no manual entry required. The backend (Flask + EfficientNetB0 CNN) is handled by a separate team. Your job is to build the interfaces that consume it.

**You are building:**
1. A React Native + Expo mobile app (Phases 1–6)
2. A React + Vite web dashboard (Phase 7)

**You are NOT building:**
- The ML model or training pipeline
- The Flask backend API
- The Supabase database schema (it's already created — you just query it)

---

## Backend API (read-only — do not change)

### POST /predict
```
Base URL: process.env.EXPO_PUBLIC_API_BASE_URL (mobile)
          import.meta.env.VITE_API_BASE_URL (web)

Request: multipart/form-data
  image     File    JPEG or PNG, compressed to <500KB before sending
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
  "gradcam_sample_url": "https://...supabase.co/storage/.../chicken_karahi.png",
  "processing_time_ms": 1240
}

Response 400: { "error": "No image file in request" }
```

**Key rules:**
- `low_confidence: true` → confidence < 0.70 → must show top-3 picker, not auto-accept
- `gradcam_sample_url` is optional — may be absent
- `nutrition.calories` may not be a number — always null-check before rendering the grid
- Food labels use underscores: `"chicken_karahi"`, `"halwa_puri"` — replace with spaces + title-case for display

### GET /health → `{ "status": "ok", "model_loaded": true, "classes": 100 }`
### GET /classes → `{ "0": "biryani", "1": "chicken_karahi", ... }`

---

## Database (Supabase — already created, do not run migrations)

```
profiles
  id uuid PK (= auth.users.id, auto-created on sign-up via trigger)
  goal text  CHECK IN ('weight_loss', 'muscle_gain', 'curious')  DEFAULT 'curious'
  restrictions text[]  DEFAULT '{}'
  onboarding_complete boolean  DEFAULT false
  created_at timestamptz

scans
  id uuid PK
  user_id uuid → auth.users(id)
  food_label text
  confidence float
  top_3 jsonb          -- [{ "label": "...", "confidence": 0.91 }, ...]
  nutrition jsonb      -- { "calories": 320, "protein": 28, "carbs": 8, "fat": 19 }
  insight text
  image_url text       -- Supabase Storage public URL, or null
  created_at timestamptz

Storage bucket: scan-images (public read)
RLS: users can only see their own rows in both tables
```

---

## Design System

| Token | Value |
|---|---|
| Primary green | `#2E7D32` |
| Light green bg | `#f0fdf4` |
| Light accent | `#dcfce7` |
| Error | `#EF4444` |
| Warning amber | `#F59E0B` |
| Font | `system-ui, -apple-system, sans-serif` |
| Mobile library | `react-native-paper` (Material Design 3) |
| Web library | Tailwind CSS utility classes |
| Tone | Warm, non-judgmental. Never describe food as unhealthy or bad. |

---

## Environment Variables

**Mobile** (`.env` in the mobile project root):
```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_API_BASE_URL=https://nutrisense-api.onrender.com
EXPO_PUBLIC_OPENROUTER_KEY=
```

**Web** (`.env` in the web project root):
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_API_BASE_URL=https://nutrisense-api.onrender.com
VITE_OPENROUTER_KEY=
```

---

## UI Behaviour Rules (apply everywhere)

| Situation | Required behaviour |
|---|---|
| `confidence >= 0.70` | Auto-accept → show ResultCard immediately |
| `confidence < 0.70` | Show top-3 picker → user selects one → show ResultCard |
| `nutrition.calories` is not a number | Show "Nutrition data not available for this dish" card instead of the grid |
| Insights: < 3 scans this week | Suppress charts; show "Scan 3+ meals to see weekly patterns" |
| Insights: 0 scans | Full empty state with "Scan Now" CTA button |
| History: 0 scans | "No scans yet — try scanning your next meal!" |
| Any API call fails | Show error message with retry button; do not crash |
| Image upload to Supabase fails | Non-fatal — save scan row with `image_url: null`, show placeholder thumbnail |

---

---

# MOBILE APP (Phases 1–6)

## Phase 1 — Project Setup & Auth

**Goal:** A running Expo app where a user can sign in or sign up with email and password, and their session persists across app restarts.

**Why Expo Router:** File-based routing means screen structure mirrors the file structure — easier for AI-assisted development and matches Next.js conventions the team already knows.

**Why expo-secure-store over AsyncStorage:** SecureStore uses the device keychain for session tokens. AsyncStorage is unencrypted. Supabase auth tokens must be stored securely.

### Step 1 — Scaffold

```bash
npx create-expo-app@latest nutrisense-mobile --template blank-typescript
cd nutrisense-mobile
```

### Step 2 — Install dependencies

```bash
npx expo install expo-router expo-secure-store react-native-paper \
  react-native-safe-area-context react-native-screens \
  react-native-gesture-handler react-native-reanimated \
  @supabase/supabase-js axios
```

### Step 3 — Update `package.json`

Change:
```json
"main": "index.ts"
```
To:
```json
"main": "expo-router/entry"
```

### Step 4 — Update `app.json`

Add inside the `"expo"` object:
```json
"scheme": "nutrisense",
"plugins": ["expo-router", "expo-secure-store"],
"web": { "bundler": "metro" }
```

### Step 5 — Create `lib/supabase.ts`

```typescript
import { createClient } from '@supabase/supabase-js'
import * as SecureStore from 'expo-secure-store'

const SecureStoreAdapter = {
  getItem:    (key: string) => SecureStore.getItemAsync(key),
  setItem:    (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
}

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { storage: SecureStoreAdapter, autoRefreshToken: true, persistSession: true } },
)
```

### Step 6 — Create `app/_layout.tsx`

This is the root of the app. It listens for auth state changes and redirects accordingly.

Logic:
- On mount: call `supabase.auth.getSession()` to check if a session exists
- Subscribe to `onAuthStateChange` for live updates
- If no session and not already on an `/auth/*` route → redirect to `/auth/login`
- If session exists and on an `/auth/*` route → redirect to `/(tabs)/scan`
- Wrap everything in `PaperProvider` with the brand theme (primary: `#2E7D32`)

### Step 7 — Create `app/auth/_layout.tsx`

Stack navigator with `headerShown: false`.

### Step 8 — Create `app/auth/login.tsx`

Screen with:
- App name "NutriSense AI" as headline
- Tagline: "Understand what you eat — one photo at a time"
- Email input (keyboardType: email-address, autoCapitalize: none)
- Password input (secureTextEntry)
- Submit button: "Sign In" or "Create Account" depending on mode
- Toggle text link: "Don't have an account? Sign up" / "Already have an account? Sign in"
- On submit: call `supabase.auth.signInWithPassword` or `supabase.auth.signUp`
- On error: show `Alert.alert('Error', error.message)`
- Use `KeyboardAvoidingView` so the form doesn't hide behind the keyboard

### Done when:
- `npx expo start` runs without errors
- Opening the app shows the login screen
- Signing in with valid Supabase credentials navigates away (even to a blank screen is fine at this stage)
- Killing and reopening the app keeps the user signed in

---

## Phase 2 — Onboarding

**Goal:** New users complete a 3-screen onboarding flow that saves their health goal and dietary restrictions to the `profiles` table. Returning users skip onboarding entirely.

**Why 3 screens:** Research (JMIR 2024) shows that apps abandoned most often have complex onboarding. Three short screens is the minimum to collect the data needed for personalised insights without losing the user.

### Files to create

```
app/onboarding/_layout.tsx   Stack navigator, headerShown: false
app/onboarding/goal.tsx
app/onboarding/restrictions.tsx
app/onboarding/intro.tsx
```

### `app/onboarding/goal.tsx`

Three large card options in a vertical list:

| Key | Label | Icon | Description |
|---|---|---|---|
| `weight_loss` | Lose Weight | ⚖️ | Track calories and make mindful food choices |
| `muscle_gain` | Build Muscle | 💪 | Focus on protein-rich South Asian dishes |
| `curious` | Just Curious | 🍽️ | Understand what you eat, no pressure |

On tap: `supabase.from('profiles').update({ goal: key }).eq('id', user.id)` → navigate to `/onboarding/restrictions`.

### `app/onboarding/restrictions.tsx`

Four chip toggles (multi-select, default none selected):
- Halal
- Vegetarian
- Gluten-Free
- Dairy-Free

"Continue" button: saves `restrictions` array to `profiles` → navigate to `/onboarding/intro`.
"Skip for now" text button: navigate to `/onboarding/intro` without saving.

### `app/onboarding/intro.tsx`

Three step cards showing how the app works:
1. 📸 Snap — Point the camera at any South Asian dish
2. 🧠 Identify — Our CNN recognises 100 Pakistani & South Asian dishes
3. 📋 Understand — Get nutrition facts and a plain-language insight instantly

"Scan Your First Meal" button: `supabase.from('profiles').update({ onboarding_complete: true }).eq('id', user.id)` → `router.replace('/(tabs)/scan')`.

### Root layout onboarding check

In `app/_layout.tsx`, after confirming the user is authenticated, query `profiles.onboarding_complete`. If `false`, redirect to `/onboarding/goal` instead of `/(tabs)/scan`.

### Done when:
- New user: sees all 3 onboarding screens, completes them, lands on scan tab
- Returning user (onboarding_complete = true): goes straight to scan tab, skips onboarding entirely
- User who signed up on the web (onboarding_complete may already be true): also skips mobile onboarding — this is intentional

---

## Phase 3 — Core Scan Feature

**Goal:** The user photographs food → the app calls the backend → shows a full result card. This is the make-or-break feature. If this doesn't work well, the demo fails.

**Why nested file structure for scan:** Using `app/(tabs)/scan/index.tsx`, `result.tsx`, `confirm.tsx` instead of one flat file allows each state to be a separate screen with its own navigation — cleaner transitions and easier to manage state.

### Install additional packages

```bash
npx expo install expo-camera expo-image-picker expo-image-manipulator
```

### Files to create

```
lib/api.ts
app/(tabs)/scan/index.tsx
app/(tabs)/scan/result.tsx
app/(tabs)/scan/confirm.tsx
components/ScanButton.tsx
components/ResultCard.tsx
components/ConfidenceBar.tsx
components/NutritionGrid.tsx
```

### `lib/api.ts`

Function `predictImage(uri: string, userGoal: string): Promise<ScanResult>`:
1. Compress the image using `expo-image-manipulator`: `resize({ width: 800 })`, `compress: 0.7`, `format: JPEG`
2. Build FormData with `image` (file) and `user_goal` (string)
3. POST to `${EXPO_PUBLIC_API_BASE_URL}/predict` using `axios`
4. Timeout: 20 seconds
5. Return the parsed JSON response as `ScanResult`

TypeScript types to define in `lib/api.ts` (or a shared `types.ts`):
```typescript
interface FoodPrediction { label: string; confidence: number }
interface Nutrition { calories: number; protein: number; carbs: number; fat: number }
interface ScanResult {
  top_prediction: FoodPrediction
  top_3: FoodPrediction[]
  low_confidence: boolean
  nutrition: Nutrition | null
  insight: string
  gradcam_sample_url?: string
  processing_time_ms: number
}
```

### `app/(tabs)/scan/index.tsx`

Camera view screen. Shows:
- A preview image (if one was previously selected) or a placeholder box with 📸 icon
- Two buttons: **Camera** (launches `expo-camera`) and **Gallery** (launches `expo-image-picker`)
- Hint text: "Point at a Pakistani or South Asian dish and tap Scan"

On image selected: `router.push({ pathname: '/(tabs)/scan/result', params: { uri: imageUri } })`

Camera permissions: request with `ImagePicker.requestCameraPermissionsAsync()`. If denied, show Alert.

### `app/(tabs)/scan/result.tsx`

This screen receives `uri` as a route param and runs the full pipeline.

```
Mount → get user's goal from profiles table
      → call predictImage(uri, goal)
      → if low_confidence: router.replace to confirm.tsx with uri + result JSON
      → else: setResult(data), call persistScan(data, uri, userId)
      → show ResultCard
```

Loading state: centred `ActivityIndicator` with text "Analysing your food…"

Error state: Alert with message + navigate back.

`persistScan` function (async, non-blocking for image upload):
1. Upload compressed image to Supabase Storage bucket `scan-images` as `{userId}/{timestamp}.jpg`
2. Get public URL from `supabase.storage.from('scan-images').getPublicUrl(fileName)`
3. Insert to `scans` table: `food_label`, `confidence`, `top_3`, `nutrition`, `insight`, `image_url`
4. If storage upload fails: insert scan with `image_url: null` (non-fatal)

### `app/(tabs)/scan/confirm.tsx`

Receives `uri` (string) and `result` (JSON string) as route params. Parses result JSON.

Shows:
- The food photo (Image component)
- Heading: "We're not sure — which one is it?"
- Three Card components, one per `top_3` item, showing:
  - Food name (underscores → spaces → title-case)
  - Confidence percentage
- "None of these — go back" text button → `router.back()`

On card tap: sets the selected prediction as `top_prediction`, sets `low_confidence: false`, navigates back to `result.tsx` with the updated result.

### `components/ScanButton.tsx`

Props: `{ onCamera: () => void, onGallery: () => void, imageUri: string | null }`

Layout:
- If `imageUri`: show `Image` component (full width, 220px height, borderRadius 16)
- If no `imageUri`: show placeholder box (same dimensions) with 📸 emoji and "No photo selected"
- Below: two buttons side by side — "Camera" (contained) and "Gallery" (outlined)

### `components/ResultCard.tsx`

Props: `{ result: ScanResult, imageUri: string, readOnly?: boolean }`

Layout (top to bottom):
1. Food photo (`Image`, 200px height, full width)
2. Food name (headline — underscores → spaces → title-case)
3. `ConfidenceBar` component
4. Divider
5. `NutritionGrid` component
6. Divider
7. AI insight text (bodyMedium, lineHeight 22)
8. If `gradcam_sample_url` present: label "Model focus area" + image of heatmap
9. If `!readOnly`: Share button that calls `Share.share({ message: "I ate X — Y kcal. Tracked with NutriSense AI." })`

### `components/ConfidenceBar.tsx`

Props: `{ confidence: number }`

- Calculate percentage: `Math.round(confidence * 100)`
- Colour: green (`#2E7D32`) if ≥70%, amber (`#F59E0B`) if 50–69%, red (`#EF4444`) if <50%
- Animated fill bar (width = percentage%)
- Label: "91% confident" aligned right

### `components/NutritionGrid.tsx`

Props: `{ nutrition: Nutrition | null }`

- If `nutrition === null` or `typeof nutrition.calories !== 'number'`: render a single card saying "Nutrition data not available for this dish" with 0.5 opacity
- Otherwise: 2×2 grid of cells showing Calories (kcal), Protein (g), Carbs (g), Fat (g)
- Each cell: large number, small label, light green background (`#f0fdf4`), rounded corners

### `app/(tabs)/_layout.tsx`

Bottom tab navigator with 4 tabs:
- Scan (icon: camera)
- History (icon: history or clock)
- Insights (icon: chart-bar or trending-up)
- Profile (icon: account or person)

Active tint: `#2E7D32`. Header background: `#2E7D32`, header text white.

### Done when:
- Take a photo → result card appears with food name, confidence bar, nutrition grid, and insight text
- `low_confidence` photo → see top-3 picker → select one → see ResultCard
- Result appears in < 5 seconds on WiFi
- Scan is saved to Supabase `scans` table after successful result

---

## Phase 4 — History Tab

**Goal:** A date-grouped feed of all past scans. Tapping any item shows the full result card in read-only mode.

**Why useFocusEffect:** Unlike useEffect, this re-runs every time the tab becomes active. Without it, the history list won't update after a new scan is added on the Scan tab.

### Files to create

```
app/(tabs)/history/index.tsx
app/(tabs)/history/[id].tsx
components/HistoryItem.tsx
```

### `app/(tabs)/history/index.tsx`

1. `useFocusEffect(useCallback(...))` — query Supabase on focus:
   ```
   supabase.from('scans')
     .select('*')
     .eq('user_id', userId)
     .order('created_at', { ascending: false })
     .limit(100)
   ```
2. Group results by formatted date: e.g. "Friday, 25 April"
3. Render with `FlatList` — date headers as section separators
4. Each item: `HistoryItem` component → `router.push({ pathname: '/(tabs)/history/[id]', params: { id: scan.id } })`
5. Empty state: "No scans yet — try scanning your next meal!"
6. Loading state: `ActivityIndicator`

### `app/(tabs)/history/[id].tsx`

1. Get `id` from `useLocalSearchParams()`
2. Fetch `supabase.from('scans').select('*').eq('id', id).single()`
3. Convert the Scan row into a `ScanResult` shape:
   ```typescript
   {
     top_prediction: { label: scan.food_label, confidence: scan.confidence },
     top_3: scan.top_3 ?? [{ label: scan.food_label, confidence: scan.confidence }],
     low_confidence: false,
     nutrition: scan.nutrition,
     insight: scan.insight ?? '',
     processing_time_ms: 0,
   }
   ```
4. Render `<ResultCard result={...} imageUri={scan.image_url ?? ''} readOnly />`

### `components/HistoryItem.tsx`

Props: `{ scan: Scan, onPress: () => void }`

Layout (horizontal row):
- Thumbnail: 48×48 rounded square. If `scan.image_url` exists: `<Image>`. Else: placeholder with 🍽️ emoji
- Middle: food label (title-case, 1 line), calories below (e.g. "320 kcal") — 0.6 opacity
- Right: time string (e.g. "7:30 PM") — small, 0.4 opacity
- Thin bottom border separator
- Full row is `TouchableOpacity`

### Done when:
- Scan a photo → go to History tab → see the new scan in the list with today's date header
- Tap the item → full ResultCard in read-only mode (no Share button)
- History list updates automatically when tab is focused

---

## Phase 5 — Insights Tab & Chatbot

**Goal:** Weekly nutrition patterns and an AI chatbot for food questions.

**Why OpenRouter is called client-side for the chatbot:** The chatbot requires back-and-forth conversation history. Routing this through the Flask backend would add latency and complexity. Calling OpenRouter directly from the client is simpler, and the Qwen free tier has no per-minute rate limit — sufficient for FYP demo use.

### Install additional packages

```bash
npx expo install react-native-chart-kit react-native-svg
```

### Files to create

```
app/(tabs)/insights/index.tsx
app/chatbot.tsx
```

### `app/(tabs)/insights/index.tsx`

1. `useFocusEffect` → query last 7 days of scans:
   ```
   .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString())
   ```

2. **Empty state (0 scans):** Large 🍽️ emoji, "No scans this week", "Scan Now" button navigating to scan tab

3. **Insufficient data state (1–2 scans):** Show scan count card + message "Scan X more meal(s) to see weekly patterns" — suppress charts

4. **Normal state (≥3 scans):**
   - Summary card: scan count this week, average calories per meal
   - Bar chart (react-native-chart-kit `BarChart`) — top 5 most-scanned foods (label on x-axis, count on y-axis). Chart colour: `#2E7D32`
   - Labels: truncate to 10 characters, replace underscores with spaces

5. "Ask about your diet" button at bottom → `router.push('/chatbot')`

### `app/chatbot.tsx`

Chat screen with the OpenRouter (Qwen) chat-completions API called directly from the client.

**System prompt construction (built silently, not shown to user):**
```
"You are a friendly South Asian food and nutrition assistant.
The user's goal is {goal}. Their dietary restrictions: {restrictions or 'none'}.
Answer concisely in 2-4 sentences. Focus on Pakistani/desi food.
Never be judgmental about food choices."
```

**Empty state (no messages yet):** Show "Ask me anything about South Asian food and nutrition" + 4 suggestion buttons:
- "Is karahi good for muscle gain?"
- "How much protein is in biryani?"
- "What are lighter desi breakfast options?"
- "Is nihari heavy for dinner?"

Tapping a suggestion sends it as the first message.

**Message rendering:** User messages right-aligned (green bubble `#dcfce7`), model messages left-aligned (grey bubble `#f3f4f6`). Auto-scroll to bottom on new message.

**Input row:** TextInput + Send button. Disabled while loading. "Thinking…" placeholder bubble while waiting.

**OpenRouter API call:**
- URL: `https://openrouter.ai/api/v1/chat/completions`
- Model: `qwen/qwen-2.5-72b-instruct`
- Headers: `Authorization: Bearer ${EXPO_PUBLIC_OPENROUTER_KEY}`, `HTTP-Referer`, `X-Title`
- Body: `{ model, messages: [{ role: 'system', content: <prompt> }, ...history], max_tokens: 200, temperature: 0.7 }` — OpenAI-compatible shape, alternates `user` and `assistant` roles
- On error: show "Sorry, I could not reach the AI right now. Try again."

### Done when:
- Insights tab shows scan count and chart after ≥3 scans; shows empty/insufficient states correctly
- Chatbot responds to "is karahi good for muscle gain?" with a relevant 2-4 sentence answer
- Suggested prompts appear on first open

---

## Phase 6 — Profile Tab

**Goal:** User can view and edit their goal and dietary restrictions. An "About the Model" sub-screen explains the CNN academically.

**Why About the Model matters:** Evaluators will look at this screen during the viva. It demonstrates that the team understands the ML work, not just the app layer.

### Files to create

```
app/(tabs)/profile/index.tsx
app/(tabs)/profile/model.tsx
```

### `app/(tabs)/profile/index.tsx`

Display:
- User email (from `supabase.auth.getUser()`)
- Current goal (label: "Lose Weight" / "Build Muscle" / "Just Curious")
- Current restrictions (chip row, or "None" if empty)

"About the Model" button → navigate to `profile/model`

"Sign Out" button (outlined) → `supabase.auth.signOut()` (root layout handles redirect to login)

### `app/(tabs)/profile/model.tsx`

Static informational screen. No data fetching needed.

Sections:
1. **Architecture card**
   - Model: EfficientNetB0 (ImageNet pretrained, two-phase fine-tuning)
   - Training: Kaggle P100/T4 GPU
   - Classes: ~100 food classes, ~35 South Asian dishes
   - Dataset: Food-101 + Khana 2025 (131K images) + DeshiFoodBD + self-scraped Pakistani classes

2. **Ablation Study card** (hardcoded expected values — fill in real values after training)

   | Model | Params | Top-1 | Top-3 |
   |---|---|---|---|
   | EfficientNetB0 ✓ | 5.3M | ~80% | ~93% |
   | MobileNetV2 | 3.4M | ~74% | ~89% |
   | ResNet50 | 25.6M | ~76% | ~90% |

3. **Grad-CAM card**
   - Brief explanation: "Grad-CAM highlights the regions of the image the CNN used to make its prediction. These are precomputed samples from the evaluation set."
   - If the backend returns `gradcam_sample_url` in scan results, those images can be shown here

4. **Limitations card** (list):
   - Portion size estimation is not supported
   - Mixed-dish scenes classify the dominant food only
   - Pakistani dish accuracy is lower than Food-101 classes due to smaller per-class training data
   - Not intended for medical or clinical use
   - Nutritional values are approximate standard-serving figures

### Done when:
- Profile screen shows correct user data
- "About the Model" navigates to the model screen with all four sections rendered
- Sign Out returns to login screen

---

---

# WEB DASHBOARD (Phase 7)

## Phase 7 — Web Dashboard

**Goal:** A browser-based version of the same product. Landing page for visitors, then a full dashboard for authenticated users: scan upload, history, insights, AI chatbot, profile.

**Why Vite + React:** Fast dev server, minimal config, TypeScript support out of the box. Tailwind CSS eliminates the need for a component library while keeping styling consistent.

**Why the web version exists:** The viva demo can be shown on a laptop without needing a physical phone. Evaluators can also access it after the demo at the Vercel URL.

### Step 1 — Scaffold

```bash
npm create vite@latest nutrisense-web -- --template react-ts
cd nutrisense-web
```

### Step 2 — Install dependencies

```bash
npm install react-router-dom @supabase/supabase-js axios react-dropzone recharts
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

### Step 3 — Tailwind config

`tailwind.config.js`:
```js
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0fdf4', 100: '#dcfce7',
          500: '#22c55e', 600: '#16a34a',
          700: '#15803d', 800: '#166534',
        },
      },
    },
  },
  plugins: [],
}
```

`src/index.css` (first 3 lines):
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### Step 4 — Supabase client

`src/lib/supabase.ts`:
```typescript
import { createClient } from '@supabase/supabase-js'
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
)
```

### Step 5 — API helper

`src/lib/api.ts`:
```typescript
import axios from 'axios'
export async function predictFile(file: File, userGoal = 'curious') {
  const form = new FormData()
  form.append('image', file)
  form.append('user_goal', userGoal)
  const { data } = await axios.post(
    `${import.meta.env.VITE_API_BASE_URL}/predict`,
    form,
    { timeout: 20000 }
  )
  return data
}
```

### Step 6 — Router setup

`src/App.tsx` — BrowserRouter with routes:
- `/` → `Landing` (public)
- `/login` → `Login` (redirect to `/dashboard` if already logged in)
- `/dashboard` → `Today` (private)
- `/history` → `History` (private)
- `/insights` → `Insights` (private)
- `/chatbot` → `Chatbot` (private)
- `/profile` → `Profile` (private)

Private routes: if no session → redirect to `/login`. Wrap private routes inside a layout route that renders a shared nav bar.

Session handling: `supabase.auth.getSession()` on mount + `onAuthStateChange` subscription. Show `null` (blank) while hydrating to avoid flash.

### Files to create

```
src/App.tsx
src/lib/supabase.ts
src/lib/api.ts
src/pages/Landing.tsx
src/pages/Login.tsx
src/pages/DashboardLayout.tsx
src/pages/Today.tsx
src/pages/History.tsx
src/pages/Insights.tsx
src/pages/Chatbot.tsx
src/pages/Profile.tsx
src/components/UploadZone.tsx
src/components/ResultCard.tsx
src/components/HistoryTable.tsx
src/components/WeeklyTrendChart.tsx
src/components/MacroChart.tsx
```

### `pages/Landing.tsx`

Sections:
1. **Nav bar:** "NutriSense AI" brand name left, "Get Started" button right → `/login`
2. **Hero:** Large heading "Know your desi food — instantly", subheading explaining the CNN + photo recognition concept, "Try It Free" CTA → `/login`
3. **How It Works:** 3-column grid: 📸 Snap → 🧠 Identify → 📋 Understand (same as mobile onboarding intro)
4. **The Model:** Paragraph explaining EfficientNetB0 + dataset. Ablation table (same values as mobile About the Model screen). Note: "These are approximate values from the evaluation set."
5. **Footer:** "NutriSense AI — Final Year Project © 2025"

No live scan demo on the landing page. Use a static placeholder or screenshot.

### `pages/Login.tsx`

Centred card with:
- "NutriSense AI" heading (brand green)
- Email and password inputs
- Submit button
- Toggle link (sign in / sign up)
- Error message display
- On success: `navigate('/dashboard')`

### `pages/DashboardLayout.tsx`

Shared layout for all private pages. Renders:
- Nav bar (dark green `#2E7D32`): brand name, links to all pages (Scan, History, Insights, Ask AI, Profile), Sign Out button
- `<Outlet />` for page content
- Max width 4xl, centred, padding 6

### `pages/Today.tsx`

- Heading "Scan Food" + today's scan count on the right (e.g. "3 scans today")
- `UploadZone` component (file drop / click to select)
- On file selected: call `predictFile(file, userGoal)` → show `ResultCard`
- Save result to Supabase `scans` table (food_label, confidence, top_3, nutrition, insight — no image_url for web)
- Error message on failure

### `pages/History.tsx`

- Query all scans for the user, ordered newest first
- Render `HistoryTable` component
- Empty state: "No scans yet. Upload a food photo to get started."

### `pages/Insights.tsx`

- Query last 7 days of scans
- Empty state (0 scans): large emoji, message, "Scan Now" button → `/dashboard`
- Insufficient state (< 3 scans): show count card + "Scan X more meals to see charts"
- Normal state (≥ 3 scans):
  - 4 macro average cards: Calories avg / Protein avg / Carbs avg / Fat avg
  - `WeeklyTrendChart` — line chart of daily average calories
  - `MacroChart` — pie chart of average macro split (protein × 4 / carbs × 4 / fat × 9 = kcal from each)
  - Most-scanned list: ranked rows with food name and scan count

### `pages/Chatbot.tsx`

Same logic as mobile chatbot. Same system prompt injection (load profile from Supabase). Same 4 suggested prompts. Same OpenRouter API call. Adapted for web: `flex flex-col`, scrollable message list, fixed input row at bottom.

### `pages/Profile.tsx`

- Show email, editable goal selector (button group), editable restriction chips
- "Save Changes" button → `supabase.from('profiles').update(...)` 
- "About the Model" accordion section with same content as mobile (architecture, ablation table, Grad-CAM explanation, limitations)
- Sign Out button

### `components/UploadZone.tsx`

Uses `react-dropzone`. Props: `{ onFile: (f: File) => void, loading: boolean }`.

- Dashed border box, centred icon and text
- Hover state: green border + light green background
- Loading state: show ⏳ and "Analysing your food…"; disable interaction
- Accept: `image/*`, max 1 file

### `components/ResultCard.tsx`

Props: `{ result: ScanResult }`.

Same content as mobile ResultCard but rendered as an HTML card:
- Food name (h2)
- Confidence bar (div with coloured fill)
- Low confidence warning (amber box listing alternative options) if `low_confidence: true`
- 4-cell macro grid (null-safe — show "Nutrition data not available" if needed)
- Insight text
- Grad-CAM sample image if `gradcam_sample_url` present

### `components/HistoryTable.tsx`

Props: `{ scans: Scan[] }`.

- Sort toggle: by Date or by Calories (button group above table)
- Table columns: Food | Calories | Protein | Carbs | Fat | Time
- Click row → expand/collapse to show full insight text below the row
- Light green highlight on expanded row

### `components/WeeklyTrendChart.tsx`

Props: `{ scans: Scan[] }`.

Recharts `LineChart` — group scans by day, average calories per day, plot as line. Stroke: `#2E7D32`.

### `components/MacroChart.tsx`

Props: `{ nutrition: { calories, protein, carbs, fat } }` (average values).

Recharts `PieChart` — 3 slices:
- Protein: protein_g × 4 kcal
- Carbs: carbs_g × 4 kcal
- Fat: fat_g × 9 kcal

Colours: `#2E7D32`, `#4CAF50`, `#81C784`. Include `Legend` and `Tooltip`.

### Done when:
- Upload a food photo on web → result card renders with food name, nutrition, insight
- History table loads all scans; clicking a row expands the insight
- Insights page shows charts after 3+ scans
- Chatbot responds to desi food questions
- Sign up on web → sign in on mobile → same scan history visible on both

---

---

## Verification Checklist

Run through this before the viva demo.

| # | Check | Expected |
|---|---|---|
| 1 | `GET https://nutrisense-api.onrender.com/health` | `{ "status": "ok", "model_loaded": true }` |
| 2 | POST a karahi photo to `/predict` | Correct label returned, confidence ≥ 0.70 |
| 3 | Mobile: scan a photo | Result card appears within 5 seconds on WiFi |
| 4 | Mobile: scan an ambiguous photo | Top-3 picker appears; selecting one shows ResultCard |
| 5 | Mobile: check History tab after scan | New scan appears in date-grouped list |
| 6 | Mobile: tap history item | Full result card in read-only mode |
| 7 | Mobile: Insights tab after 3+ scans | Chart renders with correct counts |
| 8 | Mobile: chatbot "is karahi good for muscle gain?" | 2-4 sentence relevant response |
| 9 | Web: upload a food photo | Result card renders |
| 10 | Auth: sign up on web → log in on mobile | Same scan history visible on both platforms |

---

## Common Pitfalls

| Problem | Fix |
|---|---|
| Expo Router not working | Check `"main": "expo-router/entry"` in package.json and `scheme` in app.json |
| Supabase auth not persisting | Ensure `SecureStoreAdapter` is passed to `createClient` — not default AsyncStorage |
| Image upload fails silently | Make sure `scan-images` bucket exists in Supabase Storage with public read access |
| NutritionGrid crashes | Always check `typeof nutrition?.calories === 'number'` before rendering the grid |
| History not updating after new scan | Use `useFocusEffect` not `useEffect` in history screen |
| Chatbot sends wrong history format | OpenRouter `messages` array must alternate `user` and `assistant` roles; the `system` message is sent once at the head of the array, not repeated |
| Web upload not working | Ensure `content-type: multipart/form-data` is NOT manually set — let axios/fetch set it with the boundary |
| Charts don't render on Insights | Check that you have ≥ 3 scans before the chart is rendered — suppress it otherwise |
