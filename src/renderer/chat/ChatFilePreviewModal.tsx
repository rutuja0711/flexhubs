import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiDownload, FiX } from 'react-icons/fi';
import { fetchMediaBlob } from '../mediaBlob';
import { ChatAttachmentPreviewPanel } from './ChatAttachmentPreviewPanel';
import {
  attachmentTypeLabel,
  categorizeAttachmentFile,
  readFileExtension,
} from './attachmentFileMeta';
import { executableAttachmentWarning, isExecutableAttachment } from './attachmentPreviewCapabilities';
import { formatFileSize } from './FileAttachmentCard';

export type ChatFilePreviewItem = {
  url: string;
  name: string;
};

function triggerDownload(blob: Blob, fileName: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

export function ChatFilePreviewModal({ item, onClose }: { item: ChatFilePreviewItem; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sizeBytes, setSizeBytes] = useState<number | null>(null);

  const extension = readFileExtension(item.name);
  const category = categorizeAttachmentFile(item.name);
  const typeLabel = attachmentTypeLabel(category, extension);
  const execWarning = executableAttachmentWarning(item.name);

  useEffect(() => {
    setError('');
    setSizeBytes(null);

    let cancelled = false;
    void fetchMediaBlob(item.url)
      .then((blob) => {
        if (!cancelled) {
          setSizeBytes(blob.size);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSizeBytes(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [item.url]);

  const handleSave = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const blob = await fetchMediaBlob(item.url);
      triggerDownload(blob, item.name);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to download file.');
    } finally {
      setBusy(false);
    }
  }, [item.name, item.url]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[310] flex flex-col bg-[#0b0b0c] text-white animate-fade-in">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-white/10 px-5 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{item.name}</p>
          <p className="text-xs text-white/55">
            {typeLabel}
            {sizeBytes ? ` · ${formatFileSize(sizeBytes)}` : ''}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            disabled={busy}
            className="flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
            onClick={() => void handleSave()}
          >
            <FiDownload className="text-base" />
            Download
          </button>
          <button
            type="button"
            aria-label="Close preview"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            onClick={onClose}
          >
            <FiX className="text-lg" />
          </button>
        </div>
      </header>

      {execWarning || isExecutableAttachment(item.name) ? (
        <div
          className="shrink-0 border-b border-amber-500/30 bg-amber-500/10 px-5 py-2.5 text-xs leading-relaxed text-amber-100"
          role="alert"
        >
          {execWarning ??
            'This file may be executable. Download only if you trust the sender. FlexHubs will not run it automatically.'}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 w-full flex-col overflow-hidden bg-[#0b0b0c]">
        <div className="flex min-h-0 flex-1 w-full flex-col">
          <ChatAttachmentPreviewPanel
            name={item.name}
            category={category}
            mediaUrl={item.url}
            mode="modal"
          />
        </div>
      </div>

      <footer className="shrink-0 border-t border-white/10 px-5 py-2 text-center text-xs text-white/50">
        Esc to close
        {error ? <span className="ml-2 text-red-300">{error}</span> : null}
      </footer>
    </div>,
    document.body,
  );
}