import { API_BASE_URL } from '../shared/api';
import type { ApiResult } from '../shared/api';
import type { ConversationsPayload, UnreadCountPayload } from '../shared/chat';
import { normalizeConversations, normalizeUnreadCount } from '../shared/chat';
import { apiGet } from './apiRequest';

const CONVERSATIONS_URL = `${API_BASE_URL}/conversations`;
const UNREAD_COUNT_URL = `${API_BASE_URL}/notifications/unread-count`;

export async function fetchConversations(token: string): Promise<ApiResult<ConversationsPayload>> {
  const result = await apiGet<unknown>(CONVERSATIONS_URL, token, 'Conversations API');

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    data: {
      conversations: normalizeConversations(result.data),
    },
  };
}

export async function fetchUnreadCount(token: string): Promise<ApiResult<UnreadCountPayload>> {
  const result = await apiGet<unknown>(UNREAD_COUNT_URL, token, 'Unread Count API');

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    data: {
      count: normalizeUnreadCount(result.data),
    },
  };
}
