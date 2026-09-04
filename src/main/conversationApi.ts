import { API_BASE_URL } from '../shared/api';
import type { ApiResult } from '../shared/api';
import type { ConversationBootstrap, MessageDraft, MessageItem } from '../shared/messages';
import {
  extractMessageFromPayload,
  normalizeBootstrap,
  normalizeDraft,
  normalizeMessage,
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
    data: normalizeMessageThread(result.data),
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
): Promise<ApiResult<{ conversationId: string }>> {
  const result = await apiPost<unknown>(
    `${API_BASE_URL}/conversations/direct`,
    token,
    'Create Direct Conversation API',
    { userId },
  );

  if (!result.ok) {
    return result;
  }

  const record = result.data as Record<string, unknown>;
  const conversation = asRecord(record.conversation);
  const conversationId =
    (conversation ? readString(conversation.id) : null) ?? readString(record.id);

  if (!conversationId) {
    return {
      ok: false,
      error: 'Conversation id missing from server response.',
    };
  }

  return { ok: true, data: { conversationId } };
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

export async function sendMessage(
  token: string,
  conversationId: string,
  content: string,
  replyToId?: string,
  threadRootId?: string,
): Promise<ApiResult<MessageItem>> {
  const payload: Record<string, unknown> = { content };
  if (replyToId) payload.replyToId = replyToId;
  if (threadRootId) payload.threadRootId = threadRootId;

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
  const messageRecord = extractMessageFromPayload(payload);

  return normalizeMessage((messageRecord ?? {}) as Record<string, unknown>, 0);
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

export async function addConversationMembers(token: string, conversationId: string, userIds: string[]): Promise<ApiResult<unknown>> {
  return apiPost<unknown>(`${API_BASE_URL}/conversations/${conversationId}/members`, token, 'Add Conversation Members API', { userIds });
}

export async function removeConversationMember(token: string, conversationId: string, userId: string): Promise<ApiResult<unknown>> {
  return apiDelete<unknown>(`${API_BASE_URL}/conversations/${conversationId}/members/${userId}`, token, 'Remove Conversation Member API');
}

export async function leaveConversation(token: string, conversationId: string): Promise<ApiResult<unknown>> {
  return apiDelete<unknown>(`${API_BASE_URL}/conversations/${conversationId}/leave`, token, 'Leave Conversation API');
}

export async function deleteConversation(token: string, conversationId: string): Promise<ApiResult<unknown>> {
  return apiDelete<unknown>(`${API_BASE_URL}/conversations/${conversationId}`, token, 'Delete Conversation API');
}

export async function clearConversationHistory(token: string, conversationId: string): Promise<ApiResult<unknown>> {
  return apiDelete<unknown>(`${API_BASE_URL}/conversations/${conversationId}/history`, token, 'Clear Conversation History API');
}
