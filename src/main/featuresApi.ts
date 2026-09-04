import { API_BASE_URL } from '../shared/api';
import type { ApiResult } from '../shared/api';
import type {
  CalendarEventItem,
  ChannelItem,
  FileItem,
  FriendItem,
  HubInviteItem,
  SavedMessageItem,
} from '../shared/features';
import {
  normalizeCalendarEvents,
  normalizeChannels,
  normalizeFiles,
  normalizeFriends,
  normalizeHubInvites,
  normalizeSavedMessages,
} from '../shared/features';
import { apiGet, apiPost } from './apiRequest';

export async function saveMessage(
  token: string,
  _conversationId: string,
  messageId: string,
): Promise<ApiResult<SavedMessageItem[]>> {
  const result = await apiPost<unknown>(
    `${API_BASE_URL}/messages/${messageId}/save`,
    token,
    'Save Message API',
    {},
  );

  if (!result.ok) {
    return result;
  }

  const refreshed = await fetchSavedMessages(token);

  if (refreshed.ok) {
    return refreshed;
  }

  return { ok: true, data: normalizeSavedMessages(result.data) };
}

export async function fetchSavedMessages(token: string): Promise<ApiResult<SavedMessageItem[]>> {
  const result = await apiGet<unknown>(`${API_BASE_URL}/saved-messages`, token, 'Saved Messages API');

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: normalizeSavedMessages(result.data) };
}

export async function fetchFiles(
  token: string,
  filter: string,
): Promise<ApiResult<FileItem[]>> {
  const result = await apiGet<unknown>(
    `${API_BASE_URL}/files?filter=${encodeURIComponent(filter)}`,
    token,
    'Files API',
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: normalizeFiles(result.data) };
}

export async function fetchCalendarEvents(token: string): Promise<ApiResult<CalendarEventItem[]>> {
  const result = await apiGet<unknown>(`${API_BASE_URL}/calendar/events`, token, 'Calendar API');

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: normalizeCalendarEvents(result.data) };
}

export async function fetchChannels(token: string): Promise<ApiResult<ChannelItem[]>> {
  const result = await apiGet<unknown>(`${API_BASE_URL}/channels`, token, 'Channels API');

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: normalizeChannels(result.data) };
}

export async function fetchHubInvites(token: string): Promise<ApiResult<HubInviteItem[]>> {
  const result = await apiGet<unknown>(`${API_BASE_URL}/hub-invites/me`, token, 'Hub Invites API');

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: normalizeHubInvites(result.data) };
}

export async function fetchFriends(token: string): Promise<ApiResult<FriendItem[]>> {
  const result = await apiGet<unknown>(`${API_BASE_URL}/friends`, token, 'Friends API');

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: normalizeFriends(result.data) };
}

export async function acceptHubInvite(
  token: string,
  channelId: string,
): Promise<ApiResult<{ ok: true }>> {
  const result = await apiPost<unknown>(
    `${API_BASE_URL}/channels/${channelId}/accept-invite`,
    token,
    'Accept Hub Invite API',
    {},
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: { ok: true } };
}

export async function sendFriendRequest(
  token: string,
  userId: string,
): Promise<ApiResult<{ ok: true }>> {
  const result = await apiPost<unknown>(
    `${API_BASE_URL}/friends/request`,
    token,
    'Friend Request API',
    { userId },
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: { ok: true } };
}

export async function respondFriendRequest(
  token: string,
  userId: string,
  status: 'ACCEPTED' | 'DECLINED',
): Promise<ApiResult<{ ok: true }>> {
  const result = await apiPatch<unknown>(
    `${API_BASE_URL}/friends/${userId}/respond`,
    token,
    'Respond Friend Request API',
    { status },
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: { ok: true } };
}

export async function unsaveMessage(
  token: string,
  _conversationId: string,
  messageId: string,
): Promise<ApiResult<SavedMessageItem[]>> {
  const result = await apiDelete<unknown>(
    `${API_BASE_URL}/messages/${messageId}/save`,
    token,
    'Unsave Message API',
  );

  if (!result.ok) {
    return result;
  }

  const refreshed = await fetchSavedMessages(token);

  if (refreshed.ok) {
    return refreshed;
  }

  return { ok: true, data: normalizeSavedMessages(result.data) };
}
