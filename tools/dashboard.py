"""Files the dashboard at /admin/ reads, written on every build.

admin/photos.json  every hotel photo on the English page: its file, its size (a new photo is
                   cut to the same size, so the page needs no change), where it is used and
                   its description. Photos from assets/img/places and the hero scene are not
                   listed: they are credited to their photographers.
admin/built.json   the "updated" stamp of the rates.json the pages were built from, so the
                   dashboard can tell when its save has reached the website."""
import json
import pathlib
import re

import images

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "admin"
SECTIONS = {
    "top": "Top of the page", "about": "About the hotel", "gallery": "Photo gallery", "instagram": "Instagram strip",
    "suites": "Suites", "wellness": "Pool and wellness", "dining": "Restaurant", "location": "Location",
    "trips": "Trips", "offers": "Offers", "events": "Events",
}
PHOTO = r"assets/img/photos/[\w-]+\.jpg"


def photos(html):
    out, seen = [], set()

    def add(path, group, alt):
        if path in seen:
            return
        seen.add(path)
        w, h = images.jpeg_size(ROOT / path)
        if not w or not h:
            raise ValueError(f"cannot read the size of {path}")
        out.append({"path": path, "w": w, "h": h, "thumb": path[:-4] + "-540.webp", "group": group, "label": alt})

    def scan(block, group):
        # <img src alt> on the page, and the extra photos a room card opens (<a href title>)
        for m in re.finditer(rf'<img\b[^>]*?\bsrc="({PHOTO})"[^>]*?\balt="([^"]*)"|<a\b[^>]*?\bhref="({PHOTO})"[^>]*?\btitle="([^"]*)"', block):
            add(m.group(1) or m.group(3), group, m.group(2) or m.group(4) or "")

    for sec in re.finditer(r'<section[^>]*\bid="([\w-]+)"(.*?)</section>', html, re.S):
        sid, body = sec.group(1), sec.group(2)
        if sid == "rooms":
            for card in re.finditer(r'<article class="room\b.*?</article>', body, re.S):
                name = re.search(r"<h3>(.*?)</h3>", card.group(0))
                scan(card.group(0), name.group(1) if name else "Rooms")
        scan(body, SECTIONS.get(sid, "Other photos"))
    return out


def write(english_html):
    OUT.mkdir(exist_ok=True)
    rates = json.loads((ROOT / "rates.json").read_text(encoding="utf-8"))
    (OUT / "photos.json").write_text(json.dumps(photos(english_html), ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    (OUT / "built.json").write_text(json.dumps({"updated": rates.get("updated")}) + "\n", encoding="utf-8")
