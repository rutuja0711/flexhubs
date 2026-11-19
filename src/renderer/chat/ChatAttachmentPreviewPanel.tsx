import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchMediaBlob } from '../mediaBlob';
import { RemoteImage } from '../RemoteImage';
import { RemoteVideo } from '../RemoteVideo';
import { AttachmentFileIcon } from './AttachmentFileIcon';
import {
  attachmentTypeLabel,
  categorizeAttachmentFile,
  readFileExtension,
  type AttachmentFileCategory,
} from './attachmentFileMeta';
import {
  canListArchiveContents,
  isCsvFile,
  officeDocumentCategory,
} from './attachmentPreviewCapabilities';
import { isTextPreviewFile } from './attachmentPreviewSupport';
import { useArchiveFileListing } from './useArchiveFileListing';
import { useAttachmentDisplayUrl } from './useAttachmentDisplayUrl';

const MAX_TEXT_PREVIEW_CHARS = 24_000;

function formatBytes(bytes: number): string {
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

type ChatAttachmentPreviewPanelProps = {
  name: string;
  category?: AttachmentFileCategory;
  /** Blob/object URL or remote URL for media/pdf/audio. */
  mediaUrl?: string | null;
  /** Local file for composer-stage text reads. */
  localFile?: File | null;
  mode?: 'composer' | 'inline' | 'modal';
  onMediaError?: () => void;
};

function useTextPreviewSource(
  localFile: File | null | undefined,
  mediaUrl: string | null | undefined,
  enabled: boolean,
) {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setText(null);
      setError(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        if (localFile) {
          const slice =
            localFile.size > MAX_TEXT_PREVIEW_CHARS * 2
              ? localFile.slice(0, MAX_TEXT_PREVIEW_CHARS * 2)
              : localFile;
          const raw = await slice.text();
          if (!cancelled) {
            setText(raw.slice(0, MAX_TEXT_PREVIEW_CHARS));
            setError(false);
          }
          return;
        }

        if (mediaUrl?.trim()) {
          const blob = await fetchMediaBlob(mediaUrl);
          const raw = await blob.slice(0, MAX_TEXT_PREVIEW_CHARS * 2).text();
          if (!cancelled) {
            setText(raw.slice(0, MAX_TEXT_PREVIEW_CHARS));
            setError(false);
          }
        }
      } catch {
        if (!cancelled) {
          setText(null);
          setError(true);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [enabled, localFile, mediaUrl]);

  return { text, error };
}

function parseCsvPreview(text: string, maxRows = 24): string[][] {
  const lines = text.split(/\r?\n/).filter((line) => line.length > 0).slice(0, maxRows);
  return lines.map((line) => {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (char === ',' && !inQuotes) {
        cells.push(current.trim());
        current = '';
        continue;
      }
      current += char;
    }

    cells.push(current.trim());
    return cells;
  });
}

function CsvPreviewTable({ text, mode }: { text: string; mode: 'composer' | 'inline' | 'modal' }) {
  const rows = useMemo(() => parseCsvPreview(text), [text]);
  const maxHeight =
    mode === 'modal' ? 'min(72vh,720px)' : mode === 'composer' ? 'min(52vh,520px)' : 'min(220px,40vh)';

  if (rows.length === 0) {
    return null;
  }

  return (
    <div
      className={`w-full max-w-3xl overflow-auto rounded-xl border border-app-border/60 bg-app-inset/80 ${
        mode === 'modal' ? 'border-white/15 bg-white/5' : ''
      }`}
      style={{ maxHeight }}
    >
      <table className="w-full min-w-[280px] border-collapse text-left text-xs text-app-text">
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className={rowIndex === 0 ? 'bg-app-card/80 font-semibold' : 'border-t border-app-border/40'}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="max-w-[200px] truncate px-3 py-2 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ArchiveContentsPreview({
  mediaUrl,
  mode,
}: {
  mediaUrl: string | null | undefined;
  mode: 'composer' | 'inline' | 'modal';
}) {
  const listing = useArchiveFileListing(mediaUrl, Boolean(mediaUrl));
  const maxHeight =
    mode === 'modal' ? 'min(60vh,560px)' : mode === 'inline' ? 'min(200px,36vh)' : 'min(45vh,480px)';

  if (listing.status === 'loading' || listing.status === 'idle') {
    return <PreviewLoading mode={mode} />;
  }

  if (listing.status === 'error') {
    return <p className="text-sm text-app-muted">Could not list archive contents. Download to open locally.</p>;
  }

  if (listing.status === 'ready') {
    return (
      <div
        className="w-full max-w-md overflow-auto rounded-xl border border-app-border/60 bg-app-inset/80 p-3"
        style={{ maxHeight }}
      >
        <p className="mb-2 text-xs font-semibold text-app-text">Files in archive</p>
        <ul className="space-y-1 text-xs text-app-muted">
          {listing.entries.map((entry) => (
            <li key={entry} className="truncate font-mono">
              {entry}
            </li>
          ))}
        </ul>
        {listing.truncated ? (
          <p className="mt-2 text-[11px] text-app-muted">Listing truncated. Download for the full archive.</p>
        ) : null}
      </div>
    );
  }

  return null;
}

function PreviewLoading({ mode }: { mode: 'composer' | 'inline' | 'modal' }) {
  return (
    <div
      className={`flex w-full items-center justify-center rounded-xl text-xs font-medium ${
        mode === 'modal' ? 'bg-white/5 text-white/60' : 'bg-app-inset text-app-muted'
      }`}
      style={{ minHeight: mode === 'inline' ? 120 : 200 }}
      aria-busy
      role="status"
    >
      Loading preview…
    </div>
  );
}

export function ChatAttachmentPreviewPanel({
  name,
  category: categoryProp,
  mediaUrl,
  localFile,
  mode = 'inline',
  onMediaError,
}: ChatAttachmentPreviewPanelProps) {
  const category = categoryProp ?? categorizeAttachmentFile(name);
  const extension = readFileExtension(name);
  const typeLabel = attachmentTypeLabel(category, extension);
  const isImage = category === 'image';
  const isVideo = category === 'video';
  const isPdf = category === 'pdf' || localFile?.type === 'application/pdf';
  const isAudio = category === 'audio';
  const isText = isTextPreviewFile(name, localFile?.type);
  const isCsv = isCsvFile(name);
  const isCodeText = isText && !isCsv && !['txt', 'md', 'markdown', 'log'].includes(extension);
  const isArchive = category === 'archive';
  const listableArchive = isArchive && canListArchiveContents(name);
  const isOfficeDoc = officeDocumentCategory(category);
  const textPreview = useTextPreviewSource(localFile, mediaUrl, isText && !listableArchive && !isOfficeDoc);

  const imagePreview = useAttachmentDisplayUrl(mediaUrl, localFile, 'image', isImage);
  const videoPreview = useAttachmentDisplayUrl(mediaUrl, localFile, 'video', isVideo);
  const audioPreview = useAttachmentDisplayUrl(mediaUrl, localFile, 'audio', isAudio);
  const pdfPreview = useAttachmentDisplayUrl(mediaUrl, localFile, 'pdf', isPdf);

  const maxHeight =
    mode === 'modal' ? '100%' : mode === 'composer' ? 'min(52vh,520px)' : 'min(220px,40vh)';

  const reportedErrorRef = useRef(false);

  useEffect(() => {
    reportedErrorRef.current = false;
  }, [mediaUrl, localFile, category]);

  useEffect(() => {
    if (reportedErrorRef.current) {
      return;
    }
    const composerPdfBlob =
      isPdf &&
      mode === 'composer' &&
      mediaUrl &&
      (mediaUrl.startsWith('blob:') || mediaUrl.startsWith('data:'));
    const kindFailed =
      (isImage && imagePreview.failed) ||
      (isVideo && videoPreview.failed) ||
      (isAudio && audioPreview.failed) ||
      (isPdf && pdfPreview.failed && !composerPdfBlob);
    if (kindFailed) {
      reportedErrorRef.current = true;
      onMediaError?.();
    }
  }, [
    audioPreview.failed,
    imagePreview.failed,
    isAudio,
    isImage,
    isPdf,
    isVideo,
    mediaUrl,
    mode,
    onMediaError,
    pdfPreview.failed,
    videoPreview.failed,
  ]);

  if (isImage && (mediaUrl || localFile)) {
    if (imagePreview.loading && !imagePreview.displayUrl) {
      return <PreviewLoading mode={mode} />;
    }

    if (imagePreview.displayUrl) {
      return (
        <img
          src={imagePreview.displayUrl}
          alt={name}
          className={mode === 'modal' ? 'h-full w-full object-contain' : 'max-w-full object-contain'}
          style={{ maxHeight }}
          draggable={false}
          onError={() => onMediaError?.()}
        />
      );
    }

    if (mediaUrl) {
      return (
        <RemoteImage
          src={mediaUrl}
          alt={name}
          loading="eager"
          wrapperClassName="flex w-full items-center justify-center"
          className="max-w-full object-contain"
          onError={() => onMediaError?.()}
        />
      );
    }
  }

  if (isVideo && (mediaUrl || localFile)) {
    if (videoPreview.loading && !videoPreview.displayUrl && !localFile) {
      return <PreviewLoading mode={mode} />;
    }

    if (videoPreview.failed && !localFile) {
      onMediaError?.();
    }

    const src = localFile ? mediaUrl : mediaUrl;

    return (
      <RemoteVideo
        src={src ?? null}
        controls
        playsInline
        preload="metadata"
        loading="eager"
        wrapperClassName="flex w-full items-center justify-center"
        className="w-full max-w-full rounded-xl bg-black/40"
      />
    );
  }

  if (isAudio && (mediaUrl || localFile)) {
    const src = audioPreview.displayUrl ?? (localFile ? mediaUrl : null);

    return (
      <div
        className="flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-app-border/60 bg-app-card/80 px-6 py-8"
        style={{ minHeight: mode === 'inline' ? 120 : 200 }}
      >
        <AttachmentFileIcon category="audio" className="h-12 w-12 text-accent" />
        {audioPreview.loading && !src ? (
          <p className="text-xs text-app-muted">Loading audio…</p>
        ) : src ? (
          <audio src={src} controls preload="metadata" className="w-full max-w-sm" onError={() => onMediaError?.()} />
        ) : (
          <p className="text-xs text-app-muted">Unable to load audio preview.</p>
        )}
        <p className="truncate text-sm font-medium text-app-text">{name}</p>
      </div>
    );
  }

  if (isPdf && (mediaUrl || localFile)) {
    const composerBlobSrc =
      mode === 'composer' && mediaUrl && (mediaUrl.startsWith('blob:') || mediaUrl.startsWith('data:'))
        ? mediaUrl
        : null;
    const src = composerBlobSrc ?? pdfPreview.displayUrl ?? (mediaUrl?.startsWith('blob:') ? mediaUrl : null);
    const modalLayout = mode === 'modal';

    return (
      <div
        className={`flex w-full flex-col items-stretch ${
          modalLayout ? 'h-full min-h-0 flex-1' : 'gap-2'
        }`}
        style={{ minHeight: modalLayout ? undefined : mode === 'inline' ? 140 : 240 }}
      >
        {pdfPreview.loading && !src && !composerBlobSrc ? (
          <p className={`text-sm ${modalLayout ? 'text-white/60' : 'text-app-muted'}`}>Loading PDF…</p>
        ) : null}
        {src ? (
          <iframe
            title={name}
            src={src}
            className={`w-full flex-1 ${
              modalLayout
                ? 'min-h-0 h-full border-0 bg-[#525659]'
                : 'max-w-3xl rounded-xl border border-app-border/60 bg-[#525659]'
            }`}
            style={{
              height: modalLayout ? '100%' : maxHeight,
              minHeight: modalLayout ? 0 : mode === 'inline' ? 180 : 280,
            }}
            onError={() => onMediaError?.()}
          />
        ) : pdfPreview.failed ? (
          <p className={`text-sm ${modalLayout ? 'text-white/60' : 'text-app-muted'}`}>
            Could not load PDF preview. Try downloading the file.
          </p>
        ) : null}
      </div>
    );
  }

  if (listableArchive && mediaUrl) {
    return <ArchiveContentsPreview mediaUrl={mediaUrl} mode={mode} />;
  }

  if (isArchive && !listableArchive) {
    return (
      <div
        className={`flex max-w-md flex-col items-center gap-2 rounded-2xl border px-6 py-6 text-center ${
          mode === 'modal' ? 'border-white/15 text-white' : 'border-app-border/70 text-app-text'
        }`}
      >
        <AttachmentFileIcon category="archive" className="h-10 w-10 text-accent" />
        <p className="text-sm font-medium">Archive preview</p>
        <p className="text-xs text-app-muted">
          This archive format cannot be browsed in FlexHubs. Download to extract safely on your device.
        </p>
      </div>
    );
  }

  if (isOfficeDoc) {
    const modal = mode === 'modal';

    return (
      <div
        className={`flex max-w-md flex-col items-center gap-3 rounded-2xl border px-6 py-8 text-center ${
          modal
            ? 'border-white/12 bg-[#1a1b25] text-white shadow-xl'
            : 'border-app-border/70 bg-app-elevated text-app-text'
        }`}
      >
        <AttachmentFileIcon category={category} className={`text-accent ${modal ? 'h-12 w-12' : 'h-10 w-10'}`} />
        <p className={`text-sm font-semibold ${modal ? 'text-white' : 'text-app-text'}`}>{typeLabel}</p>
        <p className={`break-all text-sm font-medium ${modal ? 'text-white/90' : 'text-app-text'}`}>{name}</p>
        <p className={`max-w-sm text-xs leading-relaxed ${modal ? 'text-white/65' : 'text-app-muted'}`}>
          In-app layout preview isn’t available for {typeLabel.toLowerCase()} files. Use <strong>Download</strong> above
          to open in Microsoft Office, Google Workspace, or another app on your device.
        </p>
      </div>
    );
  }

  if (isCsv && textPreview.text) {
    return <CsvPreviewTable text={textPreview.text} mode={mode} />;
  }

  if (isText && textPreview.text) {
    return (
      <pre
        className={`w-full max-w-3xl overflow-auto rounded-xl border border-app-border/60 bg-app-inset/80 p-4 text-left text-xs leading-relaxed text-app-text ${
          isCodeText ? 'font-mono' : ''
        }`}
        style={{ maxHeight }}
      >
        {textPreview.text}
      </pre>
    );
  }

  const fallbackSurface =
    mode === 'modal'
      ? 'border-white/15 bg-white/5 text-white'
      : 'border-app-border/70 bg-app-card/90 text-app-text';

  return (
    <div
      className={`flex max-w-md flex-col items-center gap-3 rounded-2xl border px-8 py-8 text-center shadow-lg ${fallbackSurface}`}
      role="status"
    >
      <div
        className={`flex h-20 w-20 items-center justify-center rounded-2xl ${
          mode === 'modal' ? 'bg-white/10 text-white' : 'bg-app-inset text-accent'
        }`}
      >
        <AttachmentFileIcon category={category} className="h-10 w-10" />
      </div>
      <p className={`text-sm font-semibold ${mode === 'modal' ? 'text-white' : 'text-app-text'}`}>
        {typeLabel} preview
      </p>
      <p className={`break-all text-sm font-medium ${mode === 'modal' ? 'text-white/90' : 'text-app-text'}`}>
        {name}
      </p>
      {localFile ? (
        <p className={`text-xs ${mode === 'modal' ? 'text-white/55' : 'text-app-muted'}`}>
          {formatBytes(localFile.size)}
        </p>
      ) : null}
      {textPreview.error ? (
        <p className={`text-xs ${mode === 'modal' ? 'text-white/55' : 'text-app-muted'}`}>
          Could not load text preview. You can still download the file.
        </p>
      ) : (
        <p className={`text-xs ${mode === 'modal' ? 'text-white/55' : 'text-app-muted'}`}>
          Use Preview to inspect, then download if you need a local copy.
        </p>
      )}
    </div>
  );
}