import { useEffect, useMemo, useRef, useState } from 'react';
import { FiSearch, FiUpload, FiX } from 'react-icons/fi';
import type { GifPickerItem } from '../../shared/gifs';
import { createUploadedStickerItem } from '../../shared/gifs';
import { REACTION_EMOJI_CATEGORIES } from '../../shared/reactionEmojis';
import {
  loadStickerSearch,
  loadStickerTrending,
  loadGifSearch,
  loadGifTrending,
} from '../chatApi';
import { addCustomSticker, readCustomStickers } from '../customStickersStorage';
import { uploadChatFile } from '../extrasApi';
import { RemoteImage } from '../RemoteImage';
import { readRecentEmojis, rememberRecentEmoji } from './recentEmojis';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import { useTheme } from '../theme/ThemeProvider';

export type MediaPickerTab = 'gif' | 'emoji' | 'sticker';

type MediaPickerProps = {
  open: boolean;
  onClose: () => void;
  onSelectMedia: (item: GifPickerItem, kind: 'gif' | 'sticker') => void;
  onSelectEmoji: (emoji: string) => void;
  initialTab?: MediaPickerTab;
};

const STICKER_ACCEPT = 'image/png,image/webp,image/gif,image/jpeg';
const STICKER_MIME_TYPES = new Set(['image/png', 'image/webp', 'image/gif', 'image/jpeg']);
const MAX_STICKER_BYTES = 2 * 1024 * 1024;



function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }

      reject(new Error('Unable to read sticker preview.'));
    };
    reader.onerror = () => reject(new Error('Unable to read sticker preview.'));
    reader.readAsDataURL(file);
  });
}



export function MediaPicker({
  open,
  onClose,
  onSelectMedia,
  onSelectEmoji,
  initialTab = 'emoji',
}: MediaPickerProps) {
  const { theme } = useTheme();
  const [tab, setTab] = useState<MediaPickerTab>(initialTab);
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<GifPickerItem[]>([]);
  const [myStickers, setMyStickers] = useState<GifPickerItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [recentEmojis, setRecentEmojis] = useState<string[]>(() => readRecentEmojis());
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

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setTab(initialTab);
    setQuery('');
    setError('');
    setMyStickers(readCustomStickers());
    setRecentEmojis(readRecentEmojis());
  }, [initialTab, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setQuery('');
  }, [open, tab]);

  useEffect(() => {
    if (!open || tab === 'emoji') {
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

    let previewUrl: string;

    try {
      previewUrl = await readFileAsDataUrl(file);
    } catch {
      previewUrl = result.data.url;
    }

    const item = {
      ...createUploadedStickerItem(result.data.url, file.name, mimeType),
      previewUrl,
    };
    setMyStickers(addCustomSticker(item));
    setTab('sticker');
  };

  const handleEmojiPick = (emoji: string) => {
    setRecentEmojis(rememberRecentEmoji(emoji));
    onSelectEmoji(emoji);
  };



  if (!open) {
    return null;
  }

  const searchPlaceholder =
    tab === 'gif' ? 'Search GIFs...' : tab === 'sticker' ? 'Search stickers...' : 'Search emoji...';

  return (
    <div
      ref={panelRef}
      className="absolute bottom-full left-0 z-50 mb-2 w-[min(100vw-2rem,420px)] overflow-hidden rounded-2xl border border-app-border bg-app-elevated shadow-2xl"
      role="dialog"
      aria-label="Insert GIF, emoji, or sticker"
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

      <div className="flex items-center gap-2 px-3 pb-2 pt-3">
        {(['gif', 'emoji', 'sticker'] as const).map((option) => (
          <button
            key={option}
            type="button"
            className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize transition-colors ${
              tab === option
                ? 'bg-accent text-white'
                : 'bg-app-surface text-app-muted hover:text-app-text'
            }`}
            onClick={() => setTab(option)}
          >
            {option === 'gif' ? 'Gifs' : option === 'emoji' ? 'Emojis' : 'Stickers'}
          </button>
        ))}
        <button
          type="button"
          aria-label="Close picker"
          className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-app-muted transition-colors hover:bg-app-chat-hover hover:text-app-text"
          onClick={onClose}
        >
          <FiX className="h-4 w-4" />
        </button>
      </div>

      {tab !== 'emoji' ? (
        <div className="flex items-center gap-2 px-3 pb-3">
          <div className="relative min-w-0 flex-1">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-muted" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-xl border border-app-border bg-app-surface py-2 pl-9 pr-3 text-sm text-app-text outline-none placeholder:text-app-placeholder focus:border-accent"
            />
          </div>
        </div>
      ) : null}

      {tab === 'emoji' ? (
        <div className="w-full">
          <EmojiPicker
            onEmojiClick={(emojiObject) => handleEmojiPick(emojiObject.emoji)}
            width="100%"
            height={360}
            theme={theme === 'dark' ? Theme.DARK : Theme.LIGHT}
          />
        </div>
      ) : (
        <div className="h-72 overflow-y-auto p-3">
          {tab === 'sticker' ? (
            <div className="mb-3">
              <p className="mb-2 text-sm font-medium text-app-muted">My stickers</p>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  disabled={uploading}
                  className="flex h-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-app-border bg-app-surface text-app-muted transition-colors hover:border-accent/60 hover:text-accent-soft disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={handleStickerUploadClick}
                  aria-label="Upload sticker"
                >
                  {uploading ? (
                    <span className="text-xs">Uploading...</span>
                  ) : (
                    <>
                      <FiUpload className="h-4 w-4" aria-hidden="true" />
                      <span className="text-xs font-medium">Upload</span>
                    </>
                  )}
                </button>
                {myStickers.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="overflow-hidden rounded-lg bg-transparent hover:ring-2 hover:ring-accent/60"
                    onClick={() => onSelectMedia(item, 'sticker')}
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
            <p className="mb-2 text-sm font-medium text-app-muted">Trending</p>
          ) : null}

          {loading ? (
            <p className="py-4 text-center text-sm text-app-muted">Loading...</p>
          ) : error ? (
            <p className="py-4 text-center text-sm text-accent-soft">{error}</p>
          ) : items.length === 0 ? (
            <p className="py-4 text-center text-sm text-app-muted">
              {query.trim()
                ? 'No results found.'
                : tab === 'sticker'
                  ? 'No trending stickers yet.'
                  : 'Nothing to show yet.'}
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {items.map((item) => (
                <button
                  key={`${tab}-${item.id}`}
                  type="button"
                  className={`overflow-hidden rounded-lg hover:ring-2 hover:ring-accent/60 ${
                    tab === 'sticker' ? 'bg-transparent' : 'bg-app-surface'
                  }`}
                  onClick={() => onSelectMedia(item, tab)}
                  aria-label={item.title ?? (tab === 'gif' ? 'GIF' : 'Sticker')}
                >
                  <RemoteImage
                    src={item.previewUrl}
                    alt={item.title ?? ''}
                    loading="lazy"
                    className={`h-20 w-full ${tab === 'sticker' ? 'bg-transparent object-contain p-1' : 'object-cover'}`}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
