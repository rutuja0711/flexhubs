# Calls & Meetings API

All REST endpoints require authentication (`Authorization: Bearer <token>`).

## Call token & logging

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/calls/token` | LiveKit / mediasoup join token |
| POST | `/api/calls/log` | Persist call outcome to chat history |
| POST | `/api/calls/meetings/notify` | Notify hub members a meeting started |

### POST `/api/calls/token`

```json
{
  "conversationId": "uuid",
  "video": true
}
```

Response includes `url`, `token`, `roomName`, `engine`, and optionally `canModerateMeeting`.

### POST `/api/calls/log`

```json
{
  "conversationId": "uuid",
  "callId": "uuid",
  "video": true,
  "outcome": "completed",
  "durationSec": 120,
  "initiatorId": "uuid"
}
```

`outcome`: `completed` | `missed` | `declined` | `cancelled`

### POST `/api/calls/meetings/notify`

```json
{
  "callId": "uuid",
  "conversationId": "uuid",
  "roomName": "hub-uuid",
  "conversationTitle": "General",
  "startedBy": { "id": "uuid", "username": "Alex", "avatar": null },
  "video": true,
  "startedAt": "2026-09-11T08:00:00.000Z"
}
```

## Group meeting moderation

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/calls/meetings/mute-participant` | Mute/unmute a participant |
| POST | `/api/calls/meetings/remove-participant` | Remove a participant |
| POST | `/api/calls/meetings/end` | End the meeting for everyone |

### POST `/api/calls/meetings/mute-participant`

```json
{
  "conversationId": "uuid",
  "participantIdentity": "user-id-or-livekit-identity",
  "muted": true
}
```

### POST `/api/calls/meetings/remove-participant`

```json
{
  "conversationId": "uuid",
  "participantIdentity": "user-id-or-livekit-identity"
}
```

### POST `/api/calls/meetings/end`

```json
{
  "conversationId": "uuid"
}
```

## Removed member rejoin

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/calls/meetings/join-request` | Request to rejoin after removal |
| GET | `/api/calls/meetings/join-requests?conversationId=` | List pending join requests |
| POST | `/api/calls/meetings/join-request/respond` | Approve or deny a request |

### POST `/api/calls/meetings/join-request`

```json
{
  "conversationId": "uuid",
  "callId": "uuid"
}
```

### POST `/api/calls/meetings/join-request/respond`

```json
{
  "conversationId": "uuid",
  "requestId": "uuid",
  "approved": true
}
```

## Realtime signaling

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/realtime/token` | Supabase Realtime access token |

### Channels

- Direct calls: `call:user:{userId}`
- Hub meetings: `call:hub:{conversationId}`

### Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `call:invite` | Direct | Outgoing ring |
| `call:accept` | Direct | Callee accepted |
| `call:reject` | Direct | Callee declined |
| `call:cancel` | Direct | Caller cancelled |
| `call:end` | Direct | Call ended |
| `call:meeting-started` | Hub | Meeting banner / notify |
| `call:meeting-ended` | Hub | Meeting closed |
| `call:meeting-join-request` | Hub | Removed user wants back in |
| `call:meeting-join-response` | Hub | Host approved/denied rejoin |

## Desktop integration

IPC handlers in `src/main.ts` mirror the REST endpoints above (`calls:token`, `calls:log`, `calls:notify-meeting`, `calls:mute-participant`, `calls:remove-participant`, `calls:end-meeting`, `calls:join-request`, `calls:join-requests`, `calls:join-request-respond`).

Renderer wrappers live in `src/renderer/callsApi.ts`. Meeting UI and moderation are handled by `useCallManager()` and `CallOverlay`.
