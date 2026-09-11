const RECENT_EMOJIS_KEY = 'flexhubs-recent-emojis';
const MAX_RECENT_EMOJIS = 24;

export function readRecentEmojis(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_EMOJIS_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item): item is string => typeof item === 'string').slice(0, MAX_RECENT_EMOJIS);
  } catch {
    return [];
  }
}

export function rememberRecentEmoji(emoji: string): string[] {
  const trimmed = emoji.trim();

  if (!trimmed) {
    return readRecentEmojis();
  }

  const next = [trimmed, ...readRecentEmojis().filter((item) => item !== trimmed)].slice(
    0,
    MAX_RECENT_EMOJIS,
  );

  localStorage.setItem(RECENT_EMOJIS_KEY, JSON.stringify(next));
  return next;
}
