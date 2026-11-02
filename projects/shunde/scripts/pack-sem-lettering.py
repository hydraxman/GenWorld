"""Extract only the photo-observed SEM wall text from the pinned OFL font."""
import argparse
import hashlib
import json
from pathlib import Path

from fontTools.pens.basePen import BasePen
from fontTools.ttLib import TTFont

LINES = [
    "\u6e05\u534e\u5927\u5b66",
    "\u7ecf\u6d4e\u7ba1\u7406\u5b66\u9662",
    "SCHOOL OF ECONOMICS AND MANAGEMENT",
    "TSINGHUA UNIVERSITY",
]
SOURCE_SHA256 = "39ad71264b588165b469e35e6afb162a378dacd1f95348160240ba9038ac3009"


class OutlinePen(BasePen):
    def __init__(self, glyphs, scale):
        super().__init__(glyphs)
        self.scale = scale
        self.tokens = []

    def command(self, name, *points):
        self.tokens.append(name)
        self.tokens.extend(
            format(round(value * self.scale, 3), "g")
            for point in points for value in point
        )

    def _moveTo(self, point):
        self.command("m", point)

    def _lineTo(self, point):
        self.command("l", point)

    def _qCurveToOne(self, control, end):
        self.command("q", end, control)

    def _curveToOne(self, first, second, end):
        self.command("b", end, first, second)

    def _closePath(self):
        pass


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("font", type=Path)
    args = parser.parse_args()
    if hashlib.sha256(args.font.read_bytes()).hexdigest() != SOURCE_SHA256:
        raise ValueError("Expected the pinned LXGW WenKai Regular v1.522 source bytes.")
    with TTFont(args.font) as font:
        glyph_set, cmap = font.getGlyphSet(), font.getBestCmap()
        scale = 1000 / font["head"].unitsPerEm
        glyphs = {}
        for character in sorted(set("".join(LINES))):
            name = cmap.get(ord(character))
            if not name:
                raise ValueError(f"Missing wall-sign glyph: {character}")
            pen = OutlinePen(glyph_set, scale)
            glyph_set[name].draw(pen)
            glyphs[character] = {
                "ha": round(font["hmtx"][name][0] * scale, 3),
                "o": " ".join(pen.tokens),
            }
        data = {
            "familyName": "Jianhua Wall Lettering",
            "resolution": 1000,
            "boundingBox": {
                "yMin": round(font["head"].yMin * scale, 3),
                "yMax": round(font["head"].yMax * scale, 3),
            },
            "underlineThickness": 50,
            "lines": LINES,
            "sourceFont": "LXGW WenKai Regular v1.522",
            "sourceUrl": "https://github.com/lxgw/LxgwWenKai/releases/download/v1.522/LXGWWenKai-Regular.ttf",
            "sourceSHA256": SOURCE_SHA256,
            "copyright": "Copyright 2021-2026 LXGW; Copyright 2020 The Klee Project Authors",
            "license": "SIL OFL 1.1; ../../tsinghua-campus/src/second-gate-font-OFL.txt",
            "licenseText": (Path(__file__).resolve().parents[2] / "tsinghua-campus" / "src"
                            / "second-gate-font-OFL.txt").read_text(encoding="utf-8"),
            "approximation": "Photo-observed wording; renamed font subset, not a tracing of the original calligraphy.",
            "glyphs": glyphs,
        }
    output = Path(__file__).resolve().parents[1] / "src" / "sem-lettering.json"
    output.write_text(json.dumps(data, ensure_ascii=True, separators=(",", ":")) + "\n", encoding="utf-8", newline="\n")
    print(f"Extracted {len(glyphs)} glyphs; no font binary or reference image embedded.")


if __name__ == "__main__":
    main()
