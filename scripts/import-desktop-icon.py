#!/usr/bin/env python3
"""Build assets/app-icon.png from the official desktop artwork (PNG preferred)."""

from __future__ import annotations

from pathlib import Path

try:
    from PIL import Image, ImageChops, ImageDraw
except ImportError as exc:  # pragma: no cover
    raise SystemExit(
        "Pillow is required. Install with: python3 -m pip install pillow\n"
        f"Original error: {exc}",
    ) from exc

ROOT = Path(__file__).resolve().parents[1]
MASTER_CANDIDATES = (
    ROOT / "assets" / "desktopicon.png",
    ROOT / "assets" / "desktop-icon-master.jpg",
)
OUT = ROOT / "assets" / "app-icon.png"
SIZE = 1024
# Inset so the mark matches Notes/GitHub scale in the Dock (leaves room for the badge).
CONTENT_FRACTION = 0.84
# macOS squircle mask (~22.3% corner radius).
CORNER_RADIUS_FRACTION = 0.223
TRIM_THRESHOLD = 28


def squircle_mask(size: int, radius: int) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
    return mask


def trim_near_black_border(image: Image.Image) -> Image.Image:
    pixels = image.load()
    w, h = image.size

    def row_is_dark(y: int) -> bool:
        for x in range(w):
            r, g, b, _a = pixels[x, y]
            if r > TRIM_THRESHOLD or g > TRIM_THRESHOLD or b > TRIM_THRESHOLD:
                return False
        return True

    def col_is_dark(x: int) -> bool:
        for y in range(h):
            r, g, b, _a = pixels[x, y]
            if r > TRIM_THRESHOLD or g > TRIM_THRESHOLD or b > TRIM_THRESHOLD:
                return False
        return True

    top = 0
    while top < h and row_is_dark(top):
        top += 1
    bottom = h - 1
    while bottom > top and row_is_dark(bottom):
        bottom -= 1
    left = 0
    while left < w and col_is_dark(left):
        left += 1
    right = w - 1
    while right > left and col_is_dark(right):
        right -= 1

    if left >= right or top >= bottom:
        return image

    return image.crop((left, top, right + 1, bottom + 1))


def resolve_master() -> Path:
    for candidate in MASTER_CANDIDATES:
        if candidate.is_file():
            return candidate
    raise SystemExit(
        "Missing official desktop icon. Add assets/desktopicon.png or assets/desktop-icon-master.jpg",
    )


def apply_macos_icon_mask(image: Image.Image) -> Image.Image:
    radius = int(SIZE * CORNER_RADIUS_FRACTION)
    mask = squircle_mask(SIZE, radius)
    r, g, b, a = image.split()
    a = ImageChops.multiply(a, mask)
    return Image.merge("RGBA", (r, g, b, a))


def clear_near_black_fringe(image: Image.Image) -> Image.Image:
    """Drop JPEG letterbox pixels that leak past the squircle in the Dock."""
    pixels = image.load()
    w, h = image.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if a == 0:
                continue
            if r <= TRIM_THRESHOLD and g <= TRIM_THRESHOLD and b <= TRIM_THRESHOLD:
                pixels[x, y] = (0, 0, 0, 0)


def main() -> None:
    master = resolve_master()
    im = Image.open(master).convert("RGBA")
    cropped = trim_near_black_border(im)

    max_side = int(SIZE * CONTENT_FRACTION)
    crop_w, crop_h = cropped.size
    scale = max_side / max(crop_w, crop_h)
    resized = cropped.resize(
        (max(1, int(crop_w * scale)), max(1, int(crop_h * scale))),
        Image.Resampling.LANCZOS,
    )

    canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    ox = (SIZE - resized.width) // 2
    oy = (SIZE - resized.height) // 2
    canvas.paste(resized, (ox, oy), resized)

    clear_near_black_fringe(canvas)
    final = apply_macos_icon_mask(canvas)
    final.save(OUT, format="PNG", optimize=True)
    print(
        f"Wrote {OUT} from {master.name} "
        f"({im.size} -> {cropped.size} -> art {resized.size} @ {CONTENT_FRACTION:.0%} safe area)",
    )


if __name__ == "__main__":
    main()