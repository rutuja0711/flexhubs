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

  scrollByConversationId.set(conversationId, {
    scrollTop: snapshot.scrollTop,
    stickToBottom: snapshot.stickToBottom,
  });
}

export function clearConversationScrollSnapshot(conversationId: string): void {
  scrollByConversationId.delete(conversationId);
}
