export type ConversationScrollSnapshot = {
  scrollTop: number;
  stickToBottom: boolean;
};

const scrollByConversationId = new Map<string, ConversationScrollSnapshot>();

export function getConversationScrollSnapshot(
  conversationId: string,
): ConversationScrollSnapshot | undefined {
  return scrollByConversationId.get(conversationId);
}

const BOGUS_SCROLL_TOP_MAX_PX = 8;

export function normalizeConversationScrollSnapshot(
  snapshot: ConversationScrollSnapshot | null | undefined,
): ConversationScrollSnapshot | null {
  if (!snapshot) {
    return null;
  }

  if (snapshot.stickToBottom) {
    return snapshot;
  }

  // Virtuoso often emits scrollTop≈0 before layout in production; don't restore that as "read history at top".
  if (snapshot.scrollTop <= BOGUS_SCROLL_TOP_MAX_PX) {
    return null;
  }

  return snapshot;
}

export function setConversationScrollSnapshot(
  conversationId: string,
  snapshot: ConversationScrollSnapshot,
): void {
  if (!conversationId.trim()) {
    return;
  }

  if (!Number.isFinite(snapshot.scrollTop) || snapshot.scrollTop < 0) {
    return;
  }

  const normalized =
    snapshot.stickToBottom
      ? { scrollTop: snapshot.scrollTop, stickToBottom: true as const }
      : snapshot.scrollTop <= BOGUS_SCROLL_TOP_MAX_PX
        ? { scrollTop: 0, stickToBottom: true as const }
        : snapshot;

  scrollByConversationId.set(conversationId, {
    scrollTop: normalized.scrollTop,
    stickToBottom: normalized.stickToBottom,
  });
}

export function clearConversationScrollSnapshot(conversationId: string): void {
  scrollByConversationId.delete(conversationId);
}
