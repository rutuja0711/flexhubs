import { API_BASE_URL } from '../shared/api';
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
import {
  normalizeAiTextResult,
  normalizeCalendarEventsDetailed,
  normalizeCalendarMentionableUsers,
  normalizeScheduledMessages,
  normalizeVapidPublicKey,
  sanitizeAiApiError,
} from '../shared/extras';
import { apiDelete, apiGet, apiPost, apiPatch } from './apiRequest';

async function apiDeleteWithBody<T>(
  url: string,
  token: string,
  label: string,
  body?: unknown,
): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    let data = {} as T & { error?: string };

    try {
      data = (await response.json()) as T & { error?: string };
    } catch {
      data = {} as T & { error?: string };
    }

    console.log(`[${label}] status:`, response.status);
    if (body !== undefined) {
      console.log(`[${label}] request:`, body);
    }
    console.log(`[${label}] response:`, data);

    if (!response.ok) {
      return {
        ok: false,
        error: data.error ?? 'Request failed. Please try again.',
        status: response.status,
      };
    }

    return { ok: true, data };
  } catch (error) {
    console.error(`[${label}] request failed:`, error);
    return {
      ok: false,
      error: 'Unable to reach the server. Check your connection and try again.',
    };
  }
}

export async function fetchCalendarEventsDetailed(
  token: string,
): Promise<ApiResult<CalendarEventItem[]>> {
  const result = await apiGet<unknown>(
    `${API_BASE_URL}/calendar/events`,
    token,
    'Calendar Events API',
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: normalizeCalendarEventsDetailed(result.data) };
}

export async function fetchCalendarEventById(
  token: string,
  eventId: string,
): Promise<ApiResult<CalendarEventItem>> {
  const result = await apiGet<unknown>(
    `${API_BASE_URL}/calendar/events/${eventId}`,
    token,
    'Calendar Event API',
  );

  if (!result.ok) {
    return result;
  }

  const events = normalizeCalendarEventsDetailed(result.data);
  const event = events[0] ?? normalizeCalendarEventsDetailed([result.data])[0];

  if (!event) {
    return { ok: false, error: 'Event not found.' };
  }

  return { ok: true, data: event };
}

export async function fetchCalendarMentionableUsers(
  token: string,
): Promise<ApiResult<CalendarMentionableUser[]>> {
  const result = await apiGet<unknown>(
    `${API_BASE_URL}/calendar/mentionable-users`,
    token,
    'Calendar Mentionable Users API',
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: normalizeCalendarMentionableUsers(result.data) };
}

export async function createCalendarEvent(
  token: string,
  input: CreateCalendarEventInput,
): Promise<ApiResult<CalendarEventItem>> {
  const payload: Record<string, unknown> = {
    title: input.title,
    startsAt: input.startsAt,
    description: input.description?.trim() ?? '',
    mentionUserIds: input.mentionUserIds ?? [],
  };

  if (input.conversationId) {
    payload.conversationId = input.conversationId;
  }

  if (input.conversationIds?.length) {
    payload.conversationIds = input.conversationIds;
  }

  if (input.mentionChannelIds?.length) {
    payload.mentionChannelIds = input.mentionChannelIds;
  } else if (input.channelIds?.length) {
    payload.channelIds = input.channelIds;
  }

  const result = await apiPost<unknown>(
    `${API_BASE_URL}/calendar/events`,
    token,
    'Create Calendar Event API',
    payload,
  );

  if (!result.ok) {
    return result;
  }

  const events = normalizeCalendarEventsDetailed(result.data);
  const event = events[0] ?? normalizeCalendarEventsDetailed([result.data])[0];

  if (!event) {
    return { ok: false, error: 'Event created but response was empty.' };
  }

  return { ok: true, data: event };
}

export async function updateCalendarEvent(
  token: string,
  input: UpdateCalendarEventInput,
): Promise<ApiResult<CalendarEventItem>> {
  const payload: Record<string, unknown> = {};
  if (input.title !== undefined) payload.title = input.title;
  if (input.startsAt !== undefined) payload.startsAt = input.startsAt;
  if (input.description !== undefined) {
    payload.description = (input.description ?? '').trim();
  }
  if (input.mentionUserIds !== undefined) {
    payload.mentionUserIds = input.mentionUserIds;
  }

  if (input.conversationId !== undefined) {
    payload.conversationId = input.conversationId;
  }

  if (input.conversationIds !== undefined) {
    payload.conversationIds = input.conversationIds;
  }

  if (input.mentionChannelIds !== undefined) {
    payload.mentionChannelIds = input.mentionChannelIds;
  } else if (input.channelIds !== undefined) {
    payload.channelIds = input.channelIds;
  }

  const result = await apiPatch<unknown>(
    `${API_BASE_URL}/calendar/events/${input.eventId}`,
    token,
    'Update Calendar Event API',
    payload,
  );

  if (!result.ok) {
    return result;
  }

  const events = normalizeCalendarEventsDetailed(result.data);
  const event = events[0] ?? normalizeCalendarEventsDetailed([result.data])[0];

  if (!event) {
    return { ok: false, error: 'Event updated but response was empty.' };
  }

  return { ok: true, data: event };
}

export async function respondToCalendarEvent(
  token: string,
  eventId: string,
  accept: boolean,
): Promise<ApiResult<{ ok: true }>> {
  const result = await apiPost<unknown>(
    `${API_BASE_URL}/calendar/events/${eventId}/respond`,
    token,
    'Respond Calendar Event API',
    { accept },
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: { ok: true } };
}

export async function deleteCalendarEvent(
  token: string,
  eventId: string,
): Promise<ApiResult<{ ok: true }>> {
  const result = await apiDelete<unknown>(
    `${API_BASE_URL}/calendar/events/${eventId}`,
    token,
    'Delete Calendar Event API',
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: { ok: true } };
}

export async function fetchScheduledMessages(
  token: string,
): Promise<ApiResult<ScheduledMessageItem[]>> {
  const result = await apiGet<unknown>(
    `${API_BASE_URL}/scheduled-messages`,
    token,
    'Scheduled Messages API',
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: normalizeScheduledMessages(result.data) };
}

export async function enhanceMessageText(
  token: string,
  text: string,
): Promise<ApiResult<AiTextResult>> {
  const result = await apiPost<unknown>(
    `${API_BASE_URL}/ai/enhance`,
    token,
    'AI Enhance API',
    { text },
  );

  if (!result.ok) {
    return { ...result, error: sanitizeAiApiError(result.error) };
  }

  return { ok: true, data: normalizeAiTextResult(result.data) };
}

export async function generateMessageText(
  token: string,
  description: string,
): Promise<ApiResult<AiTextResult>> {
  const result = await apiPost<unknown>(
    `${API_BASE_URL}/ai/generate`,
    token,
    'AI Generate API',
    { description },
  );

  if (!result.ok) {
    return { ...result, error: sanitizeAiApiError(result.error) };
  }

  return { ok: true, data: normalizeAiTextResult(result.data) };
}

export async function parseFlexCommand(
  token: string,
  input: string,
  conversationId?: string,
): Promise<ApiResult<AiTextResult>> {
  const result = await apiPost<unknown>(
    `${API_BASE_URL}/ai/flex-command`,
    token,
    'AI Flex Command API',
    {
      input,
      ...(conversationId ? { conversationId } : {}),
    },
  );

  if (!result.ok) {
    return { ...result, error: sanitizeAiApiError(result.error) };
  }

  return { ok: true, data: normalizeAiTextResult(result.data) };
}

export async function transcribeAudioFile(
  token: string,
  fileName: string,
  mimeType: string,
  base64Data: string,
): Promise<ApiResult<AiTextResult>> {
  try {
    const buffer = Buffer.from(base64Data, 'base64');
    const blob = new Blob([buffer], { type: mimeType || 'application/octet-stream' });
    const formData = new FormData();
    formData.append('file', blob, fileName);

    const response = await fetch(`${API_BASE_URL}/ai/transcribe`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    let data = {} as Record<string, unknown> & { error?: string };

    try {
      data = (await response.json()) as Record<string, unknown> & { error?: string };
    } catch {
      data = {};
    }

    console.log('[AI Transcribe API] status:', response.status);
    console.log('[AI Transcribe API] response:', data);

    if (!response.ok) {
      const message =
        typeof data.error === 'string'
          ? data.error
          : typeof data.message === 'string'
            ? data.message
            : 'Transcription failed. Please try again.';
      return {
        ok: false,
        error: sanitizeAiApiError(message),
        status: response.status,
      };
    }

    const normalized = normalizeAiTextResult(data.data ?? data.result ?? data);
    if (!normalized.text.trim()) {
      return {
        ok: false,
        error: 'No transcription returned.',
        status: response.status,
      };
    }

    return { ok: true, data: normalized };
  } catch (error) {
    console.error('[AI Transcribe API] request failed:', error);
    return {
      ok: false,
      error: 'Unable to reach the server. Check your connection and try again.',
    };
  }
}

export async function fetchPushVapidPublicKey(
  token: string,
): Promise<ApiResult<PushVapidKeyResult>> {
  const result = await apiGet<unknown>(
    `${API_BASE_URL}/push/vapid-public-key`,
    token,
    'Push VAPID Key API',
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: normalizeVapidPublicKey(result.data) };
}

export async function subscribePushNotifications(
  token: string,
  subscription: unknown,
): Promise<ApiResult<{ ok: true }>> {
  const result = await apiPost<unknown>(
    `${API_BASE_URL}/push/subscribe`,
    token,
    'Push Subscribe API',
    subscription,
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: { ok: true } };
}

export async function unsubscribePushEndpoint(
  token: string,
  endpoint: string,
): Promise<ApiResult<{ ok: true }>> {
  const result = await apiDeleteWithBody<unknown>(
    `${API_BASE_URL}/push/subscribe`,
    token,
    'Push Unsubscribe API',
    { endpoint },
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: { ok: true } };
}

export async function deletePushSubscriptions(
  token: string,
): Promise<ApiResult<{ ok: true }>> {
  const result = await apiDelete<unknown>(
    `${API_BASE_URL}/push/subscriptions`,
    token,
    'Push Subscriptions Delete API',
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: { ok: true } };
}
