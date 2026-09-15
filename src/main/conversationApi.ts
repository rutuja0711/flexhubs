import type { ConversationItem } from '../shared/chat';
import { normalizeConversation, patchDirectConversationMetadata } from '../shared/chat';
import { API_BASE_URL } from '../shared/api';
import type { ApiResult } from '../shared/api';
import type { ConversationBootstrap, MessageDraft, MessageItem } from '../shared/messages';
import {
  extractMessageFromPayload,
  normalizeBootstrap,
  normalizeDraft,
  normalizeMessage,
  normalizeMessageReadReceipts,
  normalizeMessageThread,
} from '../shared/messages';
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from './apiRequest';

export async function fetchConversationBootstrap(
  token: string,
  conversationId: string,
): Promise<ApiResult<ConversationBootstrap>> {
  const result = await apiGet<unknown>(
    `${API_BASE_URL}/conversations/${conversationId}/bootstrap`,
    token,
    'Conversation Bootstrap API',
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: normalizeBootstrap(result.data) };
}

export async function fetchMessageThread(
  token: string,
  conversationId: string,
  messageId: string,
): Promise<ApiResult<MessageItem[]>> {
  const result = await apiGet<unknown>(
    `${API_BASE_URL}/conversations/${conversationId}/messages/${messageId}/thread`,
    token,
    'Message Thread API',
  );

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    data: normalizeMessageThread(result.data, messageId),
  };
}

export async function fetchMessageDraft(
  token: string,
  conversationId: string,
): Promise<ApiResult<MessageDraft>> {
  const result = await apiGet<unknown>(
    `${API_BASE_URL}/conversations/${conversationId}/messages/draft`,
    token,
    'Message Draft API',
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: normalizeDraft(result.data) };
}

export async function saveMessageDraft(
  token: string,
  conversationId: string,
  content: string,
): Promise<ApiResult<MessageDraft>> {
  const result = await apiPut<unknown>(
    `${API_BASE_URL}/conversations/${conversationId}/messages/draft`,
    token,
    'Save Draft API',
    { content },
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: normalizeDraft(result.data) };
}

export async function clearMessageDraft(
  token: string,
  conversationId: string,
): Promise<ApiResult<{ ok: true }>> {
  const result = await apiDelete<unknown>(
    `${API_BASE_URL}/conversations/${conversationId}/messages/draft`,
    token,
    'Clear Draft API',
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: { ok: true } };
}

export async function markConversationRead(
  token: string,
  conversationId: string,
): Promise<ApiResult<{ ok: true }>> {
  const result = await apiPost<unknown>(
    `${API_BASE_URL}/conversations/${conversationId}/messages/read`,
    token,
    'Mark Read API',
    {},
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: { ok: true } };
}

export async function createDirectConversation(
  token: string,
  userId: string,
): Promise<ApiResult<{ conversationId: string; conversation: ConversationItem | null }>> {
  const result = await apiPost<unknown>(
    `${API_BASE_URL}/conversations/direct`,
    token,
    'Create Direct Conversation API',
    { userId },
  );

  if (!result.ok) {
    return result;
  }

  const record = asRecord(result.data);

  if (!record) {
    return {
      ok: false,
      error: 'Conversation payload missing from server response.',
    };
  }

  const conversationRecord = asRecord(record.conversation) ?? record;
  const conversationId = readString(conversationRecord.id) ?? readString(record.id);

  if (!conversationId) {
    return {
      ok: false,
      error: 'Conversation id missing from server response.',
    };
  }

  const normalized = normalizeConversation(conversationRecord, 0);
  const peerName =
    normalized.title && normalized.title !== 'Conversation' && normalized.title !== 'Direct message'
      ? normalized.title
      : readString(asRecord(conversationRecord.user)?.name) ??
        readString(asRecord(conversationRecord.peer)?.name) ??
        'Direct message';

  return {
    ok: true,
    data: {
      conversationId,
      conversation: patchDirectConversationMetadata(
        { ...normalized, kind: 'direct' },
        userId,
        peerName,
      ),
    },
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  return value as Record<string, unknown>;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function stampThreadRootId(message: MessageItem, rootMessageId: string): MessageItem {
  return {
    ...message,
    threadRootId: message.threadRootId ?? rootMessageId,
  };
}

export async function sendThreadReply(
  token: string,
  conversationId: string,
  rootMessageId: string,
  content: string,
  mediaJson?: string,
): Promise<ApiResult<MessageItem>> {
  const payload: Record<string, unknown> = {
    threadRootId: rootMessageId,
  };

  if (mediaJson) {
    try {
      const media = JSON.parse(mediaJson) as Record<string, unknown>;

      if (media.type) payload.type = media.type;
      if (typeof media.content === 'string') payload.content = media.content;
      if (media.fileUrl) payload.fileUrl = media.fileUrl;
      if (media.fileName) payload.fileName = media.fileName;
      if (media.mimeType) payload.mimeType = media.mimeType;
    } catch {
      // Ignore malformed media payload and send as plain text.
    }

    if (!('content' in payload)) {
      payload.content = content || '';
    }

    const result = await apiPost<unknown>(
      `${API_BASE_URL}/conversations/${conversationId}/messages`,
      token,
      'Send Thread Reply API',
      payload,
    );

    if (!result.ok) {
      return result;
    }

    return {
      ok: true,
      data: stampThreadRootId(normalizeMessageResult(result.data), rootMessageId),
    };
  }

  payload.content = content;

  const streamResult = await apiPost<unknown>(
    `${API_BASE_URL}/conversations/${conversationId}/messages/stream`,
    token,
    'Send Thread Reply Stream API',
    payload,
  );

  if (streamResult.ok) {
    return {
      ok: true,
      data: stampThreadRootId(normalizeMessageResult(streamResult.data), rootMessageId),
    };
  }

  const result = await apiPost<unknown>(
    `${API_BASE_URL}/conversations/${conversationId}/messages`,
    token,
    'Send Thread Reply API',
    payload,
  );

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    data: stampThreadRootId(normalizeMessageResult(result.data), rootMessageId),
  };
}

export async function sendMessage(
  token: string,
  conversationId: string,
  content: string,
  replyToId?: string,
  threadRootId?: string,
  mediaJson?: string,
): Promise<ApiResult<MessageItem>> {
  if (threadRootId) {
    return sendThreadReply(token, conversationId, threadRootId, content, mediaJson);
  }

  const payload: Record<string, unknown> = {};
  if (replyToId) payload.replyToId = replyToId;

  if (mediaJson) {
    try {
      const media = JSON.parse(mediaJson) as Record<string, unknown>;

      if (media.type) payload.type = media.type;
      if (typeof media.content === 'string') payload.content = media.content;
      if (media.fileUrl) payload.fileUrl = media.fileUrl;
      if (media.fileName) payload.fileName = media.fileName;
      if (media.mimeType) payload.mimeType = media.mimeType;
    } catch {
      // Ignore malformed media payload and send as plain text.
    }

    if (!('content' in payload)) {
      payload.content = content || '';
    }
  } else {
    payload.content = content;
  }

  const result = await apiPost<unknown>(
    `${API_BASE_URL}/conversations/${conversationId}/messages`,
    token,
    'Send Message API',
    payload,
  );

  if (!result.ok) {
    return result;
  }

  const record = result.data as Record<string, unknown>;
  const messageRecord =
    record && typeof record === 'object' && record.message && typeof record.message === 'object'
      ? (record.message as Record<string, unknown>)
      : record;

  return {
    ok: true,
    data: normalizeMessage(messageRecord as Record<string, unknown>, 0),
  };
}

export async function addMessageReaction(
  token: string,
  conversationId: string,
  messageId: string,
  emoji: string,
): Promise<ApiResult<MessageItem>> {
  const result = await apiPost<unknown>(
    `${API_BASE_URL}/conversations/${conversationId}/messages/${messageId}/reactions`,
    token,
    'Add Reaction API',
    { emoji },
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: normalizeMessageResult(result.data) };
}

function normalizeMessageResult(payload: unknown): MessageItem {
  const record = asRecord(payload);
  const messageRecord = extractMessageFromPayload(payload);
  const message = normalizeMessage((messageRecord ?? record ?? {}) as Record<string, unknown>, 0);
  const readBySource =
    message.readBy.length > 0
      ? message.readBy
      : normalizeMessageReadReceipts(
          record?.readBy ??
            record?.seenBy ??
            record?.readReceipts ??
            messageRecord?.readBy ??
            messageRecord?.seenBy ??
            messageRecord?.readReceipts,
        );

  return readBySource.length > 0 ? { ...message, readBy: readBySource } : message;
}

export async function editMessage(
  token: string,
  conversationId: string,
  messageId: string,
  content: string,
): Promise<ApiResult<MessageItem>> {
  const result = await apiPatch<unknown>(
    `${API_BASE_URL}/conversations/${conversationId}/messages/${messageId}`,
    token,
    'Edit Message API',
    { content },
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: normalizeMessageResult(result.data) };
}

export async function deleteMessage(
  token: string,
  conversationId: string,
  messageId: string,
  scope: 'me' | 'everyone',
): Promise<ApiResult<{ messageId: string; scope: 'me' | 'everyone' }>> {
  const result = await apiDelete<unknown>(
    `${API_BASE_URL}/conversations/${conversationId}/messages/${messageId}?scope=${scope}`,
    token,
    'Delete Message API',
  );

  if (!result.ok) {
    if (scope === 'everyone' && /already deleted/i.test(result.error ?? '')) {
      return {
        ok: true,
        data: { messageId, scope: 'everyone' as const },
      };
    }

    return result;
  }

  const record = asRecord(result.data);
  const deletedMessageId = record ? readString(record.messageId) ?? messageId : messageId;
  const deletedScope =
    record && readString(record.scope) === 'everyone' ? 'everyone' : scope;

  return {
    ok: true,
    data: { messageId: deletedMessageId, scope: deletedScope },
  };
}

export async function forwardMessage(
  token: string,
  conversationId: string,
  messageId: string,
  targetConversationIds: string[],
): Promise<ApiResult<{ messages: MessageItem[] }>> {
  const targets = targetConversationIds.filter((id) => typeof id === 'string' && id.trim().length > 0);

  if (targets.length === 0) {
    return {
      ok: false,
      error: 'Choose a conversation to forward to.',
    };
  }

  const url = `${API_BASE_URL}/conversations/${conversationId}/messages/${messageId}/forward`;
  const bodyOptions: unknown[] = [
    { conversationIds: targets },
    { targetConversationIds: targets },
    targets,
    { ids: targets },
    { to: targets },
  ];

  let lastResult: ApiResult<unknown> = {
    ok: false,
    error: 'Forward failed. Please try again.',
  };

  for (const body of bodyOptions) {
    const result = await apiPost<unknown>(url, token, 'Forward Message API', body);

    if (result.ok) {
      const record = asRecord(result.data);
      const rawMessages = record && Array.isArray(record.messages) ? record.messages : [];
      const messages = rawMessages
        .map(asRecord)
        .filter((item): item is Record<string, unknown> => item !== null)
        .map(normalizeMessage);

      return { ok: true, data: { messages } };
    }

    lastResult = result;

    if (result.status !== 400 || !result.error?.toLowerCase().includes('invalid input')) {
      return result;
    }
  }

  return lastResult;
}

export async function pinMessage(
  token: string,
  conversationId: string,
  messageId: string,
): Promise<ApiResult<MessageItem>> {
  const result = await apiPost<unknown>(
    `${API_BASE_URL}/conversations/${conversationId}/messages/${messageId}/pin`,
    token,
    'Pin Message API',
    {},
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: normalizeMessageResult(result.data) };
}

export async function unpinMessage(
  token: string,
  conversationId: string,
  messageId: string,
): Promise<ApiResult<MessageItem>> {
  const result = await apiDelete<unknown>(
    `${API_BASE_URL}/conversations/${conversationId}/messages/${messageId}/pin`,
    token,
    'Unpin Message API',
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: normalizeMessageResult(result.data) };
}

export async function renameConversation(token: string, conversationId: string, name: string): Promise<ApiResult<unknown>> {
  return apiPatch<unknown>(`${API_BASE_URL}/conversations/${conversationId}/name`, token, 'Rename Conversation API', { name });
}

export async function updateConversationNotificationSettings(
  token: string,
  conversationId: string,
  settings: Record<string, unknown>,
): Promise<ApiResult<{ ok: true }>> {
  const result = await apiPatch<unknown>(
    `${API_BASE_URL}/conversations/${conversationId}/notification-settings`,
    token,
    'Conversation Notification Settings API',
    settings,
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: { ok: true } };
}

export async function setConversationFavorite(
  token: string,
  conversationId: string,
  favorite: boolean,
): Promise<ApiResult<{ ok: true; favorite: boolean }>> {
  const result = await apiPatch<unknown>(
    `${API_BASE_URL}/conversations/${conversationId}/favorite`,
    token,
    'Favorite Conversation API',
    { favorite, isFavorite: favorite },
  );

  if (!result.ok) {
    return result;
  }

  const record =
    result.data && typeof result.data === 'object'
      ? (result.data as Record<string, unknown>)
      : null;
  const nestedConversation =
    record && record.conversation && typeof record.conversation === 'object'
      ? (record.conversation as Record<string, unknown>)
      : null;
  const resolvedFavorite =
    record?.favorite === true ||
    record?.isFavorite === true ||
    nestedConversation?.favorite === true ||
    nestedConversation?.isFavorite === true
      ? true
      : record?.favorite === false ||
          record?.isFavorite === false ||
          nestedConversation?.favorite === false ||
          nestedConversation?.isFavorite === false
        ? false
        : favorite;

  return { ok: true, data: { ok: true, favorite: resolvedFavorite } };
}

export async function addConversationMembers(token: string, conversationId: string, userIds: string[]): Promise<ApiResult<unknown>> {
  return apiPost<unknown>(`${API_BASE_URL}/conversations/${conversationId}/members`, token, 'Add Conversation Members API', { userIds });
}

export async function removeConversationMember(token: string, conversationId: string, userId: string): Promise<ApiResult<unknown>> {
  return apiDelete<unknown>(`${API_BASE_URL}/conversations/${conversationId}/members/${userId}`, token, 'Remove Conversation Member API');
}

export async function leaveConversation(token: string, conversationId: string, isHub: boolean): Promise<ApiResult<unknown>> {
  if (isHub) {
    const channelLeave = await apiDelete<unknown>(
      `${API_BASE_URL}/channels/${conversationId}/leave`,
      token,
      'Leave Hub API',
    );

    if (channelLeave.ok) {
      return channelLeave;
    }

    const channelPostLeave = await apiPost<unknown>(
      `${API_BASE_URL}/channels/${conversationId}/leave`,
      token,
      'Leave Hub API',
      {},
    );

    if (channelPostLeave.ok) {
      return channelPostLeave;
    }

    const conversationLeave = await apiDelete<unknown>(
      `${API_BASE_URL}/conversations/${conversationId}/leave`,
      token,
      'Leave Conversation API',
    );

    if (conversationLeave.ok) {
      return conversationLeave;
    }

    const notFound =
      channelLeave.status === 404 ||
      /not found/i.test(channelLeave.error ?? '') ||
      conversationLeave.status === 404 ||
      /not found/i.test(conversationLeave.error ?? '');

    if (notFound) {
      return {
        ok: false,
        error: 'Unable to leave this hub. Try again from the conversation, or ask an admin to remove you.',
        status: channelLeave.status ?? conversationLeave.status,
      };
    }

    return conversationLeave.ok === false && conversationLeave.error
      ? conversationLeave
      : channelLeave;
  }

  return apiDelete<unknown>(`${API_BASE_URL}/conversations/${conversationId}/leave`, token, 'Leave Conversation API');
}

export async function deleteConversation(token: string, conversationId: string): Promise<ApiResult<unknown>> {
  return apiDelete<unknown>(`${API_BASE_URL}/conversations/${conversationId}`, token, 'Delete Conversation API');
}

export async function clearConversationHistory(token: string, conversationId: string): Promise<ApiResult<unknown>> {
  return apiDelete<unknown>(`${API_BASE_URL}/conversations/${conversationId}/history`, token, 'Clear Conversation History API');
}

export async function createGroupConversation(
  token: string,
  name: string,
  userIds: string[],
): Promise<ApiResult<{ conversationId: string }>> {
  const result = await apiPost<unknown>(
    `${API_BASE_URL}/conversations/group`,
    token,
    'Create Group Conversation API',
    { name, userIds, memberIds: userIds },
  );

  if (!result.ok) {
    return result;
  }

  const record = asRecord(result.data);
  const conversation = asRecord(record?.conversation);
  const conversationId =
    readString(conversation?.id) ?? readString(record?.id) ?? readString(record?.conversationId);

  if (!conversationId) {
    return { ok: false, error: 'Conversation id missing from server response.' };
  }

  return { ok: true, data: { conversationId } };
}

export async function fetchSelfConversation(token: string): Promise<ApiResult<{ conversationId: string }>> {
  const result = await apiGet<unknown>(`${API_BASE_URL}/conversations/self`, token, 'Self Conversation API');

  if (!result.ok) {
    return result;
  }

  const record = asRecord(result.data);
  const conversation = asRecord(record?.conversation);
  const conversationId =
    readString(conversation?.id) ?? readString(record?.id) ?? readString(record?.conversationId);

  if (!conversationId) {
    return { ok: false, error: 'Self conversation id missing from server response.' };
  }

  return { ok: true, data: { conversationId } };
}

export async function fetchConversationById(
  token: string,
  conversationId: string,
): Promise<ApiResult<unknown>> {
  return apiGet<unknown>(`${API_BASE_URL}/conversations/${conversationId}`, token, 'Conversation API');
}

export async function markConversationUnread(
  token: string,
  conversationId: string,
): Promise<ApiResult<{ ok: true }>> {
  const result = await apiPost<unknown>(
    `${API_BASE_URL}/conversations/${conversationId}/messages/unread`,
    token,
    'Mark Unread API',
    {},
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: { ok: true } };
}

export async function sendMessageStream(
  token: string,
  conversationId: string,
  content: string,
  replyToId?: string,
  threadRootId?: string,
): Promise<ApiResult<MessageItem>> {
  if (threadRootId) {
    return sendThreadReply(token, conversationId, threadRootId, content);
  }

  const payload: Record<string, unknown> = { content };
  if (replyToId) payload.replyToId = replyToId;

  const streamResult = await apiPost<unknown>(
    `${API_BASE_URL}/conversations/${conversationId}/messages/stream`,
    token,
    'Send Message Stream API',
    payload,
  );

  if (streamResult.ok) {
    return { ok: true, data: normalizeMessageResult(streamResult.data) };
  }

  return sendMessage(token, conversationId, content, replyToId, threadRootId);
}

export async function createPollMessage(
  token: string,
  conversationId: string,
  payload: Record<string, unknown>,
): Promise<ApiResult<MessageItem>> {
  const result = await apiPost<unknown>(
    `${API_BASE_URL}/conversations/${conversationId}/messages/poll`,
    token,
    'Create Poll API',
    payload,
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: normalizeMessageResult(result.data) };
}

export async function votePollMessage(
  token: string,
  conversationId: string,
  messageId: string,
  optionId: string,
): Promise<ApiResult<MessageItem>> {
  const result = await apiPost<unknown>(
    `${API_BASE_URL}/conversations/${conversationId}/messages/${messageId}/poll/vote`,
    token,
    'Vote Poll API',
    { optionId, optionIds: [optionId] },
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: normalizeMessageResult(result.data) };
}

export async function fetchPinnedMessages(
  token: string,
  conversationId: string,
): Promise<ApiResult<MessageItem[]>> {
  const result = await apiGet<unknown>(
    `${API_BASE_URL}/conversations/${conversationId}/messages/pinned`,
    token,
    'Pinned Messages API',
  );

  if (!result.ok) {
    return result;
  }

  const record = asRecord(result.data);
  const raw = Array.isArray(result.data)
    ? result.data
    : Array.isArray(record?.messages)
      ? record.messages
      : Array.isArray(record?.pinned)
        ? record.pinned
        : [];

  return {
    ok: true,
    data: raw
      .map(asRecord)
      .filter((item): item is Record<string, unknown> => item !== null)
      .map((item, index) => normalizeMessage(item, index)),
  };
}

export async function fetchMessageById(
  token: string,
  conversationId: string,
  messageId: string,
): Promise<ApiResult<MessageItem>> {
  const result = await apiGet<unknown>(
    `${API_BASE_URL}/conversations/${conversationId}/messages/${messageId}`,
    token,
    'Message API',
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: normalizeMessageResult(result.data) };
}

export async function fetchMentionSuggestions(
  token: string,
  conversationId: string,
  query: string,
): Promise<ApiResult<unknown[]>> {
  const result = await apiGet<unknown>(
    `${API_BASE_URL}/conversations/${conversationId}/messages/mention-suggestions?q=${encodeURIComponent(query)}`,
    token,
    'Mention Suggestions API',
  );

  if (!result.ok) {
    return result;
  }

  const record = asRecord(result.data);
  const users = Array.isArray(result.data)
    ? result.data
    : Array.isArray(record?.users)
      ? record.users
      : Array.isArray(record?.members)
        ? record.members
        : Array.isArray(record?.suggestions)
          ? record.suggestions
          : Array.isArray(record?.mentionableUsers)
            ? record.mentionableUsers
            : [];

  return { ok: true, data: users };
}

export async function fetchConversationScheduledMessages(
  token: string,
  conversationId: string,
): Promise<ApiResult<unknown[]>> {
  const result = await apiGet<unknown>(
    `${API_BASE_URL}/conversations/${conversationId}/messages/scheduled`,
    token,
    'Conversation Scheduled Messages API',
  );

  if (!result.ok) {
    return result;
  }

  const record = asRecord(result.data);
  const messages = Array.isArray(result.data)
    ? result.data
    : Array.isArray(record?.messages)
      ? record.messages
      : [];

  return { ok: true, data: messages };
}

export async function createConversationScheduledMessage(
  token: string,
  conversationId: string,
  payload: Record<string, unknown>,
): Promise<ApiResult<unknown>> {
  return apiPost<unknown>(
    `${API_BASE_URL}/conversations/${conversationId}/messages/scheduled`,
    token,
    'Schedule Conversation Message API',
    payload,
  );
}

export async function deleteConversationScheduledMessage(
  token: string,
  conversationId: string,
  scheduledId: string,
): Promise<ApiResult<{ ok: true }>> {
  const result = await apiDelete<unknown>(
    `${API_BASE_URL}/conversations/${conversationId}/messages/scheduled/${scheduledId}`,
    token,
    'Delete Scheduled Conversation Message API',
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: { ok: true } };
}

export async function updateConversationMemberRole(
  token: string,
  conversationId: string,
  userId: string,
  role: string,
): Promise<ApiResult<unknown>> {
  return apiPatch<unknown>(
    `${API_BASE_URL}/conversations/${conversationId}/members/${userId}/role`,
    token,
    'Update Member Role API',
    { role },
  );
}

export async function fetchConversationNotificationSettings(
  token: string,
  conversationId: string,
): Promise<ApiResult<Record<string, unknown>>> {
  const result = await apiGet<unknown>(
    `${API_BASE_URL}/conversations/${conversationId}/notification-settings`,
    token,
    'Get Conversation Notification Settings API',
  );

  if (!result.ok) {
    return result;
  }

  const record = asRecord(result.data) ?? {};
  return { ok: true, data: record };
}
