import { nativeImage } from 'electron';

const BADGE_SIZE = 32;

/** Segmented 3×5 glyph maps (1 = ink). */
const GLYPH_ROWS: Record<string, readonly string[]> = {
  '0': ['111', '101', '101', '101', '111'],
  '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '111', '001', '111'],
  '4': ['101', '101', '111', '001', '001'],
  '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'],
  '7': ['111', '001', '010', '010', '010'],
  '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '111'],
  '+': ['000', '010', '111', '010', '000'],
  '@': ['011', '101', '111', '100', '011'],
};

function fillPixel(buffer: Buffer, width: number, x: number, y: number, r: number, g: number, b: number, a: number): void {
  if (x < 0 || y < 0 || x >= width || y >= BADGE_SIZE) {
    return;
  }

  const offset = (y * width + x) * 4;
  buffer[offset] = r;
  buffer[offset + 1] = g;
  buffer[offset + 2] = b;
  buffer[offset + 3] = a;
}

function fillCircle(buffer: Buffer, width: number, cx: number, cy: number, radius: number): void {
  const r = 0xe8;
  const g = 0x11;
  const b = 0x23;

  for (let y = 0; y < BADGE_SIZE; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= radius * radius) {
        fillPixel(buffer, width, x, y, r, g, b, 255);
      }
    }
  }
}

function drawGlyph(
  buffer: Buffer,
  width: number,
  glyph: readonly string[],
  originX: number,
  originY: number,
  scale: number,
): void {
  for (let row = 0; row < glyph.length; row += 1) {
    const line = glyph[row] ?? '';

    for (let col = 0; col < line.length; col += 1) {
      if (line[col] !== '1') {
        continue;
      }

      for (let sy = 0; sy < scale; sy += 1) {
        for (let sx = 0; sx < scale; sx += 1) {
          fillPixel(buffer, width, originX + col * scale + sx, originY + row * scale + sy, 255, 255, 255, 255);
        }
      }
    }
  }
}

function glyphWidth(glyph: readonly string[], scale: number): number {
  const cols = Math.max(...glyph.map((row) => row.length), 0);
  return cols * scale;
}

function drawLabel(buffer: Buffer, width: number, label: string): void {
  const chars = [...label];
  const scale = label.length > 2 ? 2 : label.length > 1 ? 2 : 3;
  const gap = scale;

  let totalWidth = 0;
  const glyphs = chars.map((char) => {
    const glyph = GLYPH_ROWS[char];

    if (!glyph) {
      return null;
    }

    const w = glyphWidth(glyph, scale);
    totalWidth += w;
    return { char, glyph, w };
  });

  totalWidth += gap * Math.max(0, chars.length - 1);

  let cursorX = Math.floor((width - totalWidth) / 2);
  const glyphHeight = 5 * scale;
  const originY = Math.floor((BADGE_SIZE - glyphHeight) / 2);

  for (const entry of glyphs) {
    if (!entry) {
      continue;
    }

    drawGlyph(buffer, width, entry.glyph, cursorX, originY, scale);
    cursorX += entry.w + gap;
  }
}

export function createWindowsTaskbarBadgeBitmap(label: string): Electron.NativeImage {
  const buffer = Buffer.alloc(BADGE_SIZE * BADGE_SIZE * 4, 0);
  fillCircle(buffer, BADGE_SIZE, BADGE_SIZE / 2, BADGE_SIZE / 2, BADGE_SIZE / 2 - 1);
  drawLabel(buffer, BADGE_SIZE, label);

  const image = nativeImage.createFromBuffer(buffer, {
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    scaleFactor: 1,
  });

  if (image.isEmpty()) {
    return image;
  }

  return image;
}