import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiBarChart2, FiClock, FiImage, FiLink, FiMic, FiPaperclip, FiPlus, FiSend, FiSmile } from 'react-icons/fi';
import { EnhanceSparkleIcon } from './ChatIcons';
import type { GifPickerItem } from '../../shared/gifs';
import type { MessageItem } from '../../shared/messages';
import {
  buildScheduleMessageBody,
  validateMessageDraft,
  validateScheduleMessageContent,
} from '../../shared/messages';
import {
  enhanceMessageText,
  generateMessageText,
  parseFlexCommand,
  transcribeAudioFile,
} from '../extrasApi';
import { ensureCallMediaPermissions } from '../callsApi';
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
import type { ScheduledMessageItem } from '../../shared/extras';
import { VoiceInlineRecording } from './VoiceInlineRecording';
import { parseDateTimeLocalValue } from './scheduleDateTime';

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
  onSendVoice?: (file: File, caption?: string) => void;
  onPollCreated?: () => void;
  onScheduled?: (item?: ScheduledMessageItem) => void;
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

const VOICE_RECORDER_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
];

function pickVoiceRecorderMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') {
    return undefined;
  }

  return VOICE_RECORDER_MIME_TYPES.find((mimeType) => MediaRecorder.isTypeSupported(mimeType));
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
  onSendVoice,
  onPollCreated,
  onScheduled,
  onUnauthorized,
  onOpenFlexAi,
  compact = false,
  currentUserId = null,
}: MessageInputProps) {
  const toast = useToast();
  const [draftError, setDraftError] = useState('');
  const [isEnhanced, setIsEnhanced] = useState(false);
  const [previousDraft, setPreviousDraft] = useState('');
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
  const [pollAllowMultiple, setPollAllowMultiple] = useState(false);
  const [pollExpiresAt, setPollExpiresAt] = useState('');
  const [voiceCaptureMode, setVoiceCaptureMode] = useState<'note' | 'typing' | null>(null);
  const [voiceTypingTranscribing, setVoiceTypingTranscribing] = useState(false);
  const [pendingVoiceNote, setPendingVoiceNote] = useState<{
    file: File;
    url: string;
    durationSec: number;
  } | null>(null);
  const [recordingElapsedSec, setRecordingElapsedSec] = useState(0);
  const voiceCaptureModeRef = useRef<'note' | 'typing' | null>(null);
  const voiceRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceStreamRef = useRef<MediaStream | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const voiceDiscardRef = useRef(false);
  const recordingStartedAtRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const voiceNoteInputRef = useRef<HTMLInputElement>(null);
  const dictationBaseRef = useRef('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const aiMenuButtonRef = useRef<HTMLButtonElement>(null);
  const actionsMenuButtonRef = useRef<HTMLButtonElement>(null);
  const [aiMenuStyle, setAiMenuStyle] = useState<{ left: number; top: number } | null>(null);
  const [actionsMenuStyle, setActionsMenuStyle] = useState<{ left: number; top: number } | null>(
    null,
  );
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
    clearPendingVoiceNote();
    setVoiceTypingTranscribing(false);
    setVoiceCaptureMode(null);
    voiceCaptureModeRef.current = null;
  }, [conversationId]);

  const clearPendingVoiceNote = () => {
    setPendingVoiceNote((current) => {
      if (current?.url.startsWith('blob:')) {
        URL.revokeObjectURL(current.url);
      }
      return null;
    });
    setRecordingElapsedSec(0);
    recordingStartedAtRef.current = null;
  };

  useEffect(() => {
    if (!voiceCaptureMode) {
      recordingStartedAtRef.current = null;
      return;
    }

    recordingStartedAtRef.current = Date.now();
    setRecordingElapsedSec(0);

    const timer = window.setInterval(() => {
      const startedAt = recordingStartedAtRef.current;
      if (!startedAt) {
        return;
      }
      setRecordingElapsedSec(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    }, 250);

    return () => window.clearInterval(timer);
  }, [voiceCaptureMode]);

  useEffect(() => {
    return () => {
      if (pendingVoiceNote?.url.startsWith('blob:')) {
        URL.revokeObjectURL(pendingVoiceNote.url);
      }
    };
  }, [pendingVoiceNote?.url]);

  const notifyScheduled = () => {
    onScheduled?.();
  };

  const handleChange = (nextValue: string, fromAi = false) => {
    const validation = validateMessageDraft(nextValue);

    if (!fromAi && isEnhanced) {
      setIsEnhanced(false);
    }

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

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    // Reset height to auto to get the correct scrollHeight for shrinking
    textarea.style.height = 'auto';
    // Set the height to match the scroll height
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [value]);

  useLayoutEffect(() => {
    if (!aiMenuOpen || !aiMenuButtonRef.current) {
      setAiMenuStyle(null);
      return;
    }

    const rect = aiMenuButtonRef.current.getBoundingClientRect();
    setAiMenuStyle({
      left: Math.max(8, rect.right - 224),
      top: Math.max(8, rect.top - 8),
    });
  }, [aiMenuOpen]);

  useLayoutEffect(() => {
    if (!actionsMenuOpen || !actionsMenuButtonRef.current) {
      setActionsMenuStyle(null);
      return;
    }

    const rect = actionsMenuButtonRef.current.getBoundingClientRect();
    setActionsMenuStyle({
      left: Math.max(8, rect.right - 288),
      bottom: window.innerHeight - rect.top + 8,
    } as any);
  }, [actionsMenuOpen]);

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

    let expiresAt: string | null = null;
    if (pollExpiresAt.trim()) {
      const expiresMs = parseDateTimeLocalValue(pollExpiresAt);
      if (!Number.isFinite(expiresMs)) {
        toast.error('Enter a valid poll expiry date and time.');
        return;
      }
      expiresAt = new Date(expiresMs).toISOString();
    }

    setPollBusy(true);
    const result = await createPoll(conversationId, {
      question,
      options,
      allowMultiple: pollAllowMultiple,
      expiresAt,
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
    setPollAllowMultiple(false);
    setPollExpiresAt('');
    onPollCreated?.();
  };

  const handleScheduleMessage = async (content: string, scheduledAt: string) => {
    if (!conversationId) {
      toast.error('Open a conversation to schedule a message.');
      return;
    }

    const contentValidation = validateScheduleMessageContent(content);
    if (!contentValidation.ok) {
      toast.error(contentValidation.error);
      return;
    }

    setScheduleBusy(true);
    const result = await scheduleConversationMessage(
      conversationId,
      buildScheduleMessageBody({
        content: contentValidation.content,
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
    notifyScheduled();
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

    setPreviousDraft(value);
    setIsEnhanced(true);
    handleChange(result.data.text, true);
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

    handleChange(result.data.text, true);
    toast.success('Message generated.');
  };

  const handleFlexCommand = async () => {
    setAiMenuOpen(false);
    const input = window.prompt('Enter a Flex command (e.g. schedule meeting tomorrow 3pm):');

    if (!input?.trim()) {
      return;
    }

    setAiBusy(true);
    const result = await parseFlexCommand(input.trim(), conversationId);
    setAiBusy(false);

    if (!result.ok) {
      if (onUnauthorized?.(result.status)) {
        return;
      }
      toast.error(result.error);
      return;
    }

    const command = result.data;
    const action = (command.action ?? '').toLowerCase();
    const isSchedule =
      action.includes('schedule') || Boolean(command.scheduledAt?.trim());

    if (isSchedule && conversationId && command.message?.trim() && command.scheduledAt?.trim()) {
      const scheduleResult = await scheduleConversationMessage(
        conversationId,
        buildScheduleMessageBody({
          content: command.message.trim(),
          scheduledAt: command.scheduledAt.trim(),
          replyToId: replyingToMessage?.id ?? null,
        }),
      );

      if (!scheduleResult.ok) {
        if (onUnauthorized?.(scheduleResult.status)) {
          return;
        }
        toast.error(scheduleResult.error);
        return;
      }

      toast.success('Message scheduled.');
      notifyScheduled();
      return;
    }

    const nextText = command.message?.trim() || command.text.trim();

    if (!nextText) {
      toast.error('Flex command did not return any text.');
      return;
    }

    handleChange(nextText, true);
    toast.success('Flex command applied.');
  };

  const transcribeVoiceTypingFile = async (file: File) => {
    if (file.size < 800) {
      toast.error('Recording was too short. Speak a little longer and try again.');
      return;
    }

    setVoiceTypingTranscribing(true);

    try {
      const base64 = await readFileAsBase64(file);
      const mimeType = file.type || pickVoiceRecorderMimeType() || 'audio/webm';
      const result = await transcribeAudioFile(file.name, mimeType, base64);

      if (!result.ok) {
        if (onUnauthorized?.(result.status)) {
          return;
        }
        toast.error(result.error);
        return;
      }

      const transcript = result.data.text.trim();
      if (!transcript) {
        toast.error('No transcription returned.');
        return;
      }

      const base = dictationBaseRef.current.trim();
      const merged = base ? `${base} ${transcript}` : transcript;
      onChange(merged);
      requestAnimationFrame(() => {
        const textarea = textareaRef.current;
        if (!textarea) {
          return;
        }
        textarea.focus();
        const end = merged.length;
        textarea.setSelectionRange(end, end);
      });
    } catch {
      toast.error('Unable to transcribe audio.');
    } finally {
      setVoiceTypingTranscribing(false);
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  };

  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !fileDisabled) {
      setIsDraggingOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    if (disabled || fileDisabled) return;

    const files = Array.from(e.dataTransfer.files);
    if (!files.length) return;

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
    if (pendingVoiceNote && onSendVoice) {
      onSendVoice(pendingVoiceNote.file, value.trim() || undefined);
      clearPendingVoiceNote();
      handleChange('');
      return;
    }

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

  const stopVoiceCapture = () => {
    const recorder = voiceRecorderRef.current;

    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
  };

  const cancelVoiceRecording = () => {
    voiceDiscardRef.current = true;

    if (voiceRecorderRef.current && voiceRecorderRef.current.state !== 'inactive') {
      stopVoiceCapture();
      return;
    }

    voiceCaptureModeRef.current = null;
    setVoiceCaptureMode(null);
    voiceChunksRef.current = [];
  };

  const startVoiceCapture = async (mode: 'note' | 'typing') => {
    if (disabled || isSending || voiceCaptureMode || voiceTypingTranscribing) {
      if (voiceCaptureMode) {
        stopVoiceCapture();
      }
      return;
    }

    if (mode === 'note' && aiDisabled) {
      return;
    }

    if (mode === 'typing') {
      dictationBaseRef.current = value;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      if (mode === 'note') {
        voiceNoteInputRef.current?.click();
      } else {
        toast.error('Microphone recording is not available on this device.');
      }
      return;
    }

    const permission = await ensureCallMediaPermissions(false);
    if (!permission.ok) {
      toast.error(permission.error);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      voiceStreamRef.current = stream;
      voiceChunksRef.current = [];
      const mimeType = pickVoiceRecorderMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      voiceRecorderRef.current = recorder;
      voiceCaptureModeRef.current = mode;
      setVoiceCaptureMode(mode);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          voiceChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        toast.error('Recording failed. Please try again.');
        stopVoiceCapture();
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        voiceStreamRef.current = null;
        voiceRecorderRef.current = null;

        const captureMode = voiceCaptureModeRef.current ?? mode;
        voiceCaptureModeRef.current = null;
        setVoiceCaptureMode(null);

        if (voiceDiscardRef.current) {
          voiceDiscardRef.current = false;
          voiceChunksRef.current = [];
          return;
        }

        const blob = new Blob(voiceChunksRef.current, {
          type: recorder.mimeType || mimeType || 'audio/webm',
        });
        voiceChunksRef.current = [];

        if (blob.size === 0) {
          toast.error('No audio captured. Try recording again.');
          return;
        }

        const extension = (recorder.mimeType || mimeType || '').includes('mp4') ? 'm4a' : 'webm';
        const file = new File(
          [blob],
          captureMode === 'note' ? `voice-note.${extension}` : `voice-typing.${extension}`,
          {
            type: blob.type || mimeType || 'audio/webm',
          },
        );

        const startedAt = recordingStartedAtRef.current;
        const durationSec = startedAt
          ? Math.max(1, Math.round((Date.now() - startedAt) / 1000))
          : Math.max(1, recordingElapsedSec);

        recordingStartedAtRef.current = null;

        if (captureMode === 'typing') {
          void transcribeVoiceTypingFile(file);
          return;
        }

        setPendingVoiceNote((current) => {
          if (current?.url.startsWith('blob:')) {
            URL.revokeObjectURL(current.url);
          }
          return {
            file,
            url: URL.createObjectURL(blob),
            durationSec,
          };
        });
        requestAnimationFrame(() => textareaRef.current?.focus());
      };

      recorder.start(250);
    } catch {
      toast.error('Microphone access was denied.');
    }
  };

  const handleVoiceNoteFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file || aiDisabled) {
      return;
    }

    if (!onSendVoice) {
      toast.error('Voice messages are unavailable in this chat.');
      return;
    }

    setPendingVoiceNote((current) => {
      if (current?.url.startsWith('blob:')) {
        URL.revokeObjectURL(current.url);
      }
      return {
        file,
        url: URL.createObjectURL(file),
        durationSec: Math.max(1, Math.round(file.size / 8000)),
      };
    });
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const iconButtonClass = compact
    ? 'flex h-7 w-7 items-center justify-center rounded-lg text-app-muted transition-all hover:bg-app-chat-hover hover:text-app-text active:scale-95 disabled:cursor-not-allowed disabled:opacity-40'
    : 'flex h-8 w-8 items-center justify-center rounded-xl text-app-muted transition-all hover:bg-app-chat-hover hover:text-app-text active:scale-95 disabled:cursor-not-allowed disabled:opacity-40';

  const dragClasses = isDraggingOver ? 'bg-app-chat-hover/30 ring-2 ring-accent ring-inset rounded-xl transition-all' : '';

  return (
    <div 
      className={`${compact ? '' : 'px-6 pb-4 pt-1.5'} ${dragClasses} relative`}
      onDragOver={handleDragOver}
      onDragEnter={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {displayError ? (
        <p className="mb-2 text-xs text-accent-soft" role="alert">
          {displayError}
        </p>
      ) : null}

      {pendingAttachments.length > 0 ? (
        <div className="mb-2 flex flex-wrap items-start gap-3">
          {pendingAttachments.map((attachment, index) => (
            <div key={index} className="flex items-start gap-3 rounded-2xl border border-app-border bg-app-surface/90 backdrop-blur-md p-2.5 shadow-sm w-full sm:w-auto min-w-[200px]">
              {attachment.isImage ? (
                <img
                  src={attachment.previewUrl}
                  alt={attachment.file.name}
                  className="h-16 w-16 shrink-0 rounded-xl object-cover"
                />
              ) : attachment.isVideo ? (
                <video src={attachment.previewUrl} className="h-16 w-16 shrink-0 rounded-xl object-cover bg-app-chat-hover" />
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-app-surface text-xs text-app-muted">
                  File
                </div>
              )}
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="truncate text-xs font-semibold text-app-text">{attachment.file.name}</p>
                {index === 0 && (
                  <p className="mt-0.5 text-[11px] text-app-muted">
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

      {pendingVoiceNote ? (
        <div className="mb-2 flex items-center gap-3 rounded-2xl border border-app-border bg-app-surface/90 p-2.5 shadow-sm backdrop-blur-md">
          <audio
            src={pendingVoiceNote.url}
            controls
            preload="metadata"
            className="h-9 max-w-[220px] min-w-0 flex-1"
          />
          <span className="shrink-0 text-xs tabular-nums text-app-muted">
            {Math.floor(pendingVoiceNote.durationSec / 60)}:
            {String(pendingVoiceNote.durationSec % 60).padStart(2, '0')}
          </span>
          <button
            type="button"
            onClick={clearPendingVoiceNote}
            className="shrink-0 rounded-lg p-1 text-app-muted hover:bg-app-chat-hover hover:text-app-text"
            aria-label="Remove voice message"
          >
            ✕
          </button>
        </div>
      ) : null}

      {replyingToMessage ? (
        <div className="flex flex-col rounded-t-2xl bg-app-surface/95 backdrop-blur-md px-4 py-2 text-xs text-app-muted border-l-4 border-l-accent shadow-sm">
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

      {isEnhanced ? (
        <div className="flex items-center justify-between rounded-full bg-accent/10 dark:bg-[#38262a] border border-accent/20 px-4 py-2 mb-2 shadow-sm">
          <span className="text-[13px] text-app-text dark:text-app-muted font-medium tracking-wide">Message enhanced with AI</span>
          <button
            type="button"
            className="text-[13px] font-bold text-accent dark:text-[#e05374] hover:text-accent-hover dark:hover:text-[#ff7494] transition-colors"
            onClick={() => {
              handleChange(previousDraft, true);
              setIsEnhanced(false);
            }}
          >
            Undo
          </button>
        </div>
      ) : null}

      <div
        className={`relative flex flex-col rounded-[24px] border bg-app-surface-input/90 backdrop-blur-md transition-all duration-200 shadow-composer focus-within:shadow-composer-focus ${
          replyingToMessage ? 'rounded-t-none border-t-0' : ''
        } ${
          displayError ? 'border-accent ring-2 ring-accent' : 'border-app-border focus-within:border-accent/60'
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
          ref={voiceNoteInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={handleVoiceNoteFileSelected}
        />
        <MediaPicker
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onSelectMedia={handleMediaSelect}
          onSelectEmoji={handleEmojiSelect}
          initialTab={pickerTab}
        />



        <div className={`flex items-end gap-1 ${compact ? 'px-1 py-1' : 'px-2 py-2'}`}>
          {voiceCaptureMode ? (
            <VoiceInlineRecording
              elapsedSec={recordingElapsedSec}
              variant={voiceCaptureMode}
              onCancel={cancelVoiceRecording}
              onStop={stopVoiceCapture}
            />
          ) : (
          <textarea
            ref={textareaRef}
            value={value}
            rows={1}
            disabled={disabled || isSending || aiBusy || voiceTypingTranscribing}
            placeholder={
              voiceTypingTranscribing
                ? 'Transcribing…'
                : aiBusy
                  ? 'AI is working…'
                  : pendingVoiceNote || pendingAttachments.length > 0
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

                if (
                  !disabled &&
                  !isSending &&
                  !aiBusy &&
                  !voiceCaptureMode &&
                  (value.trim() || pendingAttachments.length > 0 || pendingVoiceNote)
                ) {
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
          )}
          <div className="flex shrink-0 items-center gap-0.5 self-end overflow-visible pb-0.5">
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
                  ref={aiMenuButtonRef}
                  type="button"
                  disabled={aiDisabled}
                  aria-label="Enhance message"
                  title="Enhance message"
                  aria-expanded={false}
                  className={iconButtonClass}
                  onClick={() => {
                    void handleAiEnhance();
                  }}
                >
                  <EnhanceSparkleIcon className="h-[18px] w-[18px]" />
                </button>
              </div>

              <div className="relative">
                <button
                  ref={actionsMenuButtonRef}
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
                  onClick={() => {
                    setAiMenuOpen(false);
                    setActionsMenuOpen((open) => !open);
                  }}
                >
                  <FiPaperclip className="h-[18px] w-[18px]" />
                </button>
              </div>

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
          </div>
          <button
            type="button"
            disabled={
              disabled ||
              isSending ||
              aiBusy ||
              Boolean(voiceCaptureMode) ||
              voiceTypingTranscribing ||
              (!value.trim() && pendingAttachments.length === 0 && !pendingVoiceNote)
            }
            aria-label={isSending ? 'Sending message' : aiBusy ? 'Working' : 'Send message'}
            className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center self-end rounded-xl bg-gradient-to-br from-accent via-accent to-[#632a38] text-white shadow-md shadow-accent/30 transition-all duration-200 hover:shadow-accent-glow hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100 disabled:shadow-none"
            onClick={handleSendAction}
          >
            <FiSend className="text-sm" />
          </button>
        </div>
      </div>

      {actionsMenuOpen && actionsMenuStyle
        ? createPortal(
            <>
              <button
                type="button"
                aria-label="Close actions menu"
                className="fixed inset-0 z-[9998] cursor-default"
                onClick={() => setActionsMenuOpen(false)}
              />
              <div
                className="fixed z-[9999] w-72 overflow-hidden rounded-3xl border border-app-border bg-app-elevated p-2 shadow-2xl animate-pop-in"
                style={{
                  left: actionsMenuStyle.left,
                  bottom: (actionsMenuStyle as any).bottom,
                  transformOrigin: 'bottom right',
                }}
              >
                <button
                  type="button"
                  disabled={disabled || isSending || !conversationId}
                  className="flex w-full items-center gap-3.5 rounded-2xl px-3 py-2.5 text-left text-app-text transition-colors hover:bg-app-chat-hover disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={() => {
                    setActionsMenuOpen(false);
                    imageInputRef.current?.click();
                  }}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                    <FiImage className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block text-[15px] font-semibold tracking-tight text-app-text">Gallery</span>
                    <span className="text-xs text-app-muted">Photos and videos</span>
                  </span>
                </button>

                <button
                  type="button"
                  disabled={disabled || isSending || !conversationId}
                  className="flex w-full items-center gap-3.5 rounded-2xl px-3 py-2.5 text-left text-app-text transition-colors hover:bg-app-chat-hover disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={() => {
                    setActionsMenuOpen(false);
                    fileInputRef.current?.click();
                  }}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </span>
                  <span>
                    <span className="block text-[15px] font-semibold tracking-tight text-app-text">Document</span>
                    <span className="text-xs text-app-muted">Attach a file</span>
                  </span>
                </button>

                {!compact ? (
                  <>
                    <button
                      type="button"
                      disabled={disabled || isSending || !conversationId}
                      className="flex w-full items-center gap-3.5 rounded-2xl px-3 py-2.5 text-left text-app-text transition-colors hover:bg-app-chat-hover disabled:cursor-not-allowed disabled:opacity-40"
                      onClick={() => {
                        setActionsMenuOpen(false);
                        setPollOpen(true);
                      }}
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                        <FiBarChart2 className="h-5 w-5" />
                      </span>
                      <span>
                        <span className="block text-[15px] font-semibold tracking-tight text-app-text">Poll</span>
                        <span className="text-xs text-app-muted">Ask a question with options</span>
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={disabled || isSending || !conversationId || !value.trim()}
                      className="flex w-full items-center gap-3.5 rounded-2xl px-3 py-2.5 text-left text-app-text transition-colors hover:bg-app-chat-hover disabled:cursor-not-allowed disabled:opacity-40"
                      onClick={() => {
                        if (!value.trim()) {
                          toast.error('Type a message before scheduling.');
                          return;
                        }
                        setActionsMenuOpen(false);
                        setScheduleOpen(true);
                      }}
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                        <FiClock className="h-5 w-5" />
                      </span>
                      <span>
                        <span className="block text-[15px] font-semibold tracking-tight text-app-text">Schedule</span>
                        <span className="text-xs text-app-muted">Send later at a set time</span>
                      </span>
                    </button>
                  </>
                ) : null}

                <button
                  type="button"
                  disabled={aiDisabled}
                  className="flex w-full items-center gap-3.5 rounded-2xl px-3 py-2.5 text-left text-app-text transition-colors hover:bg-app-chat-hover disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={() => {
                    setActionsMenuOpen(false);
                    void startVoiceCapture('note');
                  }}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                    <FiMic className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block text-[15px] font-semibold tracking-tight text-app-text">Voice message</span>
                    <span className="text-xs text-app-muted">Record and send audio</span>
                  </span>
                </button>

              </div>
            </>,
            document.body,
          )
        : null}

      {mentionQuery !== null && mentionMenuStyle
        ? createPortal(
            <div
              className="fixed z-[9999] max-h-56 overflow-y-auto rounded-xl border border-app-border bg-app-surface shadow-2xl p-1"
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
                      className={`block w-full px-3 py-2 text-left text-sm text-app-text rounded-lg hover:bg-app-chat-hover ${
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
            <div className="w-full max-w-md rounded-2xl border border-app-border bg-app-surface p-5 shadow-2xl">
              <h3 className="text-lg font-semibold text-app-text">Create poll</h3>
              <label className="mb-1 mt-4 block text-sm text-app-muted">Question</label>
              <input
                type="text"
                value={pollQuestion}
                disabled={pollBusy}
                className="mb-4 w-full rounded-xl border border-app-border bg-app-surface-input px-3 py-2.5 text-sm text-app-text outline-none focus:border-accent focus:ring-1 focus:ring-accent"
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
                    className="w-full rounded-xl border border-app-border bg-app-surface-input px-3 py-2.5 text-sm text-app-text outline-none focus:border-accent focus:ring-1 focus:ring-accent"
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
              <label className="mt-4 flex items-center gap-2 text-sm text-app-text">
                <input
                  type="checkbox"
                  checked={pollAllowMultiple}
                  disabled={pollBusy}
                  onChange={(event) => setPollAllowMultiple(event.target.checked)}
                />
                Allow multiple answers
              </label>
              <label className="mb-1 mt-3 block text-sm text-app-muted">Expires at (optional)</label>
              <input
                type="datetime-local"
                value={pollExpiresAt}
                disabled={pollBusy}
                className="mb-2 w-full rounded-xl border border-app-border bg-app-surface-input px-3 py-2.5 text-sm text-app-text outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                onChange={(event) => setPollExpiresAt(event.target.value)}
              />
              <div className="mt-5 flex justify-end gap-3">
                <button
                  type="button"
                  disabled={pollBusy}
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-app-text hover:bg-app-chat-hover disabled:opacity-50 transition-colors"
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
        conversationId={conversationId}
        onUnauthorized={onUnauthorized}
        onClose={() => setScheduleOpen(false)}
        onScheduledListChanged={() => notifyScheduled()}
        onSchedule={(content, scheduledAt) => void handleScheduleMessage(content, scheduledAt)}
      />
    </div>
  );
}
