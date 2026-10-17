#!/usr/bin/env python3
"""Refresh The Village Cafe's public website feed from authorised Meta accounts.

No scraper, no public tokens, no fabricated posts. Runs in GitHub Actions.
If an account is not configured or Meta is unavailable, preserve existing posts.
"""
import hashlib
import io
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from PIL import Image, ImageOps, UnidentifiedImageError

BASE = Path(__file__).resolve().parents[1]
SITE = BASE / "samples" / "village-cafe-bidford"
DATA = SITE / "data" / "social-posts.json"
IMAGES = SITE / "assets" / "village-cafe" / "social"
GRAPH = "https://graph.facebook.com/v26.0/"
VALID_SOURCE = {"facebook", "instagram"}
USER_AGENT = "VillageCafeSiteFeed/1.0"

def graph_get(endpoint, token, params):
    url = GRAPH + endpoint.strip("/") + "?" + urllib.parse.urlencode(params)
    request = urllib.request.Request(url, headers={
        "Authorization": "Bearer " + token,
        "Accept": "application/json",
        "User-Agent": USER_AGENT,
    })
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)

def stable_date(value):
    if not value:
        return None
    try:
        date = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return date.astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    except (TypeError, ValueError):
        return None

def safe_url(value, domain):
    if not isinstance(value, str):
        return None
    parsed = urllib.parse.urlsplit(value)
    host = (parsed.hostname or "").lower()
    if parsed.scheme != "https" or not (host == domain or host.endswith("." + domain)):
        return None
    return value

def cache_photo(raw_url, source, post_id):
    if not isinstance(raw_url, str) or not raw_url.startswith("https://"):
        return None
    name = source + "-" + hashlib.sha256(post_id.encode("utf-8")).hexdigest()[:20] + ".webp"
    dest = IMAGES / name
    if dest.exists() and dest.stat().st_size > 100:
        return "assets/village-cafe/social/" + name
    try:
        request = urllib.request.Request(raw_url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(request, timeout=25) as response:
            mime = (response.headers.get("Content-Type") or "").lower()
            if "image/" not in mime:
                return None
            data = response.read(8_000_001)
            if not data or len(data) > 8_000_000:
                return None
        with Image.open(io.BytesIO(data)) as original:
            photo = ImageOps.exif_transpose(original).convert("RGB")
            photo.thumbnail((1320, 1320), Image.Resampling.LANCZOS)
            IMAGES.mkdir(parents=True, exist_ok=True)
            photo.save(dest, format="WEBP", quality=79, method=5)
        return "assets/village-cafe/social/" + name
    except (OSError, ValueError, UnidentifiedImageError, urllib.error.URLError) as error:
        print("Photo unavailable for", source, post_id, type(error).__name__, file=sys.stderr)
        return None

def facebook_posts(page_id, token):
    payload = graph_get(page_id + "/posts", token, {
        "fields": "id,message,created_time,full_picture,permalink_url",
        "limit": 12,
    })
    posts = []
    for item in payload.get("data", []):
        if not isinstance(item, dict):
            continue
        link = safe_url(item.get("permalink_url"), "facebook.com")
        date = stable_date(item.get("created_time"))
        if not link or not date:
            continue
        text = (item.get("message") or "").strip()[:2000]
        image = cache_photo(item.get("full_picture"), "facebook", str(item.get("id", link)))
        if not text and not image:
            continue
        posts.append({"source": "facebook", "permalink": link,
                      "published_at": date, "text": text, "image": image})
    return posts

def instagram_posts(user_id, token):
    payload = graph_get(user_id + "/media", token, {
        "fields": "id,caption,permalink,timestamp,media_type,media_url,thumbnail_url",
        "limit": 12,
    })
    posts = []
    for item in payload.get("data", []):
        if not isinstance(item, dict):
            continue
        link = safe_url(item.get("permalink"), "instagram.com")
        date = stable_date(item.get("timestamp"))
        if not link or not date:
            continue
        text = (item.get("caption") or "").strip()[:2000]
        photo_url = item.get("thumbnail_url") or item.get("media_url")
        image = cache_photo(photo_url, "instagram", str(item.get("id", link)))
        if not text and not image:
            continue
        posts.append({"source": "instagram", "permalink": link,
                      "published_at": date, "text": text, "image": image})
    return posts

def main():
    if DATA.exists():
        try:
            current = json.loads(DATA.read_text(encoding="utf-8"))
            if not isinstance(current.get("posts"), list):
                current = {"schema_version": 1, "posts": []}
        except (OSError, ValueError):
            current = {"schema_version": 1, "posts": []}
    else:
        current = {"schema_version": 1, "posts": []}

    configs = [
        ("facebook", os.getenv("CAFE_FB_PAGE_ID"), os.getenv("CAFE_FB_PAGE_TOKEN")),
        ("instagram", os.getenv("CAFE_IG_USER_ID"), os.getenv("CAFE_IG_ACCESS_TOKEN")
         or os.getenv("CAFE_FB_PAGE_TOKEN")),
    ]
    existing = [p for p in current["posts"] if isinstance(p, dict) and p.get("source") in VALID_SOURCE]
    result = list(existing)
    configured = 0
    successful = 0
    for source, account_id, token in configs:
        if not account_id or not token:
            print(source + ": not connected")
            continue
        configured += 1
        try:
            posts = facebook_posts(account_id, token) if source == "facebook" else instagram_posts(account_id, token)
            result = [p for p in result if p.get("source") != source] + posts
            successful += 1
            print(source + ": loaded", len(posts), "posts")
        except (OSError, KeyError, ValueError, urllib.error.URLError) as error:
            print(source + ": could not refresh, keeping previous posts (" +
                  type(error).__name__ + ")", file=sys.stderr)
    if not configured:
        print("No Meta accounts connected. Existing content stays unchanged.")
        return 0
    if configured and not successful:
        print("No connected feed could refresh.", file=sys.stderr)
        return 1
    # When the same update is cross-posted, avoid duplicated text and imagery.
    result.sort(key=lambda p: p.get("published_at") or "", reverse=True)
    seen_text = set()
    unique = []
    for post in result:
        caption = re.sub(r"\s+", " ", post.get("text", "").strip().casefold())
        if len(caption) > 40 and caption in seen_text:
            continue
        if len(caption) > 40:
            seen_text.add(caption)
        unique.append(post)
        if len(unique) == 12:
            break
    if unique == existing:
        print("Feed unchanged; no commit required.")
        return 0
    payload = {"schema_version": 1,
               "updated_at": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
               "posts": unique}
    DATA.parent.mkdir(parents=True, exist_ok=True)
    DATA.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("Updated", DATA.relative_to(BASE), "with", len(unique), "posts.")
    return 0

if __name__ == "__main__":
    sys.exit(main())
