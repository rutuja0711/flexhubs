import { API_BASE_URL } from '../shared/api';
import type { ApiResult } from '../shared/api';
import type {
  BlockedUserItem,
  CalendarEventItem,
  ChannelInviteItem,
  ChannelItem,
  CreateChannelInput,
  CreatedChannelResult,
  FileItem,
  FriendItem,
  FriendRelationship,
  HubInviteItem,
  SavedMessageItem,
} from '../shared/features';
import { normalizeCalendarEventsDetailed } from '../shared/extras';
import {
  normalizeBlockedUsers,
  normalizeChannelInvites,
  normalizeChannels,
  normalizeCreatedChannel,
  normalizeFiles,
  normalizeFriendRelationship,
  normalizeFriends,
  normalizeHubInvites,
  normalizeSavedMessages,
  slugifyChannelName,
} from '../shared/features';
import { apiDelete, apiGet, apiPatch, apiPost } from './apiRequest';

function successResult(): ApiResult<{ success: true }> {
  return { ok: true, data: { success: true } };
}

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

  return { ok: true, data: normalizeCalendarEventsDetailed(result.data) };
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

export async function acceptHubInviteById(
  token: string,
  inviteId: string,
): Promise<ApiResult<{ ok: true }>> {
  const result = await apiPost<unknown>(
    `${API_BASE_URL}/hub-invites/${inviteId}/accept`,
    token,
    'Accept Hub Invite By Id API',
    {},
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: { ok: true } };
}

export async function declineHubInvite(
  token: string,
  inviteId: string,
): Promise<ApiResult<{ ok: true }>> {
  const result = await apiPost<unknown>(
    `${API_BASE_URL}/hub-invites/${inviteId}/decline`,
    token,
    'Decline Hub Invite API',
    {},
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: { ok: true } };
}

export async function fetchBlockedUsers(token: string): Promise<ApiResult<BlockedUserItem[]>> {
  const result = await apiGet<unknown>(`${API_BASE_URL}/blocks`, token, 'Blocks API');

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: normalizeBlockedUsers(result.data) };
}

export async function blockUser(
  token: string,
  userId: string,
): Promise<ApiResult<{ success: true }>> {
  const result = await apiPost<unknown>(
    `${API_BASE_URL}/blocks`,
    token,
    'Block User API',
    { userId },
  );

  if (!result.ok) {
    return result;
  }

  return successResult();
}

export async function unblockUser(
  token: string,
  userId: string,
): Promise<ApiResult<{ success: true }>> {
  const deleteResult = await apiDelete<unknown>(
    `${API_BASE_URL}/blocks/${userId}`,
    token,
    'Unblock User API',
  );

  if (deleteResult.ok) {
    return successResult();
  }

  if (deleteResult.status !== 404 && deleteResult.status !== 405) {
    return deleteResult as ApiResult<{ success: true }>;
  }

  const unblockResult = await apiPost<unknown>(
    `${API_BASE_URL}/blocks/unblock`,
    token,
    'Unblock User API (fallback)',
    { userId },
  );

  if (!unblockResult.ok) {
    return unblockResult as ApiResult<{ success: true }>;
  }

  return successResult();
}

export async function fetchFriendRelationship(
  token: string,
  userId: string,
): Promise<ApiResult<FriendRelationship>> {
  const result = await apiGet<unknown>(
    `${API_BASE_URL}/friends/relationship/${userId}`,
    token,
    'Friend Relationship API',
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: normalizeFriendRelationship(result.data) };
}

export async function createChannel(
  token: string,
  input: CreateChannelInput,
): Promise<ApiResult<CreatedChannelResult>> {
  const result = await apiPost<unknown>(
    `${API_BASE_URL}/channels`,
    token,
    'Create Channel API',
    {
      name: input.name,
      slug: input.slug ?? slugifyChannelName(input.name),
      description: input.description ?? '',
      userIds: input.memberIds ?? [],
    },
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: normalizeCreatedChannel(result.data) };
}

export async function updateChannelName(
  token: string,
  channelId: string,
  name: string,
): Promise<ApiResult<{ ok: true }>> {
  const result = await apiPatch<unknown>(
    `${API_BASE_URL}/channels/${channelId}/name`,
    token,
    'Update Channel Name API',
    { name },
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: { ok: true } };
}

export async function updateChannelDescription(
  token: string,
  channelId: string,
  description: string,
): Promise<ApiResult<{ ok: true }>> {
  const result = await apiPatch<unknown>(
    `${API_BASE_URL}/channels/${channelId}/description`,
    token,
    'Update Channel Description API',
    { description },
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: { ok: true } };
}

export async function updateChannelSettings(
  token: string,
  channelId: string,
  settings: Record<string, unknown>,
): Promise<ApiResult<{ ok: true }>> {
  const result = await apiPatch<unknown>(
    `${API_BASE_URL}/channels/${channelId}/settings`,
    token,
    'Update Channel Settings API',
    settings,
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: { ok: true } };
}

export async function fetchChannelInvites(
  token: string,
  channelId: string,
): Promise<ApiResult<ChannelInviteItem[]>> {
  const result = await apiGet<unknown>(
    `${API_BASE_URL}/channels/${channelId}/invites`,
    token,
    'Channel Invites API',
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: normalizeChannelInvites(result.data) };
}

export async function revokeChannelInvite(
  token: string,
  channelId: string,
  inviteId: string,
): Promise<ApiResult<{ ok: true }>> {
  const result = await apiDelete<unknown>(
    `${API_BASE_URL}/channels/${channelId}/invites/${inviteId}`,
    token,
    'Revoke Channel Invite API',
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: { ok: true } };
}

export async function deleteChannel(
  token: string,
  channelId: string,
): Promise<ApiResult<{ ok: true }>> {
  const result = await apiDelete<unknown>(
    `${API_BASE_URL}/channels/${channelId}`,
    token,
    'Delete Channel API',
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
    { accept: status === 'ACCEPTED' },
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

export async function fetchMessageConversation(
  token: string,
  messageId: string,
): Promise<ApiResult<{ conversationId: string }>> {
  const result = await apiGet<unknown>(
    `${API_BASE_URL}/messages/${messageId}/conversation`,
    token,
    'Message Conversation API',
  );

  if (!result.ok) {
    return result;
  }

  const record = result.data as Record<string, unknown>;
  const conversation = record.conversation as Record<string, unknown> | undefined;
  const conversationId =
    (typeof conversation?.id === 'string' ? conversation.id : null) ??
    (typeof record.conversationId === 'string' ? record.conversationId : null);

  if (!conversationId) {
    return { ok: false, error: 'Conversation id missing from server response.' };
  }

  return { ok: true, data: { conversationId } };
}
