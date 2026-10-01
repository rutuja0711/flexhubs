function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  return value as Record<string, unknown>;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export type GifPickerItem = {
  id: string;
  url: string;
  previewUrl: string;
  title: string | null;
  width: number | null;
  height: number | null;
  mimeType: string | null;
};

export const STICKER_MESSAGE_MARKER = 'sticker';

function extractArray(payload: unknown, keys: string[]): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  const record = asRecord(payload);

  if (!record) {
    return [];
  }

  for (const key of keys) {
    const value = record[key];

    if (Array.isArray(value)) {
      return value;
    }
  }

  return [];
}

function readMediaUrl(record: Record<string, unknown>): string | null {
  const direct =
    readString(record.url) ??
    readString(record.gifUrl) ??
    readString(record.mediaUrl) ??
    readString(record.src) ??
    readString(record.fullUrl) ??
    readString(record.originalUrl);

  if (direct) {
    return direct;
  }

  const images = asRecord(record.images);
  if (images) {
    for (const size of ['original', 'downsized', 'fixed_width', 'preview']) {
      const image = asRecord(images[size]);
      const url = image ? readString(image.url) : null;
      if (url) {
        return url;
      }
    }
  }

  const media = record.media;
  if (Array.isArray(media)) {
    for (const entry of media) {
      const mediaRecord = asRecord(entry);
      const url = mediaRecord
        ? readString(mediaRecord.url) ?? readString(mediaRecord.gif) ?? readString(mediaRecord.tinygif)
        : null;
      if (url) {
        return url;
      }
    }
  }

  return null;
}

function readPreviewUrl(record: Record<string, unknown>, fallbackUrl: string): string {
  return (
    readString(record.previewUrl) ??
    readString(record.thumbnailUrl) ??
    readString(record.thumbUrl) ??
    readString(record.preview) ??
    readMediaUrl(record) ??
    fallbackUrl
  );
}

function normalizeGifItem(record: Record<string, unknown>, index: number): GifPickerItem | null {
  const url = readMediaUrl(record);

  if (!url) {
    return null;
  }

  const previewUrl = readPreviewUrl(record, url);
  const width = typeof record.width === 'number' ? record.width : null;
  const height = typeof record.height === 'number' ? record.height : null;

  return {
    id: readString(record.id) ?? readString(record.slug) ?? `gif-${index}`,
    url,
    previewUrl,
    title: readString(record.title) ?? readString(record.name) ?? readString(record.alt),
    width,
    height,
    mimeType: readString(record.mimeType) ?? readString(record.contentType),
  };
}

export function normalizeGifItems(payload: unknown): GifPickerItem[] {
  const items = extractArray(payload, ['gifs', 'stickers', 'results', 'items', 'data']);

  return items
    .map(asRecord)
    .filter((item): item is Record<string, unknown> => item !== null)
    .map(normalizeGifItem)
    .filter((item): item is GifPickerItem => item !== null);
}

export function buildFileMessagePayload(
  url: string,
  fileName: string,
  mimeType: string,
  caption?: string,
): Record<string, unknown> {
  const isImage = mimeType.startsWith('image/');
  const payload: Record<string, unknown> = {
    // API accepts FILE for video attachments (not VIDEO).
    type: isImage ? 'IMAGE' : 'FILE',
    content: caption?.trim() ?? '',
    fileUrl: url,
    fileName,
    mimeType,
  };

  return payload;
}

export function buildMediaMessagePayload(
  item: GifPickerItem,
  kind: 'gif' | 'sticker',
): Record<string, unknown> {
  const fileName = item.title?.trim() || (kind === 'sticker' ? 'Sticker' : 'GIF');

  if (kind === 'sticker') {
    return {
      type: 'GIF',
      content: STICKER_MESSAGE_MARKER,
      fileUrl: item.url,
      fileName,
      mimeType: item.mimeType ?? 'image/png',
    };
  }

  return {
    type: 'GIF',
    fileUrl: item.url,
    fileName,
    mimeType: 'image/gif',
  };
}

export function createUploadedStickerItem(
  url: string,
  fileName: string,
  mimeType: string,
): GifPickerItem {
  const normalizedUrl = url.trim();

  return {
    id: `custom-sticker-${normalizedUrl}`,
    url: normalizedUrl,
    previewUrl: normalizedUrl,
    title: fileName,
    width: null,
    height: null,
    mimeType,
  };
}
