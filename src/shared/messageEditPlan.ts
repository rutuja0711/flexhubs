import type { MessageItem, MessageMedia } from './messages';
import { isStickerMessage, isVoiceOnlyMessage } from './messages';

export type MessageEditMediaChange =
  | { kind: 'unchanged' }
  | { kind: 'cleared' }
  | {
      kind: 'replaced';
      fileUrl: string;
      fileName: string;
      mimeType: string;
      messageType: string;
      fileSize?: number;
    };

/** PATCH `/conversations/:id/messages/:messageId` body (web-aligned). */
export type EditMessageRequestBody = {
  content: string;
  mentionUserIds?: string[];
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  removeMedia?: boolean;
};

const EDITABLE_MEDIA_KINDS = new Set(['image', 'file', 'video', 'gif']);

export function isEditableAttachmentMedia(item: MessageMedia): boolean {
  return EDITABLE_MEDIA_KINDS.has(item.kind);
}

export function filterEditableMessageMedia(message: MessageItem): MessageMedia[] {
  if (isStickerMessage(message) || isVoiceOnlyMessage(message)) {
    return [];
  }

  const messageType = String(message.messageType ?? '').toUpperCase();

  if (messageType === 'STICKER' || messageType === 'VOICE') {
    return [];
  }

  if (messageType === 'GIF') {
    return message.media.length > 0 ? message.media : [];
  }

  return message.media.filter(isEditableAttachmentMedia);
}

export function buildEditMessageRequestBody(
  content: string,
  mediaUpdate: MessageEditMediaChange | null,
): EditMessageRequestBody {
  const trimmed = content;

  if (!mediaUpdate || mediaUpdate.kind === 'unchanged') {
    return { content: trimmed };
  }

  if (mediaUpdate.kind === 'cleared') {
    return { content: trimmed, removeMedia: true };
  }

  const body: EditMessageRequestBody = {
    content: trimmed,
    fileUrl: mediaUpdate.fileUrl,
    fileName: mediaUpdate.fileName,
    mimeType: mediaUpdate.mimeType,
  };

  if (typeof mediaUpdate.fileSize === 'number' && mediaUpdate.fileSize >= 0) {
    body.fileSize = mediaUpdate.fileSize;
  }

  return body;
}

export function resolveMessageEditMediaChange(
  original: MessageItem,
  keptMedia: MessageMedia[],
  addedFile: File | null,
  uploaded?: { url: string; fileName: string; mimeType: string } | null,
): MessageEditMediaChange {
  const originalEditable = filterEditableMessageMedia(original);
  const keptUrls = new Set(keptMedia.map((item) => item.url));

  const removedAny = originalEditable.some((item) => !keptUrls.has(item.url));
  const hasAdded = Boolean(addedFile && uploaded?.url);

  if (!removedAny && !hasAdded) {
    return { kind: 'unchanged' };
  }

  if (keptMedia.length === 0 && !hasAdded) {
    return { kind: 'cleared' };
  }

  if (hasAdded && uploaded) {
    const mimeType = uploaded.mimeType || addedFile?.type || 'application/octet-stream';
    const isImage = mimeType.startsWith('image/');
    const isVideo = mimeType.startsWith('video/');

    const isGif = mimeType === 'image/gif' || original.messageType?.toUpperCase() === 'GIF';
    const messageType = isGif ? 'GIF' : isImage ? 'IMAGE' : isVideo ? 'FILE' : 'FILE';

    return {
      kind: 'replaced',
      fileUrl: uploaded.url,
      fileName: uploaded.fileName || addedFile?.name || 'file',
      mimeType,
      messageType,
      fileSize: addedFile.size,
    };
  }

  if (removedAny && keptMedia.length > 0 && !hasAdded) {
    const primary = keptMedia[0];
    const mimeType =
      primary.kind === 'image'
        ? 'image/jpeg'
        : primary.kind === 'video'
          ? 'video/mp4'
          : 'application/octet-stream';

    const isGif =
      primary.kind === 'gif' || original.messageType?.toUpperCase() === 'GIF' || mimeType === 'image/gif';

    return {
      kind: 'replaced',
      fileUrl: primary.url,
      fileName: primary.name ?? 'file',
      mimeType: isGif ? 'image/gif' : mimeType,
      messageType: isGif ? 'GIF' : primary.kind === 'image' ? 'IMAGE' : 'FILE',
    };
  }

  return { kind: 'cleared' };
}

export function messageEditHasChanges(
  original: MessageItem,
  nextContent: string,
  keptMedia: MessageMedia[],
  addedFile: File | null,
): boolean {
  const trimmed = nextContent.trim();
  const contentChanged = trimmed !== original.content.trim();
  const originalEditable = filterEditableMessageMedia(original);
  const keptUrls = new Set(keptMedia.map((item) => item.url));
  const mediaChanged =
    Boolean(addedFile) ||
    originalEditable.length !== keptMedia.length ||
    originalEditable.some((item) => !keptUrls.has(item.url));

  return contentChanged || mediaChanged;
}