"""
Geometric RESTORATION of CURRENT mark (preserve form, double contours, ribbon dynamics,
modulated widths & tapered terminals) — just clean the hand-drawn wobble.

Pipeline: hi-res upscale -> color classify (teal/gray) via numpy -> smooth each mask
(blur+threshold+fill small holes) to remove edge jitter WITHOUT losing tapers ->
trace with vtracer splines (smooth) -> assemble two-tone with refined gradients.
Outputs /tmp/airento-restored.svg (does NOT touch committed master).
"""
import io, re
import numpy as np
import vtracer
from PIL import Image, ImageFilter
from collections import deque

SRC = "/app/public/brand/airento-mark.png"
SCALE = 8

im = Image.open(SRC).convert("RGB")
im = im.resize((im.width * SCALE, im.height * SCALE), Image.LANCZOS)
W, H = im.size
a = np.asarray(im).astype(np.float32)
r, g, b = a[..., 0], a[..., 1], a[..., 2]
mx = np.maximum(np.maximum(r, g), b)
mn = np.minimum(np.minimum(r, g), b)
delta = mx - mn
v = mx / 255.0
s = np.where(mx > 0, delta / np.maximum(mx, 1), 0)

# hue (degrees)
hue = np.zeros_like(mx)
mask = delta > 0
# red max
rm = (mx == r) & mask
gm = (mx == g) & mask & ~rm
bm = (mx == b) & mask & ~rm & ~gm
hue[rm] = (60 * ((g[rm] - b[rm]) / delta[rm]) + 360) % 360
hue[gm] = 60 * ((b[gm] - r[gm]) / delta[gm]) + 120
hue[bm] = 60 * ((r[bm] - g[bm]) / delta[bm]) + 240

bg = (mn > 210) | ((v > 0.90) & (s < 0.10))
teal = (~bg) & (hue >= 150) & (hue <= 205) & (s >= 0.12) & (g >= b - 4)
gray = (~bg) & (~teal)

def to_mask(boolarr):
    # shape (True) -> 0 (black), else 255 (white)  [vtracer binary: dark = shape]
    m = np.where(boolarr, 0, 255).astype(np.uint8)
    return Image.fromarray(m, "L")

def fill_small_holes(mask, max_frac=0.0025):
    arr = np.array(mask); h, w = arr.shape
    white = arr >= 128
    reach = np.zeros_like(white); dq = deque()
    for x in range(w):
        for y in (0, h - 1):
            if white[y, x] and not reach[y, x]: reach[y, x] = True; dq.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if white[y, x] and not reach[y, x]: reach[y, x] = True; dq.append((y, x))
    while dq:
        y, x = dq.popleft()
        for dy, dx in ((1,0),(-1,0),(0,1),(0,-1)):
            ny, nx = y+dy, x+dx
            if 0<=ny<h and 0<=nx<w and white[ny,nx] and not reach[ny,nx]:
                reach[ny,nx]=True; dq.append((ny,nx))
    enclosed = white & ~reach
    limit = int(max_frac*h*w); visited=np.zeros_like(enclosed)
    ys,xs=np.where(enclosed)
    for sy,sx in zip(ys.tolist(),xs.tolist()):
        if visited[sy,sx]: continue
        comp=[]; q=deque([(sy,sx)]); visited[sy,sx]=True
        while q:
            y,x=q.popleft(); comp.append((y,x))
            for dy,dx in ((1,0),(-1,0),(0,1),(0,-1)):
                ny,nx=y+dy,x+dx
                if 0<=ny<h and 0<=nx<w and enclosed[ny,nx] and not visited[ny,nx]:
                    visited[ny,nx]=True; q.append((ny,nx))
        if len(comp)<=limit:
            for (y,x) in comp: arr[y,x]=0
    return Image.fromarray(arr)

def smooth(mask):
    # blur + threshold => remove high-freq edge jitter, keep smooth curves & tapers
    m = mask.filter(ImageFilter.GaussianBlur(SCALE * 1.1))
    m = m.point(lambda p: 0 if p < 128 else 255)
    m = fill_small_holes(m)
    # tiny speckle clean
    m = m.filter(ImageFilter.MedianFilter(3))
    m = m.point(lambda p: 0 if p < 128 else 255)
    return m

teal_m = smooth(to_mask(teal))
gray_m = smooth(to_mask(gray))
teal_m.save("/tmp/rm_teal.png"); gray_m.save("/tmp/rm_gray.png")

def trace(mask_img):
    p = "/tmp/rt_tmp.png"; mask_img.save(p)
    o = "/tmp/rt_tmp.svg"
    vtracer.convert_image_to_svg_py(
        p, o, colormode="binary", mode="spline",
        filter_speckle=int((SCALE*SCALE)*0.9), corner_threshold=72,
        length_threshold=4.0, splice_threshold=48, path_precision=2)
    svg = open(o).read()
    return re.findall(r'<path\b[^>]*/>', svg)

teal_paths = trace(teal_m)
gray_paths = trace(gray_m)
print("teal paths", len(teal_paths), "gray paths", len(gray_paths))

# tight bbox
shape = (np.array(teal_m) < 128) | (np.array(gray_m) < 128)
ys, xs = np.where(shape)
minx, maxx, miny, maxy = xs.min(), xs.max(), ys.min(), ys.max()
pad = int(SCALE*3)
minx-=pad; miny-=pad; maxx+=pad; maxy+=pad
bw, bh = maxx-minx, maxy-miny

def recolor(els, fill):
    out=[]
    for el in els:
        el = re.sub(r'fill="[^"]*"', f'fill="{fill}"', el)
        if 'fill=' not in el: el = el.replace('<path', f'<path fill="{fill}"',1)
        out.append('    '+el)
    return "\n".join(out)

svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="{minx} {miny} {bw} {bh}" role="img" aria-label="Airento">
  <defs>
    <linearGradient id="tealGrad" x1="12%" y1="0%" x2="92%" y2="100%">
      <stop offset="0%" stop-color="#41c6b4"/>
      <stop offset="48%" stop-color="#0d9488"/>
      <stop offset="100%" stop-color="#0a5c56"/>
    </linearGradient>
    <linearGradient id="grayGrad" x1="0%" y1="0%" x2="100%" y2="55%">
      <stop offset="0%" stop-color="#94a1b1"/>
      <stop offset="100%" stop-color="#556170"/>
    </linearGradient>
  </defs>
  <g>
{recolor(gray_paths, "url(#grayGrad)")}
{recolor(teal_paths, "url(#tealGrad)")}
  </g>
</svg>
'''
open("/tmp/airento-restored.svg","w").write(svg)
print("restored svg bytes", len(svg), "viewBox", minx, miny, bw, bh)
