#!/usr/bin/env python3
"""Build the extra language versions of the site.

index.html (English) and ar/index.html (Arabic) are written by hand. This script:
  1. keeps the language switcher and hreflang links in every page up to date,
  2. writes data/i18n/_source.json, every English string on the page,
  3. translates index.html into each language that has data/i18n/<code>.json,
     and writes it to <code>/index.html,
  4. rewrites sitemap.xml.

Usage (from the repo root):  python3 tools/build.py
No dependencies beyond the Python 3 standard library.
"""
import json
import pathlib
import re
import sys
from datetime import date

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import i18n  # noqa: E402

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
HAND = {"en", "ar"}  # written by hand, never generated
CATALOGS = {c: json.loads((I18N / f"{c}.json").read_text(encoding="utf-8"))
            for c, *_ in LANGS if c not in HAND and (I18N / f"{c}.json").exists()}
BUILT = [l for l in LANGS if l[0] in HAND or l[0] in CATALOGS]


def url(code):
    return BASE if code == "en" else f"{BASE}{code}/"


def switcher(code):
    """Language menu for the page in `code`. Links are relative to that page."""
    up = "" if code == "en" else "../"
    cur = next(l for l in BUILT if l[0] == code)
    items = "".join(
        f'<li><a href="{(up + ("" if c == "en" else c + "/")) or "./"}" hreflang="{h}" lang="{h}"'
        f'{" aria-current=\"true\"" if c == code else ""}>{n}</a></li>'
        for c, h, n, *_ in BUILT)
    return (f'<!--langs--><details class="langs" translate="no"><summary aria-label="Language: {cur[2]}">'
            f'<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.6" '
            f'd="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm-9 9h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/></svg>'
            f'{cur[1].split("-")[0].upper()}</summary><ul>{items}</ul></details><!--/langs-->')


def hreflangs():
    links = [f'<link rel="alternate" hreflang="{h}" href="{url(c)}">' for c, h, *_ in BUILT]
    links.append(f'<link rel="alternate" hreflang="x-default" href="{url("en")}">')
    return "\n".join(links)


def tel_nbsp(html):
    """Digits inside a tel: link are joined with &nbsp; so the number never wraps."""
    def fix(m):
        text = m.group(2)
        while re.search(r"(\d) (\d)", text):
            text = re.sub(r"(\d) (\d)", r"\1&nbsp;\2", text)
        return m.group(1) + text + m.group(3)
    return re.sub(r'(<a href="tel:[^"]*">)(.*?)(</a>)', fix, html, flags=re.S)


def shared(html, code):
    """Switcher and hreflang links, the same in every language."""
    html = tel_nbsp(html)
    html = re.sub(r'<!--langs-->.*?<!--/langs-->|<a class="lang" href="[^"]*" hreflang="[^"]*" lang="[^"]*">[^<]*</a>',
                  lambda m: switcher(code), html, count=1, flags=re.S)
    html = re.sub(r'(?:<link rel="alternate" hreflang="[^"]*" href="[^"]*">\n?)+', "", html)
    return html.replace("<link rel=\"canonical\"", hreflangs() + "\n<link rel=\"canonical\"", 1)


def relink(html):
    """Paths are relative to the site root; a language page sits one folder down."""
    def fix(u):
        u = u.strip()
        if not u or re.match(r"(#|[a-z][a-z0-9+.-]*:|/|\.\./)", u):
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


def localise(html, code):
    _, h, _, locale, hl = next(l for l in LANGS if l[0] == code)
    html = html.replace('<html lang="en" dir="ltr">', f'<html lang="{h}" dir="ltr">', 1)
    html = re.sub(r'(<link rel="canonical" href=")[^"]*', rf"\g<1>{url(code)}", html, count=1)
    html = re.sub(r'(<meta property="og:url" content=")[^"]*', rf"\g<1>{url(code)}", html, count=1)
    html = re.sub(r'(<meta property="og:locale" content=")[^"]*', rf"\g<1>{locale}", html, count=1)
    return html.replace("&amp;output=embed", f"&amp;hl={hl}&amp;output=embed")


def main():
    en_path, ar_path = ROOT / "index.html", ROOT / "ar/index.html"
    en = shared(en_path.read_text(encoding="utf-8"), "en")
    en_path.write_text(en, encoding="utf-8")
    ar_path.write_text(shared(ar_path.read_text(encoding="utf-8"), "ar"), encoding="utf-8")

    keys = {}
    for k in i18n.collect(en):
        keys[k] = keys.get(k, 0) + 1
    I18N.mkdir(parents=True, exist_ok=True)
    (I18N / "_source.json").write_text(json.dumps({k: ["index.html"] for k in sorted(keys)}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    for code, *_ in LANGS:
        if code in HAND:
            continue
        if code not in CATALOGS:
            print(f"  {code}: no data/i18n/{code}.json yet, skipped")
            continue
        out, missing = i18n.translate(relink(en), CATALOGS[code])
        out = shared(localise(out, code), code)
        if missing:
            print(f"  {code}: {len(missing)} strings not translated (shown in English)")
        (ROOT / code).mkdir(exist_ok=True)
        (ROOT / code / "index.html").write_text(out, encoding="utf-8")

    today = date.today().isoformat()
    alts = "".join(f'\n    <xhtml:link rel="alternate" hreflang="{h}" href="{url(c)}"/>' for c, h, *_ in BUILT)
    urls = "".join(f"\n  <url>\n    <loc>{url(c)}</loc>{alts}\n    <lastmod>{today}</lastmod>\n  </url>" for c, *_ in BUILT)
    (ROOT / "sitemap.xml").write_text(
        f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
        f'xmlns:xhtml="http://www.w3.org/1999/xhtml">{urls}\n</urlset>\n', encoding="utf-8")
    print(f"{len(keys)} strings; built {len(BUILT)} languages: {', '.join(c for c, *_ in BUILT)}")


if __name__ == "__main__":
    main()
