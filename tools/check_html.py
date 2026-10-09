#!/usr/bin/env python3
"""Structural checks over every page: balanced tags, duplicate ids, heading order,
in-page anchors, alt text, JSON-LD syntax and local file references.
Usage: python3 tools/check_html.py   (exit 1 on any finding)"""
import json, os, pathlib, re, sys
from html.parser import HTMLParser

ROOT = pathlib.Path(__file__).resolve().parent.parent
os.chdir(ROOT)
PAGES = ["404.html"] + sorted(str(x.relative_to(ROOT)) for x in ROOT.rglob("index.html") if not str(x.relative_to(ROOT)).startswith(("assets", "data", "tools", "node_modules", ".")))
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}


class Checker(HTMLParser):
    def __init__(self):
        super().__init__()
        self.stack, self.errors, self.ids, self.h, self.noalt = [], [], {}, [], 0

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag not in VOID:
            self.stack.append(tag)
        if "id" in a:
            self.ids[a["id"]] = self.ids.get(a["id"], 0) + 1
        if tag in ("h1", "h2", "h3", "h4", "h5", "h6"):
            self.h.append(int(tag[1]))
        if tag == "img" and "alt" not in a:
            self.noalt += 1

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        if not self.stack or self.stack[-1] != tag:
            self.errors.append(f"unexpected </{tag}> at line {self.getpos()[0]}")
            if tag in self.stack:
                del self.stack[self.stack.index(tag):]
        else:
            self.stack.pop()


bad = 0
for page in PAGES:
    s = open(page, encoding="utf-8").read()
    c = Checker(); c.feed(s); c.close()
    problems = list(c.errors)
    problems += [f"unclosed <{t}>" for t in c.stack]
    problems += [f"duplicate id {k}" for k, v in c.ids.items() if v > 1]
    problems += [f"heading jump h{a}->h{b}" for a, b in zip(c.h, c.h[1:]) if b > a + 1]
    if c.h.count(1) != 1:
        problems.append(f"{c.h.count(1)} h1 elements")
    if c.noalt:
        problems.append(f"{c.noalt} img without alt")
    for a in set(re.findall(r'href="#([^"]+)"', s)):
        if a not in c.ids:
            problems.append(f"anchor #{a} has no target")
    for m in re.finditer(r'<script type="application/ld\+json">(.*?)</script>', s, re.S):
        try:
            json.loads(m.group(1))
        except ValueError as e:
            problems.append(f"JSON-LD: {e}")
    base = os.path.dirname(page)
    srcset = [c.strip().split()[0] for v in re.findall(r'srcset="([^"]+)"', s) for c in v.split(",")]
    for u in set(re.findall(r'(?:src|href)="([^"#]+)"', s)) | set(srcset):
        if u.startswith(("http", "mailto:", "tel:", "data:")) or not u:
            continue
        u = u.split("?")[0]
        p = u.lstrip("/") if u.startswith("/") else os.path.normpath(os.path.join(base, u))
        if p.endswith("/") or p in (".", ""):
            p = os.path.join(p, "index.html") if p not in (".", "") else "index.html"
        if not os.path.exists(p):
            problems.append(f"missing file {u}")
    print(f"{page}: {'ok' if not problems else '; '.join(problems)}")
    bad += len(problems)
sys.exit(1 if bad else 0)
