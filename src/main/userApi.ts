import { API_BASE_URL } from '../shared/api';
import type { ApiResult } from '../shared/api';
import {
  buildProfileUpdatePayload,
  buildNotificationSettingsPayload,
  extractUploadUrl,
  normalizeAvatarStyles,
  normalizeNotificationSettings,
  normalizeOrganizationMembers,
  normalizeUploadUrl,
  type AvatarStyleItem,
  type OrganizationMemberItem,
  type ProfileSettings,
  type UserPresenceStatus,
} from '../shared/profile';
import { apiGet, apiPatch, apiPostForm } from './apiRequest';

export async function fetchAvatarStyles(token: string): Promise<ApiResult<AvatarStyleItem[]>> {
  const result = await apiGet<unknown>(
    `${API_BASE_URL}/avatars/styles`,
    token,
    'Avatar Styles API',
  );

  if (!result.ok) {
    return result;
  }

  const styles = normalizeAvatarStyles(result.data);

  if (styles.length === 0) {
    return {
      ok: true,
      data: [
        { id: 'notionists', name: 'Notionists', previewUrl: 'https://api.dicebear.com/7.x/notionists/svg?seed=flexhubs' },
        { id: 'thumbs', name: 'Thumbs', previewUrl: 'https://api.dicebear.com/7.x/thumbs/svg?seed=flexhubs' },
        { id: 'bottts', name: 'Bottts', previewUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=flexhubs' },
        { id: 'avataaars', name: 'Avataaars', previewUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=flexhubs' },
      ],
    };
  }

  return { ok: true, data: styles };
}

export async function fetchNotificationSettings(
  token: string,
): Promise<ApiResult<ProfileSettings>> {
  const result = await apiGet<unknown>(
    `${API_BASE_URL}/users/notification-settings`,
    token,
    'Notification Settings API',
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: normalizeNotificationSettings(result.data) };
}

export async function updateNotificationSettings(
  token: string,
  updates: import('../shared/profile').NotificationPreferenceUpdate,
): Promise<ApiResult<ProfileSettings>> {
  const result = await apiPatch<unknown>(
    `${API_BASE_URL}/users/notification-settings`,
    token,
    'Update Notification Settings API',
    buildNotificationSettingsPayload(updates),
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: normalizeNotificationSettings(result.data) };
}

export async function updateUserProfile(
  token: string,
  updates: Record<string, unknown>,
): Promise<ApiResult<unknown>> {
  return apiPatch<unknown>(
    `${API_BASE_URL}/users/profile`,
    token,
    'Update Profile API',
    buildProfileUpdatePayload(updates),
  );
}

export async function updateUserStatus(
  token: string,
  updates: { status?: UserPresenceStatus; message?: string },
): Promise<ApiResult<{ ok: true }>> {
  const payload: Record<string, unknown> = {};

  if (updates.status) {
    payload.status = updates.status;
    payload.presenceStatus = updates.status;
  }

  if (updates.message !== undefined) {
    payload.message = updates.message;
    payload.statusMessage = updates.message;
    payload.customStatus = updates.message;
  }

  const result = await apiPatch<unknown>(
    `${API_BASE_URL}/users/status`,
    token,
    'Update User Status API',
    payload,
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: { ok: true } };
}

export async function updateUserTimezone(
  token: string,
  timezone: string,
): Promise<ApiResult<{ ok: true }>> {
  const result = await apiPatch<unknown>(
    `${API_BASE_URL}/users/timezone`,
    token,
    'Update Timezone API',
    { timezone },
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: { ok: true } };
}

export async function fetchOrganizationMembersDetailed(
  token: string,
): Promise<ApiResult<OrganizationMemberItem[]>> {
  const adminResult = await apiGet<unknown>(
    `${API_BASE_URL}/organizations/members`,
    token,
    'Organization Members API',
  );

  if (adminResult.ok) {
    return { ok: true, data: normalizeOrganizationMembers(adminResult.data) };
  }

  const sidebarResult = await apiGet<unknown>(
    `${API_BASE_URL}/users/organization-members`,
    token,
    'Organization Members API',
  );

  if (!sidebarResult.ok) {
    return sidebarResult;
  }

  return { ok: true, data: normalizeOrganizationMembers(sidebarResult.data) };
}

export async function uploadProfileImage(
  token: string,
  fileName: string,
  mimeType: string,
  base64Data: string,
): Promise<ApiResult<{ url: string }>> {
  const result = await apiPostForm<unknown>(
    `${API_BASE_URL}/upload`,
    token,
    'Upload API',
    fileName,
    mimeType,
    base64Data,
  );

  if (!result.ok) {
    return result;
  }

  const url = extractUploadUrl(result.data);

  if (!url) {
    return {
      ok: false,
      error: 'Upload succeeded but no file URL was returned.',
    };
  }

  return { ok: true, data: { url: normalizeUploadUrl(url) } };
}

export async function fetchUserById(token: string, userId: string): Promise<ApiResult<unknown>> {
  return apiGet<unknown>(`${API_BASE_URL}/users/${userId}`, token, 'User Profile API');
}
