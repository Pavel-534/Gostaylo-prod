"""Brand assets library + lockup builder.
Wordmark rendered from Inter (outlines -> SVG paths) so files are self-contained.
"""
import io, re, os
import cairosvg
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen

ROOT = "/app"
MARK = os.path.join(ROOT, "public/brand/airento-mark.svg")
INTER_800 = "/tmp/inter-800.ttf"
INTER_600 = "/tmp/inter-600.ttf"

# ---------- wordmark (text -> svg paths) ----------
def _font(path):
    f = TTFont(path)
    return f, f["head"].unitsPerEm, f.getGlyphSet(), f.getBestCmap(), f["hmtx"]

def wordmark(text, font_path, size, color, tracking_em=0.0, x0=0, baseline=0):
    """Return (svg_group_str, advance_width_px). Glyphs flipped to SVG y-down."""
    f, upm, gs, cmap, hmtx = _font(font_path)
    s = size / upm
    track = tracking_em * upm  # font units between glyphs
    x = 0.0
    parts = []
    for ch in text:
        gname = cmap.get(ord(ch))
        if gname is None:
            x += 0.5 * upm + track
            continue
        pen = SVGPathPen(gs)
        gs[gname].draw(pen)
        d = pen.getCommands()
        if d.strip():
            parts.append(f'<path d="{d}" transform="translate({x:.1f},0)"/>')
        x += hmtx[gname][0] + track
    width_px = x * s
    group = (f'<g transform="translate({x0:.2f},{baseline:.2f}) scale({s:.5f},{-s:.5f})" '
             f'fill="{color}">\n' + "\n".join(parts) + "\n</g>")
    return group, width_px

# ---------- mark (inline, self-contained) ----------
def mark_inline(target_h, x, y):
    """Return (defs_str, group_str, width_px) placing the mark at (x,y) with height target_h."""
    svg = open(MARK).read()
    vb = re.search(r'viewBox="([\d.\- ]+)"', svg).group(1).split()
    vx, vy, vw, vh = (float(v) for v in vb)
    defs = re.search(r"<defs>.*?</defs>", svg, re.S).group(0)
    g = re.search(r"<g>.*?</g>", svg, re.S).group(0)
    s = target_h / vh
    width_px = vw * s
    group = (f'<g transform="translate({x:.2f},{y:.2f}) scale({s:.5f}) '
             f'translate({-vx:.2f},{-vy:.2f})">{g}</g>')
    return defs, group, width_px

# ---------- lockup ----------
def build_lockup(color_word="#0d9488", color_sub="#64748b", filename="airento-lockup.svg"):
    MARK_H = 132.0
    GAP = 30.0
    mark_defs, mark_g, mark_w = mark_inline(MARK_H, 0, 0)

    word_size = 96.0
    # cap height Inter ~0.727em -> place baseline; stack Airento + rentals, vertically centered
    cap = word_size * 0.727
    sub_size = 21.0
    sub_track = 0.26
    block_h = cap + 14 + sub_size
    top = (MARK_H - block_h) / 2
    word_baseline = top + cap
    word_g, word_w = wordmark("Airento", INTER_800, word_size, color_word,
                              tracking_em=0.005, x0=mark_w + GAP, baseline=word_baseline)
    sub_baseline = word_baseline + 18 + sub_size
    sub_g, sub_w = wordmark("RENTALS", INTER_600, sub_size, color_sub,
                            tracking_em=sub_track, x0=mark_w + GAP + 3, baseline=sub_baseline)

    total_w = mark_w + GAP + max(word_w, sub_w)
    pad = 6
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="{-pad} {-pad} {total_w+2*pad:.1f} {MARK_H+2*pad:.1f}" role="img" aria-label="Airento rentals">
  {mark_defs}
  {mark_g}
  {word_g}
  {sub_g}
</svg>
'''
    out = os.path.join(ROOT, "public/brand", filename)
    open(out, "w").write(svg)
    print("wrote", out, "viewBox w:", round(total_w+2*pad,1))
    return out

def _render_png(svg_path, out, w, bg=None):
    svg = open(svg_path).read()
    vb = re.search(r'viewBox="([\d.\- ]+)"', svg).group(1).split()
    ar = float(vb[2]) / float(vb[3])
    h = round(w / ar)
    cairosvg.svg2png(url=svg_path, write_to=out, output_width=w, output_height=h,
                     background_color=bg)
    return h

def _mark_png(target_w):
    """RGBA PIL of the mark at width target_w (transparent)."""
    from PIL import Image
    svg = open(MARK).read()
    vb = re.search(r'viewBox="([\d.\- ]+)"', svg).group(1).split()
    ar = float(vb[2]) / float(vb[3])
    h = round(target_w / ar)
    png = cairosvg.svg2png(url=MARK, output_width=target_w, output_height=h)
    return Image.open(io.BytesIO(png)).convert("RGBA")

def _lockup_png(svg_path, target_w):
    from PIL import Image
    png = cairosvg.svg2png(url=svg_path, output_width=target_w,
                           output_height=round(target_w / _ar(svg_path)))
    return Image.open(io.BytesIO(png)).convert("RGBA")

def _ar(svg_path):
    vb = re.search(r'viewBox="([\d.\- ]+)"', open(svg_path).read()).group(1).split()
    return float(vb[2]) / float(vb[3])

def _vgrad(size, top, bottom):
    """Vertical gradient RGBA image (numpy-fast). size=(w,h)."""
    from PIL import Image
    import numpy as np
    w, h = size
    t = np.linspace(0, 1, h)[:, None]
    top = np.array(top); bottom = np.array(bottom)
    row = (top[None, :] + (bottom - top)[None, :] * t)  # h x 3
    arr = np.repeat(row[:, None, :], w, axis=1).astype(np.uint8)  # h x w x 3
    a = np.full((h, w, 1), 255, np.uint8)
    return Image.fromarray(np.concatenate([arr, a], axis=2), "RGBA")

def _radial_glow(size, center, radius, color, max_alpha):
    from PIL import Image
    import numpy as np
    w, h = size
    yy, xx = np.mgrid[0:h, 0:w]
    d = np.sqrt((xx - center[0]) ** 2 + (yy - center[1]) ** 2)
    a = np.clip((1 - d / radius), 0, 1) ** 2 * max_alpha
    arr = np.zeros((h, w, 4), np.uint8)
    arr[..., 0] = color[0]; arr[..., 1] = color[1]; arr[..., 2] = color[2]
    arr[..., 3] = a.astype(np.uint8)
    return Image.fromarray(arr, "RGBA")


# ---------- OG card 1200x630 ----------
def build_og():
    from PIL import Image, ImageDraw, ImageFont
    W, H = 1200, 630
    card = _vgrad((W, H), (11, 20, 33), (9, 34, 38)).convert("RGBA")  # navy -> deep teal-navy
    card.alpha_composite(_radial_glow((W, H), (W * 0.5, H * 0.34), 520, (13, 148, 136), 120))
    d = ImageDraw.Draw(card)
    # lockup (white on dark), centered horizontally, upper area
    lock = _lockup_png(os.path.join(ROOT, "public/brand/airento-lockup-onbg.svg"), 720)
    card.alpha_composite(lock, ((W - lock.width) // 2, 150))
    # tagline
    f = ImageFont.truetype(INTER_600, 34)
    tag = "Cross-border rentals, escrow-secured worldwide"
    tw = d.textbbox((0, 0), tag, font=f)[2]
    d.text(((W - tw) // 2, 430), tag, font=f, fill=(191, 205, 220, 255))
    # thin divider + small caps
    d.line([(W // 2 - 60, 500), (W // 2 + 60, 500)], fill=(13, 148, 136, 200), width=3)
    f2 = ImageFont.truetype(INTER_600, 22)
    sub = "PHUKET  ·  RUSSIA  ·  WORLDWIDE"
    sw = d.textbbox((0, 0), sub, font=f2)[2]
    # letter spacing manual
    x = (W - (sw + 0.14 * 22 * len(sub))) / 2
    for ch in sub:
        d.text((x, 528), ch, font=f2, fill=(120, 140, 160, 255))
        x += d.textbbox((0, 0), ch, font=f2)[2] + 0.14 * 22
    out_png = os.path.join(ROOT, "public/og-image.png")
    out_jpg = os.path.join(ROOT, "public/og-image.jpg")
    card.convert("RGB").save(out_png)
    card.convert("RGB").save(out_jpg, quality=90)
    print("wrote", out_png, "and og-image.jpg")

# iOS splash: (logical_w, logical_h, dpr) — device-width/height are CSS points
IOS_SPLASH = [
    (440, 956, 3),  # 16 Pro Max / 15 Pro Max
    (430, 932, 3),  # 15 Plus / 14 Pro Max
    (402, 874, 3),  # 16 Pro
    (393, 852, 3),  # 15 / 15 Pro / 14 Pro
    (428, 926, 3),  # 14 Plus / 13 Pro Max / 12 Pro Max
    (390, 844, 3),  # 14 / 13 / 13 Pro / 12 / 12 Pro
    (375, 812, 3),  # X / XS / 11 Pro / 13 mini / 12 mini(≈)
    (414, 896, 3),  # XS Max / 11 Pro Max
    (414, 896, 2),  # XR / 11
    (375, 667, 2),  # SE2/SE3 / 8 / 7 / 6s
    (414, 736, 3),  # 8 Plus / 7 Plus / 6s Plus
]
def build_splash():
    from PIL import Image
    outdir = os.path.join(ROOT, "public/splash")
    os.makedirs(outdir, exist_ok=True)
    seen = set()
    for (lw, lh, dpr) in IOS_SPLASH:
        w, h = lw * dpr, lh * dpr
        if (w, h) in seen:
            continue
        seen.add((w, h))
        bg = _vgrad((w, h), (12, 22, 35), (10, 33, 37)).convert("RGBA")
        bg.alpha_composite(_radial_glow((w, h), (w * 0.5, h * 0.42), int(w * 0.6), (13, 148, 136), 90))
        lock = _lockup_png(os.path.join(ROOT, "public/brand/airento-lockup-onbg.svg"),
                           int(w * 0.62))
        bg.alpha_composite(lock, ((w - lock.width) // 2, int(h * 0.42) - lock.height // 2))
        bg.convert("RGB").save(os.path.join(outdir, f"apple-splash-{w}-{h}.png"))
    print("wrote", len(seen), "splash screens")

def splash_link_tags():
    tags = []
    for (lw, lh, dpr) in IOS_SPLASH:
        w, h = lw * dpr, lh * dpr
        tags.append(
            f'<link rel="apple-touch-startup-image" '
            f'media="screen and (device-width: {lw}px) and (device-height: {lh}px) '
            f'and (-webkit-device-pixel-ratio: {dpr}) and (orientation: portrait)" '
            f'href="/splash/apple-splash-{w}-{h}.png" />'
        )
    return "\n".join(tags)

# ---------- Dark app icons ----------
def build_dark_icons():
    from PIL import Image
    ICONS = os.path.join(ROOT, "public/icons")
    def dark_icon(size, frac):
        bg = _vgrad((size, size), (16, 25, 41), (8, 34, 33)).convert("RGBA")  # navy -> deep teal
        mw = round(size * frac)
        m = _mark_png(mw)
        bg.alpha_composite(m, ((size - mw) // 2, (size - m.height) // 2))
        return bg
    for s in (192, 512, 1024):
        dark_icon(s, 0.70).save(os.path.join(ICONS, f"icon-dark-{s}x{s}.png"))
    dark_icon(512, 0.56).save(os.path.join(ICONS, "icon-dark-maskable-512x512.png"))
    print("wrote dark icons 192/512/1024 + maskable")


if __name__ == "__main__":
    light = build_lockup()
    dark = build_lockup(color_word="#ffffff", color_sub="#9fb0c3", filename="airento-lockup-onbg.svg")
    # lockup transparent PNGs (emails/sharing)
    from PIL import Image
    _lockup_png(light, 1000).save(os.path.join(ROOT, "public/brand/airento-lockup.png"))
    _lockup_png(dark, 1000).save(os.path.join(ROOT, "public/brand/airento-lockup-onbg.png"))
    print("wrote lockup PNGs")
    build_og()
    build_splash()
    build_dark_icons()
    # previews
    _render_png(light, "/tmp/prev_lockup_light.png", 900, "white")
    _render_png(dark, "/tmp/prev_lockup_dark.png", 900, "#0f172a")
    print("DONE. splash link tags:\n" + splash_link_tags())

