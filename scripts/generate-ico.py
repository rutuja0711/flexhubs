#!/usr/bin/env python3
"""Build assets/logo-symbol.ico from assets/logo-symbol.png (multi-size Windows icon)."""

from __future__ import annotations

from pathlib import Path

try:
    from PIL import Image
except ImportError as exc:  # pragma: no cover
    raise SystemExit(
        "Pillow is required. Install with: python3 -m pip install pillow\n"
        f"Original error: {exc}",
    ) from exc

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets" / "logo-symbol.png"
OUT = ROOT / "assets" / "logo-symbol.ico"


def main() -> None:
    if not SRC.is_file():
        raise SystemExit(f"Missing source logo: {SRC}")

    im = Image.open(SRC).convert("RGBA")
    sizes = [16, 24, 32, 48, 64, 128, 256]
    size_pairs = [(s, s) for s in sizes]
    master = im.resize((256, 256), Image.Resampling.LANCZOS)
    master.save(OUT, format="ICO", sizes=size_pairs)
    print("Wrote", OUT, "with sizes", sizes)


if __name__ == "__main__":
    main()
