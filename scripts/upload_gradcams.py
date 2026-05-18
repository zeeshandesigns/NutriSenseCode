"""
Upload Grad-CAM PNGs from Modal's evaluation/ folder to Supabase Storage
and write data/gradcam_index.json mapping class_label -> public URL.

Usage:
    pip install supabase

    # 1. Pull Grad-CAM PNGs locally
    modal volume get nutrisense /evaluation/gradcam_samples ./outputs/gradcam_samples --recursive

    # 2. Run the uploader
    python scripts/upload_gradcams.py --src ./outputs/gradcam_samples

Requires the following env vars (load from backend/.env or export them):
    SUPABASE_URL          your project URL
    SUPABASE_SERVICE_KEY  service-role key (bypasses RLS for uploads)

After running:
    - PNGs land in the `gradcam` bucket under their class label
    - data/gradcam_index.json contains the public URL mapping
    - Commit data/gradcam_index.json so Render picks it up
"""

import argparse
import json
import os
import sys
from pathlib import Path

try:
    from supabase import create_client
except ImportError:
    print("Install the supabase Python client first:  pip install supabase", file=sys.stderr)
    sys.exit(1)

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent.parent / "backend" / ".env")
except ImportError:
    pass

ROOT     = Path(__file__).resolve().parent.parent
INDEX    = ROOT / "data" / "gradcam_index.json"
BUCKET   = "gradcam"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--src", required=True,
                        help="Directory of PNGs named like <label>_gradcam.png")
    args = parser.parse_args()

    url  = os.environ.get("SUPABASE_URL")
    key  = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        raise SystemExit("Set SUPABASE_URL + SUPABASE_SERVICE_KEY (or have them in backend/.env)")

    src = Path(args.src)
    pngs = sorted(src.glob("*.png"))
    if not pngs:
        raise SystemExit(f"No PNGs found in {src}")

    client = create_client(url, key)
    mapping: dict[str, str] = json.loads(INDEX.read_text(encoding="utf-8")) if INDEX.exists() else {}

    print(f"Uploading {len(pngs)} PNGs to bucket '{BUCKET}'…")
    for p in pngs:
        # Filenames produced by evaluate.py: '{label}_gradcam.png'
        label = p.stem.replace("_gradcam", "")
        with open(p, "rb") as f:
            data = f.read()
        try:
            client.storage.from_(BUCKET).upload(
                path=p.name, file=data,
                file_options={"content-type": "image/png", "upsert": "true"},
            )
        except Exception as e:
            print(f"  ✗ {label}: {e}")
            continue
        public_url = client.storage.from_(BUCKET).get_public_url(p.name)
        # Supabase appends a trailing '?' sometimes — strip
        public_url = public_url.rstrip("?")
        mapping[label] = public_url
        print(f"  ✓ {label}  →  {public_url}")

    INDEX.write_text(json.dumps(mapping, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"\n{INDEX} updated with {len(mapping)} entries")
    print("Commit it so Render's deploy picks it up.")


if __name__ == "__main__":
    main()
