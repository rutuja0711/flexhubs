function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  return value as Record<string, unknown>;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export type CallLogOutcome = 'completed' | 'missed' | 'declined' | 'cancelled';

export type CallMediaEngine = 'mediasoup' | 'livekit' | string;

export type CallIceServer = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

export type CallTokenResult = {
  engine: CallMediaEngine;
  url: string;
  token: string;
  roomName: string;
  video: boolean;
  canModerateMeeting?: boolean;
  iceServers?: CallIceServer[];
  turnRelayRequired?: boolean;
  rtpCapabilities?: Record<string, unknown>;
};

export type FlexhubCallLog = {
  v: 1;
  callId: string;
  mode: 'audio' | 'video';
  outcome: CallLogOutcome;
  durationSec: number;
  initiatorId: string;
};

export type CallParticipant = {
  id: string;
  username: string;
  avatar: string | null;
};

export type CallInvitePayload = {
  callId: string;
  conversationId: string;
  roomName: string;
  caller: CallParticipant;
  video: boolean;
  sentAt: string;
};

function readCallParticipant(value: unknown): CallParticipant | null {
  const record = asRecord(value);

  if (!record) {
    return null;
  }

  const id = readString(record.id);
  const username = readString(record.username) ?? readString(record.name) ?? 'Caller';

  if (!id) {
    return null;
  }

  return {
    id,
    username,
    avatar: readString(record.avatar),
  };
}

export function normalizeCallInvitePayload(payload: unknown): CallInvitePayload | null {
  const record = asRecord(payload);

  if (!record) {
    return null;
  }

  const nested = asRecord(record.payload) ?? asRecord(record.data) ?? record;
  const caller =
    readCallParticipant(nested.caller) ??
    readCallParticipant(nested.startedBy) ??
    readCallParticipant(nested.peer) ??
    readCallParticipant(nested.from) ??
    (readString(nested.callerId)
      ? {
          id: readString(nested.callerId)!,
          username:
            readString(nested.callerName) ??
            readString(nested.callerUsername) ??
            readString(nested.fromName) ??
            'Caller',
          avatar:
            readString(nested.callerAvatar) ??
            readString(nested.fromAvatar) ??
            null,
        }
      : null);

  const callId = readString(nested.callId);
  const conversationId = readString(nested.conversationId);
  const roomName = readString(nested.roomName);

  if (!callId || !conversationId || !roomName || !caller) {
    return null;
  }

  return {
    callId,
    conversationId,
    roomName,
    caller,
    video: nested.video === true,
    sentAt: readString(nested.sentAt) ?? new Date().toISOString(),
  };
}

function readDirectCallSignalIds(record: Record<string, unknown>): {
  callId: string | null;
  conversationId: string | null;
} {
  const nested = asRecord(record.payload) ?? asRecord(record.data) ?? asRecord(record.message) ?? record;

  return {
    callId:
      readString(nested.callId) ??
      readString(nested.call_id) ??
      readString(nested.id),
    conversationId:
      readString(nested.conversationId) ??
      readString(nested.conversation_id),
  };
}

export function normalizeCallRejectPayload(payload: unknown): CallRejectPayload | null {
  const record = asRecord(payload);

  if (!record) {
    return null;
  }

  const { callId, conversationId } = readDirectCallSignalIds(record);

  if (!callId || !conversationId) {
    return null;
  }

  const nested = asRecord(record.payload) ?? asRecord(record.data) ?? record;
  const reasonRaw = readString(nested.reason)?.toLowerCase();

  return {
    callId,
    conversationId,
    reason: reasonRaw === 'busy' ? 'busy' : reasonRaw === 'declined' ? 'declined' : undefined,
  };
}

export function normalizeCallCancelPayload(payload: unknown): CallCancelPayload | null {
  const record = asRecord(payload);

  if (!record) {
    return null;
  }

  const { callId, conversationId } = readDirectCallSignalIds(record);

  if (!callId || !conversationId) {
    return null;
  }

  return { callId, conversationId };
}

export function parseMeetingNotificationBody(body: string): MeetingStartedPayload | null {
  const trimmed = body.trim();

  if (!trimmed.startsWith('__meeting__:')) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed.slice('__meeting__:'.length)) as unknown;
    const record = asRecord(parsed);
    const meeting = asRecord(record?.meeting);

    if (!meeting) {
      return null;
    }

    const callId = readString(meeting.callId);
    const conversationId = readString(meeting.conversationId);
    const roomName = readString(meeting.roomName);
    const startedBy = readCallParticipant(meeting.startedBy);

    if (!callId || !conversationId || !roomName || !startedBy) {
      return null;
    }

    return {
      callId,
      conversationId,
      roomName,
      conversationTitle: readString(meeting.conversationTitle) ?? 'Meeting',
      startedBy,
      video: meeting.video === true,
      startedAt: readString(meeting.startedAt) ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/** Human-readable text for notification bodies like `__meeting__:{...}` or call logs. */
export function formatNotificationDisplayBody(
  body: string,
  currentUserId: string | null = null,
): string {
  const trimmed = body.trim();

  const callLog = parseCallLogContent(trimmed);

  if (callLog) {
    return formatCallLogPreview(callLog, currentUserId);
  }

  if (!trimmed.startsWith('__meeting__:')) {
    return body;
  }

  try {
    const parsed = JSON.parse(trimmed.slice('__meeting__:'.length)) as unknown;
    const record = asRecord(parsed);
    const display = readString(record?.display);

    if (display) {
      return display;
    }

    const meeting = parseMeetingNotificationBody(body);

    if (meeting) {
      const mode = meeting.video ? 'video' : 'audio';
      return `${meeting.startedBy.username} started a ${mode} meeting in ${meeting.conversationTitle}`;
    }
  } catch {
    // fall through
  }

  return body;
}

export type CallAcceptPayload = {
  callId: string;
  conversationId: string;
  roomName: string;
  video: boolean;
  accepterId: string;
};

export function normalizeCallAcceptPayload(payload: unknown): CallAcceptPayload | null {
  const record = asRecord(payload);

  if (!record) {
    return null;
  }

  const nested = asRecord(record.payload) ?? asRecord(record.data) ?? record;
  const callId = readString(nested.callId);
  const conversationId = readString(nested.conversationId);
  const accepterId =
    readString(nested.accepterId) ??
    readString(nested.accepterUserId) ??
    readString(nested.acceptedBy);

  if (!callId || !conversationId || !accepterId) {
    return null;
  }

  return {
    callId,
    conversationId,
    roomName: readString(nested.roomName) ?? '',
    video: nested.video === true,
    accepterId,
  };
}

export type CallRejectPayload = {
  callId: string;
  conversationId: string;
  reason?: 'declined' | 'busy';
};

export type CallCancelPayload = {
  callId: string;
  conversationId: string;
};

export type CallEndPayload = {
  callId: string;
  conversationId: string;
  endedBy: string;
};

export type MeetingStartedPayload = {
  callId: string;
  conversationId: string;
  roomName: string;
  conversationTitle: string;
  startedBy: CallParticipant;
  video: boolean;
  startedAt: string;
};

export type MeetingEndedPayload = {
  callId: string;
  conversationId: string;
  endedBy: string;
};

export type MeetingJoinRequestItem = {
  id: string;
  conversationId: string;
  callId: string;
  requester: CallParticipant;
  requestedAt: string;
};

export type MeetingJoinRequestPayload = {
  requestId: string;
  conversationId: string;
  callId: string;
  requester: CallParticipant;
  requestedAt: string;
};

export type MeetingJoinResponsePayload = {
  requestId: string;
  conversationId: string;
  callId: string;
  requesterId: string;
  approved: boolean;
  respondedBy: CallParticipant;
  respondedAt: string;
};

function readApproved(value: unknown): boolean {
  if (value === true) {
    return true;
  }

  const record = asRecord(value);

  if (!record) {
    return false;
  }

  return record.approved === true || record.accepted === true || record.accept === true;
}

export function normalizeMeetingJoinRequestPayload(payload: unknown): MeetingJoinRequestPayload | null {
  const record = asRecord(payload);
  const nested = asRecord(record?.payload) ?? asRecord(record?.data) ?? asRecord(record?.request) ?? record;

  if (!nested) {
    return null;
  }

  const requestId =
    readString(nested.requestId) ?? readString(nested.id) ?? readString(nested.joinRequestId);
  const conversationId = readString(nested.conversationId);
  const callId = readString(nested.callId);
  const requester =
    readCallParticipant(nested.requester) ??
    readCallParticipant(nested.user) ??
    readCallParticipant(nested.from) ??
    (readString(nested.userId)
      ? {
          id: readString(nested.userId)!,
          username: readString(nested.username) ?? readString(nested.userName) ?? 'Member',
          avatar: readString(nested.avatar) ?? null,
        }
      : null);

  if (!conversationId || !callId || !requester) {
    return null;
  }

  return {
    requestId: requestId ?? `${requester.id}:${callId}`,
    conversationId,
    callId,
    requester,
    requestedAt: readString(nested.requestedAt) ?? readString(nested.createdAt) ?? new Date().toISOString(),
  };
}

export function normalizeMeetingJoinResponsePayload(payload: unknown): MeetingJoinResponsePayload | null {
  const record = asRecord(payload);
  const nested = asRecord(record?.payload) ?? asRecord(record?.data) ?? asRecord(record?.response) ?? record;

  if (!nested) {
    return null;
  }

  const requestId =
    readString(nested.requestId) ?? readString(nested.id) ?? readString(nested.joinRequestId);
  const conversationId = readString(nested.conversationId);
  const callId = readString(nested.callId);
  const requesterId =
    readString(nested.requesterId) ??
    readString(nested.userId) ??
    readCallParticipant(nested.requester)?.id ??
    null;
  const respondedById =
    readString(nested.respondedBy) ??
    readString(nested.respondedById) ??
    readCallParticipant(nested.respondedBy)?.id ??
    readCallParticipant(nested.moderator)?.id ??
    readCallParticipant(nested.by)?.id ??
    null;
  const respondedBy =
    readCallParticipant(nested.respondedBy) ??
    readCallParticipant(nested.moderator) ??
    readCallParticipant(nested.by) ??
    (respondedById
      ? {
          id: respondedById,
          username: readString(nested.respondedByName) ?? 'Host',
          avatar: readString(nested.respondedByAvatar) ?? null,
        }
      : null);

  if (!conversationId || !callId || !requesterId) {
    return null;
  }

  return {
    requestId: requestId ?? `${requesterId}:${callId}`,
    conversationId,
    callId,
    requesterId,
    approved: readApproved(nested),
    respondedBy: respondedBy ?? {
      id: respondedById ?? 'unknown',
      username: 'Host',
      avatar: null,
    },
    respondedAt: readString(nested.respondedAt) ?? readString(nested.createdAt) ?? new Date().toISOString(),
  };
}

export function normalizeMeetingJoinRequestList(payload: unknown): MeetingJoinRequestItem[] {
  const record = asRecord(payload);
  const items = extractArray(payload, ['requests', 'items', 'data', 'joinRequests']);

  return items
    .map((item) => normalizeMeetingJoinRequestPayload(item))
    .filter((item): item is MeetingJoinRequestPayload => item !== null)
    .map((item) => ({
      id: item.requestId,
      conversationId: item.conversationId,
      callId: item.callId,
      requester: item.requester,
      requestedAt: item.requestedAt,
    }));
}

function extractArray(payload: unknown, keys: string[]): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  const record = asRecord(payload);

  if (!record) {
    return [];
  }

  for (const key of keys) {
    const value = record[key];

    if (Array.isArray(value)) {
      return value;
    }
  }

  return [];
}

function normalizeIceServers(value: unknown): CallIceServer[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const servers = value
    .map((item) => {
      const record = asRecord(item);

      if (!record) {
        return null;
      }

      const urls = record.urls;

      if (typeof urls === 'string' && urls.trim()) {
        return {
          urls: urls.trim(),
          username: readString(record.username) ?? undefined,
          credential: readString(record.credential) ?? undefined,
        };
      }

      if (Array.isArray(urls)) {
        const normalizedUrls = urls.filter((entry): entry is string => typeof entry === 'string' && Boolean(entry.trim()));

        if (normalizedUrls.length === 0) {
          return null;
        }

        return {
          urls: normalizedUrls,
          username: readString(record.username) ?? undefined,
          credential: readString(record.credential) ?? undefined,
        };
      }

      return null;
    })
    .filter((item): item is CallIceServer => item !== null);

  return servers.length > 0 ? servers : undefined;
}

export function normalizeCallTokenResult(payload: unknown, requestedVideo: boolean): CallTokenResult | null {
  const record = asRecord(payload);

  if (!record) {
    return null;
  }

  const url = readString(record.url);
  const token = readString(record.token);
  const roomName = readString(record.roomName);

  if (!url || !token || !roomName) {
    return null;
  }

  const engine = readString(record.engine) ?? 'livekit';
  const rtpCapabilitiesRecord = asRecord(record.rtpCapabilities);

  return {
    engine,
    url,
    token,
    roomName,
    video: typeof record.video === 'boolean' ? record.video : requestedVideo,
    canModerateMeeting: record.canModerateMeeting === true,
    iceServers: normalizeIceServers(record.iceServers),
    turnRelayRequired: record.turnRelayRequired === true,
    rtpCapabilities: rtpCapabilitiesRecord ?? undefined,
  };
}

export function buildLiveKitRtcConfig(
  tokenResult: Pick<CallTokenResult, 'iceServers' | 'turnRelayRequired'>,
): RTCConfiguration | undefined {
  const iceServers = tokenResult.iceServers;

  if (!iceServers?.length && !tokenResult.turnRelayRequired) {
    return undefined;
  }

  const config: RTCConfiguration = {};

  if (iceServers?.length) {
    config.iceServers = iceServers.map((server) => ({
      urls: server.urls,
      username: server.username,
      credential: server.credential,
    }));
  }

  if (tokenResult.turnRelayRequired) {
    config.iceTransportPolicy = 'relay';
  }

  return config;
}

export function parseCallLogContent(content: string): FlexhubCallLog | null {
  const trimmed = content.trim();

  if (!trimmed.startsWith('{')) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    const record = asRecord(parsed);
    const callLog = asRecord(record?.flexhubCallLog) ?? record;

    if (!callLog) {
      return null;
    }

    const callId = readString(callLog.callId);
    const initiatorId = readString(callLog.initiatorId);
    const modeRaw = readString(callLog.mode);
    const outcomeRaw = readString(callLog.outcome);

    if (!callId || !initiatorId || !modeRaw || !outcomeRaw) {
      return null;
    }

    const mode = modeRaw === 'video' ? 'video' : 'audio';
    const outcome = outcomeRaw as CallLogOutcome;

    if (!['completed', 'missed', 'declined', 'cancelled'].includes(outcome)) {
      return null;
    }

    return {
      v: 1,
      callId,
      mode,
      outcome,
      durationSec: typeof callLog.durationSec === 'number' ? Math.max(0, callLog.durationSec) : 0,
      initiatorId,
    };
  } catch {
    return null;
  }
}

export function isCallLogMessage(
  message: Pick<{ content: string; messageType: string | null }, 'content' | 'messageType'>,
): boolean {
  if (parseCallLogContent(message.content)) {
    return true;
  }

  return String(message.messageType ?? '').toUpperCase() === 'CALL';
}

export function formatCallLogPreview(
  callLog: FlexhubCallLog,
  currentUserId: string | null,
): string {
  const modeLabel = callLog.mode === 'video' ? 'Video call' : 'Voice call';
  const isInitiator = currentUserId != null && callLog.initiatorId === currentUserId;

  switch (callLog.outcome) {
    case 'completed': {
      const mins = Math.floor(callLog.durationSec / 60);
      const secs = callLog.durationSec % 60;
      const duration = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
      return `${modeLabel} · ${duration}`;
    }
    case 'missed':
      return isInitiator ? `${modeLabel} · No answer` : `Missed ${callLog.mode === 'video' ? 'video' : 'voice'} call`;
    case 'declined':
      return isInitiator ? `${modeLabel} · Declined` : `${modeLabel} · Declined`;
    case 'cancelled':
      return `${modeLabel} · Cancelled`;
    default:
      return modeLabel;
  }
}

export function buildDirectCallRoomName(conversationId: string): string {
  return `dm-${conversationId}`;
}

export function buildHubCallRoomName(conversationId: string): string {
  return `hub-${conversationId}`;
}

export function buildUserCallChannel(userId: string): string {
  return `call:user:${userId}`;
}

export function buildHubCallChannel(conversationId: string): string {
  return `call:hub:${conversationId}`;
}

export function isMeetingModerator(session: {
  isGroup: boolean;
  isInitiator: boolean;
  canModerateMeeting?: boolean;
}): boolean {
  return session.isGroup && (session.isInitiator || session.canModerateMeeting === true);
}

export type CallHistoryItem = {
  id: string;
  callId: string;
  conversationId: string;
  messageId?: string;
  mode: 'audio' | 'video';
  outcome: CallLogOutcome;
  durationSec: number;
  initiatorId: string;
  initiatorName: string;
  peerName: string;
  conversationTitle?: string;
  createdAt: string;
};

function normalizeCallOutcome(value: unknown): CallLogOutcome {
  const raw = readString(value)?.toLowerCase();

  if (raw === 'completed' || raw === 'missed' || raw === 'declined' || raw === 'cancelled') {
    return raw;
  }

  return 'completed';
}

function normalizeCallHistoryItem(raw: unknown, index: number): CallHistoryItem | null {
  const record = asRecord(raw);

  if (!record) {
    return null;
  }

  const content = readString(record.content);
  const parsedLog = content ? parseCallLogContent(content) : null;
  const conversationRecord = asRecord(record.conversation);
  const sender = readCallParticipant(record.sender) ?? readCallParticipant(record.author);
  const initiator =
    readCallParticipant(record.initiator) ??
    readCallParticipant(record.startedBy) ??
    (parsedLog?.initiatorId && sender?.id === parsedLog.initiatorId ? sender : null) ??
    sender;
  const peer =
    readCallParticipant(record.peer) ??
    readCallParticipant(record.otherParticipant) ??
    readCallParticipant(record.participant) ??
    readCallParticipant(record.with) ??
    readCallParticipant(record.callee) ??
    readCallParticipant(record.caller);

  const callId =
    readString(record.callId) ??
    parsedLog?.callId ??
    readString(record.id) ??
    `call-${index}`;
  const conversationId =
    readString(record.conversationId) ?? readString(conversationRecord?.id) ?? '';
  const messageId = readString(record.messageId) ?? (parsedLog ? readString(record.id) ?? undefined : undefined);
  const video =
    record.video === true ||
    parsedLog?.mode === 'video' ||
    readString(record.mode)?.toLowerCase() === 'video';
  const mode = video ? 'video' : 'audio';
  const outcome = normalizeCallOutcome(record.outcome ?? parsedLog?.outcome);
  const durationSec =
    typeof record.durationSec === 'number'
      ? Math.max(0, record.durationSec)
      : parsedLog?.durationSec ?? 0;
  const initiatorId =
    readString(record.initiatorId) ??
    parsedLog?.initiatorId ??
    initiator?.id ??
    sender?.id ??
    '';
  const initiatorName =
    initiator?.username ??
    readString(record.initiatorName) ??
    readString(record.startedByName) ??
    sender?.username ??
    '';
  const conversationTitle =
    readString(record.conversationTitle) ??
    readString(conversationRecord?.title) ??
    readString(conversationRecord?.name) ??
    undefined;
  const peerName =
    peer?.username ??
    readString(record.peerName) ??
    readString(record.participantName) ??
    readString(record.withName) ??
    conversationTitle ??
    '';
  const createdAt =
    readString(record.createdAt) ??
    readString(record.startedAt) ??
    readString(record.timestamp) ??
    readString(record.loggedAt) ??
    readString(record.messageAt) ??
    '';

  const id = readString(record.id) ?? callId;

  if (!callId) {
    return null;
  }

  return {
    id,
    callId,
    conversationId,
    messageId,
    mode,
    outcome,
    durationSec,
    initiatorId,
    initiatorName,
    peerName,
    conversationTitle,
    createdAt: createdAt || new Date(0).toISOString(),
  };
}

export function normalizeCallHistoryList(payload: unknown): CallHistoryItem[] {
  const items = extractArray(payload, ['items', 'calls', 'history', 'data', 'results']);

  return items
    .map((item, index) => normalizeCallHistoryItem(item, index))
    .filter((item): item is CallHistoryItem => item !== null)
    .sort((left, right) => {
      const leftTime = Date.parse(left.createdAt);
      const rightTime = Date.parse(right.createdAt);

      if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) {
        return 0;
      }

      return rightTime - leftTime;
    });
}

export function formatCallHistoryTitle(item: Pick<CallHistoryItem, 'mode' | 'outcome' | 'durationSec'>): string {
  const modeLabel = item.mode === 'video' ? 'Video call' : 'Audio call';

  switch (item.outcome) {
    case 'completed': {
      if (item.durationSec > 0) {
        const mins = Math.floor(item.durationSec / 60);
        const secs = item.durationSec % 60;
        const duration = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
        return `${modeLabel} · ${duration}`;
      }

      return `${modeLabel} completed`;
    }
    case 'missed':
      return `Missed ${item.mode === 'video' ? 'video' : 'audio'} call`;
    case 'declined':
      return `${modeLabel} declined`;
    case 'cancelled':
      return `${modeLabel} cancelled`;
    default:
      return modeLabel;
  }
}

export function formatCallHistorySubtitle(
  item: Pick<CallHistoryItem, 'initiatorId' | 'initiatorName' | 'peerName' | 'conversationTitle'>,
  currentUserId: string | null,
): string {
  const starter =
    currentUserId && item.initiatorId === currentUserId
      ? 'you'
      : item.initiatorName.trim() || 'Someone';
  const peer = item.peerName.trim() || item.conversationTitle?.trim() || 'Unknown';

  return `Started by ${starter} - ${peer}`;
}
