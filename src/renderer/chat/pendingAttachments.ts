import {
  attachmentTypeLabel,
  categorizeAttachmentFile,
  readFileExtension,
  type AttachmentFileCategory,
} from './attachmentFileMeta';
import { isTextPreviewFile, shouldAttachObjectUrlForPreview } from './attachmentPreviewSupport';

export type PendingAttachment = {
  id: string;
  file: File;
  previewUrl: string;
  category: AttachmentFileCategory;
  isImage: boolean;
  isVideo: boolean;
  isPdf: boolean;
  isAudio: boolean;
  isText: boolean;
};

function createAttachmentId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function buildPendingAttachment(file: File): PendingAttachment {
  const mimeType = file.type || 'application/octet-stream';
  const category = categorizeAttachmentFile(file.name);
  const isImage = mimeType.startsWith('image/') || category === 'image';
  const isVideo = mimeType.startsWith('video/') || category === 'video';
  const isPdf = category === 'pdf' || mimeType === 'application/pdf';
  const isAudio = mimeType.startsWith('audio/') || category === 'audio';
  const isText = isTextPreviewFile(file.name, mimeType);
  const needsObjectUrl = shouldAttachObjectUrlForPreview(file, category);
  const previewUrl = needsObjectUrl ? URL.createObjectURL(file) : '';

  return {
    id: createAttachmentId(),
    file,
    previewUrl,
    category,
    isImage,
    isVideo,
    isPdf,
    isAudio,
    isText,
  };
}

export function revokePendingAttachment(attachment: PendingAttachment): void {
  if (attachment.previewUrl.startsWith('blob:')) {
    URL.revokeObjectURL(attachment.previewUrl);
  }
}

export function revokePendingAttachments(attachments: PendingAttachment[]): void {
  attachments.forEach(revokePendingAttachment);
}

export function pendingAttachmentTypeLabel(attachment: PendingAttachment): string {
  const extension = readFileExtension(attachment.file.name);
  return attachmentTypeLabel(attachment.category, extension);
}
