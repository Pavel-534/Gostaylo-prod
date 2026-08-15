#!/usr/bin/env python3
"""
Brand icon generator (SSOT) — Airento.
Source of truth: public/brand/airento-mark.svg  (clean two-tone vector).
Design: full-bleed, NO inner plate/frame. Two-tone mark centered on a subtle
light gradient (#ffffff -> #eafcfa). OS rounds the corners (do NOT pre-round).

Outputs (public/):
  favicon.svg, favicon.ico, favicon.png
  icons/icon-32x32.png, icon-180x180.png (apple-touch),
  icons/icon-192x192.png, icon-512x512.png (any),
  icons/icon-maskable-512x512.png (Android maskable, safe zone),
  icons/icon-1024x1024.png (stores),
  icons/icon-512x512.svg (full-bleed vector),
  icons/badge-72x72.png (monochrome notification badge)

Run:  python3 scripts/generate-brand-icons.py
"""
import io
import os
import cairosvg
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUB = os.path.join(ROOT, "public")
MARK_SVG = os.path.join(PUB, "brand", "airento-mark.svg")
ICONS = os.path.join(PUB, "icons")
os.makedirs(ICONS, exist_ok=True)

# mark aspect ratio (w:h) parsed from the master SVG viewBox (SSOT)
import re as _re
_vb = _re.search(r'viewBox="([\d.\- ]+)"', open(MARK_SVG).read()).group(1).split()
_VBX, _VBY, _VBW, _VBH = (float(v) for v in _vb)
MARK_AR = _VBW / _VBH

BG_TOP = (255, 255, 255)
BG_BOTTOM = (234, 252, 250)  # #eafcfa – barely-teal


def render_mark(width):
    """Transparent PNG of the mark at given pixel width."""
    height = round(width / MARK_AR)
    png = cairosvg.svg2png(url=MARK_SVG, output_width=width, output_height=height)
    return Image.open(io.BytesIO(png)).convert("RGBA")


def gradient_bg(size):
    """Vertical light gradient square, fully opaque."""
    img = Image.new("RGB", (size, size))
    px = img.load()
    for y in range(size):
        t = y / max(1, size - 1)
        r = round(BG_TOP[0] + (BG_BOTTOM[0] - BG_TOP[0]) * t)
        g = round(BG_TOP[1] + (BG_BOTTOM[1] - BG_TOP[1]) * t)
        b = round(BG_TOP[2] + (BG_BOTTOM[2] - BG_TOP[2]) * t)
        for x in range(size):
            px[x, y] = (r, g, b)
    return img.convert("RGBA")


def app_icon(size, mark_frac=0.70, transparent=False):
    """Full-bleed icon: mark centered on light gradient (or transparent)."""
    if transparent:
        canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    else:
        canvas = gradient_bg(size)
    mw = round(size * mark_frac)
    mark = render_mark(mw)
    mh = mark.height
    canvas.alpha_composite(mark, ((size - mw) // 2, (size - mh) // 2))
    return canvas


def save(img, path):
    img.save(path)
    print("wrote", os.path.relpath(path, ROOT), img.size)


# ---- App icons (full-bleed, light gradient) ----
save(app_icon(192, 0.70), os.path.join(ICONS, "icon-192x192.png"))
save(app_icon(512, 0.70), os.path.join(ICONS, "icon-512x512.png"))
save(app_icon(180, 0.70), os.path.join(ICONS, "icon-180x180.png"))   # apple-touch
save(app_icon(1024, 0.70), os.path.join(ICONS, "icon-1024x1024.png"))  # stores

# ---- Maskable (Android): mark inside inner safe zone (~56%) on full-bleed bg ----
save(app_icon(512, 0.56), os.path.join(ICONS, "icon-maskable-512x512.png"))

# ---- Small icons / favicons ----
# ---- Simplified favicon glyph (legible at 16px) — bold "A" + infinity gesture ----
def _inf(cx, cy, a, b):
    return (f"M{cx},{cy} C{cx-a*0.55},{cy-b} {cx-a},{cy-b} {cx-a},{cy} "
            f"C{cx-a},{cy+b} {cx-a*0.55},{cy+b} {cx},{cy} "
            f"C{cx+a*0.55},{cy-b} {cx+a},{cy-b} {cx+a},{cy} "
            f"C{cx+a},{cy+b} {cx+a*0.55},{cy+b} {cx},{cy} Z")

FAVICON_GLYPH = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-label="Airento">
  <g fill="none" stroke="#0d9488" stroke-linecap="round" stroke-linejoin="round">
    <path d="M20,84 L45,24 Q50,14 55,24 L80,84" stroke-width="18"/>
    <path d="{_inf(50,58,21,10)}" stroke-width="11"/>
    <path d="M55,24 L68,52" stroke-width="18"/>
  </g>
</svg>'''

def render_glyph(size):
    png = cairosvg.svg2png(bytestring=FAVICON_GLYPH.encode(), output_width=size, output_height=size)
    return Image.open(io.BytesIO(png)).convert("RGBA")

# small icon + legacy favicon.png use the simplified glyph (crisp in tabs)
save(render_glyph(32), os.path.join(ICONS, "icon-32x32.png"))
save(render_glyph(32), os.path.join(PUB, "favicon.png"))

# favicon.svg — simplified glyph (crisp vector at tab sizes)
with open(os.path.join(PUB, "favicon.svg"), "w") as f:
    f.write(FAVICON_GLYPH)
print("wrote favicon.svg (simplified glyph)")

# favicon.ico — multi-resolution 16/32/48 from the simplified glyph
ico_sizes = [16, 32, 48]
ico_imgs = [render_glyph(s) for s in ico_sizes]
ico_imgs[0].save(
    os.path.join(PUB, "favicon.ico"),
    format="ICO",
    sizes=[(s, s) for s in ico_sizes],
    append_images=ico_imgs[1:],
)
print("wrote favicon.ico", ico_sizes, "(simplified glyph)")

# ---- Light mark variant (for dark backgrounds / dark theme) ----
# Bright teal + light slate so the mark stays high-contrast on dark chrome.
_master = open(MARK_SVG).read()
_light = (
    _master
    .replace("#41c6b4", "#7ff0dd").replace("#0d9488", "#2dd4bf").replace("#0a5c56", "#14b8a6")
    .replace("#94a1b1", "#e2e8f0").replace("#556170", "#aab6c6")
)
with open(os.path.join(PUB, "brand", "airento-mark-light.svg"), "w") as f:
    f.write(_light)
print("wrote brand/airento-mark-light.svg (dark-bg variant)")

# Header badge (white chip + mark in one SVG — forced-dark proof; Stage 201.42)
import subprocess
subprocess.check_call(["node", os.path.join(ROOT, "scripts", "build-airento-mark-badge.cjs")])

# ---- Notification badge (72x72, monochrome via alpha; Android tints it) ----
badge = render_mark(72)
# flatten to solid dark silhouette on transparent (alpha preserved)
solid = Image.new("RGBA", badge.size, (15, 118, 110, 0))
alpha = badge.split()[3]
solid.putalpha(alpha)
badge_canvas = Image.new("RGBA", (72, 72), (0, 0, 0, 0))
badge_canvas.alpha_composite(solid, ((72 - solid.width) // 2, (72 - solid.height) // 2))
save(badge_canvas, os.path.join(ICONS, "badge-72x72.png"))

# ---- Full-bleed vector app icon (replaces old placeholder) ----
_iw = round(512 * 0.70)
_ih = round(_iw / MARK_AR)
_ix = (512 - _iw) // 2
_iy = (512 - _ih) // 2
icon_svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="Airento">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#eafcfa"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <image href="/brand/airento-mark.svg" x="{_ix}" y="{_iy}" width="{_iw}" height="{_ih}"/>
</svg>
'''
with open(os.path.join(ICONS, "icon-512x512.svg"), "w") as f:
    f.write(icon_svg)
print("wrote icons/icon-512x512.svg")

print("\nDONE.")
