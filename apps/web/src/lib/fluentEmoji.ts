import emojiData from 'fluentui-emoji-js/emojiData.json'

/** Pinned GitHub tree for stable CDN URLs (Microsoft Fluent Emoji). */
const CDN_BASE = 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets'

export interface FluentEmojiJsonEntry {
  glyph: string
  unicode: string
  folder: string
  images: {
    '3D': string[]
    Color: string[]
    Flat: string[]
    'High Contrast'?: string[]
  }
  emojiStyles: string[]
}

const data = emojiData as FluentEmojiJsonEntry[]

const glyphToEntry = new Map<string, FluentEmojiJsonEntry>()

for (const entry of data) {
  glyphToEntry.set(entry.glyph, entry)
  const stripped = entry.glyph.replace(/\uFE0F/g, '')
  if (stripped !== entry.glyph) {
    glyphToEntry.set(stripped, entry)
  }
}

function lookupEntry(glyph: string): FluentEmojiJsonEntry | undefined {
  let e = glyphToEntry.get(glyph)
  if (e) return e
  e = glyphToEntry.get(glyph + '\uFE0F')
  if (e) return e
  const trimmed = glyph.replace(/\uFE0F/g, '')
  if (trimmed !== glyph) {
    e = glyphToEntry.get(trimmed)
    if (e) return e
  }
  return undefined
}

/** Returns a CDN URL for the 3D Fluent PNG, or `null` if this app has no asset for the glyph. */
export function getFluentEmoji3dPngUrl(glyph: string): string | null {
  const entry = lookupEntry(glyph)
  const file = entry?.images['3D']?.[0]
  if (!entry || !file) return null
  const rel = `${entry.folder.replace(/^\//, '')}/3D/${file}`
  return encodeURI(`${CDN_BASE}/${rel}`)
}

export function hasFluentEmojiAsset(glyph: string): boolean {
  return Boolean(lookupEntry(glyph)?.images['3D']?.[0])
}
