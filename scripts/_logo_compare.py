"""Iteration 3: B2 = geometric refinement of the ORIGINAL (tall woven A + sweeping ribbon).
Compare CURRENT vs B2 (recommended) vs C (monoline minimal)."""
import io, cairosvg
from PIL import Image, ImageDraw, ImageFont

VB = "0 0 260 210"

# ---- B2: faithful geometric rebuild — tall A + elegant diagonal ribbon, woven, 2-tone ----
A_LEG = "M58,184 L121,56 Q128,45 135,56 L198,184"
RIBBON = "M44,156 C64,150 72,136 90,130 C120,120 142,150 170,133 C192,120 200,110 216,100"
# weave: ribbon UNDER left leg (redraw left-leg segment on top), OVER right leg (ribbon already on top)
LEFT_OVER = "M76,140 L104,88"
B2 = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="{VB}">
  <defs><linearGradient id="t" x1="0.1" y1="0" x2="0.9" y2="1">
    <stop offset="0" stop-color="#33bfad"/><stop offset="1" stop-color="#0b736b"/></linearGradient></defs>
  <g fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="{A_LEG}" stroke="url(#t)" stroke-width="25"/>
    <path d="{RIBBON}" stroke="#69757f" stroke-width="21"/>
    <path d="{LEFT_OVER}" stroke="url(#t)" stroke-width="25"/>
  </g>
</svg>'''

# ---- C: monoline minimal, A + infinity crossbar, single color ----
def inf(cx,cy,a,b):
    return (f"M{cx},{cy} C{cx-a*0.55},{cy-b} {cx-a},{cy-b} {cx-a},{cy} "
            f"C{cx-a},{cy+b} {cx-a*0.55},{cy+b} {cx},{cy} "
            f"C{cx+a*0.55},{cy-b} {cx+a},{cy-b} {cx+a},{cy} "
            f"C{cx+a},{cy+b} {cx+a*0.55},{cy+b} {cx},{cy} Z")
C = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="{VB}">
  <g fill="none" stroke="#0d9488" stroke-width="22" stroke-linecap="round" stroke-linejoin="round">
    <path d="M62,184 L123,58 Q130,46 137,58 L198,184"/>
    <path d="{inf(130,120,56,26)}"/>
    <path d="M137,58 L165,116"/>
  </g>
</svg>'''

def render(svg,w):
    h=round(w*210/260); return Image.open(io.BytesIO(cairosvg.svg2png(bytestring=svg.encode(),output_width=w,output_height=h))).convert("RGBA")
def rfile(p,w):
    h=round(w*1107/1432); return Image.open(io.BytesIO(cairosvg.svg2png(url=p,output_width=w,output_height=h))).convert("RGBA")

font=ImageFont.truetype("/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",20)
fsm=ImageFont.truetype("/usr/share/fonts/truetype/freefont/FreeSans.ttf",15)
cols=[("CURRENT",("file","/app/public/brand/airento-mark.svg")),
      ("B2 refined original",("svg",B2)),
      ("C monoline minimal",("svg",C))]
COLW,ROWH=340,230; W=COLW*3; H=50+ROWH*2+200
sheet=Image.new("RGBA",(W,H),(245,247,249,255)); d=ImageDraw.Draw(sheet)
for i,(n,_) in enumerate(cols): d.text((i*COLW+16,16),n,font=font,fill=(15,23,42,255))
def big(s,size=210):
    k,v=s; return rfile(v,size) if k=="file" else render(v,size)
d.rectangle([0,50,W,50+ROWH],fill=(255,255,255,255))
for i,(_,s) in enumerate(cols):
    m=big(s); sheet.alpha_composite(m,(i*COLW+(COLW-m.width)//2,50+(ROWH-m.height)//2))
y2=50+ROWH; d.rectangle([0,y2,W,y2+ROWH],fill=(15,23,42,255))
for i,(_,s) in enumerate(cols):
    m=big(s); sheet.alpha_composite(m,(i*COLW+(COLW-m.width)//2,y2+(ROWH-m.height)//2))
y3=y2+ROWH; d.rectangle([0,y3,W,y3+200],fill=(255,255,255,255))
d.text((16,y3+8),"32px favicon test (real pixels, upscaled x5):",font=fsm,fill=(71,85,105,255))
for i,(_,s) in enumerate(cols):
    k,v=s; m=(rfile(v,32) if k=="file" else render(v,32))
    tile=Image.new("RGBA",(32,26),(255,255,255,255)); tile.alpha_composite(m,(0,(26-m.height)//2))
    sheet.alpha_composite(tile.resize((160,130),Image.NEAREST),(i*COLW+(COLW-160)//2,y3+44))
sheet.convert("RGB").save("/tmp/logo_compare.png"); print("saved")
