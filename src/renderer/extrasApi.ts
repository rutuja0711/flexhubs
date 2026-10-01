import type { ApiResult } from '../shared/api';
import type {
  AiTextResult,
  CalendarEventItem,
  CalendarMentionableUser,
  CreateCalendarEventInput,
  UpdateCalendarEventInput,
  PushVapidKeyResult,
  ScheduledMessageItem,
} from '../shared/extras';
import type { SavedMessageItem } from '../shared/features';
import { getStoredToken } from './authApi';
import { uploadFileToApi } from './uploadApi';

function unavailable<T>(): ApiResult<T> {
  return { ok: false, error: 'Desktop API is not available.' };
}

async function withToken<T>(
  runner: (token: string) => Promise<ApiResult<T>>,
): Promise<ApiResult<T>> {
  const token = getStoredToken();

  if (!token) {
    return { ok: false, error: 'Not authenticated.', status: 401 };
  }

  return runner(token);
}

export async function loadCalendarMentionableUsers(): Promise<
  ApiResult<CalendarMentionableUser[]>
> {
  if (!window.electronAPI?.getCalendarMentionableUsers) {
    return unavailable();
  }

  return withToken((token) => window.electronAPI.getCalendarMentionableUsers(token));
}

export async function createCalendarEvent(
  input: CreateCalendarEventInput,
): Promise<ApiResult<CalendarEventItem>> {
  if (!window.electronAPI?.createCalendarEvent) {
    return unavailable();
  }

  return withToken((token) => window.electronAPI.createCalendarEvent(token, JSON.stringify(input)));
}

export async function updateCalendarEvent(
  input: UpdateCalendarEventInput,
): Promise<ApiResult<CalendarEventItem>> {
  if (!window.electronAPI?.updateCalendarEvent) {
    return unavailable();
  }

  return withToken((token) => window.electronAPI.updateCalendarEvent(token, JSON.stringify(input)));
}

export async function respondToCalendarEvent(
  eventId: string,
  accept: boolean,
): Promise<ApiResult<{ ok: true }>> {
  if (!window.electronAPI?.respondToCalendarEvent) {
    return unavailable();
  }

  return withToken((token) => window.electronAPI.respondToCalendarEvent(token, eventId, accept));
}

export async function deleteCalendarEvent(eventId: string): Promise<ApiResult<{ ok: true }>> {
  if (!window.electronAPI?.deleteCalendarEvent) {
    return unavailable();
  }

  return withToken((token) => window.electronAPI.deleteCalendarEvent(token, eventId));
}

export async function loadScheduledMessages(): Promise<ApiResult<ScheduledMessageItem[]>> {
  if (!window.electronAPI?.getScheduledMessages) {
    return unavailable();
  }

  return withToken((token) => window.electronAPI.getScheduledMessages(token));
}

export async function uploadChatFile(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<ApiResult<{ url: string }>> {
  return uploadFileToApi(file, onProgress);
}

export async function enhanceMessageText(text: string): Promise<ApiResult<AiTextResult>> {
  if (!window.electronAPI?.enhanceMessageText) {
    return unavailable();
  }

  return withToken((token) => window.electronAPI.enhanceMessageText(token, text));
}

export async function generateMessageText(description: string): Promise<ApiResult<AiTextResult>> {
  if (!window.electronAPI?.generateMessageText) {
    return unavailable();
  }

  return withToken((token) => window.electronAPI.generateMessageText(token, description));
}

export async function parseFlexCommand(
  input: string,
  conversationId?: string,
): Promise<ApiResult<AiTextResult>> {
  if (!window.electronAPI?.parseFlexCommand) {
    return unavailable();
  }

  return withToken((token) => window.electronAPI.parseFlexCommand(token, input, conversationId));
}

export async function transcribeAudioFile(
  fileName: string,
  mimeType: string,
  base64Data: string,
): Promise<ApiResult<AiTextResult>> {
  if (!window.electronAPI?.transcribeAudioFile) {
    return unavailable();
  }

  return withToken((token) =>
    window.electronAPI.transcribeAudioFile(token, fileName, mimeType, base64Data),
  );
}

export async function loadPushVapidPublicKey(): Promise<ApiResult<PushVapidKeyResult>> {
  if (!window.electronAPI?.getPushVapidPublicKey) {
    return unavailable();
  }

  return withToken((token) => window.electronAPI.getPushVapidPublicKey(token));
}

export async function subscribePushNotifications(
  subscription: PushSubscriptionJSON,
): Promise<ApiResult<{ ok: true }>> {
  if (!window.electronAPI?.subscribePushNotifications) {
    return unavailable();
  }

  return withToken((token) =>
    window.electronAPI.subscribePushNotifications(token, JSON.stringify(subscription)),
  );
}

export async function unsubscribePushEndpoint(endpoint: string): Promise<ApiResult<{ ok: true }>> {
  if (!window.electronAPI?.unsubscribePushEndpoint) {
    return unavailable();
  }

  return withToken((token) => window.electronAPI.unsubscribePushEndpoint(token, endpoint));
}

export async function deletePushSubscriptions(): Promise<ApiResult<{ ok: true }>> {
  if (!window.electronAPI?.deletePushSubscriptions) {
    return unavailable();
  }

  return withToken((token) => window.electronAPI.deletePushSubscriptions(token));
}

export async function loadSavedMessages(): Promise<ApiResult<SavedMessageItem[]>> {
  if (!window.electronAPI?.getSavedMessages) {
    return unavailable();
  }

  return withToken((token) => window.electronAPI.getSavedMessages(token));
}

export type { CalendarMentionableUser, CreateCalendarEventInput, ScheduledMessageItem };
