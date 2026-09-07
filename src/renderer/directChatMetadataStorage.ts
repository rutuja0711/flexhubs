import type { DirectChatMetadata } from '../shared/chat';
import { isBrokenDirectTitle } from '../shared/chat';

const STORAGE_KEY = 'flexhubs:directChatMetadata';

function isDirectChatMetadata(value: unknown): value is DirectChatMetadata {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  return typeof record.peerUserId === 'string' && typeof record.displayName === 'string';
}

export function readPersistedDirectChatMetadata(): Record<string, DirectChatMetadata> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as unknown;

    if (!parsed || typeof parsed !== 'object') {
      return {};
    }

    const next: Record<string, DirectChatMetadata> = {};

    for (const [conversationId, value] of Object.entries(parsed)) {
      if (!isDirectChatMetadata(value)) {
        continue;
      }

      if (isBrokenDirectTitle(value.displayName)) {
        continue;
      }

      next[conversationId] = value;
    }

    return next;
  } catch {
    return {};
  }
}

export function writePersistedDirectChatMetadata(
  metadata: Record<string, DirectChatMetadata>,
): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(metadata));
  } catch {
    // Ignore storage quota or private mode errors.
  }
}

export function readPlanComplianceDismissed(): boolean {
  try {
    return sessionStorage.getItem('flexhubs:planComplianceDismissed') === '1';
  } catch {
    return false;
  }
}

export function writePlanComplianceDismissed(dismissed: boolean): void {
  try {
    if (dismissed) {
      sessionStorage.setItem('flexhubs:planComplianceDismissed', '1');
    } else {
      sessionStorage.removeItem('flexhubs:planComplianceDismissed');
    }
  } catch {
    // Ignore storage errors.
  }
}
