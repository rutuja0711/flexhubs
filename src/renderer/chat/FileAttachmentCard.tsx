import { useCallback, useEffect, useState } from 'react';
import { FiDownload } from 'react-icons/fi';
import { fetchMediaBlobWithProgress } from '../mediaBlob';
import { SendingProgressRing } from '../ui/SendingProgressRing';

type FileAttachmentCardProps = {
  url: string;
  name: string;
  isSending?: boolean;
  sendProgress?: number | null;
  isOwn?: boolean;
};

function readFileExtension(fileName: string): string {
  const base = fileName.trim().split(/[\\/]/).pop() ?? fileName;
  const match = base.match(/\.([a-z0-9]{1,8})$/i);
  return match ? match[1].toUpperCase() : 'FILE';
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '';
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  const mb = bytes / (1024 * 1024);
  return mb >= 10 ? `${Math.round(mb)} MB` : `${mb.toFixed(1)} MB`;
}

function buildMetaLine(extension: string, sizeBytes: number | null): string {
  const sizeLabel = sizeBytes ? formatFileSize(sizeBytes) : null;
  if (sizeLabel) {
    return `${extension} • ${sizeLabel}`;
  }

  return extension;
}

function downloadedStorageKey(url: string): string {
  return `flexhubs:file-downloaded:${url}`;
}

function readPersistedDownloaded(url: string): boolean {
  try {
    return sessionStorage.getItem(downloadedStorageKey(url)) === '1';
  } catch {
    return false;
  }
}

function persistDownloaded(url: string): void {
  try {
    sessionStorage.setItem(downloadedStorageKey(url), '1');
  } catch {
    // Ignore storage failures.
  }
}

function triggerBlobDownload(blob: Blob, fileName: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

function DocumentTypeIcon({ extension }: { extension: string }) {
  const label = extension.length > 4 ? extension.slice(0, 4) : extension;

  return (
    <div className="relative flex h-[46px] w-[38px] shrink-0 items-end justify-center pb-0.5">
      <svg
        viewBox="0 0 32 40"
        className="h-[42px] w-[34px] text-app-muted/75"
        aria-hidden="true"
      >
        <path
          fill="currentColor"
          d="M6 2h14l6 6v28a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"
        />
        <path fill="currentColor" fillOpacity="0.45" d="M20 2v6h6" />
        <rect x="4" y="26" width="24" height="10" rx="1" fill="currentColor" fillOpacity="0.35" />
      </svg>
      <span className="absolute bottom-[7px] left-1/2 max-w-[30px] -translate-x-1/2 truncate text-[9px] font-bold leading-none tracking-tight text-white drop-shadow-sm">
        {label}
      </span>
    </div>
  );
}

export function FileAttachmentCard({
  url,
  name,
  isSending = false,
  sendProgress = null,
  isOwn = false,
}: FileAttachmentCardProps) {
  const extension = readFileExtension(name);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [knownSizeBytes, setKnownSizeBytes] = useState<number | null>(null);
  const [downloadError, setDownloadError] = useState(false);
  const [downloaded, setDownloaded] = useState(() => readPersistedDownloaded(url));

  useEffect(() => {
    setDownloaded(readPersistedDownloaded(url));
  }, [url]);

  const metaLine = buildMetaLine(extension, knownSizeBytes);
  const showDownloadAction = !downloaded || isSending || downloadError;
  const showSendProgress = isSending;
  const showDownloadProgress = downloading && !isSending;
  const ringProgress = showSendProgress
    ? sendProgress
    : showDownloadProgress
      ? downloadProgress
      : null;

  const insetClass = isOwn
    ? 'bg-black/12 dark:bg-black/25'
    : 'bg-black/[0.06] dark:bg-black/22';

  const handleDownload = useCallback(async () => {
    if (isSending || downloading) {
      return;
    }

    setDownloading(true);
    setDownloadError(false);
    setDownloadProgress(0);

    try {
      let blob: Blob;

      if (url.startsWith('blob:') || url.startsWith('data:')) {
        const response = await fetch(url);
        blob = await response.blob();
        setKnownSizeBytes(blob.size);
        setDownloadProgress(100);
      } else {
        blob = await fetchMediaBlobWithProgress(url, (loaded, total) => {
          if (total && total > 0) {
            setKnownSizeBytes(total);
            setDownloadProgress(Math.min(100, Math.round((loaded / total) * 100)));
          } else if (loaded > 0) {
            setKnownSizeBytes(loaded);
            setDownloadProgress(null);
          }
        });
        setKnownSizeBytes(blob.size);
        setDownloadProgress(100);
      }

      triggerBlobDownload(blob, name);
      setDownloaded(true);
      persistDownloaded(url);
      setDownloadError(false);
    } catch {
      setDownloadError(true);
      setDownloadProgress(null);
    } finally {
      window.setTimeout(() => {
        setDownloading(false);
        setDownloadProgress(null);
      }, 400);
    }
  }, [downloading, isSending, name, url]);

  const progressBarWidth =
    typeof ringProgress === 'number' ? ringProgress : showDownloadProgress ? undefined : 0;

  return (
    <div
      className={`relative min-w-[min(100%,280px)] max-w-sm overflow-hidden rounded-xl ${insetClass} px-3 py-2.5`}
    >
      <div className="flex items-center gap-2.5">
        <DocumentTypeIcon extension={extension} />

        <div className="min-w-0 flex-1 py-0.5">
          <p className="line-clamp-2 text-[13px] font-medium leading-snug text-inherit">{name}</p>
          <p className="mt-0.5 text-[11px] font-medium text-inherit/55">
            {downloadError ? 'Download failed — tap to retry' : metaLine}
          </p>
        </div>

        {showDownloadAction ? (
          <button
            type="button"
            aria-label={downloading ? 'Downloading file' : 'Download file'}
            disabled={isSending}
            className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${
              isSending ? 'cursor-default opacity-80' : 'hover:bg-black/10 dark:hover:bg-white/10'
            }`}
            onClick={() => {
              void handleDownload();
            }}
          >
            {showSendProgress || showDownloadProgress ? (
              <SendingProgressRing
                progress={ringProgress}
                size={36}
                showLabel={typeof ringProgress === 'number'}
                className={isOwn ? 'text-white/90' : 'text-accent-soft'}
              />
            ) : (
              <FiDownload className="h-[22px] w-[22px] text-inherit/70" strokeWidth={1.75} />
            )}
          </button>
        ) : null}
      </div>

      {showSendProgress || showDownloadProgress ? (
        <div
          className="mt-2.5 h-1 overflow-hidden rounded-full bg-black/10 dark:bg-white/10"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={typeof progressBarWidth === 'number' ? progressBarWidth : undefined}
        >
          {typeof progressBarWidth === 'number' ? (
            <div
              className={`h-full rounded-full transition-[width] duration-200 ease-out ${
                isOwn ? 'bg-white/85' : 'bg-accent'
              }`}
              style={{ width: `${progressBarWidth}%` }}
            />
          ) : (
            <div
              className={`h-full w-1/3 animate-pulse rounded-full ${
                isOwn ? 'bg-white/70' : 'bg-accent/80'
              }`}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}
