import { PROFILE_BANNER_ASPECT } from '../../shared/profileBanner';

export type CoverCropState = {
  scale: number;
  offsetX: number;
  offsetY: number;
};

export async function loadImageElement(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);

  try {
    const image = new Image();
    image.decoding = 'async';
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Unable to load image.'));
      image.src = url;
    });
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function measureImageForCrop(image: HTMLImageElement): { width: number; height: number } {
  return { width: image.naturalWidth, height: image.naturalHeight };
}

export function renderCroppedCoverBlob(
  image: HTMLImageElement,
  crop: CoverCropState,
  outputWidth = 1600,
): Promise<Blob> {
  const outputHeight = Math.round(outputWidth / PROFILE_BANNER_ASPECT);
  const canvas = document.createElement('canvas');
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return Promise.reject(new Error('Unable to prepare cover image.'));
  }

  const viewW = image.naturalWidth / crop.scale;
  const viewH = image.naturalHeight / crop.scale;
  const sx = Math.max(0, Math.min(image.naturalWidth - viewW, crop.offsetX));
  const sy = Math.max(0, Math.min(image.naturalHeight - viewH, crop.offsetY));

  ctx.drawImage(image, sx, sy, viewW, viewH, 0, 0, outputWidth, outputHeight);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Unable to export cover image.'));
          return;
        }

        resolve(blob);
      },
      'image/jpeg',
      0.92,
    );
  });
}

export function initialCropForImage(
  image: HTMLImageElement,
  viewportAspect = PROFILE_BANNER_ASPECT,
): CoverCropState {
  const imageAspect = image.naturalWidth / image.naturalHeight;
  const scale =
    imageAspect >= viewportAspect
      ? image.naturalWidth / (image.naturalHeight * viewportAspect)
      : image.naturalHeight / (image.naturalWidth / viewportAspect);

  const viewW = image.naturalWidth / scale;
  const viewH = image.naturalHeight / scale;

  return {
    scale,
    offsetX: Math.max(0, (image.naturalWidth - viewW) / 2),
    offsetY: Math.max(0, (image.naturalHeight - viewH) / 2),
  };
}