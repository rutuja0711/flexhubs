#!/usr/bin/env python3
"""Generate assets/install-loading.gif for the Windows Squirrel installer splash."""

from __future__ import annotations

import math
import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
LOGO_PATH = ROOT / "assets" / "logo-symbol.png"
OUT_PATH = ROOT / "assets" / "install-loading.gif"

WIDTH = 500
HEIGHT = 300
BACKGROUND = (16, 17, 20)
ACCENT = (180, 70, 90)
TEXT = (245, 245, 245)
MUTED = (170, 170, 180)


def load_fonts() -> tuple[ImageFont.FreeTypeFont | ImageFont.ImageFont, ImageFont.FreeTypeFont | ImageFont.ImageFont]:
    try:
        return (
            ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 22),
            ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 14),
        )
    except OSError:
        default = ImageFont.load_default()
        return default, default


def main() -> None:
    logo = Image.open(LOGO_PATH).convert("RGBA")
    logo_size = 96
    logo = logo.resize((logo_size, logo_size), Image.Resampling.LANCZOS)
    title_font, sub_font = load_fonts()

    frames: list[Image.Image] = []
    for index in range(24):
        frame = Image.new("RGB", (WIDTH, HEIGHT), BACKGROUND)
        draw = ImageDraw.Draw(frame)

        pulse = 0.5 + 0.5 * math.sin(index * (2 * math.pi / 24))
        ring = int(8 + pulse * 10)
        center_x = WIDTH // 2
        center_y = 108

        draw.ellipse(
            (
                center_x - 58 - ring,
                center_y - 58 - ring,
                center_x + 58 + ring,
                center_y + 58 + ring,
            ),
            outline=ACCENT,
        )

        frame.paste(
            logo,
            (center_x - logo_size // 2, center_y - logo_size // 2),
            logo,
        )

        title = "FlexHubs Desktop"
        subtitle = "Installing..."
        title_box = draw.textbbox((0, 0), title, font=title_font)
        subtitle_box = draw.textbbox((0, 0), subtitle, font=sub_font)
        draw.text(((WIDTH - (title_box[2] - title_box[0])) // 2, 178), title, fill=TEXT, font=title_font)
        draw.text(
            ((WIDTH - (subtitle_box[2] - subtitle_box[0])) // 2, 212),
            subtitle,
            fill=MUTED,
            font=sub_font,
        )

        bar_width = 180
        bar_height = 4
        bar_x = (WIDTH - bar_width) // 2
        bar_y = 248
        draw.rounded_rectangle((bar_x, bar_y, bar_x + bar_width, bar_y + bar_height), radius=2, fill=(40, 40, 48))
        progress = ((index + 1) / 24) * bar_width
        draw.rounded_rectangle((bar_x, bar_y, bar_x + progress, bar_y + bar_height), radius=2, fill=ACCENT)

        frames.append(frame)

    frames[0].save(
        OUT_PATH,
        save_all=True,
        append_images=frames[1:],
        duration=90,
        loop=0,
        optimize=True,
    )
    print(f"Wrote {OUT_PATH} ({OUT_PATH.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
