import emojiData from 'unicode-emoji-json'

export interface EmojiEntry {
  emoji: string
  name: string
  group: string
}

type RawEmojiData = Record<string, { name: string; group: string }>

const raw = emojiData as RawEmojiData

/** Full emoji list with English names and categories. */
const ALL_EMOJIS: EmojiEntry[] = Object.entries(raw).map(([emoji, data]) => ({
  emoji,
  name: data.name,
  group: data.group,
}))

/** Searches emojis by English name. Returns matching entries. */
export function searchEmojis(query: string): EmojiEntry[] {
  if (!query.trim()) return ALL_EMOJIS
  const terms = query.toLowerCase().trim().split(/\s+/)
  return ALL_EMOJIS.filter(e => {
    const name = e.name.toLowerCase()
    return terms.every(t => name.includes(t))
  })
}
