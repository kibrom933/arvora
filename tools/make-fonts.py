#!/usr/bin/env python3
"""Laver prototype/fonts/hk-400.ttf og hk-700.ttf til PDF'en.

jsPDF's indbyggede Helvetica kan kun vesteuropæiske bogstaver (Ayşe blev til "Ay_e").
Derfor skærer vi to statiske snit af Hanken Grotesk (variabel skrift, OFL-licens) og
beholder kun latin + udvidet latin, så filerne er små (ca. 38 KB hver).

Kræver: pip install fonttools
Kilde:  https://github.com/google/fonts/tree/main/ofl/hankengrotesk
"""
import base64, pathlib, sys, urllib.request
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools import subset

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'prototype' / 'fonts'
SRC_URL = 'https://raw.githubusercontent.com/google/fonts/main/ofl/hankengrotesk/HankenGrotesk%5Bwght%5D.ttf'
# Latin, Latin-1, Latin Ext-A/B, Latin Ext Additional (bl.a. vietnamesisk), tegnsætning, €, ™, −
UNICODES = 'U+0020-007E,U+00A0-024F,U+0259,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+1E00-1EFF,U+2000-206F,U+20AC,U+2122,U+2212,U+2215'

def main():
    src = ROOT / 'tools' / 'HankenGrotesk[wght].ttf'
    if not src.exists():
        print('Henter', SRC_URL); urllib.request.urlretrieve(SRC_URL, src)
    OUT.mkdir(parents=True, exist_ok=True)
    for weight in (400, 700):
        f = TTFont(src)
        inst = instancer.instantiateVariableFont(f, {'wght': weight}, inplace=False)
        opts = subset.Options(); opts.layout_features = ['kern', 'liga']; opts.name_IDs = [1, 2, 4, 6]; opts.notdef_outline = True; opts.hinting = False
        sub = subset.Subsetter(opts); sub.populate(unicodes=subset.parse_unicodes(UNICODES)); sub.subset(inst)
        dest = OUT / f'hk-{weight}.ttf'; inst.save(dest)
        print(dest.relative_to(ROOT), dest.stat().st_size, 'bytes', len(inst.getGlyphOrder()), 'glyffer')

if __name__ == '__main__':
    sys.exit(main())
