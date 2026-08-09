/**
 * Structured block editor.
 *
 * NO DRAG AND DROP. Reordering uses explicit Move up / Move down buttons, which are keyboard
 * accessible by construction. The task allows DnD only if it is fully keyboard accessible and
 * adds no dependency; buttons meet the same need with neither caveat.
 */

import { useState } from 'react';
import { ChevronDown, ChevronUp, Copy, Plus, Trash2 } from 'lucide-react';
import type { BlockType, ContentBody, ContentType, ValidationIssue } from '@meetezri/shared';
import { adminBtnSecondary, adminCardStatic } from '@/app/admin';
import { cn } from '@/lib/utils';
import { BlockFields } from './BlockFields';
import {
  BLOCK_LABEL,
  addBlock,
  blockAddBlocker,
  canMove,
  duplicateBlock,
  moveBlock,
  paletteFor,
  removeBlock,
  updateBlock,
} from './blockOperations';

export interface BlockEditorProps {
  body: ContentBody;
  contentType: ContentType;
  onChange: (next: ContentBody) => void;
  /** Document-level issues from the shared validator, keyed to blocks where possible. */
  issues?: ValidationIssue[];
  disabled?: boolean;
}

export function BlockEditor({ body, contentType, onChange, issues = [], disabled }: BlockEditorProps) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const palette = paletteFor(contentType);

  const issuesFor = (blockId: string) => issues.filter((issue) => issue.blockId === blockId);

  return (
    <div className="space-y-4">
      {body.blocks.length === 0 ? (
        <div className={cn(adminCardStatic, 'px-6 py-10 text-center')}>
          <p className="text-sm text-[var(--admin-text-secondary)]">
            This document is empty. Add your first block to begin.
          </p>
        </div>
      ) : null}

      <ol className="space-y-3">
        {body.blocks.map((block, index) => {
          const blockIssues = issuesFor(block.id);
          const pinned = block.type === 'direct_answer';

          return (
            <li key={block.id} className={cn(adminCardStatic, 'p-4', blockIssues.length > 0 && 'border-red-400/40')}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[var(--admin-text)]">
                    {BLOCK_LABEL[block.type]}
                  </span>
                  {pinned ? (
                    <span className="rounded border border-sky-400/30 bg-sky-400/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-sky-200">
                      Always first
                    </span>
                  ) : null}
                  <span className="text-xs text-[var(--admin-text-muted)]">
                    Block {index + 1} of {body.blocks.length}
                  </span>
                </span>

                <span className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onChange(moveBlock(body, block.id, 'up'))}
                    disabled={disabled || !canMove(body, block.id, 'up')}
                    aria-label={`Move ${BLOCK_LABEL[block.type]} up`}
                    className="rounded-md border border-white/10 p-1 text-[var(--admin-text-secondary)] hover:bg-white/[0.06] disabled:opacity-30"
                  >
                    <ChevronUp aria-hidden="true" className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange(moveBlock(body, block.id, 'down'))}
                    disabled={disabled || !canMove(body, block.id, 'down')}
                    aria-label={`Move ${BLOCK_LABEL[block.type]} down`}
                    className="rounded-md border border-white/10 p-1 text-[var(--admin-text-secondary)] hover:bg-white/[0.06] disabled:opacity-30"
                  >
                    <ChevronDown aria-hidden="true" className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange(duplicateBlock(body, block.id))}
                    disabled={disabled || block.type === 'direct_answer' || block.type === 'faq'}
                    aria-label={`Duplicate ${BLOCK_LABEL[block.type]}`}
                    className="rounded-md border border-white/10 p-1 text-[var(--admin-text-secondary)] hover:bg-white/[0.06] disabled:opacity-30"
                  >
                    <Copy aria-hidden="true" className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange(removeBlock(body, block.id))}
                    disabled={disabled}
                    aria-label={`Remove ${BLOCK_LABEL[block.type]}`}
                    className="rounded-md border border-white/10 p-1 text-red-300 hover:bg-red-500/10 disabled:opacity-30"
                  >
                    <Trash2 aria-hidden="true" className="h-4 w-4" />
                  </button>
                </span>
              </div>

              <BlockFields
                block={block}
                onChange={(next) => onChange(updateBlock(body, block.id, next))}
                disabled={disabled}
              />

              {blockIssues.length > 0 ? (
                <ul className="mt-3 space-y-1" role="alert">
                  {blockIssues.map((issue) => (
                    <li key={issue.code} className="text-xs text-red-300">
                      {issue.message}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ol>

      <div className={cn(adminCardStatic, 'p-4')}>
        <button
          type="button"
          onClick={() => setPaletteOpen((open) => !open)}
          aria-expanded={paletteOpen}
          aria-controls="block-palette"
          disabled={disabled}
          className={cn(adminBtnSecondary, 'inline-flex items-center gap-2')}
        >
          <Plus aria-hidden="true" className="h-4 w-4" />
          Add block
        </button>

        {paletteOpen ? (
          <div id="block-palette" className="mt-3 flex flex-wrap gap-2">
            {palette.map((type: BlockType) => {
              const blocker = blockAddBlocker(body, type);
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    onChange(addBlock(body, type));
                    setPaletteOpen(false);
                  }}
                  disabled={disabled || !!blocker}
                  title={blocker ?? undefined}
                  className="rounded-md border border-white/10 px-3 py-1.5 text-sm text-[var(--admin-text-secondary)] hover:bg-white/[0.06] disabled:opacity-40"
                >
                  {BLOCK_LABEL[type]}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
