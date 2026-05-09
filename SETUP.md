# NutriSense AI — Setup Checklist

Everything you need to do manually, in order. Code is already written — you are just connecting the services and filling in keys.

**Legend:** `[KEY]` = copy a value and save it somewhere | `[RUN]` = run a command | `[PASTE]` = paste text into a web UI | `[FILE]` = create or edit a file

---

## Stage 0 — Accounts to create (do this first, all free)

| Service | URL | What it's for |
|---|---|---|
| Supabase | supabase.com | Database, Auth, Storage |
| OpenRouter | openrouter.ai | Qwen LLM API key (free tier) |
| Render | render.com | Backend hosting |
| Vercel | vercel.com | Web hosting |
| Kaggle | kaggle.com | GPU training |

---

## Stage 1 — Get all API keys before touching any code

### 1.1 OpenRouter API Key
1. Go to **openrouter.ai** → Sign in (Google or GitHub auth)
2. Click your avatar → **Keys** → **Create Key**
3. `[KEY]` Copy it (starts with `sk-or-v1-...`) → call it `OPENROUTER_API_KEY`
4. The Qwen model (`qwen/qwen-2.5-72b-instruct`) is free-tier and has no per-minute rate limit — sufficient for FYP demo and viva

### 1.2 Supabase Keys
1. Go to **supabase.com** → New project (pick a region close to you)
2. Wait ~2 minutes for it to provision
3. Go to **Settings → API**
4. `[KEY]` Copy **Project URL** → `SUPABASE_URL`
5. `[KEY]` Copy **anon / public** key → `SUPABASE_ANON_KEY`
6. `[KEY]` Copy **service_role** key → `SUPABASE_SERVICE_KEY`
   - ⚠️ Keep service_role secret — never put it in the mobile or web app

---

## Stage 2 — Supabase Setup

### 2.1 Run the database schema
1. In your Supabase project → **SQL Editor** → **New query**
2. `[PASTE]` the entire contents of `docs/CONTEXT.md` → Section 9 (the SQL block)
   - Or paste this directly:

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (new.id) ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  goal text NOT NULL DEFAULT 'curious'
    CHECK (goal IN ('weight_loss', 'muscle_gain', 'curious')),
  restrictions text[] NOT NULL DEFAULT '{}',
  onboarding_complete boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  food_label text NOT NULL,
  confidence float NOT NULL,
  top_3 jsonb,
  nutrition jsonb NOT NULL,
  insight text,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scans_user_created ON scans (user_id, created_at DESC);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_profile" ON profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "own_scans" ON scans FOR ALL USING (auth.uid() = user_id);
```

3. Click **Run** — should say "Success"

### 2.2 Create Storage buckets
1. **Storage** → **New bucket**
   - Name: `scan-images` | Public: ✅ ON | Click Create
2. **New bucket** again
   - Name: `gradcam` | Public: ✅ ON | Click Create

### 2.3 Enable Email Auth
1. **Authentication → Providers → Email**
2. Make sure it's enabled (it is by default)
3. Optional: disable "Confirm email" for faster testing during development

---

## Stage 3 — Environment Files

Create these files by copying the `.example` files. Never commit `.env` files to git.

### 3.1 Backend

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env`:
```
MOCK_MODE=true
OPENROUTER_API_KEY=paste_your_openrouter_key_here
SUPABASE_URL=paste_your_supabase_url_here
SUPABASE_SERVICE_KEY=paste_your_service_role_key_here
MODEL_PATH=../model.onnx
CLASS_INDEX_PATH=../data/class_index.json
NUTRITION_DB_PATH=../data/nutrition_db.json
GRADCAM_INDEX_PATH=../data/gradcam_index.json
CONFIDENCE_THRESHOLD=0.70
```

> Keep `MOCK_MODE=true` until you have the trained `model.onnx` from Kaggle.

### 3.2 Mobile

```bash
cd mobile
cp .env.example .env
```

Edit `mobile/.env`:
```
EXPO_PUBLIC_SUPABASE_URL=paste_your_supabase_url_here
EXPO_PUBLIC_SUPABASE_ANON_KEY=paste_your_anon_key_here
EXPO_PUBLIC_API_BASE_URL=http://YOUR_LOCAL_IP:5000
EXPO_PUBLIC_OPENROUTER_KEY=paste_your_openrouter_key_here
```

> For `API_BASE_URL`: use your computer's local IP (e.g. `http://192.168.1.5:5000`), not `localhost` — the phone can't reach localhost on your PC. Find your IP with `ipconfig` on Windows.

### 3.3 Web

```bash
cd web
cp .env.example .env
```

Edit `web/.env`:
```
VITE_SUPABASE_URL=paste_your_supabase_url_here
VITE_SUPABASE_ANON_KEY=paste_your_anon_key_here
VITE_API_BASE_URL=http://localhost:5000
VITE_OPENROUTER_KEY=paste_your_openrouter_key_here
```

---

## Stage 4 — Run Locally (development, no trained model needed)

### 4.1 Start the backend
```bash
cd backend
venv\Scripts\activate       # Windows
# source venv/bin/activate  # Mac/Linux
python app.py
```

Expected output:
```
[MOCK] Model not loaded — mock predictions enabled (100 classes)
Nutrition DB loaded: 120 entries
Grad-CAM index loaded: 0 entries
Running on http://0.0.0.0:5000
```

Test it:
```bash
python test_api.py
```
All 5 tests should pass.

### 4.2 Start the web dashboard
```bash
cd web
npm run dev
```
Open `http://localhost:5173` — landing page should appear. Sign up → you'll see the scan dashboard.

### 4.3 Start the mobile app
```bash
cd mobile
npx expo start
```
Scan the QR code with **Expo Go** app on your phone (iOS or Android).
- Make sure your phone and PC are on the same WiFi network
- Use your PC's local IP in `EXPO_PUBLIC_API_BASE_URL`, not `localhost`

---

## Stage 5 — Kaggle Training (when ready to replace mock with real model)

### 5.1 Prepare datasets on Kaggle

Download and add these as Kaggle datasets to your notebook:

| Dataset | Kaggle search term or URL |
|---|---|
| Food-101 | kaggle.com/datasets/kmader/food41 |
| Khana 2025 | khana.omkar.xyz (download ZIP, upload to Kaggle) |
| DeshiFoodBD | mendeley data tczzndbprx — download, upload to Kaggle |
| Pakistani Food Dataset | kaggle.com — search "Pakistani Food Dataset" |

### 5.2 Upload your code to Kaggle

1. Zip the `model/` folder from this repo
2. Kaggle → **Datasets** → **New Dataset**
3. Name it exactly: `nutrisense-code`
4. Upload the zip → Create

### 5.3 Scrape Pakistani gap-fill classes (optional but recommended)

Run this on your local machine before uploading to Kaggle:
```bash
cd model
pip install -r requirements.txt
python scrape.py --output_dir ./scraped --target 400
```

After it finishes: **manually review** the `scraped/` folder. Delete blurry, watermarked, or wrong images. Then upload `scraped/` to Kaggle as dataset `nutrisense-scraped`.

### 5.4 Run the training notebook

1. Kaggle → **Code** → **New Notebook**
2. File → Import Notebook → upload `model/nutrisense_training.ipynb`
3. Add datasets: food41, khana, deshifoodbd, nutrisense-scraped, pakistani-food-dataset, nutrisense-code
4. Settings → **Accelerator: GPU T4 x2** ← important
5. **Run All**

Expected runtime: ~3–5 hours total.

### 5.5 Download outputs

After the notebook finishes, download from the **Output** tab:
- `model.onnx` ← most important
- `class_index.json`
- `evaluation/ablation_results.csv` ← for the viva report
- `evaluation/results.json`
- `evaluation/confusion_matrix.png`
- `evaluation/per_class_accuracy.png`
- `evaluation/gradcam_samples/` (folder of PNGs)

### 5.6 Add model to backend

```bash
# Copy downloaded files to the right places
cp ~/Downloads/model.onnx NutriSense/model.onnx          # repo root
cp ~/Downloads/class_index.json NutriSense/data/class_index.json
```

Then in `backend/.env`, change:
```
MOCK_MODE=false
```

Restart the backend and run `python test_api.py` — `model_loaded` should now be `true`.

### 5.7 Upload Grad-CAM images to Supabase

1. Open Supabase → **Storage** → `gradcam` bucket
2. Upload all PNGs from `evaluation/gradcam_samples/`
3. For each file, click it → **Get URL** → copy the public URL
4. Edit `data/gradcam_index.json` and add entries:
```json
{
  "biryani": "https://YOUR_PROJECT.supabase.co/storage/v1/object/public/gradcam/biryani_gradcam.png",
  "chicken_karahi": "https://...",
  ...
}
```

---

## Stage 6 — Production Deployment

### 6.1 Deploy Backend to Render

1. Go to **render.com** → New → **Web Service**
2. Connect your GitHub repo (`zeeshandesigns/NutriSense`)
3. Settings:
   - **Root Directory:** `backend`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `gunicorn app:app`
   - **Instance Type:** Free
4. **Environment Variables** → Add all keys from `backend/.env` (except MOCK_MODE — leave it false)
5. **Disks** → Add a disk (or accept the one configured in `render.yaml`):
   - Mount path: `/opt/render/project/src/backend/data`
   - Size: 1 GB
6. Deploy → wait ~5 minutes for first deploy
7. SSH into the disk (or use Render shell) and upload `model.onnx`:
   ```bash
   # In Render shell:
   # Upload model.onnx, class_index.json, nutrition_db.json, gradcam_index.json
   # to /opt/render/project/src/backend/data/
   ```
   **Alternative (simpler):** Put all data files directly in `backend/data/` folder and push to git. The model.onnx is ~20MB so this works fine.

8. Test: `curl https://YOUR_RENDER_URL.onrender.com/health`
   Should return: `{"status": "ok", "model_loaded": true, "classes": 100}`

### 6.2 Deploy Web to Vercel

1. Go to **vercel.com** → **Add New Project**
2. Import from GitHub → select `zeeshandesigns/NutriSense`
3. Settings:
   - **Root Directory:** `web`
   - **Framework:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. **Environment Variables** → add all from `web/.env` but change:
   ```
   VITE_API_BASE_URL=https://YOUR_RENDER_URL.onrender.com
   ```
5. Deploy → takes ~1 minute
6. Your web app URL: `https://nutrisense-xyz.vercel.app`

### 6.3 Update mobile for production

In `mobile/.env`, change:
```
EXPO_PUBLIC_API_BASE_URL=https://YOUR_RENDER_URL.onrender.com
```

### 6.4 Build APK for viva demo

```bash
cd mobile
npm install -g eas-cli
eas login
eas build:configure
eas build -p android --profile preview
```

This builds a standalone APK you can install on any Android phone for the demo. Takes ~10 minutes on Expo's servers.

---

## Stage 7 — Pre-Viva Checklist

Run through this the day before the viva.

| # | Check | How to verify |
|---|---|---|
| 1 | Backend health | `curl https://YOUR_RENDER_URL.onrender.com/health` → `model_loaded: true` |
| 2 | Karahi prediction | POST a karahi photo to `/predict` → correct label, confidence ≥ 0.70 |
| 3 | Low confidence | POST an ambiguous photo → `low_confidence: true`, 3 options shown |
| 4 | Mobile scan | Open Expo app → scan a dish → result appears in < 5 seconds |
| 5 | Mobile history | Past scan appears in History tab |
| 6 | Mobile chatbot | "Is karahi good for muscle gain?" → relevant 2-4 sentence response |
| 7 | Web scan | Upload a food photo on web → result card renders |
| 8 | Web history | History table shows all scans |
| 9 | Cross-platform | Sign up on web → sign in on mobile → same history visible |
| 10 | About the Model | Profile → About the Model → ablation table and limitations shown |

---

## Quick Reference — Local IPs & URLs

Fill this in as you set things up:

| Item | Value |
|---|---|
| Your PC's local IP | `ipconfig` → look for IPv4 under your WiFi adapter |
| Supabase Project URL | |
| Supabase Anon Key | |
| OpenRouter API Key | |
| Render Backend URL | |
| Vercel Web URL | |

---

## Common Errors

| Error | Fix |
|---|---|
| `OPENROUTER_API_KEY is required` | Add OPENROUTER_API_KEY to `backend/.env` or set `MOCK_MODE=true` |
| Mobile can't reach backend | Use PC's local IP in `EXPO_PUBLIC_API_BASE_URL`, not localhost |
| `model.onnx not found` | Either set `MOCK_MODE=true` or copy model.onnx to repo root |
| Supabase insert fails | Check RLS policies were created — rerun the schema SQL |
| Expo QR not working | Make sure phone and PC are on the same WiFi |
| Render deploy fails | Check Build Command and Root Directory are set correctly |
| Tailwind classes not applying | Make sure `@import "tailwindcss"` is the first line of `src/index.css` |
