#!/usr/bin/env python3
"""Add the three exact College Arms story photographs referenced in the brief.

Only publish the page after all three image downloads validate. Do not
substitute unrelated hotel or bedroom pictures.
"""
from pathlib import Path
import requests,io,json,re,sys
from PIL import Image

root=Path("samples/college-arms")
target=root/"assets"/"photos"
target.mkdir(parents=True,exist_ok=True)
photos={
"story-team-2016": {
 "urls":["https://images.openai.com/static-rsc-4/mqnQ8JMzT8wE2bk-fLY5-_iVm4RmPU7ySvR-3coxkWesY5H-gkFqucxeddg1IgZqMIPM2PU-rktEKlLFvffNJHvgOrXPG3xXtiIcr8Q7qj0YN9qR97knAlztNHN7mr58h_8ZvfSKZX5JpzvejRKokbY0hB6pICuOAu8a-l4POX0?purpose=inline"],
 "credit":"Historical reopening staff photograph (2016), WiderView Visual Media; supplied reference URL"
},
"story-village-green": {
 "urls":["https://images.openai.com/static-rsc-4/VLGc9-DUfz4k_SiSXCQMVvI1MEPphuIU9ikz80VhcfmdA90tE9j3rUtLfQA_9OA0Ev1Q_TIbhmxURZtbtlJoM52oAt_Qnzv2M0LRsVInpuSHmBrjtmiGxuFelXB5zpec5GuB_cxS6WsCGm4fO5o4DVZ43cRmXFL6UnlkiUmPbUo?purpose=inline"],
 "credit":"The College Arms from the village green, from user-supplied Historic England/British Listed Buildings reference"
},
"story-pub-outside": {
 "urls":["https://images.openai.com/static-rsc-4/X0To3bOeBYdjuYeBPUG10c_x044myo04GS3jcfnNiDcizvXKJLcVFkeh3ZQxVQCeTPDDlY3kzMD4TTXYvAchCWI4LtHQYH1p4eyYbkJjBuOBuexvuw4pLh_FEnApRTD31WZizZ0IuJXUrou6ztCRNc7bKfh-8C_129KheYqeL0M?purpose=inline"],
 "credit":"The College Arms exterior, Philip Halling, Geograph, CC BY-SA 2.0"
}
}
session=requests.Session()
session.headers["User-Agent"]="Mozilla/5.0"
errors=[]
for name,record in photos.items():
    file=target/(name+".jpg")
    if file.exists():
        try:
            with Image.open(file) as im: im.verify()
            print("EXISTS",name)
            continue
        except Exception: pass
    ok=False
    for url in record["urls"]:
        try:
            r=session.get(url,timeout=25)
            r.raise_for_status()
            im=Image.open(io.BytesIO(r.content))
            im.load()
            if im.width<250 or im.height<200: raise ValueError("Photo too small")
            im=im.convert("RGB")
            im.thumbnail((1500,1200),Image.Resampling.LANCZOS)
            im.save(file,format="JPEG",quality=87,optimize=True)
            print("DOWNLOADED",name,im.size,len(r.content),flush=True)
            ok=True
            break
        except Exception as ex:
            print("FETCH FAILED",name,type(ex).__name__,str(ex)[:180],flush=True)
    if not ok:errors.append(name)

if errors:
    (root/"assets"/"story-photo-fetch-errors.json").write_text(json.dumps({"failed":errors},indent=2)+"\n")
    print("Not changing page; missing",errors)
    sys.exit(1)

story=root/"story.html"
html=story.read_text()
for name in photos:
    if not (target/(name+".jpg")).exists(): sys.exit(2)
html=html.replace('src="assets/photos/front-hotel.jpg" alt="The College Arms historic stone frontage overlooking the village green"', 'src="assets/photos/story-village-green.jpg" alt="The College Arms stone frontage facing the Lower Quinton village green"')
html=html.replace('src="assets/photos/exterior-hotel.jpg" alt="The College Arms stone building, outdoor seating and pub sign beside the green"', 'src="assets/photos/story-pub-outside.jpg" alt="The College Arms outside with its traditional hanging sign"')
staff='<figure class="story-photo"><img src="assets/photos/story-team-2016.jpg" alt="The College Arms team at the 2016 reopening, photographed behind the bar" loading="lazy"><figcaption>The team at the 2016 reopening</figcaption></figure>'
marker='<div class="tag">People behind the bar</div>'
if 'story-team-2016.jpg' not in html:
    html=html.replace(marker,marker,1).replace('<div class="tag">People behind the bar</div>', '<div class="tag">People behind the bar</div>',1)
    # Place opposite the team text, at the end of the section's two-column grid.
    start=html.find('<div class="tag">People behind the bar</div>')
    end=html.find('</div></div></section>',start)
    if start<0 or end<0:raise SystemExit("staff section not found")
    html=html[:end+6]+staff+html[end+6:]
html=html.replace('style.css?v=brand-and-story-20261030','style.css?v=story-gallery-20261030')
story.write_text(html)
credits=root/"assets"/"PHOTO-SOURCES.md"
with credits.open("a") as f:
    f.write("\n## Our Story photo credits\n")
    for name,record in photos.items(): f.write("- "+name+".jpg: "+record["credit"]+"\n")
print("Three exact story photos successfully installed")
