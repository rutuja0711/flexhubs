import type { ReactNode } from 'react';
import { FiFile, FiImage, FiPlus, FiVideo, FiX } from 'react-icons/fi';
import type { MessageMedia } from '../../shared/messages';
import { RemoteImage } from '../RemoteImage';
import type { PendingAttachment } from './pendingAttachments';
import { pendingAttachmentTypeLabel } from './pendingAttachments';

type MessageEditAttachmentsProps = {
  existing: MessageMedia[];
  pending: PendingAttachment[];
  disabled?: boolean;
  onRemoveExisting: (index: number) => void;
  onRemovePending: (index: number) => void;
  onAddFiles: () => void;
};

function existingIcon(item: MessageMedia) {
  if (item.kind === 'video') {
    return <FiVideo className="h-4 w-4" />;
  }

  if (item.kind === 'image') {
    return <FiImage className="h-4 w-4" />;
  }

  return <FiFile className="h-4 w-4" />;
}

export function MessageEditAttachments({
  existing,
  pending,
  disabled = false,
  onRemoveExisting,
  onRemovePending,
  onAddFiles,
}: MessageEditAttachmentsProps) {
  const addChipButton = (
    <button
      type="button"
      className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-xl border border-dashed border-accent/40 bg-accent/5 text-accent-soft transition-colors hover:border-accent/70 hover:bg-accent/10 disabled:opacity-50"
      onClick={onAddFiles}
      disabled={disabled}
      aria-label="Add attachment"
      title="Add attachment"
    >
      <FiPlus className="h-5 w-5" />
    </button>
  );

  if (existing.length === 0 && pending.length === 0) {
    return (
      <div className="border-x border-app-border bg-app-surface/95 px-4 py-2 backdrop-blur-md">
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-app-muted">Attachments</p>
        <AttachmentEditRow>{addChipButton}</AttachmentEditRow>
      </div>
    );
  }

  return (
    <div className="border-x border-app-border bg-app-surface/95 px-4 py-2 backdrop-blur-md">
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-app-muted">Attachments</p>
      <AttachmentEditRow>
        {existing.map((item, index) => (
          <div
            key={`existing-${item.url}-${index}`}
            className="flex min-w-0 max-w-full items-center gap-2 rounded-xl border border-app-border bg-app-elevated/60 px-2 py-1.5"
          >
            <AttachmentThumb>
              {item.kind === 'image' || item.kind === 'video' ? (
                <RemoteImage
                  src={item.previewUrl ?? item.url}
                  alt={item.name ?? 'Attachment'}
                  className="h-10 w-10 rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-app-surface text-app-muted">
                  {existingIcon(item)}
                </div>
              )}
            </AttachmentThumb>
            <AttachmentMeta>
              <p className="truncate text-xs font-medium text-app-text">{item.name ?? 'Attachment'}</p>
              <p className="text-[10px] text-app-muted">{item.kind}</p>
            </AttachmentMeta>
            <button
              type="button"
              className="shrink-0 rounded-lg p-1 text-app-muted hover:bg-app-chat-hover hover:text-app-text disabled:opacity-50"
              onClick={() => onRemoveExisting(index)}
              disabled={disabled}
              aria-label="Remove attachment"
            >
              <FiX className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {pending.map((item, index) => (
          <div
            key={item.id}
            className="flex min-w-0 max-w-full items-center gap-2 rounded-xl border border-dashed border-accent/35 bg-accent/5 px-2 py-1.5"
          >
            <AttachmentThumb>
              {item.previewUrl ? (
                <img src={item.previewUrl} alt="" className="h-10 w-10 rounded-lg object-cover" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-app-surface text-app-muted">
                  <FiFile className="h-4 w-4" />
                </div>
              )}
            </AttachmentThumb>
            <AttachmentMeta>
              <p className="truncate text-xs font-medium text-app-text">{item.file.name}</p>
              <p className="text-[10px] text-app-muted">
                New · {pendingAttachmentTypeLabel(item)}
              </p>
            </AttachmentMeta>
            <button
              type="button"
              className="shrink-0 rounded-lg p-1 text-app-muted hover:bg-app-chat-hover hover:text-app-text disabled:opacity-50"
              onClick={() => onRemovePending(index)}
              disabled={disabled}
              aria-label="Remove new attachment"
            >
              <FiX className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {addChipButton}
      </AttachmentEditRow>
    </div>
  );
}

function AttachmentEditRow(props: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-2">{props.children}</div>;
}

function AttachmentThumb(props: { children: ReactNode }) {
  return <div className="shrink-0">{props.children}</div>;
}

function AttachmentMeta(props: { children: ReactNode }) {
  return <div className="min-w-0 flex-1">{props.children}</div>;
}