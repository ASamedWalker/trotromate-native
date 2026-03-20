export const REACTION_EMOJIS = [
  { emoji: '👍', label: 'Helpful' },
  { emoji: '❤️', label: 'Love' },
  { emoji: '😂', label: 'Funny' },
  { emoji: '🚨', label: 'Safety' },
  { emoji: '💯', label: 'Accurate' },
  { emoji: '👀', label: 'Interesting' },
] as const

export type ReactionEmoji = (typeof REACTION_EMOJIS)[number]['emoji']
