// ─── Noelaven Reaction System ─────────────────────────────────────────────────

export interface Reaction {
  emoji: string;
  label: string;
  category: 'positive' | 'thoughtful';
}

export const REACTIONS: Reaction[] = [
  // ── Positive ───────────────────────────────────────────────────────────────
  { emoji: '🌊', label: 'Vibe',                    category: 'positive' },
  { emoji: '💜', label: 'Noelove',                 category: 'positive' },
  { emoji: '❤️', label: 'Love',                   category: 'positive' },
  { emoji: '✨', label: 'Inspired',               category: 'positive' },
  { emoji: '🔥', label: 'Fire',                   category: 'positive' },
  { emoji: '🤩', label: 'Obsessed',               category: 'positive' },
  { emoji: '👏', label: 'Applause',               category: 'positive' },
  { emoji: '🫶', label: 'Support',                category: 'positive' },
  { emoji: '🥹', label: 'Heartfelt',              category: 'positive' },
  { emoji: '😂', label: 'Laugh',                  category: 'positive' },
  { emoji: '😮', label: 'Wow',                    category: 'positive' },
  { emoji: '💯', label: 'Facts',                  category: 'positive' },
  // ── Thoughtful ─────────────────────────────────────────────────────────────
  { emoji: '🤔', label: 'Interesting',            category: 'thoughtful' },
  { emoji: '💭', label: 'Makes Me Think',         category: 'thoughtful' },
  { emoji: '👀', label: 'Following',              category: 'thoughtful' },
  { emoji: '📌', label: 'Worth Saving',           category: 'thoughtful' },
  { emoji: '❓', label: 'Curious',               category: 'thoughtful' },
  { emoji: '🤝', label: 'Respectfully Disagree',  category: 'thoughtful' },
  { emoji: '🔄', label: 'Different Perspective',  category: 'thoughtful' },
  { emoji: '🧠', label: 'Thought Provoking',      category: 'thoughtful' },
];

export const DEFAULT_REACTION = REACTIONS[0]; // 🌊 Vibe
export const POSITIVE_REACTIONS  = REACTIONS.filter(r => r.category === 'positive');
export const THOUGHTFUL_REACTIONS = REACTIONS.filter(r => r.category === 'thoughtful');

export function getLabelForEmoji(emoji: string): string {
  return REACTIONS.find(r => r.emoji === emoji)?.label ?? emoji;
}

export function getReactionForEmoji(emoji: string): Reaction | undefined {
  return REACTIONS.find(r => r.emoji === emoji);
}

/** Top N reactions sorted by count descending */
export function getTopReactions(
  reactions: Record<string, string[]>,
  n = 3,
): Array<{ emoji: string; count: number; label: string }> {
  return Object.entries(reactions)
    .filter(([, users]) => users.length > 0)
    .map(([emoji, users]) => ({ emoji, count: users.length, label: getLabelForEmoji(emoji) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}

/** Sum all reaction counts */
export function totalReactionCount(reactions: Record<string, string[]>): number {
  return Object.values(reactions).reduce((n, arr) => n + arr.length, 0);
}

/** Return the emoji the given userId has reacted with, or null */
export function myReactionEmoji(
  reactions: Record<string, string[]>,
  userId: string,
): string | null {
  for (const [emoji, users] of Object.entries(reactions)) {
    if (users.includes(userId)) return emoji;
  }
  return null;
}

/** Human-readable past-tense phrase for notification messages */
export function reactionPhrase(emoji: string): string {
  const label = getLabelForEmoji(emoji);
  const overrides: Record<string, string> = {
    'Vibe':                    'Vibed',
    'Noelove':                 'Noeloved',
    'Love':                    'Loved',
    'Inspired':                'was Inspired by',
    'Fire':                    'Fired up on',
    'Obsessed':                'is Obsessed with',
    'Applause':                'Applauded',
    'Support':                 'Supported',
    'Heartfelt':               'felt Heartfelt about',
    'Laugh':                   'Laughed at',
    'Wow':                     'was Wowed by',
    'Facts':                   'said Facts on',
    'Interesting':             'found Interesting',
    'Makes Me Think':          'said Makes Me Think about',
    'Following':               'is Following',
    'Worth Saving':            'marked Worth Saving',
    'Curious':                 'is Curious about',
    'Respectfully Disagree':   'Respectfully Disagreed with',
    'Different Perspective':   'shared a Different Perspective on',
    'Thought Provoking':       'found Thought Provoking',
  };
  return overrides[label] ?? label;
}
