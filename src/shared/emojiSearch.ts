import emojilib from 'emojilib/dist/emoji-en-US.json';
import { REACTION_EMOJI_CATEGORIES } from './reactionEmojis';

const CATALOG_EMOJIS = [
  ...new Set(REACTION_EMOJI_CATEGORIES.flatMap((category) => category.emojis)),
];

const CATALOG_LOOKUP = new Set<string>();

for (const emoji of CATALOG_EMOJIS) {
  CATALOG_LOOKUP.add(emoji);
  CATALOG_LOOKUP.add(stripEmojiVariation(emoji));
}

const EMOJI_KEYWORDS = buildEmojiKeywordIndex();

function stripEmojiVariation(value: string): string {
  return value.replace(/\uFE0F/g, '');
}

function isInCatalog(emoji: string): boolean {
  return CATALOG_LOOKUP.has(emoji) || CATALOG_LOOKUP.has(stripEmojiVariation(emoji));
}

function buildEmojiKeywordIndex(): Map<string, string[]> {
  const index = new Map<string, string[]>();
  const lib = emojilib as Record<string, string[]>;

  for (const [emoji, rawKeywords] of Object.entries(lib)) {
    if (!emoji || !Array.isArray(rawKeywords) || !isInCatalog(emoji)) {
      continue;
    }

    const tokens = rawKeywords.flatMap((keyword) => {
      const lower = keyword.toLowerCase();
      return [lower, lower.replace(/_/g, ' ')];
    });

    index.set(emoji, [...new Set(tokens)]);
    index.set(stripEmojiVariation(emoji), [...new Set(tokens)]);
  }

  for (const category of REACTION_EMOJI_CATEGORIES) {
    const categoryTokens = category.label.toLowerCase().split(/\s+/).filter(Boolean);

    for (const emoji of category.emojis) {
      const existing = index.get(emoji) ?? index.get(stripEmojiVariation(emoji)) ?? [];
      const merged = [...new Set([...existing, category.label.toLowerCase(), ...categoryTokens])];
      index.set(emoji, merged);
      index.set(stripEmojiVariation(emoji), merged);
    }
  }

  return index;
}

function scoreEmojiMatch(tokens: string[], queryTokens: string[]): number {
  if (queryTokens.length === 0) {
    return 0;
  }

  const haystack = tokens.join(' ');

  let score = 0;

  for (const token of queryTokens) {
    const exact = tokens.some((entry) => entry === token);
    const prefix = tokens.some((entry) => entry.startsWith(token));
    const includes = haystack.includes(token);

    if (exact) {
      score += 12;
    } else if (prefix) {
      score += 8;
    } else if (includes) {
      score += 4;
    } else {
      return 0;
    }
  }

  return score;
}

/**
 * Search the in-app emoji catalog by CLDR-style names and keywords (e.g. "heart", "pizza", "thumbs up").
 */
export function searchCatalogEmojis(query: string, limit = 160): string[] {
  const trimmed = query.trim().toLowerCase();

  if (!trimmed) {
    return [];
  }

  const queryTokens = trimmed.split(/\s+/).filter(Boolean);
  const scored: Array<{ emoji: string; score: number }> = [];

  for (const emoji of CATALOG_EMOJIS) {
    const tokens = EMOJI_KEYWORDS.get(emoji) ?? EMOJI_KEYWORDS.get(stripEmojiVariation(emoji));
    if (!tokens) {
      continue;
    }

    const score = scoreEmojiMatch(tokens, queryTokens);
    if (score > 0) {
      scored.push({ emoji, score });
    }
  }

  scored.sort((left, right) => right.score - left.score || left.emoji.localeCompare(right.emoji));

  return scored.slice(0, limit).map((entry) => entry.emoji);
}