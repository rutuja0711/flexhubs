import { API_BASE_URL } from '../shared/api';
import type { ApiResult } from '../shared/api';
import {
  normalizeCallTokenResult,
  normalizeMeetingJoinRequestList,
  type CallLogOutcome,
  type CallTokenResult,
  type MeetingJoinRequestItem,
} from '../shared/calls';
import { apiGet, apiPost } from './apiRequest';

type CallTokenBody = {
  conversationId?: string;
  roomName?: string;
  video: boolean;
};

export async function fetchCallToken(
  token: string,
  body: CallTokenBody,
): Promise<ApiResult<CallTokenResult>> {
  const requestBody: CallTokenBody = {
    video: body.video,
  };

  if (body.conversationId?.trim()) {
    requestBody.conversationId = body.conversationId.trim();
  } else if (body.roomName?.trim()) {
    requestBody.roomName = body.roomName.trim();
  }

  console.log('[Call Token API] request:', requestBody);

  const result = await apiPost<unknown>(
    `${API_BASE_URL}/calls/token`,
    token,
    'Call Token API',
    requestBody,
  );

  if (!result.ok) {
    return result;
  }

  const normalized = normalizeCallTokenResult(result.data, body.video);

  if (!normalized) {
    return {
      ok: false,
      error: 'Call token response was missing url, token, or roomName.',
    };
  }

  return { ok: true, data: normalized };
}

export async function logCallHistory(
  token: string,
  payload: {
    conversationId: string;
    callId: string;
    video: boolean;
    outcome: CallLogOutcome;
    durationSec: number;
    initiatorId: string;
  },
): Promise<ApiResult<{ message?: unknown }>> {
  return apiPost<{ message?: unknown }>(
    `${API_BASE_URL}/calls/log`,
    token,
    'Call Log API',
    payload,
  );
}

export async function notifyGroupMeeting(
  token: string,
  payload: {
    callId: string;
    conversationId: string;
    roomName: string;
    conversationTitle: string;
    startedBy: { id: string; username: string; avatar: string | null };
    video: boolean;
    startedAt: string;
  },
): Promise<ApiResult<{ notified?: number }>> {
  return apiPost<{ notified?: number }>(
    `${API_BASE_URL}/calls/meetings/notify`,
    token,
    'Call Meeting Notify API',
    payload,
  );
}

export async function muteMeetingParticipant(
  token: string,
  conversationId: string,
  participantIdentity: string,
  muted: boolean,
): Promise<ApiResult<{ muted?: boolean }>> {
  return apiPost<{ muted?: boolean }>(
    `${API_BASE_URL}/calls/meetings/mute-participant`,
    token,
    'Call Mute Participant API',
    { conversationId, participantIdentity, muted },
  );
}

export async function removeMeetingParticipant(
  token: string,
  conversationId: string,
  participantIdentity: string,
): Promise<ApiResult<{ removed?: boolean }>> {
  return apiPost<{ removed?: boolean }>(
    `${API_BASE_URL}/calls/meetings/remove-participant`,
    token,
    'Call Remove Participant API',
    { conversationId, participantIdentity },
  );
}

export async function endGroupMeeting(
  token: string,
  conversationId: string,
): Promise<ApiResult<{ ended?: boolean }>> {
  return apiPost<{ ended?: boolean }>(
    `${API_BASE_URL}/calls/meetings/end`,
    token,
    'Call End Meeting API',
    { conversationId },
  );
}

export async function requestMeetingJoin(
  token: string,
  payload: { conversationId: string; callId?: string },
): Promise<ApiResult<unknown>> {
  return apiPost<unknown>(
    `${API_BASE_URL}/calls/meetings/join-request`,
    token,
    'Call Meeting Join Request API',
    payload,
  );
}

export async function fetchMeetingJoinRequests(
  token: string,
  conversationId: string,
): Promise<ApiResult<MeetingJoinRequestItem[]>> {
  const result = await apiGet<unknown>(
    `${API_BASE_URL}/calls/meetings/join-requests?conversationId=${encodeURIComponent(conversationId)}`,
    token,
    'Call Meeting Join Requests API',
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: normalizeMeetingJoinRequestList(result.data) };
}

export async function respondMeetingJoinRequest(
  token: string,
  payload: {
    conversationId: string;
    participantIdentity: string;
    callId: string;
    accept: boolean;
  },
): Promise<ApiResult<unknown>> {
  return apiPost<unknown>(
    `${API_BASE_URL}/calls/meetings/join-request/respond`,
    token,
    'Call Meeting Join Respond API',
    payload,
  );
}

export async function fetchCallHistory(
  token: string,
  filter: 'all' | 'missed' = 'all',
): Promise<ApiResult<unknown>> {
  return apiGet<unknown>(
    `${API_BASE_URL}/calls/history?filter=${encodeURIComponent(filter)}`,
    token,
    'Call History API',
  );
}

export async function declineMeetingInvite(
  token: string,
  payload: {
    conversationId: string;
    callId: string;
  },
): Promise<ApiResult<unknown>> {
  return apiPost<unknown>(
    `${API_BASE_URL}/calls/meetings/decline-invite`,
    token,
    'Call Decline Invite API',
    payload,
  );
}

export async function fetchDeclinedMeetingInvites(
  token: string,
  conversationId: string,
  callId: string,
): Promise<ApiResult<unknown>> {
  return apiGet<unknown>(
    `${API_BASE_URL}/calls/meetings/declined-invites?conversationId=${encodeURIComponent(conversationId)}&callId=${encodeURIComponent(callId)}`,
    token,
    'Call Declined Invites API',
  );
}
