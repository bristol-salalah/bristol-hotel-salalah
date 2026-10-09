#!/usr/bin/env python3
"""Build the extra language versions of the site.

Pages are listed in PAGES. The English version of each page is written by hand
(index.html, guide/index.html); HAND says which other languages are hand-written
for each page (ar/index.html). This script:
  1. keeps the language switcher and hreflang links in every page up to date,
  2. writes data/i18n/_source.json, every English string and the pages it is on,
  3. translates each English page into every language that has data/i18n/<code>.json
     and is not hand-written for that page, and writes it to <code>/<page>,
  4. rewrites sitemap.xml.

Links: a relative URL in an English page is rewritten to reach the same file from
the language folder, except URLs starting with "./", which stay in the same language
(use "./guide/" or "./../#rooms" for links between pages).

Usage (from the repo root):  python3 tools/build.py
No dependencies beyond the Python 3 standard library.
"""
import json
import pathlib
import re
import sys
from datetime import date

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import html as htmlmod  # noqa: E402
import i18n  # noqa: E402
import images  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent.parent
BASE = "https://www.bristolhotelsalalah.com/"
I18N = ROOT / "data/i18n"

# (folder/code, hreflang, name in that language, og:locale, Google Maps hl)
LANGS = [
    ("en", "en", "English", "en_GB", "en"),
    ("ar", "ar", "العربية", "ar_OM", "ar"),
    ("hi", "hi", "हिन्दी", "hi_IN", "hi"),
    ("de", "de", "Deutsch", "de_DE", "de"),
    ("ru", "ru", "Русский", "ru_RU", "ru"),
    ("fr", "fr", "Français", "fr_FR", "fr"),
    ("it", "it", "Italiano", "it_IT", "it"),
    ("pl", "pl", "Polski", "pl_PL", "pl"),
    ("zh", "zh-Hans", "简体中文", "zh_CN", "zh-CN"),
]
PAGES = ["", "guide/"]  # folder of each page, relative to a language root
HAND = {"": {"en", "ar"}, "guide/": {"en"}}  # languages written by hand, per page
CATALOGS = {c: json.loads((I18N / f"{c}.json").read_text(encoding="utf-8"))
            for c, *_ in LANGS if c != "en" and (I18N / f"{c}.json").exists()}
BUILT = [l for l in LANGS if l[0] == "en" or l[0] in CATALOGS or any(l[0] in h for h in HAND.values())]


def url(code, page=""):
    return (BASE if code == "en" else f"{BASE}{code}/") + page


def path(code, page=""):
    return ROOT / ("" if code == "en" else code) / page / "index.html"


def switcher(code, page=""):
    """Language menu for `page` in `code`. Links are relative to that page."""
    up = "../" * ((code != "en") + page.count("/"))
    cur = next(l for l in BUILT if l[0] == code)
    items = "".join(
        f'<li><a href="{(up + ("" if c == "en" else c + "/") + page) or "./"}" hreflang="{h}" lang="{h}"'
        f'{" aria-current=\"true\"" if c == code else ""}>{n}</a></li>'
        for c, h, n, *_ in BUILT)
    return (f'<!--langs--><details class="langs" translate="no"><summary aria-label="Language: {cur[2]}">'
            f'<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.6" '
            f'd="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm-9 9h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/></svg>'
            f'{cur[1].split("-")[0].upper()}</summary><ul>{items}</ul></details><!--/langs-->')


def hreflangs(page=""):
    links = [f'<link rel="alternate" hreflang="{h}" href="{url(c, page)}">' for c, h, *_ in BUILT]
    links.append(f'<link rel="alternate" hreflang="x-default" href="{url("en", page)}">')
    return "\n".join(links)


SIZES = {"hero-bg": "100vw", "g-open": "(max-width:860px) 50vw, 25vw", "panel-media": "(max-width:860px) 100vw, 33vw", "dining-media": "(max-width:860px) 50vw, 25vw"}
# Rooms: occupancy and beds are not in the page text, so they live here (image name -> details).
ROOM_FACTS = {"room-deluxe": (2, "King"), "suite-junior": (3, "King + sofa bed"), "suite-superior": (3, "King + sofa bed"), "suite-executive": (5, "King + 2 singles + sofa bed")}
ROOM_RE = re.compile(r'<article class="room reveal">(.*?)</article>', re.S)
FAQ_RE = re.compile(r'<details(?: open)?><summary>(.*?)</summary><p>(.*?)</p></details>', re.S)
LD_RE = re.compile(r'<script type="application/ld\+json">\s*(\{.*?\})\s*</script>', re.S)
FAQ_LD_RE = re.compile(r'<script type="application/ld\+json" data-ld="faq">.*?</script>\n?', re.S)


def responsive(html):
    """Every photo <img> gets a WebP srcset (540/800/1080) and a sizes hint from its context."""
    def fix(m):
        before, tag = m.group(1), m.group(2)
        src = re.search(r'src="([^"]*photos/)([a-z0-9-]+)\.jpg"', tag)
        if not src:
            return m.group(0)
        prefix, name = src.groups()
        jpg = ROOT / "assets/img/photos" / f"{name}.jpg"
        if not jpg.exists():
            return m.group(0)
        cands = [(p, w) for p, w in images.variants(jpg) if p.exists()]
        if len(cands) < 3:
            return m.group(0)
        tag = re.sub(r' (?:srcset|sizes)="[^"]*"', "", tag)
        ctx = before[-400:]
        sizes = next((v for k, v in SIZES.items() if k in ctx), "(max-width:860px) 100vw, 50vw")
        srcset = ", ".join(f"{prefix}{p.name} {w}w" for p, w in cands)
        return before + tag.replace(' src="', f' srcset="{srcset}" sizes="{sizes}" src="', 1)
    return re.sub(r'([\s\S]{0,400}?)(<img [^>]*>)', fix, html)


def text(s):
    return htmlmod.unescape(re.sub(r"<[^>]+>", "", s)).strip()


def structured_data(html, code):
    """Hotel JSON-LD gains the rooms (HotelRoom) and a map link; a FAQPage block is generated from the FAQ."""
    rooms = []
    for block in ROOM_RE.findall(html):
        name = text(re.search(r"<h3>(.*?)</h3>", block, re.S).group(1))
        desc = text(re.search(r'<div class="room-body">.*?<p>(.*?)</p>', block, re.S).group(1))
        chips = [text(c) for c in re.findall(r"<li>(.*?)</li>", re.search(r'<ul class="chips">(.*?)</ul>', block, re.S).group(1), re.S)]
        size = next((int(re.search(r"\d+", c).group(0)) for c in chips if re.search(r"\d+\s*(m²|م²|वर्ग|平方)", c)), None)
        price = re.search(r'<div class="price">.*?(\d+)', block, re.S)
        img = re.search(r"photos/([a-z0-9-]+)\.jpg", block).group(1)
        occ, bed = ROOM_FACTS.get(img, (None, None))
        room = {"@type": "HotelRoom", "name": name, "description": desc}
        if size:
            room["floorSize"] = {"@type": "QuantitativeValue", "value": size, "unitCode": "MTK"}
        if occ:
            room["occupancy"] = {"@type": "QuantitativeValue", "maxValue": occ}
        if bed:
            room["bed"] = {"@type": "BedDetails", "typeOfBed": bed}
        if price:
            room["offers"] = {"@type": "Offer", "price": price.group(1), "priceCurrency": "USD", "availability": "https://schema.org/InStock"}
        rooms.append(room)
    m = LD_RE.search(html)
    if not m:
        return html
    hotel = json.loads(m.group(1))
    if hotel.get("@type") != "Hotel":
        return html
    hotel["hasMap"] = "https://www.google.com/maps/search/?api=1&query=Bristol+Hotel+Salalah+As+Saadah+Street+Salalah"
    if rooms:
        hotel["containsPlace"] = rooms
    dump = lambda o: json.dumps(o, ensure_ascii=False, indent=2).replace("</", "<\\/")
    html = html[:m.start(1)] + dump(hotel) + html[m.end(1):]
    html = FAQ_LD_RE.sub("", html)
    faqs = [(text(q), text(a)) for q, a in FAQ_RE.findall(html)]
    if faqs:
        lang = re.search(r'<html lang="([^"]+)"', html).group(1)
        faq = {"@context": "https://schema.org", "@type": "FAQPage", "inLanguage": lang,
               "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faqs]}
        m = LD_RE.search(html)
        end = html.index("</script>", m.end()) + len("</script>")
        html = html[:end] + '\n<script type="application/ld+json" data-ld="faq">\n' + dump(faq) + "\n</script>" + html[end:]
    return html


def tel_nbsp(html):
    """Digits inside a tel: link are joined with &nbsp; so the number never wraps."""
    def fix(m):
        text = m.group(2)
        while re.search(r"(\d) (\d)", text):
            text = re.sub(r"(\d) (\d)", r"\1&nbsp;\2", text)
        return m.group(1) + text + m.group(3)
    return re.sub(r'(<a [^>]*href="tel:[^"]*"[^>]*>)(.*?)(</a>)', fix, html, flags=re.S)


def shared(html, code, page=""):
    """Switcher and hreflang links, the same in every language."""
    html = tel_nbsp(html)
    html = responsive(html)
    html = structured_data(html, code)
    html = re.sub(r'<!--langs-->.*?<!--/langs-->|<a class="lang" href="[^"]*" hreflang="[^"]*" lang="[^"]*">[^<]*</a>',
                  lambda m: switcher(code, page), html, count=1, flags=re.S)
    html = re.sub(r'(?:<link rel="alternate" hreflang="[^"]*" href="[^"]*">\n?)+', "", html)
    return html.replace("<link rel=\"canonical\"", hreflangs(page) + "\n<link rel=\"canonical\"", 1)


def relink(html):
    """Paths are relative to the site root; a language page sits one folder down."""
    def fix(u):
        u = u.strip()
        if not u or re.match(r"(#|[a-z][a-z0-9+.-]*:|/|\./)", u):
            return u
        return "../" + u

    def attr(m):
        name, val = m.group(1), m.group(2)
        if name in ("srcset", "imagesrcset"):
            val = ", ".join(" ".join([fix(p.split()[0])] + p.split()[1:]) for p in val.split(","))
        else:
            val = fix(val)
        return f'{name}="{val}"'

    return re.sub(r'\b(href|src|srcset|imagesrcset)="([^"]*)"', attr, html)


def localise(html, code, page=""):
    _, h, _, locale, hl = next(l for l in LANGS if l[0] == code)
    html = html.replace('<html lang="en" dir="ltr">', f'<html lang="{h}" dir="{"rtl" if code == "ar" else "ltr"}">', 1)
    html = re.sub(r'(<link rel="canonical" href=")[^"]*', rf"\g<1>{url(code, page)}", html, count=1)
    html = re.sub(r'(<meta property="og:url" content=")[^"]*', rf"\g<1>{url(code, page)}", html, count=1)
    html = re.sub(r'(<meta property="og:locale" content=")[^"]*', rf"\g<1>{locale}", html, count=1)
    return html.replace("&amp;output=embed", f"&amp;hl={hl}&amp;output=embed")


def main():
    images.ensure()
    sources, keys = {}, {}
    for page in PAGES:
        for code in HAND[page]:
            p = path(code, page)
            out = shared(p.read_text(encoding="utf-8"), code, page)
            p.write_text(out, encoding="utf-8")
            if code == "en":
                sources[page] = out
        for k in i18n.collect(sources[page]):
            keys.setdefault(k, set()).add(page + "index.html")
    I18N.mkdir(parents=True, exist_ok=True)
    (I18N / "_source.json").write_text(json.dumps({k: sorted(v) for k, v in sorted(keys.items())}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    for page in PAGES:
        for code, *_ in LANGS:
            if code in HAND[page]:
                continue
            if code not in CATALOGS:
                print(f"  {code}: no data/i18n/{code}.json yet, skipped")
                continue
            out, missing = i18n.translate(relink(sources[page]), CATALOGS[code])
            out = shared(localise(out, code, page), code, page)
            if missing:
                print(f"  {code}/{page}: {len(missing)} strings not translated (shown in English)")
            p = path(code, page)
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(out, encoding="utf-8")

    today = date.today().isoformat()
    urls = ""
    for page in PAGES:
        alts = "".join(f'\n    <xhtml:link rel="alternate" hreflang="{h}" href="{url(c, page)}"/>' for c, h, *_ in BUILT)
        urls += "".join(f"\n  <url>\n    <loc>{url(c, page)}</loc>{alts}\n    <lastmod>{today}</lastmod>\n  </url>" for c, *_ in BUILT)
    (ROOT / "sitemap.xml").write_text(
        f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
        f'xmlns:xhtml="http://www.w3.org/1999/xhtml">{urls}\n</urlset>\n', encoding="utf-8")
    print(f"{len(keys)} strings; {len(PAGES)} pages; built {len(BUILT)} languages: {', '.join(c for c, *_ in BUILT)}")


if __name__ == "__main__":
    main()
