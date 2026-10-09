"""Translate generated HTML pages using a catalog of English -> translated strings.

The English page is the source. Every run of text (with its inline tags, such as <b> or <a>)
becomes one catalog key. Keys hide markup and numbers behind placeholders, so a translation
can't break a link or change a price:

    'Prices from <b>10</b> JOD'  ->  key 'Prices from <0>{0}</0> JOD'

Translators keep <0>...</0>, <0/> and {0} as they are, and may move them around.
"""
import html
import json
import re
from html.parser import HTMLParser

INLINE = {"a", "abbr", "b", "br", "code", "em", "i", "mark", "small", "span", "strong", "sub", "sup", "u"}
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}
SKIP = {"script", "style", "svg", "textarea", "canvas"}
# Attributes whose text is shown to people (or read by screen readers or search engines).
# The form's data-t-hello, data-t-room ... build the WhatsApp message and stay in English.
ATTRS = {"alt", "aria-label", "placeholder", "title", "data-title", "data-remove", "data-t-photo",
         "data-t-bed", "data-t-err", "data-t-est", "data-t-est1", "data-t-est2", "data-t-pick", "data-t-per", "data-t-open", "data-t-close", "data-t-age", "data-t-under1", "data-t-cap", "data-t-ages", "data-t-choose", "data-ui-night", "data-ui-nights"}
META = {("name", "description"), ("property", "og:title"), ("property", "og:description")}
# Names and brands that stay as they are.
KEEP = {"Bristol Hotel Salalah", "WhatsApp", "Booking.com", "Google", "Google Maps", "Instagram @bristol_hotel_salalah", "MHT L{0}"}

NUM = re.compile(r"\d+(?:[.,]\d+)*")
TOKEN = re.compile(r"<(\d+)/>|<(\d+)>|</(\d+)>|\{(\d+)\}")
LATIN = re.compile(r"[A-Za-z]")
EMAIL = re.compile(r"^\S+@\S+\.\S+$")


# ---------------------------------------------------------------- keys
def make_key(text):
    """Plain text -> (key, numbers)."""
    nums = []

    def num(m):
        nums.append(m.group(0))
        return "{%d}" % (len(nums) - 1)

    return NUM.sub(num, re.sub(r"\s+", " ", text).strip()), nums


def wanted(key):
    bare = TOKEN.sub("", key)
    return bool(LATIN.search(bare)) and key not in KEEP and not EMAIL.match(bare.strip())


def tokens_of(s):
    return sorted(m.group(0) for m in TOKEN.finditer(s))


def lookup(cat, key):
    """The translation for key, or None if missing or if it lost/gained placeholders."""
    t = cat.get(key)
    if t is None or tokens_of(t) != tokens_of(key):
        return None
    return t


def tr_text(cat, text):
    """Translate plain text (no markup). Returns the text unchanged if there's no translation."""
    key, nums = make_key(text)
    if not wanted(key):
        return text
    t = lookup(cat, key)
    if t is None:
        return text
    return TOKEN.sub(lambda m: nums[int(m.group(4))] if m.group(4) is not None else m.group(0), t)


# ---------------------------------------------------------------- a tiny DOM
class El:
    def __init__(self, tag, attrs, raw):
        self.tag, self.attrs, self.raw, self.kids, self.end = tag, attrs, raw, [], ""

    def opaque(self):
        a = dict(self.attrs)
        return a.get("translate") == "no" or a.get("lang", "")[:2] == "ar" or self.tag in SKIP


class Raw:
    def __init__(self, raw):
        self.raw = raw


class Text(Raw):
    pass


class _Parser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.root = El("#root", [], "")
        self.stack = [self.root]

    def handle_starttag(self, tag, attrs):
        el = El(tag, attrs, self.get_starttag_text())
        self.stack[-1].kids.append(el)
        if tag not in VOID:
            self.stack.append(el)

    def handle_startendtag(self, tag, attrs):
        self.stack[-1].kids.append(El(tag, attrs, self.get_starttag_text()))

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i].tag == tag:
                self.stack[i].end = f"</{tag}>"
                del self.stack[i:]
                return

    def handle_data(self, d):
        self.stack[-1].kids.append(Text(d))

    def handle_entityref(self, name):
        self.stack[-1].kids.append(Text(f"&{name};"))

    def handle_charref(self, name):
        self.stack[-1].kids.append(Text(f"&#{name};"))

    def handle_comment(self, d):
        self.stack[-1].kids.append(Raw(f"<!--{d}-->"))

    def handle_decl(self, d):
        self.stack[-1].kids.append(Raw(f"<!{d}>"))


def parse(src):
    p = _Parser()
    p.feed(src)
    p.close()
    return p.root


def serialize(node):
    if isinstance(node, Raw):
        return node.raw
    return node.raw + "".join(serialize(k) for k in node.kids) + node.end


def inline(n):
    """Text-level element: an inline tag whose whole subtree is inline too."""
    return (isinstance(n, El) and n.tag in INLINE and not n.opaque()
            and all(isinstance(k, Raw) or inline(k) for k in n.kids))


def has_text(nodes):
    for n in nodes:
        if isinstance(n, Text) and n.raw.strip():
            return True
        if isinstance(n, El) and not n.opaque() and has_text(n.kids):
            return True
    return False


# ---------------------------------------------------------------- the walk
class Translator:
    """Walks a page. With cat=None it only collects keys; otherwise it translates in place."""

    def __init__(self, cat=None):
        self.cat, self.keys, self.missing = cat, [], set()

    def text(self, s):
        key, _ = make_key(s)
        if not wanted(key):
            return s
        self.keys.append(key)
        if self.cat is None:
            return s
        if lookup(self.cat, key) is None:
            self.missing.add(key)
        return tr_text(self.cat, s)

    def attrs(self, el):
        a = dict(el.attrs)
        changed = False
        new = []
        for k, v in el.attrs:
            if v is not None and (k in ATTRS or (el.tag == "meta" and k == "content" and any(a.get(x) == y for x, y in META))):
                t = self.text(html.unescape(v))
                changed |= t != v
                v = t
            new.append((k, v))
        if changed:
            el.attrs = new
            close = " /" if el.raw.endswith("/>") else ""
            el.raw = f"<{el.tag}" + "".join(f" {k}" if v is None else f' {k}="{html.escape(v)}"' for k, v in new) + f"{close}>"

    def element(self, el):
        if el.tag == "script":
            if dict(el.attrs).get("type") == "application/ld+json" and self.cat is not None:
                data = json.loads("".join(k.raw for k in el.kids))
                el.kids = [Raw(json.dumps(self.json(data), ensure_ascii=False).replace("</", "<\\/"))]
            return
        if el.opaque():
            return
        self.attrs(el)
        self.children(el)

    def json(self, v, key=None):
        if isinstance(v, dict):
            return {k: self.json(x, k) for k, x in v.items()}
        if isinstance(v, list):
            return [self.json(x, key) for x in v]
        if isinstance(v, str) and key in ("name", "description", "text", "touristType"):
            out = tr_text(self.cat, v)
            if out == v and "; " in v:
                out = "; ".join(tr_text(self.cat, p) for p in v.split("; "))
            return out
        return v

    def children(self, el):
        kids, out, run = el.kids, [], []

        def flush():
            if run:
                out.extend(self.run(run))
                run.clear()

        for k in kids:
            if isinstance(k, Text) or inline(k):
                run.append(k)
            else:
                flush()
                if isinstance(k, El):
                    self.element(k)
                out.append(k)
        flush()
        el.kids = out

    def run(self, nodes):
        # Keep surrounding whitespace where it is.
        i, j = 0, len(nodes)
        while i < j and isinstance(nodes[i], Text) and not nodes[i].raw.strip():
            i += 1
        while j > i and isinstance(nodes[j - 1], Text) and not nodes[j - 1].raw.strip():
            j -= 1
        head, body, tail = nodes[:i], nodes[i:j], nodes[j:]
        if not body:
            return nodes
        # One element, or elements with no wording between them: translate each on its own.
        loose = [n for n in body if isinstance(n, Text) and LATIN.search(html.unescape(n.raw))]
        if not loose:
            for n in body:
                if isinstance(n, El):
                    self.element(n)
            return nodes
        if not has_text(body):
            for n in body:
                if isinstance(n, El):
                    self.element(n)
            return nodes

        tags = []

        def flat(ns):
            s = ""
            for n in ns:
                if isinstance(n, Text):
                    s += html.unescape(n.raw)
                else:
                    idx = len(tags)
                    tags.append(n)
                    if n.tag in VOID:
                        s += f"<{idx}/>"
                    else:
                        s += f"<{idx}>" + flat(n.kids) + f"</{idx}>"
            return s

        src = flat(body)
        # Numbers only in text, not inside tag placeholders.
        nums = []
        parts = re.split(r"(<\d+/>|</?\d+>)", re.sub(r"\s+", " ", src).strip())
        key = ""
        for p in parts:
            if re.fullmatch(r"<\d+/>|</?\d+>", p):
                key += p
            else:
                def num(m):
                    nums.append(m.group(0))
                    return "{%d}" % (len(nums) - 1)
                key += NUM.sub(num, p)
        if not wanted(key):
            return nodes
        self.keys.append(key)
        if self.cat is None:
            return nodes
        t = lookup(self.cat, key)
        if t is None:
            self.missing.add(key)
            return nodes

        def build(m):
            if m.group(1) is not None:
                return tags[int(m.group(1))].raw
            if m.group(2) is not None:
                return tags[int(m.group(2))].raw
            if m.group(3) is not None:
                return tags[int(m.group(3))].end
            return nums[int(m.group(4))]

        pieces, pos = [], 0
        for m in TOKEN.finditer(t):
            pieces.append(html.escape(t[pos:m.start()], quote=False))
            pieces.append(build(m))
            pos = m.end()
        pieces.append(html.escape(t[pos:], quote=False))
        return head + [Raw("".join(pieces))] + tail


def collect(page_html):
    t = Translator()
    t.element(parse(page_html))
    return t.keys


def translate(page_html, cat):
    """Returns (translated html, set of keys with no translation)."""
    root = parse(page_html)
    t = Translator(cat)
    t.element(root)
    return serialize(root), t.missing
