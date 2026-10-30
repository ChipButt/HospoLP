#!/usr/bin/env python3
"""Fetch and validate College Arms photos, then publish a completely self-hosted photo set.
This job deliberately fails before modifying pages if any required photo cannot be obtained.
"""
from __future__ import annotations
import hashlib, io, os, re, sys, time, json
from pathlib import Path
from urllib.parse import urlparse
import requests
from PIL import Image, UnidentifiedImageError

ROOT = Path("samples/college-arms")
OUT = ROOT / "assets" / "photos"
BASE = "https://images.trvl-media.com/lodging/18000000/17750000/17743200/17743106/"
GEO = {
    "home-front": ("https://s0.geograph.org.uk/geophotos/08/00/67/8006750_f6aac984.jpg", "Philip Halling · CC BY-SA 2.0 · https://www.geograph.org.uk/photo/8006750"),
    "story-green": ("https://s0.geograph.org.uk/geophotos/08/10/48/8104825_b1de9512.jpg", "Bikeboy · CC BY-SA 2.0 · https://www.geograph.org.uk/photo/8104825"),
    "visit-outside": ("https://s0.geograph.org.uk/geophotos/08/00/67/8006748_7abb8add.jpg", "Philip Halling · CC BY-SA 2.0 · https://www.geograph.org.uk/photo/8006748"),
}
HOTELS = {
    "restaurant": "41d2ac9a",
    "lounge": "aaa24ae7",
    "room-seymour": "25065652",
    "room-arragon": "e1e0083b",
    "room-boleyn": "85b56610",
    "room-cleaves": "b46cf1e7",
    "room-classic": "bad04af5",
    "exterior-hotel": "416f416d",
    "courtyard-hotel": "bf6a0b6a",
    "front-hotel": "26b7e91d",
}
hotel_license = "Hotels.com / property photography. Reuse subject to permission from copyright holder."
SOURCES = {name:([url],credit) for name,(url,credit) in GEO.items()}
for name,photoid in HOTELS.items():
    u = BASE + photoid + ".jpg"
    SOURCES[name] = ([
        u+"?impolicy=fcrop&w=1200&h=800",
        u+"?impolicy=resizecrop&rw=1200&ra=fit",
        u+"?impolicy=resizecrop&rw=598&ra=fit",
        u,
    ], hotel_license)

session = requests.Session()
session.headers.update({
 "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
 "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
 "Accept-Language": "en-GB,en;q=0.9",
})
OUT.mkdir(parents=True, exist_ok=True)
errors=[]
verified={}
hashes={}

def download(name,urls):
    for url in urls:
        try:
            headers={"Referer":"https://uk.hotels.com/"} if "trvl-media" in url else {}
            response=session.get(url,timeout=24,headers=headers)
            response.raise_for_status()
            if len(response.content)<12000 or len(response.content)>15000000:
                raise ValueError("unexpected download size "+str(len(response.content)))
            im=Image.open(io.BytesIO(response.content))
            im.load()
            if im.width < 390 or im.height < 250:
                raise ValueError("photo too small "+str(im.size))
            if im.width > 1700:
                im.thumbnail((1700,1400),Image.Resampling.LANCZOS)
            im=im.convert("RGB")
            import numpy as np
            a=np.array(im.resize((64,64)))
            if float(a.std())<15: raise ValueError("low-detail or solid-colour image")
            buffer=io.BytesIO()
            im.save(buffer,format="JPEG",quality=87,optimize=True,progressive=True)
            b=buffer.getvalue()
            digest=hashlib.sha256(b).hexdigest()
            if digest in hashes:
                raise ValueError("duplicate image content of "+hashes[digest])
            hashes[digest]=name
            (OUT/(name+".jpg")).write_bytes(b)
            verified[name]=(im.width,im.height,len(b),url)
            print("OK",name,im.size,len(b),url,flush=True)
            return
        except Exception as ex:
            print("FAILED ATTEMPT",name,type(ex).__name__,str(ex)[:180],flush=True)
    errors.append(name)

for name,(urls,credit) in SOURCES.items():download(name,urls)

(ROOT/"assets"/"photo-fetch-report.json").write_text(json.dumps({"available":list(verified),"failed":errors,"details":{name:list(data) for name,data in verified.items()}},indent=2)+"\n",encoding="utf-8")
mandatory={"home-front","story-green","visit-outside","restaurant","lounge","room-seymour"}
if mandatory.intersection(errors):
    print("REQUIRED PHOTOS UNAVAILABLE",sorted(mandatory.intersection(errors)),flush=True)
    sys.exit(1)

# Avoid referencing any missing optional photo, and never substitute a photo of an
# unrelated area for a room or restaurant.
def asset(name):
    if name not in verified: return None
    return "assets/photos/"+name+".jpg"

PAGES={
"index.html":("home-front",["home-front","visit-outside","courtyard-hotel","restaurant","front-hotel","lounge","story-green"]),
"story.html":("story-green",["home-front","visit-outside"]),
"food.html":("restaurant",["restaurant"]),
"stay.html":("room-seymour",["room-seymour","room-seymour","room-arragon","room-boleyn","room-cleaves","room-classic","lounge","restaurant","exterior-hotel","courtyard-hotel"]),
"events.html":("lounge",["lounge"]),
"visit.html":("visit-outside",["visit-outside"]),
}
for page,(hero,names) in PAGES.items():
    path=ROOT/page
    html=path.read_text(encoding="utf-8")
    idx=0
    def localise(match):
        global idx
        name=names[idx] if idx<len(names) else None
        idx+=1
        if not name or not asset(name):
            return re.sub(r"<img\b[^>]*>", "", match.group(0),count=1)
        tag=match.group(0)
        return re.sub(r'src="[^"]+"', 'src="'+asset(name)+'"',tag,count=1)
    html=re.sub(r'<img\b[^>]*>',localise,html)
    if page=="stay.html":
        # Strict: no room image may have failed.
        for name in ("room-seymour","room-arragon","room-boleyn","room-cleaves","room-classic"):
            if not asset(name):
                print("REQUIRED ROOM IMAGE MISSING",name)
                sys.exit(1)
    if page not in ("index.html","stay.html"):
        photo=asset(hero)
        hero_style = "background-image:linear-gradient(90deg,rgba(26,13,10,.82),rgba(30,13,10,.36)),url('"+photo+"')"
        html=html.replace('<section class="subhero">','<section class="subhero photo-page-hero" style="'+hero_style+'">',1)
    html=html.replace('style.css?v=identity-20261030','style.css?v=heroes-20261030')
    html=html.replace('style.css?v=story-20261030b','style.css?v=heroes-20261030')
    html=html.replace('style.css?v=stay-20261030','style.css?v=heroes-20261030')
    # Drop the invalid 2016 staff-photo reference if it cannot be downloaded and
    # avoid implying that a newer team has been verified.
    if page=="story.html":
        html=re.sub(r'<figure class="story-photo">\s*<img[^>]+2016[^>]*>.*?</figure>','',html,flags=re.S)
    path.write_text(html,encoding="utf-8")
    print("UPDATED",page,"images",idx)

stylesheet=ROOT/"style.css"
css=stylesheet.read_text(encoding="utf-8")
css+="""
/* Self-hosted individual page hero photography */
.subhero.photo-page-hero{
 background-position:center 48%;background-repeat:no-repeat;background-size:cover;
 min-height:470px;display:flex;align-items:center;color:#fff5e8;
}
.subhero.photo-page-hero .wrap{width:100%}
.subhero.photo-page-hero .tag{color:#f2c190}
.subhero.photo-page-hero p{color:#f6eadd}
.subhero.photo-page-hero h1{text-shadow:0 3px 24px rgba(0,0,0,.24)}
.newhero-photo{object-position:center 55%}
.stay-room>img{background:#e8d8c5}
@media(max-width:700px){
 .subhero.photo-page-hero{min-height:380px;background-position:55% center}
 .newhero-photo{object-position:60% center}
}
"""
stylesheet.write_text(css,encoding="utf-8")
credits=["# College Arms photo provenance","", "Images for a prospect demo only. Obtain the rights holder's permission before public commercial client deployment.",""]
for name,(urls,credit) in SOURCES.items():
    credits.append("- "+name+".jpg: "+credit+(" [not downloaded]" if name not in verified else ""))
(ROOT/"assets"/"PHOTO-SOURCES.md").write_text("\n".join(credits)+"\n",encoding="utf-8")
print("ASSET IMPORT COMPLETE. images:",len(verified),"missing:",errors,flush=True)
