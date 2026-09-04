import { API_BASE_URL } from '../shared/api';
import type { ApiResult } from '../shared/api';
import type { NotificationItem, PendingFriendItem, TeammateItem } from '../shared/messages';
import {
  normalizeNotifications,
  normalizePendingFriends,
  normalizeTeammates,
} from '../shared/messages';
import { apiGet, apiPatch } from './apiRequest';

export type NotificationsPayload = {
  notifications: NotificationItem[];
};

export type PendingFriendsPayload = {
  pending: PendingFriendItem[];
};

export type TeammatesPayload = {
  members: TeammateItem[];
};

export async function fetchNotifications(token: string): Promise<ApiResult<NotificationsPayload>> {
  const result = await apiGet<unknown>(
    `${API_BASE_URL}/notifications`,
    token,
    'Notifications API',
  );

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    data: { notifications: normalizeNotifications(result.data) },
  };
}

export async function markAllNotificationsRead(token: string): Promise<ApiResult<{ ok: true }>> {
  const result = await apiPatch<unknown>(
    `${API_BASE_URL}/notifications/read-all`,
    token,
    'Notifications Read All API',
    {},
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: { ok: true } };
}

export async function fetchPendingFriends(
  token: string,
): Promise<ApiResult<PendingFriendsPayload>> {
  const result = await apiGet<unknown>(
    `${API_BASE_URL}/friends/pending`,
    token,
    'Pending Friends API',
  );

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    data: { pending: normalizePendingFriends(result.data) },
  };
}

export async function fetchOrganizationMembers(
  token: string,
): Promise<ApiResult<TeammatesPayload>> {
  const result = await apiGet<unknown>(
    `${API_BASE_URL}/users/organization-members`,
    token,
    'Organization Members API',
  );

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    data: { members: normalizeTeammates(result.data) },
  };
}
