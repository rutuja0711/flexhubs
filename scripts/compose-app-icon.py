#!/usr/bin/env python3
"""Compose the full FlexHubs application icon (symbol on light rounded-square background)."""

from __future__ import annotations

from pathlib import Path

try:
    from PIL import Image, ImageDraw
except ImportError as exc:  # pragma: no cover
    raise SystemExit(
        "Pillow is required. Install with: python3 -m pip install pillow\n"
        f"Original error: {exc}",
    ) from exc

ROOT = Path(__file__).resolve().parents[1]
SYMBOL = ROOT / "assets" / "logo-symbol.png"
OUT = ROOT / "assets" / "app-icon.png"

SIZE = 1024
# Light fill matching the macOS Applications / Dock reference.
BACKGROUND = (242, 242, 242, 255)
# Full-bleed tile: transparent outer margin shrinks the mark in Dock and notifications.
OUTER_INSET = 0
# Logo scale — same mark size as 1.0.32 (~58% of the old inner tile), on full-bleed canvas.
LOGO_MAX_FRACTION = 0.475
# Rounded tile corners (~22.5% of tile width).
CORNER_RADIUS_FRACTION = 0.225


def squircle_mask(width: int, height: int, radius: int) -> Image.Image:
    mask = Image.new("L", (width, height), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, width - 1, height - 1), radius=radius, fill=255)
    return mask


def main() -> None:
    if not SYMBOL.is_file():
        raise SystemExit(f"Missing logo symbol: {SYMBOL}")

    symbol = Image.open(SYMBOL).convert("RGBA")
    bbox = symbol.getbbox()
    if not bbox:
        raise SystemExit(f"Logo symbol has no visible pixels: {SYMBOL}")

    cropped = symbol.crop(bbox)
    tile_size = SIZE - 2 * OUTER_INSET
    corner_radius = int(tile_size * CORNER_RADIUS_FRACTION)
    tile_mask = squircle_mask(tile_size, tile_size, corner_radius)

    tile = Image.new("RGBA", (tile_size, tile_size), BACKGROUND)
    tile.putalpha(tile_mask)

    target = int(tile_size * LOGO_MAX_FRACTION)
    crop_w, crop_h = cropped.size
    scale = target / max(crop_w, crop_h)
    resized = cropped.resize(
        (max(1, int(crop_w * scale)), max(1, int(crop_h * scale))),
        Image.Resampling.LANCZOS,
    )

    logo_x = (tile_size - resized.width) // 2
    logo_y = (tile_size - resized.height) // 2
    tile.paste(resized, (logo_x, logo_y), resized)

    canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    canvas.paste(tile, (OUTER_INSET, OUTER_INSET), tile_mask)

    canvas.save(OUT, format="PNG", optimize=True)
    print(
        f"Wrote {OUT} ({SIZE}x{SIZE}, tile {tile_size}px, inset {OUTER_INSET}px, "
        f"radius {corner_radius}px)",
    )


if __name__ == "__main__":
    main()