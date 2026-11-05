const draftContentByConversation = new Map<string, string>();

export function peekDraftContent(conversationId: string): string | undefined {
  return draftContentByConversation.get(conversationId);
}

export function setDraftContentCache(conversationId: string, content: string | null | undefined): void {
  const trimmed = content?.trim();

  if (!trimmed) {
    draftContentByConversation.delete(conversationId);
    return;
  }

  draftContentByConversation.set(conversationId, content ?? trimmed);
}

export function clearDraftContentCache(conversationId: string): void {
  draftContentByConversation.delete(conversationId);
}
