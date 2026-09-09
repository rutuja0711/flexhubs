import { useEffect, useRef, useState } from 'react';
import { FiUpload } from 'react-icons/fi';
import type { GifPickerItem } from '../../shared/gifs';
import { createUploadedStickerItem } from '../../shared/gifs';
import {
  loadStickerSearch,
  loadStickerTrending,
  loadGifSearch,
  loadGifTrending,
} from '../chatApi';
import { addCustomSticker, readCustomStickers } from '../customStickersStorage';
import { uploadChatFile } from '../extrasApi';
import { RemoteImage } from '../RemoteImage';

type MediaPickerTab = 'gif' | 'sticker';

type MediaPickerProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (item: GifPickerItem, kind: MediaPickerTab) => void;
  initialTab?: MediaPickerTab;
};

const STICKER_ACCEPT = 'image/png,image/webp,image/gif,image/jpeg';
const STICKER_MIME_TYPES = new Set(['image/png', 'image/webp', 'image/gif', 'image/jpeg']);
const MAX_STICKER_BYTES = 2 * 1024 * 1024;

export function MediaPicker({ open, onClose, onSelect, initialTab = 'gif' }: MediaPickerProps) {
  const [tab, setTab] = useState<MediaPickerTab>(initialTab);
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<GifPickerItem[]>([]);
  const [myStickers, setMyStickers] = useState<GifPickerItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setTab(initialTab);
    setQuery('');
    setError('');
    setMyStickers(readCustomStickers());
  }, [initialTab, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setQuery('');
  }, [open, tab]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const trimmedQuery = query.trim();
    setLoading(true);
    setError('');

    const timer = window.setTimeout(() => {
      const request =
        tab === 'gif'
          ? trimmedQuery
            ? loadGifSearch(trimmedQuery)
            : loadGifTrending()
          : trimmedQuery
            ? loadStickerSearch(trimmedQuery)
            : loadStickerTrending();

      void request.then((result) => {
        setLoading(false);

        if (!result.ok) {
          setError(result.error);
          setItems([]);
          return;
        }

        setItems(result.data);
      });
    }, trimmedQuery ? 300 : 0);

    return () => window.clearTimeout(timer);
  }, [open, query, tab]);

  const handleStickerUploadClick = () => {
    if (uploading) {
      return;
    }

    fileInputRef.current?.click();
  };

  const handleStickerFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    const mimeType = file.type || 'application/octet-stream';

    if (!STICKER_MIME_TYPES.has(mimeType)) {
      setError('Use a PNG, WebP, GIF, or JPEG image.');
      return;
    }

    if (file.size > MAX_STICKER_BYTES) {
      setError('Sticker must be under 2 MB.');
      return;
    }

    setUploading(true);
    setError('');

    const result = await uploadChatFile(file);
    setUploading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    const item = createUploadedStickerItem(result.data.url, file.name, mimeType);
    setMyStickers(addCustomSticker(item));
    setTab('sticker');
  };

  if (!open) {
    return null;
  }

  return (
    <div
      ref={panelRef}
      className="absolute bottom-full left-0 z-50 mb-2 w-full max-w-md rounded-xl border border-app-border bg-app-elevated shadow-xl"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={STICKER_ACCEPT}
        className="hidden"
        onChange={(event) => {
          void handleStickerFileChange(event);
        }}
      />

      <div className="flex items-center gap-2 border-b border-app-border px-3 py-2">
        <button
          type="button"
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
            tab === 'gif' ? 'bg-accent text-white' : 'text-app-muted hover:text-app-text'
          }`}
          onClick={() => setTab('gif')}
        >
          GIFs
        </button>
        <button
          type="button"
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
            tab === 'sticker' ? 'bg-accent text-white' : 'text-app-muted hover:text-app-text'
          }`}
          onClick={() => setTab('sticker')}
        >
          Stickers
        </button>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={tab === 'gif' ? 'Search GIFs' : 'Search stickers'}
          className="ml-auto min-w-0 flex-1 rounded-lg border border-app-border bg-app-surface px-3 py-1.5 text-xs text-app-text outline-none placeholder:text-app-placeholder focus:border-accent"
        />
      </div>

      <div className="h-64 overflow-y-auto p-2">
        {tab === 'sticker' ? (
          <div className="mb-3">
            <p className="mb-2 px-1 text-[0.6875rem] font-semibold uppercase tracking-wide text-app-muted">
              My stickers
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                disabled={uploading}
                className="flex h-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-app-border bg-app-surface text-app-muted transition-colors hover:border-accent/60 hover:text-accent-soft disabled:cursor-not-allowed disabled:opacity-50"
                onClick={handleStickerUploadClick}
                aria-label="Upload sticker"
              >
                {uploading ? (
                  <span className="text-[0.6875rem]">Uploading...</span>
                ) : (
                  <>
                    <FiUpload className="h-4 w-4" aria-hidden="true" />
                    <span className="text-[0.6875rem] font-medium">Upload</span>
                  </>
                )}
              </button>
              {myStickers.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="overflow-hidden rounded-lg bg-app-surface hover:ring-2 hover:ring-accent/60"
                  onClick={() => onSelect(item, 'sticker')}
                  aria-label={item.title ?? 'Custom sticker'}
                >
                  <RemoteImage
                    src={item.previewUrl}
                    alt={item.title ?? ''}
                    loading="lazy"
                    className="h-20 w-full object-contain p-1"
                  />
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {tab === 'sticker' && !query.trim() ? (
          <p className="mb-2 px-1 text-[0.6875rem] font-semibold uppercase tracking-wide text-app-muted">
            Trending
          </p>
        ) : null}

        {loading ? (
          <p className="px-2 py-4 text-center text-xs text-app-muted">Loading...</p>
        ) : error ? (
          <p className="px-2 py-4 text-center text-xs text-accent-soft">{error}</p>
        ) : items.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-app-muted">
            {query.trim() ? 'No results found.' : tab === 'sticker' ? 'No trending stickers yet.' : 'Nothing to show yet.'}
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {items.map((item) => (
              <button
                key={`${tab}-${item.id}`}
                type="button"
                className="overflow-hidden rounded-lg bg-app-surface hover:ring-2 hover:ring-accent/60"
                onClick={() => onSelect(item, tab)}
                aria-label={item.title ?? (tab === 'gif' ? 'GIF' : 'Sticker')}
              >
                <RemoteImage
                  src={item.previewUrl}
                  alt={item.title ?? ''}
                  loading="lazy"
                  className={`h-20 w-full object-cover ${tab === 'sticker' ? 'object-contain p-1' : ''}`}
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
