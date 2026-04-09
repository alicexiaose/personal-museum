#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""验证：检查子集 woff2 的 cmap 是否覆盖收字 txt 中的每个字符。"""
from __future__ import annotations

import sys
from pathlib import Path

try:
    from fontTools.ttLib import TTFont
except ImportError:
    print("请先: pip install -r scripts/font-subset/requirements.txt")
    sys.exit(1)

ROOT = Path(__file__).resolve().parent
OUT_TXT = ROOT / "out"
PUBLIC_FONTS = ROOT.parent.parent / "public" / "fonts"

PAIRS: list[tuple[str, str]] = [
    ("noto-serif-sc-300.subset.woff2", "noto-serif-sc.txt"),
    ("noto-serif-sc-400.subset.woff2", "noto-serif-sc.txt"),
    ("noto-sans-sc-300.subset.woff2", "noto-sans-sc.txt"),
    ("noto-sans-sc-500.subset.woff2", "noto-sans-sc.txt"),
    ("cinzel-400.subset.woff2", "cinzel.txt"),
    ("eb-garamond-300.subset.woff2", "eb-garamond.txt"),
    ("eb-garamond-400.subset.woff2", "eb-garamond.txt"),
    ("cormorant-garamond-300.subset.woff2", "cormorant-garamond.txt"),
    ("cormorant-garamond-400.subset.woff2", "cormorant-garamond.txt"),
]


def main() -> None:
    failed = False
    for woff2_name, txt_name in PAIRS:
        font_path = PUBLIC_FONTS / woff2_name
        txt_path = OUT_TXT / txt_name
        if not font_path.is_file():
            print(f"[跳过] 无字体文件: {woff2_name}")
            failed = True
            continue
        text = txt_path.read_text(encoding="utf-8")
        font = TTFont(str(font_path))
        cmap = font["cmap"].getBestCmap()
        if cmap is None:
            print(f"[错] {woff2_name} 无 cmap")
            failed = True
            continue
        missing = [c for c in text if ord(c) not in cmap and not (c in "\n\r\t ")]
        if missing:
            print(f"[错] {woff2_name} 缺字 ({len(missing)}): {repr(''.join(missing[:40]))}…")
            failed = True
        else:
            print(f"[OK] {woff2_name} 覆盖 {txt_name} ({len(set(text))} 个不同字符)")
        font.close()

    if failed:
        sys.exit(1)
    print("\n验证通过。")


if __name__ == "__main__":
    main()
