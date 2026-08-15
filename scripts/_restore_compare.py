import io, cairosvg
from PIL import Image, ImageDraw, ImageFont

def rfile(p,w,ar):
    h=round(w/ar); return Image.open(io.BytesIO(cairosvg.svg2png(url=p,output_width=w,output_height=h))).convert("RGBA")

CUR="/app/public/brand/airento-mark.svg"; CUR_AR=1432/1107
RES="/tmp/airento-restored.svg"; RES_AR=2306/1799

font=ImageFont.truetype("/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",20)
fsm=ImageFont.truetype("/usr/share/fonts/truetype/freefont/FreeSans.ttf",15)
cols=[("CURRENT (before)",CUR,CUR_AR),("RESTORED (after)",RES,RES_AR)]
COLW,ROWH=440,250; W=COLW*2; H=50+ROWH*2+210
sheet=Image.new("RGBA",(W,H),(245,247,249,255)); d=ImageDraw.Draw(sheet)
for i,(n,_,_) in enumerate(cols): d.text((i*COLW+16,16),n,font=font,fill=(15,23,42,255))
def big(p,ar,size=220): return rfile(p,size,ar)
d.rectangle([0,50,W,50+ROWH],fill=(255,255,255,255))
for i,(_,p,ar) in enumerate(cols):
    m=big(p,ar); sheet.alpha_composite(m,(i*COLW+(COLW-m.width)//2,50+(ROWH-m.height)//2))
y2=50+ROWH; d.rectangle([0,y2,W,y2+ROWH],fill=(15,23,42,255))
for i,(_,p,ar) in enumerate(cols):
    m=big(p,ar); sheet.alpha_composite(m,(i*COLW+(COLW-m.width)//2,y2+(ROWH-m.height)//2))
y3=y2+ROWH; d.rectangle([0,y3,W,y3+210],fill=(255,255,255,255))
d.text((16,y3+8),"32px favicon test (real pixels, upscaled x5):",font=fsm,fill=(71,85,105,255))
for i,(_,p,ar) in enumerate(cols):
    m=rfile(p,32,ar); tile=Image.new("RGBA",(32,26),(255,255,255,255)); tile.alpha_composite(m,(0,(26-m.height)//2))
    sheet.alpha_composite(tile.resize((160,130),Image.NEAREST),(i*COLW+(COLW-160)//2,y3+46))
sheet.convert("RGB").save("/tmp/logo_restore_compare.png"); print("saved")
