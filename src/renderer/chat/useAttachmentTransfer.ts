import { useCallback, useEffect, useState } from 'react';
import { fetchMediaBlobWithProgress } from '../mediaBlob';
import { sanitizeProgressPercent } from './attachmentProgressUtil';
import { warmChatFileDragPath } from './startChatFileDrag';

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

export type AttachmentTransferState = {
  downloading: boolean;
  downloadProgress: number | null;
  knownSizeBytes: number | null;
  downloadError: boolean;
  downloaded: boolean;
  showSendProgress: boolean;
  showDownloadProgress: boolean;
  ringProgress: number | null;
  ringIndeterminate: boolean;
  progressBarWidth: number | undefined;
  handleDownload: () => Promise<void>;
};

export function useAttachmentTransfer(options: {
  url: string;
  name: string;
  isSending?: boolean;
  sendProgress?: number | null;
  /** Optional size while sending (blob URL phase). */
  sendingSizeBytes?: number | null;
}): AttachmentTransferState {
  const { url, name, isSending = false, sendProgress = null, sendingSizeBytes = null } = options;
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [knownSizeBytes, setKnownSizeBytes] = useState<number | null>(sendingSizeBytes);
  const [downloadError, setDownloadError] = useState(false);
  const [downloaded, setDownloaded] = useState(() => readPersistedDownloaded(url));

  useEffect(() => {
    setDownloaded(readPersistedDownloaded(url));
  }, [url]);

  useEffect(() => {
    if (sendingSizeBytes != null && sendingSizeBytes > 0) {
      setKnownSizeBytes(sendingSizeBytes);
    }
  }, [sendingSizeBytes]);

  useEffect(() => {
    if (!isSending || !url.startsWith('blob:') || knownSizeBytes) {
      return;
    }

    let cancelled = false;
    void fetch(url)
      .then((response) => response.blob())
      .then((blob) => {
        if (!cancelled && blob.size > 0) {
          setKnownSizeBytes(blob.size);
        }
      })
      .catch(() => {
        // Ignore — size remains unknown.
      });

    return () => {
      cancelled = true;
    };
  }, [isSending, knownSizeBytes, url]);

  useEffect(() => {
    if (isSending || !url || url.startsWith('blob:')) {
      return;
    }

    void warmChatFileDragPath(url, name);
  }, [isSending, name, url]);

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
            setDownloadProgress(sanitizeProgressPercent((loaded / total) * 100));
          } else if (loaded > 0) {
            setKnownSizeBytes((current) => current ?? loaded);
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

  const sanitizedSend = sanitizeProgressPercent(sendProgress);
  const sanitizedDownload = sanitizeProgressPercent(downloadProgress);
  const showSendProgress = isSending;
  const showDownloadProgress = downloading && !isSending;
  const ringIndeterminate =
    showSendProgress &&
    (sanitizedSend == null || (sanitizedSend > 40 && sanitizedSend < 100));
  const ringProgress = showSendProgress
    ? ringIndeterminate
      ? null
      : sanitizedSend
    : showDownloadProgress
      ? sanitizedDownload
      : null;
  const progressBarWidth =
    typeof ringProgress === 'number'
      ? ringProgress
      : showSendProgress || showDownloadProgress
        ? undefined
        : undefined;

  return {
    downloading,
    downloadProgress: sanitizedDownload,
    knownSizeBytes,
    downloadError,
    downloaded,
    showSendProgress,
    showDownloadProgress,
    ringProgress,
    ringIndeterminate,
    progressBarWidth,
    handleDownload,
  };
}
