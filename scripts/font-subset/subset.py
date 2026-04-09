#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
子集：从 google/fonts（raw.githubusercontent.com）拉取可变字体，先 instancer 成静态字重，再按收字结果裁成 woff2。
依赖：pip install -r scripts/font-subset/requirements.txt
"""
from __future__ import annotations

import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CACHE = ROOT / "cache"
OUT_TXT = ROOT / "out"
PUBLIC_FONTS = ROOT.parent.parent / "public" / "fonts"

# (URL, 缓存文件名)
RAW = "https://raw.githubusercontent.com/google/fonts/main"
VF_SOURCES: list[tuple[str, str]] = [
    (f"{RAW}/ofl/notoserifsc/NotoSerifSC%5Bwght%5D.ttf", "NotoSerifSC-VF.ttf"),
    (f"{RAW}/ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf", "NotoSansSC-VF.ttf"),
    (f"{RAW}/ofl/cinzel/Cinzel%5Bwght%5D.ttf", "Cinzel-VF.ttf"),
    (f"{RAW}/ofl/ebgaramond/EBGaramond%5Bwght%5D.ttf", "EBGaramond-VF.ttf"),
    (
        f"{RAW}/ofl/cormorantgaramond/CormorantGaramond%5Bwght%5D.ttf",
        "CormorantGaramond-VF.ttf",
    ),
]

# (输出 woff2 名, VF 缓存名, wght 实例值, 收字 txt)
SUBSET_JOBS: list[tuple[str, str, int, str]] = [
    ("noto-serif-sc-300.subset.woff2", "NotoSerifSC-VF.ttf", 300, "noto-serif-sc.txt"),
    ("noto-serif-sc-400.subset.woff2", "NotoSerifSC-VF.ttf", 400, "noto-serif-sc.txt"),
    ("noto-sans-sc-300.subset.woff2", "NotoSansSC-VF.ttf", 300, "noto-sans-sc.txt"),
    ("noto-sans-sc-500.subset.woff2", "NotoSansSC-VF.ttf", 500, "noto-sans-sc.txt"),
    ("cinzel-400.subset.woff2", "Cinzel-VF.ttf", 400, "cinzel.txt"),
    ("eb-garamond-300.subset.woff2", "EBGaramond-VF.ttf", 300, "eb-garamond.txt"),
    ("eb-garamond-400.subset.woff2", "EBGaramond-VF.ttf", 400, "eb-garamond.txt"),
    ("cormorant-garamond-300.subset.woff2", "CormorantGaramond-VF.ttf", 300, "cormorant-garamond.txt"),
    ("cormorant-garamond-400.subset.woff2", "CormorantGaramond-VF.ttf", 400, "cormorant-garamond.txt"),
]


def _looks_like_ttf(path: Path) -> bool:
    if not path.is_file() or path.stat().st_size < 12:
        return False
    with path.open("rb") as f:
        h = f.read(4)
    return h in (b"\x00\x01\x00\x00", b"OTTO", b"true", b"ttcf")


def download(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if _looks_like_ttf(dest):
        print(f"已存在有效 TTF，跳过下载: {dest.name}")
        return
    print(f"下载 {url} -> {dest.name} …")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (font-subset)"})
    with urllib.request.urlopen(req, timeout=600) as r:
        data = r.read()
    dest.write_bytes(data)
    print(f"  完成 {len(data) // 1024} KB")


def run(cmd: list[str]) -> None:
    p = subprocess.run(cmd, check=False)
    if p.returncode != 0:
        sys.exit(p.returncode)


def main() -> None:
    CACHE.mkdir(parents=True, exist_ok=True)
    PUBLIC_FONTS.mkdir(parents=True, exist_ok=True)
    tmp_dir = CACHE / "tmp_inst"
    tmp_dir.mkdir(exist_ok=True)

    vf_url: dict[str, str] = {name: url for url, name in VF_SOURCES}

    # 按 VF 分组：每下载完一个源文件就立刻子集，避免后续下载失败导致前面未产出 woff2
    by_vf: dict[str, list[tuple[str, int, str]]] = {}
    for out_name, vf_name, wght, txt_name in SUBSET_JOBS:
        by_vf.setdefault(vf_name, []).append((out_name, wght, txt_name))

    for vf_name, jobs in by_vf.items():
        url = vf_url.get(vf_name)
        if not url:
            print(f"[跳过] 未知 VF: {vf_name}")
            continue
        vf_path = CACHE / vf_name
        try:
            download(url, vf_path)
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            print(f"[失败] 下载 {vf_name}: {e}，可稍后重跑本脚本续传。")
            continue
        if not _looks_like_ttf(vf_path):
            print(f"[失败] {vf_name} 不是有效字体，请删缓存后重试: {vf_path}")
            continue

        for out_name, wght, txt_name in jobs:
            txt_path = OUT_TXT / txt_name
            if not txt_path.is_file():
                print(f"缺少收字文件，请先: npm run fonts:collect — {txt_path}")
                sys.exit(1)

            static_ttf = tmp_dir / f"{out_name.replace('.subset.woff2', '')}-static.ttf"
            out_woff2 = PUBLIC_FONTS / out_name
            # 已产出的 woff2 跳过，便于断网/超时后重跑只补未完成项；需全量重建时先删对应文件
            if out_woff2.is_file() and out_woff2.stat().st_size > 0:
                print(f"已存在，跳过: {out_name}")
                continue

            print(f"\n=== {out_name} (wght={wght}) ===")
            run(
                [
                    sys.executable,
                    "-m",
                    "fontTools.varLib.instancer",
                    str(vf_path),
                    f"wght={wght}",
                    "--static",
                    "-o",
                    str(static_ttf),
                ]
            )
            # CJK 全量 layout 子集极慢；网页仅需基础字距/连字，关闭 hinting 可再缩小体积
            run(
                [
                    sys.executable,
                    "-m",
                    "fontTools.subset",
                    str(static_ttf),
                    f"--text-file={txt_path}",
                    f"--output-file={out_woff2}",
                    "--flavor=woff2",
                    "--no-hinting",
                    "--layout-features=kern,liga",
                    "--no-layout-closure",
                    "--glyph-names",
                    "--symbol-cmap",
                ]
            )
            try:
                static_ttf.unlink()
            except OSError:
                pass

    print(f"\n写入目录: {PUBLIC_FONTS}")


if __name__ == "__main__":
    main()
