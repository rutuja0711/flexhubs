const draftContentByConversation = new Map<string, string>();
const inFlightDraftLoads = new Map<string, Promise<string>>();

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
  inFlightDraftLoads.delete(conversationId);
}

export function invalidateDraftCache(conversationId: string): void {
  clearDraftContentCache(conversationId);
}

/** Coalesce parallel GET draft requests for the same conversation (matches web draftCache). */
export function loadDraftContent(
  conversationId: string,
  fetcher: () => Promise<string>,
): Promise<string> {
  const existing = inFlightDraftLoads.get(conversationId);

  if (existing) {
    return existing;
  }

  const pending = fetcher()
    .then((content) => {
      const trimmed = content.trim();

      if (trimmed) {
        setDraftContentCache(conversationId, content);
      } else {
        draftContentByConversation.delete(conversationId);
      }

      return content;
    })
    .finally(() => {
      if (inFlightDraftLoads.get(conversationId) === pending) {
        inFlightDraftLoads.delete(conversationId);
      }
    });

  inFlightDraftLoads.set(conversationId, pending);
  return pending;
}