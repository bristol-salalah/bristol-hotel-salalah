"""Room and breakfast prices come from data/rates.json, the one file hotel staff edit.

Every element in the hand-written pages (index.html, ar/index.html) that shows a price
carries data-rate="<key>": deluxe, junior, superior, executive, min (the cheapest room,
hero badge) or breakfast. apply() replaces the first number in that element's text (and
its data-price attribute, on the booking form's options) with the value from the JSON,
and keeps the JSON-LD priceRange in step. The generated languages inherit the numbers
from the English page, so nothing else needs to know about the file."""
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
FILE = ROOT / "data/rates.json"
ROOM_KEYS = {"deluxe": "Deluxe Room", "junior": "Junior Suite", "superior": "Superior Suite", "executive": "Executive Suite"}
NUM = re.compile(r"\d+(?:\.\d+)?")


def fmt(v):
    return f"{v:g}"


def load():
    """{key: value} with min added; raises ValueError with a plain message if the file is wrong."""
    try:
        data = json.loads(FILE.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        raise ValueError(f"data/rates.json is not valid JSON: {e}. Check for a missing comma or quote.") from e
    rooms = data.get("rooms")
    if not isinstance(rooms, dict):
        raise ValueError('data/rates.json needs a "rooms" object')
    rates = {}
    for key, name in ROOM_KEYS.items():
        v = rooms.get(name)
        if not isinstance(v, (int, float)) or isinstance(v, bool) or v <= 0:
            raise ValueError(f'data/rates.json: "{name}" must be a number above 0 (got {v!r}). Keep the room names exactly as they are.')
        rates[key] = v
    b = data.get("breakfast_per_person")
    if not isinstance(b, (int, float)) or isinstance(b, bool) or b < 0:
        raise ValueError(f'data/rates.json: "breakfast_per_person" must be a number (got {b!r})')
    rates["breakfast"] = b
    rates["min"] = min(rates[k] for k in ROOM_KEYS)
    rates["max"] = max(rates[k] for k in ROOM_KEYS)
    return rates


def apply(html, rates=None):
    rates = rates or load()

    def fix(m):
        tag, attrs, key, inner = m.group(1), m.group(2), m.group(3), m.group(4)
        if key not in rates:
            raise ValueError(f'unknown data-rate="{key}" in the page')
        value = fmt(rates[key])
        attrs = re.sub(r'data-price="[^"]*"', f'data-price="{value}"', attrs)
        parts = re.split(r"(<[^>]+>)", inner)  # text nodes and tags alternate
        for i, p in enumerate(parts):
            if not p.startswith("<") and NUM.search(p):
                parts[i] = NUM.sub(value, p, count=1)
                break
        else:
            raise ValueError(f'no number to replace inside data-rate="{key}"')
        return f"<{tag}{attrs}>{''.join(parts)}</{tag}>"

    html = re.sub(r'<(\w+)([^>]*\bdata-rate="(\w+)"[^>]*)>(.*?)</\1>', fix, html, flags=re.S)
    return re.sub(r'("priceRange": "OMR )[^"]*"', lambda m: f'{m.group(1)}{fmt(rates["min"])}–{fmt(rates["max"])}"', html)


if __name__ == "__main__":
    r = load()
    print(", ".join(f"{k}: OMR {fmt(v)}" for k, v in r.items()))
