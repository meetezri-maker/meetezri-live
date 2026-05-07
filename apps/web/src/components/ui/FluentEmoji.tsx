import { getFluentEmoji3dPngUrl } from '@/lib/fluentEmoji'
import { cn } from '@/app/components/ui/utils'

export interface FluentEmojiProps {
  emoji: string
  /** Width and height in pixels. Default 24 */
  size?: number
  className?: string
  /** Sets img `alt` when a URL exists; when missing and no URL, used as aria-label on the fallback span */
  label?: string
}

export function FluentEmoji({ emoji, size = 24, className, label }: FluentEmojiProps) {
  const url = getFluentEmoji3dPngUrl(emoji)
  if (!url) {
    return (
      <span
        className={cn('inline-block leading-none', className)}
        role="img"
        aria-label={label ?? emoji}
        style={{ fontSize: size }}
      >
        {emoji}
      </span>
    )
  }
  return (
    <img
      src={url}
      alt={label ?? ''}
      className={cn('inline-block shrink-0 select-none align-[-0.2em]', className)}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
    />
  )
}
