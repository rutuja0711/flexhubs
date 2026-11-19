import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiTrash2, FiUpload, FiX } from 'react-icons/fi';
import {
  PROFILE_BANNER_ACCEPT,
  PROFILE_BANNER_ASPECT,
  PROFILE_BANNER_MIN_HEIGHT,
  PROFILE_BANNER_MIN_WIDTH,
  validateProfileBannerFile,
} from '../../shared/profileBanner';
import { saveProfileCover, uploadUserProfileImage } from '../chatApi';
import { resolveCoverUrlAfterProfileSave } from '../../shared/profileBanner';
import { useToast } from '../ui/Toast';
import { ProfileCoverImage } from './ProfileCoverImage';
import {
  initialCropForImage,
  loadImageElement,
  renderCroppedCoverBlob,
  type CoverCropState,
} from './profileCoverCrop';

type ProfileCoverEditorModalProps = {
  open: boolean;
  currentBannerUrl?: string | null;
  onClose: () => void;
  onSaved: (bannerUrl: string | null) => void;
  /** When set, profile PATCH + local sync run here (settings view). */
  persistCover?: (bannerUrl: string | null) => Promise<boolean>;
  onUnauthorized?: (status?: number) => boolean;
};

export function ProfileCoverEditorModal({
  open,
  currentBannerUrl,
  onClose,
  onSaved,
  persistCover,
  onUnauthorized,
}: ProfileCoverEditorModalProps) {
  const toast = useToast();
  const [uploadProgress, setUploadProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState<CoverCropState | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const previewBoxRef = useRef<HTMLDivElement>(null);

  const resetPreview = useCallback(() => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewFile(null);
    setPreviewUrl(null);
    setCrop(null);
    imageRef.current = null;
  }, [previewUrl]);

  useEffect(() => {
    if (!open) {
      resetPreview();
      setUploadProgress(0);
      setBusy(false);
    }
  }, [open, resetPreview]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && open && !busy) {
        onClose();
      }
    };

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [busy, onClose, open]);

  const handlePickFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = PROFILE_BANNER_ACCEPT;
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        return;
      }

      const validation = validateProfileBannerFile(file);
      if (!validation.ok) {
        toast.error(validation.error);
        return;
      }

      resetPreview();
      const url = URL.createObjectURL(file);
      setPreviewFile(file);
      setPreviewUrl(url);

      void loadImageElement(file).then((image) => {
        if (
          image.naturalWidth < PROFILE_BANNER_MIN_WIDTH ||
          image.naturalHeight < PROFILE_BANNER_MIN_HEIGHT
        ) {
          toast.error(
            `Image is small (${image.naturalWidth}×${image.naturalHeight}). A wider photo will look sharper; you can still save.`,
          );
        }

        imageRef.current = image;
        setCrop(initialCropForImage(image));
      });
    };
    input.click();
  };

  const persistCoverToProfile = async (url: string | null): Promise<boolean> => {
    if (persistCover) {
      return persistCover(url);
    }

    const result = await saveProfileCover(url);

    if (!result.ok) {
      if (onUnauthorized?.(result.status)) {
        return false;
      }
      toast.error(result.error || 'Unable to save cover to your profile.');
      return false;
    }

    resolveCoverUrlAfterProfileSave(result.data, url);
    return true;
  };

  const handleRemove = async () => {
    setBusy(true);

    const saved = await persistCoverToProfile(null);
    setBusy(false);

    if (!saved) {
      return;
    }

    if (!persistCover) {
      toast.success('Cover image removed.');
    }
    onSaved(null);
    onClose();
  };

  const handleSave = async () => {
    if (!previewFile || !imageRef.current || !crop) {
      toast.error('Choose an image to upload.');
      return;
    }

    setBusy(true);
    setUploadProgress(0);

    try {
      let file: File;
      try {
        const blob = await renderCroppedCoverBlob(imageRef.current, crop);
        file = new File([blob], 'profile-cover.jpg', { type: 'image/jpeg' });
      } catch {
        if (!previewFile) {
          toast.error('Unable to prepare cover image.');
          return;
        }
        file = previewFile;
      }

      const validation = validateProfileBannerFile(file);

      if (!validation.ok) {
        toast.error(validation.error);
        setBusy(false);
        return;
      }

      const upload = await uploadUserProfileImage(file, setUploadProgress);

      if (!upload.ok) {
        if (onUnauthorized?.(upload.status)) {
          return;
        }
        toast.error(upload.error);
        return;
      }

      const persistedUrl = upload.data.url;
      const saved = await persistCoverToProfile(persistedUrl);

      if (!saved) {
        return;
      }

      if (!persistCover) {
        toast.success('Cover image saved to your profile.');
      }
      onSaved(persistedUrl);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save cover image.');
    } finally {
      setBusy(false);
      setUploadProgress(0);
    }
  };

  const onPointerDown = (event: React.PointerEvent) => {
    if (!crop || !imageRef.current) {
      return;
    }

    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      ox: crop.offsetX,
      oy: crop.offsetY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    const image = imageRef.current;

    if (!drag || !image || !crop) {
      return;
    }

    const box = previewBoxRef.current;
    const scaleX = image.naturalWidth / (box?.clientWidth ?? image.naturalWidth);
    const scaleY = image.naturalHeight / (box?.clientHeight ?? image.naturalHeight);
    const dx = (event.clientX - drag.x) * scaleX;
    const dy = (event.clientY - drag.y) * scaleY;

    const viewW = image.naturalWidth / crop.scale;
    const viewH = image.naturalHeight / crop.scale;

    setCrop({
      ...crop,
      offsetX: Math.max(0, Math.min(image.naturalWidth - viewW, drag.ox - dx)),
      offsetY: Math.max(0, Math.min(image.naturalHeight - viewH, drag.oy - dy)),
    });
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  if (!open) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-app-border bg-app-surface shadow-2xl"
        role="dialog"
        aria-label="Edit profile cover"
      >
        <header className="flex items-center justify-between border-b border-app-border px-4 py-3">
          <h2 className="text-sm font-bold text-app-text">Profile cover</h2>
          <button
            type="button"
            className="rounded-lg p-2 text-app-muted hover:bg-app-chat-hover"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
          >
            <FiX />
          </button>
        </header>

        <div className="space-y-4 p-4">
          <div
            ref={previewBoxRef}
            className="relative aspect-[4/1] w-full overflow-hidden rounded-xl border border-app-border"
            style={{ touchAction: 'none' }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            {previewUrl && crop && imageRef.current ? (
              <img
                src={previewUrl}
                alt="Cover preview"
                className="h-full w-full object-cover"
                style={{
                  objectPosition: `${(crop.offsetX / imageRef.current.naturalWidth) * 100}% ${
                    (crop.offsetY / imageRef.current.naturalHeight) * 100
                  }%`,
                  transform: `scale(${crop.scale / initialCropForImage(imageRef.current).scale})`,
                  transformOrigin: 'center center',
                }}
                draggable={false}
              />
            ) : (
              <ProfileCoverImage bannerUrl={currentBannerUrl} roundedTop={false} />
            )}
          </div>

          {crop ? (
            <label className="block text-xs text-app-muted">
              Zoom
              <input
                type="range"
                min={crop.scale * 0.85}
                max={crop.scale * 2.5}
                step={0.02}
                value={crop.scale}
                className="mt-1 w-full accent-accent"
                onChange={(event) =>
                  setCrop((current) =>
                    current ? { ...current, scale: Number(event.target.value) } : current,
                  )
                }
              />
            </label>
          ) : null}

          {busy ? (
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-app-chat-hover">
              <div
                className="h-full bg-accent transition-all"
                style={{ width: `${Math.max(8, uploadProgress)}%` }}
              />
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-app-border px-3 py-2 text-sm font-medium hover:bg-app-chat-hover"
              onClick={handlePickFile}
              disabled={busy}
            >
              <FiUpload className="text-base" />
              Upload image
            </button>
            {currentBannerUrl ? (
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl border border-rose-500/30 px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
                onClick={() => void handleRemove()}
                disabled={busy}
              >
                <FiTrash2 className="text-base" />
                Remove cover
              </button>
            ) : null}
          </div>
        </div>

        <footer className="flex justify-end gap-2 border-t border-app-border px-4 py-3">
          <button
            type="button"
            className="rounded-xl px-4 py-2 text-sm font-medium text-app-muted hover:bg-app-chat-hover"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            onClick={() => void handleSave()}
            disabled={busy || !previewFile}
          >
            {busy ? 'Saving…' : 'Save cover'}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}