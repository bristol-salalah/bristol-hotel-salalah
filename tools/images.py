#!/usr/bin/env python3
"""Responsive variants for every photo in assets/img/photos:
<name>-540.webp, <name>-800.webp and <name>-1080.webp (never wider than the source).
Needs cwebp (brew install webp / apt-get install webp). Existing variants are kept;
delete them when you replace a photo. Run on its own or let tools/build.py call it."""
import pathlib
import shutil
import struct
import subprocess

ROOT = pathlib.Path(__file__).resolve().parent.parent
PHOTOS = ROOT / "assets/img/photos"
WIDTHS = (540, 800, 1080)


def jpeg_size(path):
    """(width, height) from the JPEG's SOF marker, no imaging library needed."""
    with open(path, "rb") as f:
        data = f.read()
    i = 2
    while i < len(data):
        if data[i] != 0xFF:
            i += 1
            continue
        marker = data[i + 1]
        if marker in (0xC0, 0xC1, 0xC2):
            h, w = struct.unpack(">HH", data[i + 5:i + 9])
            return w, h
        if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7:
            i += 2
            continue
        i += 2 + struct.unpack(">H", data[i + 2:i + 4])[0]
    return None, None


def variants(jpg):
    """[(path, width)] for the variants a photo should have."""
    w, _ = jpeg_size(jpg)
    out = []
    for width in WIDTHS:
        actual = min(width, w or width)
        out.append((jpg.with_name(f"{jpg.stem}-{width}.webp"), actual))
    return out


def ensure(verbose=True):
    cwebp = shutil.which("cwebp")
    made, skipped = 0, 0
    for jpg in sorted(PHOTOS.glob("*.jpg")):
        src_w, _ = jpeg_size(jpg)
        for out, width in variants(jpg):
            if out.exists():
                continue
            if not cwebp:
                skipped += 1
                continue
            args = [cwebp, "-quiet", "-q", "78"]
            if src_w and width < src_w:
                args += ["-resize", str(width), "0"]
            subprocess.run(args + [str(jpg), "-o", str(out)], check=True)
            made += 1
    if verbose:
        print(f"images: {made} variants made" + (f", {skipped} skipped (cwebp not installed)" if skipped else ""))
    return skipped == 0


if __name__ == "__main__":
    ensure()
