#!/usr/bin/env python3
import base64
import json
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageEnhance

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "build"

PETS = [
    {"src": "assets/co-maintainers/4kMj575KQY2SESCv1Lixpg.jpg", "box": (100, 0, 1050, 950),
     "name": "KINGSLEY", "alt": "Kingsley, golden retriever"},
    {"src": "assets/co-maintainers/i5fcvSP9R0mQx19clwEVwg.jpg", "box": (55, 0, 476, 421),
     "name": "TYSON", "alt": "Tyson, tabby cat"},
]
PET_PX = 400
PET_QUALITY = 78


def grade(im):
    r, g, b = im.convert("RGB").split()
    r = r.point(lambda v: min(255, int(v * 1.035)))
    b = b.point(lambda v: int(v * 0.965))
    im = Image.merge("RGB", (r, g, b))
    im = ImageEnhance.Color(im).enhance(1.08)
    im = ImageEnhance.Contrast(im).enhance(1.06)
    return im


def encode(im, quality):
    buf = BytesIO()
    im.convert("RGB").save(buf, "JPEG", quality=quality, optimize=True, progressive=True)
    raw = buf.getvalue()
    return "data:image/jpeg;base64," + base64.b64encode(raw).decode(), len(raw)


def main():
    OUT.mkdir(exist_ok=True)
    manifest = {}
    total = 0

    manifest["pets"] = []
    for item in PETS:
        im = grade(Image.open(ROOT / item["src"]).crop(item["box"])
                   .resize((PET_PX, PET_PX), Image.LANCZOS))
        uri, size = encode(im, PET_QUALITY)
        manifest["pets"].append({"uri": uri, "name": item["name"], "alt": item["alt"]})
        total += size
        print(f"pet {item['name']:<9} {PET_PX}px  {size // 1024} KB")

    (OUT / "photos.json").write_text(json.dumps(manifest))
    print(f"---\nportraits raw {total // 1024} KB, ~{int(total * 1.34) // 1024} KB once base64'd")


if __name__ == "__main__":
    main()
