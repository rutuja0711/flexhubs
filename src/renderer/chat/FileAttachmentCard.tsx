import { useCallback, useEffect, useState } from 'react';
import { FiCheck, FiDownload, FiRefreshCw } from 'react-icons/fi';
import { fetchMediaBlobWithProgress } from '../mediaBlob';
import { SendingProgressRing } from '../ui/SendingProgressRing';
import { AttachmentFileIcon } from './AttachmentFileIcon';
import {
  attachmentTypeLabel,
  categorizeAttachmentFile,
  readFileExtension,
} from './attachmentFileMeta';
import { beginChatFileDrag } from './startChatFileDrag';
import { useAttachmentTransfer } from './useAttachmentTransfer';

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

type FileAttachmentCardProps = {
  url: string;
  name: string;
  isSending?: boolean;
  sendProgress?: number | null;
  isOwn?: boolean;
};

function buildMetaLine(
  typeLabel: string,
  sizeBytes: number | null,
  statusLine: string | null,
): string {
  if (statusLine) {
    return statusLine;
  }

  const sizeLabel = sizeBytes ? formatFileSize(sizeBytes) : null;
  if (sizeLabel) {
    return `${typeLabel} · ${sizeLabel}`;
  }

  return typeLabel;
}

function AttachmentProgressBar({
  progressBarWidth,
  isOwn,
  label,
}: {
  progressBarWidth: number | undefined;
  isOwn: boolean;
  label: string;
}) {
  return (
    <div className="mt-3 space-y-1">
      <div
        className="h-[3px] overflow-hidden rounded-full bg-black/[0.08] dark:bg-white/10"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={typeof progressBarWidth === 'number' ? progressBarWidth : undefined}
        aria-label={label}
      >
        {typeof progressBarWidth === 'number' ? (
          <div
            className={`h-full rounded-full transition-[width] duration-200 ease-out ${
              isOwn ? 'bg-white/90' : 'bg-accent'
            }`}
            style={{ width: `${progressBarWidth}%` }}
          />
        ) : (
          <div
            className={`h-full w-1/3 animate-pulse rounded-full ${isOwn ? 'bg-white/70' : 'bg-accent/80'}`}
          />
        )}
      </div>
      {typeof progressBarWidth === 'number' ? (
        <p className={`text-[10px] tabular-nums ${isOwn ? 'text-white/65' : 'text-app-muted'}`}>
          {label} · {progressBarWidth}%
        </p>
      ) : null}
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
  const category = categorizeAttachmentFile(name);
  const typeLabel = attachmentTypeLabel(category, extension);

  const transfer = useAttachmentTransfer({ url, name, isSending, sendProgress });
  const {
    knownSizeBytes,
    downloadError,
    downloaded,
    showSendProgress,
    showDownloadProgress,
    ringProgress,
    progressBarWidth,
    handleDownload,
  } = transfer;

  const statusLine = showSendProgress
    ? 'Uploading…'
    : showDownloadProgress
      ? 'Downloading…'
      : downloadError
        ? 'Download failed — tap to retry'
        : downloaded && !isSending
          ? 'Downloaded'
          : null;

  const metaLine = buildMetaLine(typeLabel, knownSizeBytes, statusLine);

  const canDrag =
    Boolean(window.electronAPI?.startChatFileDragFromPath) &&
    !isSending &&
    Boolean(url) &&
    !url.startsWith('blob:');

  const cardSurface = isOwn
    ? 'border-white/15 bg-gradient-to-br from-white/[0.14] via-white/[0.08] to-white/[0.04] shadow-sm shadow-black/10'
    : 'border-app-border/80 bg-app-surface/95 shadow-sm shadow-black/[0.04] dark:border-accent/15 dark:bg-gradient-to-br dark:from-app-elevated dark:via-app-surface dark:to-app-elevated/80';

  const iconWrap = isOwn
    ? 'bg-white/15 text-white ring-1 ring-white/20'
    : 'bg-accent/[0.08] text-accent ring-1 ring-accent/15';

  const actionButton = isOwn
    ? 'border-white/20 bg-white/10 text-white hover:bg-white/20'
    : 'border-accent/20 bg-app-inset/50 text-accent hover:bg-accent/10 hover:border-accent/35';

  return (
    <div
      draggable={canDrag}
      title={canDrag ? 'Drag to Desktop, Finder, or another app' : undefined}
      className={`group/card relative min-w-[min(100%,300px)] max-w-sm overflow-hidden rounded-2xl border px-3 py-3 transition-shadow duration-200 hover:shadow-md ${cardSurface} ${
        canDrag ? 'cursor-grab active:cursor-grabbing' : ''
      }`}
      onDragStart={(event) => beginChatFileDrag(event, url, name, { disabled: isSending })}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/25 to-transparent opacity-80" />

      <div className="flex items-start gap-3">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconWrap}`}
        >
          <AttachmentFileIcon category={category} className="h-[22px] w-[22px]" />
        </div>

        <div className="min-w-0 flex-1 pt-0.5">
          <p
            className={`break-words text-[13px] font-semibold leading-snug ${
              isOwn ? 'text-white' : 'text-app-text'
            }`}
          >
            {name}
          </p>
          <p
            className={`mt-1 text-[11px] font-medium leading-snug ${
              downloadError
                ? isOwn
                  ? 'text-red-100'
                  : 'text-red-400'
                : isOwn
                  ? 'text-white/60'
                  : 'text-app-muted'
            }`}
          >
            {metaLine}
          </p>
        </div>

        <button
          type="button"
          aria-label={
            showSendProgress
              ? 'Uploading file'
              : showDownloadProgress
                ? 'Downloading file'
                : downloadError
                  ? 'Retry download'
                  : downloaded && !isSending
                    ? 'Download again'
                    : 'Download file'
          }
          disabled={isSending && !showSendProgress}
          className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-all duration-150 active:scale-95 ${actionButton} ${
            isSending && !showSendProgress ? 'cursor-default opacity-50' : ''
          }`}
          onClick={() => {
            void handleDownload();
          }}
        >
          {showSendProgress || showDownloadProgress ? (
            <SendingProgressRing
              progress={ringProgress}
              size={34}
              showLabel={typeof ringProgress === 'number'}
              className={isOwn ? 'text-white' : 'text-accent'}
            />
          ) : downloadError ? (
            <FiRefreshCw className="h-[18px] w-[18px]" strokeWidth={2} />
          ) : downloaded && !isSending ? (
            <FiCheck className="h-[18px] w-[18px]" strokeWidth={2.5} />
          ) : (
            <FiDownload className="h-[18px] w-[18px]" strokeWidth={2} />
          )}
        </button>
      </div>

      {showSendProgress || showDownloadProgress ? (
        <AttachmentProgressBar
          progressBarWidth={progressBarWidth}
          isOwn={isOwn}
          label={showSendProgress ? 'Uploading' : 'Downloading'}
        />
      ) : null}
    </div>
  );
}
