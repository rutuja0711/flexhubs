import type { MessageItem } from '../../shared/messages';
import {
  isDeletedMessage,
  isMediaOnlyMessage,
  isPollMessage,
  isVoiceOnlyMessage,
} from '../../shared/messages';
import { canEditMessage } from '../../shared/messageComposer';
import type { ReactNode } from 'react';

export type MessageContextMenuItem = {
  id: string;
  label: string;
  tone?: 'default' | 'danger';
  icon?: ReactNode;
  disabled?: boolean;
  onSelect: () => void;
};

export type BuildMessageContextMenuOptions = {
  message: MessageItem;
  currentUserId: string | null;
  isPinned: boolean;
  isSaved: boolean;
  threadsEnabled: boolean;
  selectedText?: string | null;
  onAddReaction: () => void;
  onReply: () => void;
  onReplyInThread: () => void;
  onCopyText: (text: string) => void;
  onForward: () => void;
  onPinToggle: () => void;
  onSave: () => void;
  onUnsave: () => void;
  onEdit: () => void;
  onDeleteForMe: () => void;
  onDeleteForEveryone: () => void;
  onOpenMedia?: () => void;
  onDownloadMedia?: () => void;
  onCopyMediaLink?: () => void;
  onCopyImage?: () => void;
};

function primaryMedia(message: MessageItem) {
  return message.media?.[0] ?? null;
}

export function buildMessageContextMenuItems(
  options: BuildMessageContextMenuOptions,
): MessageContextMenuItem[] {
  const {
    message,
    currentUserId,
    isPinned,
    isSaved,
    threadsEnabled,
    selectedText,
    onAddReaction,
    onReply,
    onReplyInThread,
    onCopyText,
    onForward,
    onPinToggle,
    onSave,
    onUnsave,
    onEdit,
    onDeleteForMe,
    onDeleteForEveryone,
    onOpenMedia,
    onDownloadMedia,
    onCopyMediaLink,
    onCopyImage,
  } = options;

  const deleted = isDeletedMessage(message);
  const sending = message.status === 'sending';
  const media = primaryMedia(message);
  const hasMedia = Boolean(media);
  const isMediaPrimary =
    !isPollMessage(message) && (isMediaOnlyMessage(message) || isVoiceOnlyMessage(message) || hasMedia);
  const copyText = (selectedText?.trim() || message.content).trim();
  const items: MessageContextMenuItem[] = [];

  const push = (item: MessageContextMenuItem) => {
    items.push(item);
  };

  if (selectedText?.trim()) {
    push({
      id: 'copy-selection',
      label: 'Copy',
      onSelect: () => onCopyText(selectedText.trim()),
    });
    return items;
  }

  if (deleted) {
    push({ id: 'delete-me', label: 'Delete for me', tone: 'danger', onSelect: onDeleteForMe });
    return items;
  }

  if (!sending) {
    push({ id: 'reaction', label: 'Add reaction', onSelect: onAddReaction });
    push({ id: 'reply', label: 'Reply', onSelect: onReply });

    if (threadsEnabled) {
      push({ id: 'reply-thread', label: 'Reply in thread', onSelect: onReplyInThread });
    }
  }

  if (isMediaPrimary && media) {
    const kind = media.kind;

    if (onOpenMedia && (kind === 'image' || kind === 'video' || kind === 'sticker')) {
      push({ id: 'open', label: kind === 'video' ? 'Open video' : 'Open image', onSelect: onOpenMedia });
    }

    if (onDownloadMedia) {
      push({
        id: 'download',
        label: kind === 'file' ? 'Download file' : 'Download',
        onSelect: onDownloadMedia,
      });
    }

    if (onCopyMediaLink && media.url) {
      push({ id: 'copy-link', label: 'Copy link', onSelect: onCopyMediaLink });
    }

    if (
      onCopyImage &&
      media.url &&
      (kind === 'image' || kind === 'sticker' || kind === 'gif')
    ) {
      push({ id: 'copy-image', label: 'Copy image', onSelect: onCopyImage });
    }
  }

  if (copyText && !isMediaPrimary) {
    push({ id: 'copy-text', label: 'Copy text', onSelect: () => onCopyText(copyText) });
  }

  if (!sending) {
    push({ id: 'forward', label: 'Forward', onSelect: onForward });
    push({ id: 'pin', label: isPinned ? 'Unpin' : 'Pin', onSelect: onPinToggle });
    push({
      id: 'save',
      label: isSaved ? 'Unsave' : 'Save',
      onSelect: isSaved ? onUnsave : onSave,
    });
  }

  if (message.isOwn && canEditMessage(message, currentUserId)) {
    push({ id: 'edit', label: 'Edit message', onSelect: onEdit });
  }

  push({ id: 'delete-me', label: 'Delete for me', tone: 'danger', onSelect: onDeleteForMe });

  if (message.isOwn && !sending) {
    push({
      id: 'delete-everyone',
      label: 'Delete for everyone',
      tone: 'danger',
      onSelect: onDeleteForEveryone,
    });
  }

  return items;
}