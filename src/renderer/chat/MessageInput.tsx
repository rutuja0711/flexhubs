import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiBarChart2, FiClock, FiImage, FiLink, FiMic, FiPaperclip, FiPlus, FiSend, FiSmile, FiZap } from 'react-icons/fi';
import type { GifPickerItem } from '../../shared/gifs';
import type { MessageItem } from '../../shared/messages';
import { buildScheduleMessageBody, validateMessageDraft } from '../../shared/messages';
import {
  enhanceMessageText,
  generateMessageText,
  parseFlexCommand,
  transcribeAudioFile,
} from '../extrasApi';
import {
  createPoll,
  loadMentionSuggestions,
  loadOrganizationMembers,
  loadUserSearch,
  scheduleConversationMessage,
} from '../chatApi';
import { useToast } from '../ui/Toast';
import { MessageReplyPreview } from './MessageContent';
import { MediaPicker, type MediaPickerTab } from './MediaPicker';
import { ScheduleMessageModal } from './ScheduleMessageModal';

type MessageInputProps = {
  value: string;
  disabled: boolean;
  isSending: boolean;
  error: string;
  conversationId?: string;
  replyingToMessage?: MessageItem | null;
  onCancelReply?: () => void;
  onChange: (value: string) => void;
  onSend: () => void;
  onSendMedia?: (item: GifPickerItem, kind: 'gif' | 'sticker') => void;
  onSendFile?: (file: File, caption?: string) => void;
  onPollCreated?: () => void;
  onScheduled?: () => void;
  onUnauthorized?: (status?: number) => boolean;
  onOpenFlexAi?: () => void;
  compact?: boolean;
  currentUserId?: string | null;
};

type MentionSuggestion = {
  id: string;
  username: string;
  name: string;
};

function readMentionSuggestion(record: unknown): MentionSuggestion | null {
  if (typeof record === 'string') {
    const username = record.trim().replace(/^@/, '');
    if (!username) return null;
    return { id: username, username, name: username };
  }

  if (!record || typeof record !== 'object') {
    return null;
  }

  const item = record as Record<string, unknown>;
  const user = item.user && typeof item.user === 'object' ? (item.user as Record<string, unknown>) : item;
  const id = typeof user.id === 'string' ? user.id : typeof item.id === 'string' ? item.id : '';
  const username =
    typeof user.username === 'string'
      ? user.username
      : typeof item.username === 'string'
        ? item.username
        : '';
  const name =
    typeof user.name === 'string'
      ? user.name
      : typeof item.name === 'string'
        ? item.name
        : typeof user.displayName === 'string'
          ? user.displayName
          : username;

  if (!username) {
    return null;
  }

  return { id: id || username, username, name };
}

function parseMentionSuggestions(payload: unknown[]): MentionSuggestion[] {
  return payload
    .map(readMentionSuggestion)
    .filter((item): item is MentionSuggestion => item !== null);
}

const MENTION_REPLACE_PATTERN = /(^|[\s([{])@([a-zA-Z0-9._-]*)$/;

function detectMentionQuery(text: string, cursor: number): string | null {
  const before = text.slice(0, cursor);
  const match = before.match(MENTION_REPLACE_PATTERN);
  return match ? match[2] : null;
}

function detectMentionAnchor(text: string, cursor: number): number | null {
  const before = text.slice(0, cursor);
  const match = before.match(MENTION_REPLACE_PATTERN);
  return match ? cursor - match[0].length : null;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;

      if (typeof result !== 'string') {
        reject(new Error('Unable to read file.'));
        return;
      }

      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = () => reject(new Error('Unable to read file.'));
    reader.readAsDataURL(file);
  });
}

export function MessageInput({
  value,
  disabled,
  isSending,
  error,
  conversationId,
  replyingToMessage,
  onCancelReply,
  onChange,
  onSend,
  onSendMedia,
  onSendFile,
  onPollCreated,
  onScheduled,
  onUnauthorized,
  onOpenFlexAi,
  compact = false,
  currentUserId = null,
}: MessageInputProps) {
  const toast = useToast();
  const [draftError, setDraftError] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTab, setPickerTab] = useState<MediaPickerTab>('emoji');
  const [aiMenuOpen, setAiMenuOpen] = useState(false);
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleBusy, setScheduleBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionSuggestions, setMentionSuggestions] = useState<MentionSuggestion[]>([]);
  const [mentionLoading, setMentionLoading] = useState(false);
  const [mentionHighlightIndex, setMentionHighlightIndex] = useState(0);
  const [mentionMenuStyle, setMentionMenuStyle] = useState<{
    left: number;
    top: number;
    width: number;
  } | null>(null);
  const mentionAnchorRef = useRef<number | null>(null);
  const [pollOpen, setPollOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [pollBusy, setPollBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [pendingAttachments, setPendingAttachments] = useState<{
    file: File;
    previewUrl: string;
    isImage: boolean;
    isVideo: boolean;
  }[]>([]);

  const removeAttachment = (indexToRemove: number) => {
    setPendingAttachments((current) => {
      const next = [...current];
      const removed = next.splice(indexToRemove, 1)[0];
      if (removed?.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(removed.previewUrl);
      }
      return next;
    });
  };

  const clearPendingAttachments = () => {
    setPendingAttachments((current) => {
      current.forEach(att => {
        if (att.previewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(att.previewUrl);
        }
      });
      return [];
    });
  };

  useEffect(() => {
    return () => {
      pendingAttachments.forEach(att => {
        if (att.previewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(att.previewUrl);
        }
      });
    };
  }, []);

  useEffect(() => {
    clearPendingAttachments();
  }, [conversationId]);

  const handleChange = (nextValue: string) => {
    const validation = validateMessageDraft(nextValue);

    if (!validation.ok) {
      setDraftError(validation.error);
      return;
    }

    setDraftError('');
    onChange(nextValue);
  };

  useEffect(() => {
    if (!conversationId || mentionQuery === null) {
      setMentionSuggestions([]);
      setMentionLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setMentionLoading(true);
      let suggestions: MentionSuggestion[] = [];

      const result = await loadMentionSuggestions(conversationId, mentionQuery);
      if (!cancelled && result.ok) {
        suggestions = parseMentionSuggestions(result.data);
      }

      if (!cancelled && suggestions.length === 0) {
        if (mentionQuery.trim().length >= 1) {
          const searchResult = await loadUserSearch(mentionQuery.trim());
          if (searchResult.ok) {
            suggestions = searchResult.data.map((person) => ({
              id: person.id,
              username: person.username,
              name: person.name || person.username,
            }));
          }
        } else {
          const membersResult = await loadOrganizationMembers();
          if (membersResult.ok) {
            suggestions = membersResult.data.map((member) => ({
              id: member.id,
              username: member.username,
              name: member.name || member.username,
            }));
          }
        }
      }

      if (cancelled) return;

      setMentionSuggestions(suggestions.slice(0, 8));
      setMentionLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [conversationId, mentionQuery]);

  useEffect(() => {
    setMentionHighlightIndex(0);
  }, [mentionQuery, mentionSuggestions]);

  useLayoutEffect(() => {
    if (mentionQuery === null || !textareaRef.current) {
      setMentionMenuStyle(null);
      return;
    }

    const rect = textareaRef.current.getBoundingClientRect();
    setMentionMenuStyle({
      left: rect.left,
      top: Math.max(8, rect.top - 8),
      width: Math.max(rect.width, 240),
    });
  }, [mentionQuery, mentionSuggestions.length, value]);

  const insertAtCursor = (text: string) => {
    const textarea = textareaRef.current;
    const cursor = textarea?.selectionStart ?? value.length;
    const before = value.slice(0, cursor);
    const after = value.slice(cursor);
    const nextValue = `${before}${text}${after}`;
    const nextCursor = cursor + text.length;

    handleChange(nextValue);

    requestAnimationFrame(() => {
      if (!textarea) {
        return;
      }

      textarea.focus();
      textarea.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const insertMention = (username: string) => {
    const textarea = textareaRef.current;
    const cursor = textarea?.selectionStart ?? value.length;
    const anchor = mentionAnchorRef.current ?? detectMentionAnchor(value, cursor);
    const after = value.slice(cursor);
    let nextValue: string;
    let nextCursor: number;

    if (anchor !== null) {
      nextValue = `${value.slice(0, anchor)}@${username}${after ? ` ${after}` : ' '}`;
      nextCursor = anchor + username.length + 2;
    } else {
      const before = value.slice(0, cursor);
      const nextBefore = before.replace(MENTION_REPLACE_PATTERN, (_match, prefix) => {
        return `${prefix}@${username}`;
      });
      nextValue = after ? `${nextBefore} ${after}` : `${nextBefore} `;
      nextCursor = nextValue.length;
    }

    handleChange(nextValue);
    setMentionQuery(null);
    mentionAnchorRef.current = null;

    requestAnimationFrame(() => {
      if (!textarea) {
        return;
      }

      textarea.focus();
      textarea.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const handleCreatePoll = async () => {
    if (!conversationId) {
      toast.error('Open a conversation to create a poll.');
      return;
    }

    const question = pollQuestion.trim();
    const options = pollOptions.map((option) => option.trim()).filter(Boolean);

    if (!question) {
      toast.error('Enter a poll question.');
      return;
    }

    if (options.length < 2) {
      toast.error('Add at least two options.');
      return;
    }

    setPollBusy(true);
    const result = await createPoll(conversationId, {
      question,
      options,
      allowMultiple: false,
      anonymous: false,
    });
    setPollBusy(false);

    if (!result.ok) {
      if (onUnauthorized?.(result.status)) {
        return;
      }
      toast.error(result.error);
      return;
    }

    toast.success('Poll created.');
    setPollOpen(false);
    setPollQuestion('');
    setPollOptions(['', '']);
    onPollCreated?.();
  };

  const handleScheduleMessage = async (content: string, scheduledAt: string) => {
    if (!conversationId) {
      toast.error('Open a conversation to schedule a message.');
      return;
    }

    setScheduleBusy(true);
    const result = await scheduleConversationMessage(
      conversationId,
      buildScheduleMessageBody({
        content,
        scheduledAt,
        replyToId: replyingToMessage?.id ?? null,
      }),
    );
    setScheduleBusy(false);

    if (!result.ok) {
      if (onUnauthorized?.(result.status)) {
        return;
      }
      toast.error(result.error);
      return;
    }

    toast.success('Message scheduled.');
    setScheduleOpen(false);
    setActionsMenuOpen(false);
    handleChange('');
    onScheduled?.();
  };

  const updateMentionState = (nextValue: string, cursor: number) => {
    const query = detectMentionQuery(nextValue, cursor);
    mentionAnchorRef.current = query === null ? null : detectMentionAnchor(nextValue, cursor);
    setMentionQuery(query);
  };

  const displayError = draftError || error;
  const mediaDisabled = disabled || isSending || !onSendMedia;
  const fileDisabled = disabled || isSending || !onSendFile;
  const aiDisabled = disabled || isSending || aiBusy;

  const openPicker = (tab: MediaPickerTab = 'emoji') => {
    if (mediaDisabled && tab !== 'emoji') {
      return;
    }

    if (disabled || isSending || aiBusy) {
      return;
    }

    setPickerTab(tab);
    setPickerOpen(true);
  };

  const handleMediaSelect = (item: GifPickerItem, kind: 'gif' | 'sticker') => {
    setPickerOpen(false);
    onSendMedia?.(item, kind);
  };

  const handleEmojiSelect = (emoji: string) => {
    insertAtCursor(emoji);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const handleAiEnhance = async () => {
    setAiMenuOpen(false);

    if (!value.trim()) {
      toast.error('Type a message first to enhance it.');
      return;
    }

    setAiBusy(true);
    const result = await enhanceMessageText(value.trim());
    setAiBusy(false);

    if (!result.ok) {
      if (onUnauthorized?.(result.status)) {
        return;
      }
      toast.error(result.error);
      return;
    }

    if (!result.data.text.trim()) {
      toast.error('AI did not return any text.');
      return;
    }

    handleChange(result.data.text);
    toast.success('Message enhanced.');
  };

  const handleAiGenerate = async () => {
    setAiMenuOpen(false);
    const description = window.prompt('Describe the message you want to generate:');

    if (!description?.trim()) {
      return;
    }

    setAiBusy(true);
    const result = await generateMessageText(description.trim());
    setAiBusy(false);

    if (!result.ok) {
      if (onUnauthorized?.(result.status)) {
        return;
      }
      toast.error(result.error);
      return;
    }

    if (!result.data.text.trim()) {
      toast.error('AI did not return any text.');
      return;
    }

    handleChange(result.data.text);
    toast.success('Message generated.');
  };

  const handleFlexCommand = async () => {
    setAiMenuOpen(false);
    const input = window.prompt('Enter a Flex command (e.g. schedule meeting tomorrow 3pm):');

    if (!input?.trim()) {
      return;
    }

    setAiBusy(true);
    const result = await parseFlexCommand(input.trim());
    setAiBusy(false);

    if (!result.ok) {
      if (onUnauthorized?.(result.status)) {
        return;
      }
      toast.error(result.error);
      return;
    }

    if (!result.data.text.trim()) {
      toast.error('Flex command did not return any text.');
      return;
    }

    handleChange(result.data.text);
    toast.success('Flex command applied.');
  };

  const handleTranscribeFile = async (file: File) => {
    setAiBusy(true);

    try {
      const base64 = await readFileAsBase64(file);
      const result = await transcribeAudioFile(
        file.name,
        file.type || 'audio/webm',
        base64,
      );
      setAiBusy(false);

      if (!result.ok) {
        if (onUnauthorized?.(result.status)) {
          return;
        }
        toast.error(result.error);
        return;
      }

      if (!result.data.text.trim()) {
        toast.error('No transcription returned.');
        return;
      }

      handleChange(result.data.text);
      toast.success('Audio transcribed.');
    } catch {
      setAiBusy(false);
      toast.error('Unable to read audio file.');
    }
  };

  const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';

    if (!files.length || fileDisabled) {
      return;
    }

    const newAttachments = files.map((file) => {
      const mimeType = file.type || 'application/octet-stream';
      const isImage = mimeType.startsWith('image/');
      const isVideo = mimeType.startsWith('video/');
      const previewUrl = isImage || isVideo ? URL.createObjectURL(file) : '';
      return { file, previewUrl, isImage, isVideo };
    });

    setPendingAttachments((current) => [...current, ...newAttachments]);

    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const handleSendAction = () => {
    if (pendingAttachments.length > 0) {
      pendingAttachments.forEach((attachment, index) => {
        onSendFile?.(attachment.file, index === 0 ? (value.trim() || undefined) : undefined);
      });
      clearPendingAttachments();
      handleChange('');
      return;
    }

    onSend();
  };

  const handleAudioSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file || aiDisabled) {
      return;
    }

    void handleTranscribeFile(file);
  };

  const iconButtonClass = compact
    ? 'flex h-7 w-7 items-center justify-center rounded-lg text-app-muted transition-colors hover:bg-app-chat-hover hover:text-app-text disabled:cursor-not-allowed disabled:opacity-50'
    : 'flex h-8 w-8 items-center justify-center rounded-lg text-app-muted transition-colors hover:bg-app-chat-hover hover:text-app-text disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <div className={compact ? '' : 'border-t border-app-border px-4 py-4'}>
      {displayError ? (
        <p className="mb-2 text-xs text-accent-soft" role="alert">
          {displayError}
        </p>
      ) : null}

      {pendingAttachments.length > 0 ? (
        <div className="mb-2 flex flex-wrap items-start gap-3">
          {pendingAttachments.map((attachment, index) => (
            <div key={index} className="flex items-start gap-3 rounded-xl border border-app-border bg-app-surface-input px-3 py-2 w-full sm:w-auto min-w-[200px]">
              {attachment.isImage ? (
                <img
                  src={attachment.previewUrl}
                  alt={attachment.file.name}
                  className="h-20 w-20 shrink-0 rounded-lg border border-app-border object-cover"
                />
              ) : attachment.isVideo ? (
                <video src={attachment.previewUrl} className="h-20 w-20 shrink-0 rounded-lg border border-app-border object-cover bg-app-chat-hover" />
              ) : (
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border border-app-border bg-app-surface text-xs text-app-muted">
                  File
                </div>
              )}
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="truncate text-sm font-medium text-app-text">{attachment.file.name}</p>
                {index === 0 && (
                  <p className="mt-0.5 text-xs text-app-muted">
                    {attachment.isImage || attachment.isVideo
                      ? 'Add an optional caption, then press Send.'
                      : 'Add an optional message, then press Send.'}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeAttachment(index)}
                className="shrink-0 rounded-lg p-1 text-app-muted hover:bg-app-chat-hover hover:text-app-text"
                aria-label="Remove attachment"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {replyingToMessage ? (
        <div className="mb-2 flex flex-col rounded-t-[8px] border-l-4 border-l-accent bg-app-surface-input px-3 py-2 text-sm text-app-muted">
          <div className="mb-1 flex items-center justify-between">
            <span className="font-semibold text-accent-soft">
              Replying to {replyingToMessage.senderName || replyingToMessage.senderId}
            </span>
            {onCancelReply ? (
              <button
                type="button"
                onClick={onCancelReply}
                className="text-app-muted hover:text-app-text"
                aria-label="Cancel reply"
              >
                ✕
              </button>
            ) : null}
          </div>
          <MessageReplyPreview message={replyingToMessage} currentUserId={currentUserId} />
        </div>
      ) : null}

      <div
        className={`relative flex flex-col rounded-[12px] border bg-app-surface-input transition-colors ${
          replyingToMessage ? 'rounded-t-none border-t-0' : ''
        } ${
          displayError ? 'border-accent' : 'border-app-border'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          onChange={handleFileSelected}
        />
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          multiple
          onChange={handleFileSelected}
        />
        <input
          ref={audioInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={handleAudioSelected}
        />

        <MediaPicker
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onSelectMedia={handleMediaSelect}
          onSelectEmoji={handleEmojiSelect}
          initialTab={pickerTab}
        />

        <div className={`flex items-end gap-1 ${compact ? 'px-1 py-1' : 'px-2 py-2'}`}>
          <textarea
            ref={textareaRef}
            value={value}
            rows={1}
            disabled={disabled || isSending || aiBusy}
            placeholder={
              aiBusy
                ? 'AI is working…'
                : pendingAttachments.length > 0
                  ? 'Add a caption (optional)'
                  : 'Type a message'
            }
            aria-invalid={Boolean(displayError)}
            className={`max-h-32 min-w-0 flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-snug text-app-text outline-none placeholder:text-app-placeholder disabled:opacity-60 ${
              compact ? 'min-h-[32px]' : 'min-h-[36px]'
            }`}
            onChange={(event) => {
              handleChange(event.target.value);
              updateMentionState(event.target.value, event.target.selectionStart ?? event.target.value.length);
            }}
            onKeyDown={(event) => {
              if (mentionQuery !== null && mentionSuggestions.length > 0 && !mentionLoading) {
                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  setMentionHighlightIndex((current) =>
                    Math.min(current + 1, mentionSuggestions.length - 1),
                  );
                  return;
                }

                if (event.key === 'ArrowUp') {
                  event.preventDefault();
                  setMentionHighlightIndex((current) => Math.max(current - 1, 0));
                  return;
                }

                if (event.key === 'Escape') {
                  event.preventDefault();
                  setMentionQuery(null);
                  mentionAnchorRef.current = null;
                  return;
                }

                if (event.key === 'Enter' || event.key === 'Tab') {
                  event.preventDefault();
                  const selected =
                    mentionSuggestions[mentionHighlightIndex] ?? mentionSuggestions[0];

                  if (selected) {
                    insertMention(selected.username);
                  }

                  return;
                }
              }

              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();

                if (!disabled && !isSending && !aiBusy && (value.trim() || pendingAttachments.length > 0)) {
                  handleSendAction();
                }
              }
            }}
            onKeyUp={(event) => {
              updateMentionState(event.currentTarget.value, event.currentTarget.selectionStart ?? event.currentTarget.value.length);
            }}
            onClick={(event) => {
              const target = event.currentTarget;
              updateMentionState(target.value, target.selectionStart ?? target.value.length);
            }}
          />
          <div className="flex shrink-0 items-center gap-0.5 self-end overflow-x-auto pb-0.5">
              <button
                type="button"
                disabled={fileDisabled}
                aria-label="Attach file"
                title="Attach file"
                className={iconButtonClass}
                onClick={() => fileInputRef.current?.click()}
              >
                <FiPaperclip className="h-[18px] w-[18px]" />
              </button>
              <button
                type="button"
                disabled={fileDisabled}
                aria-label="Attach image"
                title="Attach image"
                className={iconButtonClass}
                onClick={() => imageInputRef.current?.click()}
              >
                <FiImage className="h-[18px] w-[18px]" />
              </button>
              <button
                type="button"
                disabled={disabled || isSending || aiBusy}
                aria-label="Insert emoji, GIF, or sticker"
                title="Emoji, GIFs & stickers"
                aria-expanded={pickerOpen}
                className={`${iconButtonClass} ${
                  pickerOpen ? 'bg-accent/15 text-accent-soft' : ''
                }`}
                onClick={() => openPicker('emoji')}
              >
                <FiSmile className="h-[18px] w-[18px]" />
              </button>

              <div className="relative">
                <button
                  type="button"
                  disabled={aiDisabled}
                  aria-label="Flex AI"
                  title="Flex AI"
                  aria-expanded={aiMenuOpen}
                  className={`${iconButtonClass} ${
                    aiMenuOpen
                      ? 'bg-accent/15 text-accent-soft'
                      : ''
                  }`}
                  onClick={() => {
                    if (onOpenFlexAi) {
                      onOpenFlexAi();
                      return;
                    }

                    setAiMenuOpen((open) => !open);
                  }}
                >
                  <FiZap className="h-[18px] w-[18px]" />
                </button>

                {aiMenuOpen ? (
                  <>
                    <button
                      type="button"
                      aria-label="Close AI menu"
                      className="fixed inset-0 z-10 cursor-default"
                      onClick={() => setAiMenuOpen(false)}
                    />
                    <div className="absolute bottom-full right-0 z-20 mb-2 w-52 overflow-hidden rounded-xl border border-app-border bg-app-surface shadow-lg">
                      <button
                        type="button"
                        disabled={!value.trim()}
                        className="block w-full px-3 py-2 text-left text-sm text-app-text hover:bg-app-chat-hover disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => void handleAiEnhance()}
                      >
                        Enhance message
                      </button>
                      <button
                        type="button"
                        className="block w-full px-3 py-2 text-left text-sm text-app-text hover:bg-app-chat-hover"
                        onClick={() => void handleAiGenerate()}
                      >
                        Generate message
                      </button>
                      <button
                        type="button"
                        className="block w-full px-3 py-2 text-left text-sm text-app-text hover:bg-app-chat-hover"
                        onClick={() => void handleFlexCommand()}
                      >
                        Flex command
                      </button>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-app-text hover:bg-app-chat-hover"
                        onClick={() => {
                          setAiMenuOpen(false);
                          audioInputRef.current?.click();
                        }}
                      >
                        <FiMic className="h-4 w-4" />
                        Transcribe audio
                      </button>
                    </div>
                  </>
                ) : null}
              </div>

              <div className="relative">
                <button
                  type="button"
                  disabled={disabled || isSending || !conversationId}
                  aria-label="More message actions"
                  title="More actions"
                  aria-expanded={actionsMenuOpen}
                  className={`${iconButtonClass} ${
                    actionsMenuOpen
                      ? 'bg-accent/15 text-accent-soft'
                      : ''
                  }`}
                  onClick={() => setActionsMenuOpen((open) => !open)}
                >
                  <FiPlus className="h-[18px] w-[18px]" />
                </button>

                {actionsMenuOpen ? (
                  <>
                    <button
                      type="button"
                      aria-label="Close actions menu"
                      className="fixed inset-0 z-10 cursor-default"
                      onClick={() => setActionsMenuOpen(false)}
                    />
                    <div className="absolute bottom-full right-0 z-20 mb-2 w-64 overflow-hidden rounded-xl border border-app-border bg-app-surface shadow-lg">
                      <button
                        type="button"
                        disabled={disabled || isSending || !conversationId}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-app-text hover:bg-app-chat-hover disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => {
                          setActionsMenuOpen(false);
                          fileInputRef.current?.click();
                        }}
                      >
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15 text-accent-soft">
                          <FiLink className="h-4 w-4" />
                        </span>
                        <span>
                          <span className="block font-medium">Attach a file</span>
                          <span className="text-xs text-app-muted">Upload from your computer</span>
                        </span>
                      </button>
                      {!compact ? (
                        <>
                      <button
                        type="button"
                        disabled={disabled || isSending || !conversationId}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-app-text hover:bg-app-chat-hover disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => {
                          setActionsMenuOpen(false);
                          setPollOpen(true);
                        }}
                      >
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15 text-accent-soft">
                          <FiBarChart2 className="h-4 w-4" />
                        </span>
                        <span>
                          <span className="block font-medium">Poll</span>
                          <span className="text-xs text-app-muted">Ask a question with options</span>
                        </span>
                      </button>
                      <button
                        type="button"
                        disabled={disabled || isSending || !conversationId}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-app-text hover:bg-app-chat-hover disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => {
                          setActionsMenuOpen(false);
                          setScheduleOpen(true);
                        }}
                      >
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15 text-accent-soft">
                          <FiClock className="h-4 w-4" />
                        </span>
                        <span>
                          <span className="block font-medium">Schedule message</span>
                          <span className="text-xs text-app-muted">Send later at a set time</span>
                        </span>
                      </button>
                        </>
                      ) : null}
                      <button
                        type="button"
                        disabled={aiDisabled}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-app-text hover:bg-app-chat-hover disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => {
                          setActionsMenuOpen(false);
                          audioInputRef.current?.click();
                        }}
                      >
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15 text-accent-soft">
                          <FiMic className="h-4 w-4" />
                        </span>
                        <span>
                          <span className="block font-medium">Voice typing</span>
                          <span className="text-xs text-app-muted">Transcribe audio to text</span>
                        </span>
                      </button>
                    </div>
                  </>
                ) : null}
              </div>
          </div>
          <button
            type="button"
            disabled={disabled || isSending || aiBusy || (!value.trim() && pendingAttachments.length === 0)}
            aria-label={isSending ? 'Sending message' : aiBusy ? 'Working' : 'Send message'}
            className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center self-end rounded-lg bg-accent text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            onClick={handleSendAction}
          >
            <FiSend className="text-base" />
          </button>
        </div>
      </div>

      {mentionQuery !== null && mentionMenuStyle
        ? createPortal(
            <div
              className="fixed z-[9999] max-h-56 overflow-y-auto rounded-xl border border-app-border bg-app-surface shadow-xl"
              style={{
                left: mentionMenuStyle.left,
                top: mentionMenuStyle.top,
                width: mentionMenuStyle.width,
                transform: 'translateY(-100%)',
              }}
            >
                {mentionLoading ? (
                  <p className="px-3 py-2 text-sm text-app-muted">Searching people...</p>
                ) : mentionSuggestions.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-app-muted">No people found</p>
                ) : (
                  mentionSuggestions.map((user, index) => (
                    <button
                      key={user.id}
                      type="button"
                      className={`block w-full px-3 py-2 text-left text-sm text-app-text hover:bg-app-chat-hover ${
                        index === mentionHighlightIndex ? 'bg-app-chat-hover' : ''
                      }`}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        insertMention(user.username);
                      }}
                      onMouseEnter={() => setMentionHighlightIndex(index)}
                    >
                      @{user.username}
                      {user.name && user.name !== user.username ? (
                        <span className="ml-2 text-app-muted">{user.name}</span>
                      ) : null}
                    </button>
                  ))
                )}
              </div>,
              document.body,
            )
          : null}

      {pollOpen ? (
        <>
          <button
            type="button"
            aria-label="Close poll dialog"
            className="fixed inset-0 z-40 cursor-default bg-black/50"
            onClick={() => !pollBusy && setPollOpen(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl border border-app-border bg-app-surface p-5 shadow-xl">
              <h3 className="text-lg font-semibold text-app-text">Create poll</h3>
              <label className="mb-1 mt-4 block text-sm text-app-muted">Question</label>
              <input
                type="text"
                value={pollQuestion}
                disabled={pollBusy}
                className="mb-4 w-full rounded-xl border border-app-border bg-app-surface-input px-3 py-2.5 text-sm text-app-text outline-none focus:border-accent"
                onChange={(event) => setPollQuestion(event.target.value)}
              />
              <p className="mb-2 text-sm text-app-muted">Options</p>
              <div className="space-y-2">
                {pollOptions.map((option, index) => (
                  <input
                    key={index}
                    type="text"
                    value={option}
                    disabled={pollBusy}
                    placeholder={`Option ${index + 1}`}
                    className="w-full rounded-xl border border-app-border bg-app-surface-input px-3 py-2.5 text-sm text-app-text outline-none focus:border-accent"
                    onChange={(event) => {
                      const next = [...pollOptions];
                      next[index] = event.target.value;
                      setPollOptions(next);
                    }}
                  />
                ))}
              </div>
              {pollOptions.length < 6 ? (
                <button
                  type="button"
                  disabled={pollBusy}
                  className="mt-3 text-sm font-medium text-accent-soft hover:underline disabled:opacity-50"
                  onClick={() => setPollOptions((current) => [...current, ''])}
                >
                  Add option
                </button>
              ) : null}
              <div className="mt-5 flex justify-end gap-3">
                <button
                  type="button"
                  disabled={pollBusy}
                  className="rounded-xl border border-app-border px-4 py-2 text-sm font-semibold text-app-text hover:bg-app-chat-hover disabled:opacity-50"
                  onClick={() => setPollOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={pollBusy}
                  className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
                  onClick={() => void handleCreatePoll()}
                >
                  {pollBusy ? 'Creating...' : 'Create poll'}
                </button>
              </div>
            </div>
          </div>
        </>
      ) : null}

      <ScheduleMessageModal
        open={scheduleOpen}
        initialContent={value.trim()}
        busy={scheduleBusy}
        onClose={() => setScheduleOpen(false)}
        onSchedule={(content, scheduledAt) => void handleScheduleMessage(content, scheduledAt)}
      />
    </div>
  );
}
