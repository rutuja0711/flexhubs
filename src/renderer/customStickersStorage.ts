import type { GifPickerItem } from '../shared/gifs';
import { normalizeUploadUrl } from '../shared/profile';

const STORAGE_KEY = 'flexhubs:customStickers';
const MAX_CUSTOM_STICKERS = 48;

function isGifPickerItem(value: unknown): value is GifPickerItem {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  return typeof record.id === 'string' && typeof record.url === 'string' && typeof record.previewUrl === 'string';
}

export function readCustomStickers(): GifPickerItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isGifPickerItem).map((item) => ({
      ...item,
      url: normalizeUploadUrl(item.url),
      previewUrl: item.previewUrl.startsWith('data:')
        ? item.previewUrl
        : normalizeUploadUrl(item.previewUrl),
    }));
  } catch {
    return [];
  }
}

export function addCustomSticker(item: GifPickerItem): GifPickerItem[] {
  const current = readCustomStickers();
  const withoutDuplicate = current.filter((sticker) => sticker.url !== item.url);
  const next = [item, ...withoutDuplicate].slice(0, MAX_CUSTOM_STICKERS);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    return current;
  }

  return next;
}
