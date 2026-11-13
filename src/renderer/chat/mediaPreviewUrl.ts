/** True when URL looks like a raster image thumbnail (not a video file). */
export function isLikelyImagePreviewUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) {
    return false;
  }

  const path = url.split('?')[0].split('#')[0].toLowerCase();
  return /\.(jpe?g|png|gif|webp|heic|heif|bmp|svg|avif)$/.test(path);
}
