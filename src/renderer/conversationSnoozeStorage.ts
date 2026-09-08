const STORAGE_KEY = 'flexhubs.conversation.snooze.v2';

function isBooleanRecord(value: unknown): value is Record<string, boolean> {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return Object.values(value).every((entry) => typeof entry === 'boolean');
}

export function readPersistedConversationSnooze(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as unknown;

    if (!isBooleanRecord(parsed)) {
      return {};
    }

    return parsed;
  } catch {
    return {};
  }
}

export function writePersistedConversationSnooze(conversationId: string, snoozed: boolean): void {
  const next = { ...readPersistedConversationSnooze() };

  if (snoozed) {
    next[conversationId] = true;
  } else {
    delete next[conversationId];
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore quota / private-mode failures; in-memory state still applies.
  }
}
