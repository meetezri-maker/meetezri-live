/**
 * Inline editor boundary.
 *
 * The ONLY module the rest of the Content Hub imports for rich text. It lazy-loads
 * `TipTapInlineEditor`, which is the single file that imports TipTap — so ProseMirror stays in
 * the `vendor-editor` chunk and never reaches the public site, the member app, or any admin
 * screen that does not open the editor.
 *
 * Importing `TipTapInlineEditor` directly anywhere else would defeat that; an architecture test
 * asserts this file is the only importer.
 */

import { Suspense, lazy } from 'react';
import type { InlineContent } from '@meetezri/shared';
import { cn } from '@/lib/utils';

const TipTapInlineEditor = lazy(() => import('./TipTapInlineEditor'));

export interface InlineEditorProps {
  value: InlineContent;
  onChange: (next: InlineContent) => void;
  placeholder?: string;
  singleLine?: boolean;
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
}

/** Same height as the loaded editor, so the layout does not jump when the chunk arrives. */
function InlineEditorFallback({ ariaLabel }: { ariaLabel: string }) {
  return (
    <div
      className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-[var(--admin-text-muted)]"
      role="status"
      aria-label={`${ariaLabel} — loading editor`}
    >
      Loading editor…
    </div>
  );
}

export function InlineEditor(props: InlineEditorProps) {
  return (
    <Suspense fallback={<InlineEditorFallback ariaLabel={props.ariaLabel} />}>
      <TipTapInlineEditor {...props} />
    </Suspense>
  );
}

/** Read-only inline rendering — used by block previews and summaries, with no editor loaded. */
export function InlineText({ content, className }: { content: InlineContent | undefined; className?: string }) {
  if (!Array.isArray(content) || content.length === 0) {
    return <span className={cn('text-[var(--admin-text-muted)]', className)}>Empty</span>;
  }

  return (
    <span className={className}>
      {content.map((span, index) => {
        const marks = span.marks ?? [];
        let node: React.ReactNode = span.text;
        if (marks.includes('code')) node = <code key={`c${index}`}>{node}</code>;
        if (marks.includes('italic')) node = <em key={`i${index}`}>{node}</em>;
        if (marks.includes('bold')) node = <strong key={`b${index}`}>{node}</strong>;
        // Links render as underlined text only — the editor never resolves an href for display,
        // and there is no `dangerouslySetInnerHTML` anywhere in this path.
        if (span.link) {
          node = (
            <span key={`l${index}`} className="underline decoration-dotted" title={`Link: ${span.link.kind}`}>
              {node}
            </span>
          );
        }
        return <span key={index}>{node}</span>;
      })}
    </span>
  );
}
