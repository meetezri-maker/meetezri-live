import emojiRegex from 'emoji-regex'
import { Fragment, useMemo } from 'react'

import { getFluentEmoji3dPngUrl } from '@/lib/fluentEmoji'
import { cn } from '@/app/components/ui/utils'

import { FluentEmoji } from '@/components/ui/FluentEmoji'

export interface EmojiTextProps {
  children: string
  emojiSize?: number
  className?: string
}

function splitWithEmoji(text: string): { type: 'text' | 'emoji'; value: string }[] {
  const re = emojiRegex()
  const parts: { type: 'text' | 'emoji'; value: string }[] = []
  let last = 0
  for (const m of text.matchAll(re)) {
    const idx = m.index ?? 0
    if (idx > last) {
      parts.push({ type: 'text', value: text.slice(last, idx) })
    }
    parts.push({ type: 'emoji', value: m[0] })
    last = idx + m[0].length
  }
  if (last < text.length) {
    parts.push({ type: 'text', value: text.slice(last) })
  }
  return parts
}

export function EmojiText({ children, emojiSize = 20, className }: EmojiTextProps) {
  const segments = useMemo(() => splitWithEmoji(children), [children])

  return (
    <span className={cn('inline align-baseline', className)}>
      {segments.map((seg, i) =>
        seg.type === 'text' ? (
          <Fragment key={`t-${i}-${seg.value.slice(0, 24)}`}>{seg.value}</Fragment>
        ) : getFluentEmoji3dPngUrl(seg.value) ? (
          <FluentEmoji key={`e-${i}-${seg.value}`} emoji={seg.value} size={emojiSize} className="mx-0.5" />
        ) : (
          <span key={`f-${i}-${seg.value}`} className="inline-block leading-none" role="img" aria-label={seg.value}>
            {seg.value}
          </span>
        ),
      )}
    </span>
  )
}
