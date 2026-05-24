"""
Build NutriSense_Application.pdf from the markdown sections in this folder.

Pipeline: 00_cover.md + 01_application.md + 02_hosting.md + 03_test_cases.md +
          04_system_testing.md  ->  combined.html  ->  PDF via headless Edge.

Usage (from any working directory):
    python build_pdf.py
"""

from __future__ import annotations

import shutil
import subprocess
import sys
import time
from pathlib import Path

import markdown

HERE = Path(__file__).resolve().parent
OUT_HTML = HERE / "combined.html"
OUT_PDF  = HERE / "NutriSense_Application.pdf"

SECTIONS = [
    "00_cover.md",
    "01_application.md",
    "02_hosting.md",
    "03_test_cases.md",
    "04_system_testing.md",
]

CSS = """
@page {
    size: A4;
    margin: 22mm 18mm 22mm 18mm;
    @bottom-center { content: counter(page); }
}
body {
    font-family: "Calibri", "Segoe UI", Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.45;
    color: #1a1a1a;
}
h1 {
    font-size: 22pt;
    color: #0f4a3a;
    border-bottom: 2px solid #0f4a3a;
    padding-bottom: 4px;
    margin-top: 28px;
    page-break-before: always;
}
h1:first-of-type { page-break-before: avoid; }
h2 { font-size: 16pt; color: #14624c; margin-top: 22px; }
h3 { font-size: 13pt; color: #14624c; margin-top: 18px; }
h4 { font-size: 11pt; color: #14624c; margin-top: 14px; }
p, li { margin: 4px 0; }
table {
    border-collapse: collapse;
    width: 100%;
    margin: 10px 0;
    font-size: 10pt;
}
th, td {
    border: 1px solid #ccc;
    padding: 5px 8px;
    text-align: left;
    vertical-align: top;
}
th { background: #eaf3ef; color: #0f4a3a; }
code {
    background: #f4f4f4;
    padding: 1px 4px;
    border-radius: 3px;
    font-family: "Consolas", "Courier New", monospace;
    font-size: 9.5pt;
}
pre {
    background: #f4f4f4;
    padding: 10px 12px;
    border-left: 3px solid #0f4a3a;
    overflow-x: auto;
    font-size: 9pt;
    line-height: 1.35;
    page-break-inside: avoid;
}
pre code { background: transparent; padding: 0; }
blockquote {
    border-left: 3px solid #b8c5c0;
    margin: 10px 0;
    padding: 4px 10px;
    color: #4a4a4a;
    background: #f9f9f7;
}
strong { color: #0f4a3a; }
hr { border: 0; border-top: 1px solid #c8c8c8; margin: 18px 0; }
.cover-spacer { height: 30px; }
"""

HTML_SHELL = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>NutriSense AI — Application Deliverable</title>
<style>{css}</style>
</head>
<body>
{body}
</body>
</html>
"""


def find_browser() -> Path | None:
    candidates = [
        Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"),
        Path(r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"),
        Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe"),
        Path(r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"),
    ]
    for c in candidates:
        if c.exists():
            return c
    return None


def main() -> int:
    print(f"AppDocs folder: {HERE}")

    md_pieces = []
    for name in SECTIONS:
        path = HERE / name
        if not path.exists():
            print(f"  [SKIP] {name} (missing)")
            continue
        print(f"  [OK]   {name}")
        md_pieces.append(path.read_text(encoding="utf-8"))

    if not md_pieces:
        print("No markdown sources found.")
        return 1

    full_md = "\n\n\\pagebreak\n\n".join(md_pieces)

    extensions = [
        "extra",       # tables, fenced code, footnotes, etc.
        "sane_lists",
        "toc",
        "admonition",
    ]
    body_html = markdown.markdown(full_md, extensions=extensions, output_format="html5")
    body_html = body_html.replace(
        "<p>\\pagebreak</p>",
        '<div style="page-break-after: always;"></div>',
    )

    OUT_HTML.write_text(HTML_SHELL.format(css=CSS, body=body_html), encoding="utf-8")
    print(f"\nCombined HTML written: {OUT_HTML}")

    browser = find_browser()
    if browser is None:
        print("ERROR: neither Edge nor Chrome found in the standard install paths.")
        print(f"You can still print {OUT_HTML} to PDF manually from any browser.")
        return 2

    print(f"Using headless browser: {browser}")
    if OUT_PDF.exists():
        OUT_PDF.unlink()

    cmd = [
        str(browser),
        "--headless=new",
        "--disable-gpu",
        "--no-pdf-header-footer",
        f"--print-to-pdf={OUT_PDF}",
        OUT_HTML.as_uri(),
    ]
    print(" ".join(f'"{c}"' if " " in c else c for c in cmd))

    t0 = time.time()
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
    dt = time.time() - t0

    if result.returncode != 0:
        print(f"Browser exited with code {result.returncode} after {dt:.1f}s")
        if result.stdout:
            print("STDOUT:", result.stdout[-2000:])
        if result.stderr:
            print("STDERR:", result.stderr[-2000:])
        return 3

    if not OUT_PDF.exists():
        print("Browser reported success but no PDF was produced.")
        return 4

    size_kb = OUT_PDF.stat().st_size / 1024
    print(f"\n[OK] PDF generated in {dt:.1f}s")
    print(f"     {OUT_PDF}  ({size_kb:.0f} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
