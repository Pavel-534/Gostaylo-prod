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

# mark aspect ratio (w:h) from viewBox
MARK_AR = 1432 / 1107  # ~1.2936 (wider than tall)

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
save(app_icon(32, 0.92, transparent=True), os.path.join(ICONS, "icon-32x32.png"))
save(app_icon(32, 0.92, transparent=True), os.path.join(PUB, "favicon.png"))

# favicon.svg — transparent mark (crisp vector in modern browsers)
with open(MARK_SVG, "rb") as f:
    svg_bytes = f.read()
with open(os.path.join(PUB, "favicon.svg"), "wb") as f:
    f.write(svg_bytes)
print("wrote favicon.svg")

# favicon.ico — multi-resolution 16/32/48 (transparent mark)
ico_sizes = [16, 32, 48]
ico_imgs = [app_icon(s, 0.94, transparent=True) for s in ico_sizes]
ico_imgs[0].save(
    os.path.join(PUB, "favicon.ico"),
    format="ICO",
    sizes=[(s, s) for s in ico_sizes],
    append_images=ico_imgs[1:],
)
print("wrote favicon.ico", ico_sizes)

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
icon_svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="Airento">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#eafcfa"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <image href="/brand/airento-mark.svg" x="77" y="118" width="358" height="277"/>
</svg>
'''
with open(os.path.join(ICONS, "icon-512x512.svg"), "w") as f:
    f.write(icon_svg)
print("wrote icons/icon-512x512.svg")

print("\nDONE.")
