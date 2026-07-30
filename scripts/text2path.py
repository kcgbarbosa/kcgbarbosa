#!/usr/bin/env python3
import json
import sys
from io import BytesIO

import uharfbuzz as hb
from fontTools.misc.transform import Transform
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

USAGE = "\n".join([
    "text2path.py info  FONT.ttf",
    "text2path.py build SPEC.json > OUT.json",
])


def axis_info(path):
    font = TTFont(path)
    if "fvar" not in font:
        return []
    return [
        {"tag": a.axisTag, "min": a.minValue, "default": a.defaultValue, "max": a.maxValue}
        for a in font["fvar"].axes
    ]


def load_static(path, axes):
    font = TTFont(path)
    if "fvar" in font and axes:
        available = {a.axisTag for a in font["fvar"].axes}
        unknown = set(axes) - available
        if unknown:
            raise SystemExit(
                f"{path}: no such axis {sorted(unknown)}; has {sorted(available)}"
            )
        font = instantiateVariableFont(font, axes, inplace=True, updateFontNames=False)
    buf = BytesIO()
    font.save(buf)
    return font, buf.getvalue()


def main(argv):
    if len(argv) < 3:
        raise SystemExit(USAGE)
    cmd, arg = argv[1], argv[2]

    if cmd == "info":
        print(json.dumps(axis_info(arg), indent=2))
        return

    if cmd != "build":
        raise SystemExit(f"unknown command: {cmd}")

    with open(arg) as fh:
        spec = json.load(fh)

    out = {}
    cache = {}
    for entry in spec:
        key = (entry["font"], json.dumps(entry.get("axes", {}), sort_keys=True))
        if key not in cache:
            cache[key] = load_static(entry["font"], entry.get("axes", {}))
        out[entry["id"]] = outline(
            cache[key], entry["text"], entry["size"], entry.get("tracking", 0.0)
        )
    json.dump(out, sys.stdout)


def outline(loaded, text, size, tracking):
    ttf, raw = loaded
    upem = ttf["head"].unitsPerEm
    scale = size / upem

    hb_font = hb.Font(hb.Face(hb.Blob(raw)))
    hb_font.scale = (upem, upem)
    buf = hb.Buffer()
    buf.add_str(text)
    buf.guess_segment_properties()
    hb.shape(hb_font, buf)

    glyph_order = ttf.getGlyphOrder()
    glyph_set = ttf.getGlyphSet()
    track_units = (tracking / scale) if scale else 0.0

    parts = []
    glyphs = []
    cursor = 0.0
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        name = glyph_order[info.codepoint]
        x = (cursor + pos.x_offset) * scale
        y = -pos.y_offset * scale
        pen = SVGPathPen(glyph_set, ntos=lambda v: f"{v:.2f}")
        glyph_set[name].draw(TransformPen(pen, Transform().translate(x, y).scale(scale, -scale)))
        d = pen.getCommands()
        if d:
            parts.append(d)
        glyphs.append({
            "d": d,
            "cluster": info.cluster,
            "char": text[info.cluster] if info.cluster < len(text) else "",
            "x": round(x, 2),
            "advance": round(pos.x_advance * scale, 2),
        })
        cursor += pos.x_advance + track_units

    width = cursor * scale
    if text and track_units:
        width -= track_units * scale

    return {
        "d": " ".join(parts),
        "glyphs": glyphs,
        "width": round(width, 2),
        "ascent": round(ttf["hhea"].ascender * scale, 2),
        "descent": round(ttf["hhea"].descender * scale, 2),
        "capHeight": round(getattr(ttf["OS/2"], "sCapHeight", ttf["hhea"].ascender) * scale, 2),
    }


if __name__ == "__main__":
    main(sys.argv)
