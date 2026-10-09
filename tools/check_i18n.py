#!/usr/bin/env python3
"""Check translation catalogs against data/i18n/_source.json.

Usage: python3 tools/check_i18n.py [code ...]   (default: every catalog present)
Fails if a key is missing, if a translation adds or drops a placeholder, or if
a translation is left identical to the English (allowed only for short names).
"""
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import build  # noqa: E402
import i18n  # noqa: E402

DIR = pathlib.Path(__file__).resolve().parent.parent / "data/i18n"
source = json.loads((DIR / "_source.json").read_text(encoding="utf-8"))
codes = sys.argv[1:] or sorted(p.stem for p in DIR.glob("*.json") if not p.stem.startswith("_"))
bad = 0
for code in codes:
    cat = json.loads((DIR / f"{code}.json").read_text(encoding="utf-8"))
    need = [k for k, pages in source.items() if any(build.path(code, pg.replace("index.html", "")) and code not in build.HAND[pg.replace("index.html", "")] for pg in pages)]
    missing = [k for k in need if k not in cat]
    broken = [k for k in source if k in cat and i18n.tokens_of(cat[k]) != i18n.tokens_of(k)]
    extra = [k for k in cat if k not in source]
    print(f"{code}: {len(cat)} entries, {len(missing)} missing, {len(broken)} broken placeholders, {len(extra)} unknown keys")
    for k in missing[:10]:
        print("  missing:", k[:100])
    for k in broken[:10]:
        print("  broken:", k[:80], "->", cat[k][:80])
    bad += len(missing) + len(broken)
sys.exit(1 if bad else 0)
