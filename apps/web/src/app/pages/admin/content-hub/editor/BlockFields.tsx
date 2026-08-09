/**
 * Per-block field editors.
 *
 * One component per block type, each receiving the block and an `onChange`. They own only their
 * own fields — insertion, ordering and cardinality live in `blockOperations.ts`.
 *
 * INTERNAL FIELDS ARE LABELLED. `geo_statement.coreMessage` and `.citationGoal` are internal and
 * are marked as such in the UI, because the author needs to know what a reader will and will not
 * see.
 */

import { Plus, Trash2 } from 'lucide-react';
import { ROUTE_KEYS, ROUTE_REGISTRY, type ContentBlock, type InlineContent } from '@meetezri/shared';
import { adminInput, adminSelect } from '@/app/admin';
import { cn } from '@/lib/utils';
import { InlineEditor } from './InlineEditor';
import { newBlockId } from './blockOperations';

interface FieldProps<T extends ContentBlock = ContentBlock> {
  block: T;
  onChange: (next: ContentBlock) => void;
  disabled?: boolean;
}

const labelClass = 'mb-1 block text-xs text-[var(--admin-text-secondary)]';
const internalBadge = (
  <span className="ml-2 rounded border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-amber-200">
    Internal
  </span>
);

function SmallButton({
  onClick,
  children,
  label,
  disabled,
}: {
  onClick: () => void;
  children: React.ReactNode;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      disabled={disabled}
      className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-xs text-[var(--admin-text-secondary)] hover:bg-white/[0.06] disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export function BlockFields({ block, onChange, disabled }: FieldProps) {
  const inline = (
    value: InlineContent | undefined,
    apply: (next: InlineContent) => ContentBlock,
    ariaLabel: string,
    singleLine = false,
  ) => (
    <InlineEditor
      value={value ?? []}
      onChange={(next) => onChange(apply(next))}
      ariaLabel={ariaLabel}
      singleLine={singleLine}
      disabled={disabled}
    />
  );

  switch (block.type) {
    case 'paragraph':
      return inline(block.content, (content) => ({ ...block, content }), 'Paragraph text');

    case 'quote':
      return (
        <div className="space-y-2">
          {inline(block.content, (content) => ({ ...block, content }), 'Quote text')}
          <div>
            <label className={labelClass}>Attribution</label>
            <input
              value={block.attribution ?? ''}
              onChange={(e) => onChange({ ...block, attribution: e.target.value || undefined })}
              disabled={disabled}
              className={cn(adminInput, 'w-full')}
            />
          </div>
        </div>
      );

    case 'direct_answer':
      return inline(block.content, (content) => ({ ...block, content }), 'Direct answer');

    case 'heading':
      return (
        <div className="space-y-2">
          <div className="flex gap-3">
            <div>
              <label className={labelClass}>Level</label>
              <select
                value={block.level}
                onChange={(e) => onChange({ ...block, level: Number(e.target.value) as 2 | 3 })}
                disabled={disabled}
                className={adminSelect}
                aria-label="Heading level"
              >
                {/* No H1: the page title is the only one. */}
                <option value={2}>Heading 2</option>
                <option value={3}>Heading 3</option>
              </select>
            </div>
            <div className="flex-1">
              <label className={labelClass}>Anchor ID (optional)</label>
              <input
                value={block.anchorId ?? ''}
                onChange={(e) => onChange({ ...block, anchorId: e.target.value || undefined })}
                disabled={disabled}
                className={cn(adminInput, 'w-full')}
                placeholder="Derived from the text when blank"
              />
            </div>
          </div>
          {inline(block.content, (content) => ({ ...block, content }), 'Heading text', true)}
        </div>
      );

    case 'list':
      return (
        <div className="space-y-2">
          <select
            value={block.style}
            onChange={(e) => onChange({ ...block, style: e.target.value as 'bullet' | 'number' })}
            disabled={disabled}
            className={adminSelect}
            aria-label="List style"
          >
            <option value="bullet">Bulleted</option>
            <option value="number">Numbered</option>
          </select>

          {block.items.map((item, index) => (
            <div key={index} className="flex items-start gap-2">
              <div className="flex-1">
                <InlineEditor
                  value={item}
                  onChange={(next) => {
                    const items = [...block.items];
                    items[index] = next;
                    onChange({ ...block, items });
                  }}
                  ariaLabel={`List item ${index + 1}`}
                  disabled={disabled}
                />
              </div>
              <SmallButton
                label={`Remove list item ${index + 1}`}
                disabled={disabled || block.items.length <= 1}
                onClick={() => onChange({ ...block, items: block.items.filter((_, i) => i !== index) })}
              >
                <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
              </SmallButton>
            </div>
          ))}

          <SmallButton
            label="Add list item"
            disabled={disabled}
            onClick={() => onChange({ ...block, items: [...block.items, [{ text: '' }]] })}
          >
            <Plus aria-hidden="true" className="h-3.5 w-3.5" /> Add item
          </SmallButton>
        </div>
      );

    case 'key_takeaway':
      return (
        <div className="space-y-2">
          <div>
            <label className={labelClass}>Heading</label>
            <input
              value={block.title ?? ''}
              onChange={(e) => onChange({ ...block, title: e.target.value || undefined })}
              disabled={disabled}
              className={cn(adminInput, 'w-full')}
            />
          </div>
          {block.points.map((point, index) => (
            <div key={index} className="flex items-start gap-2">
              <div className="flex-1">
                <InlineEditor
                  value={point}
                  onChange={(next) => {
                    const points = [...block.points];
                    points[index] = next;
                    onChange({ ...block, points });
                  }}
                  ariaLabel={`Takeaway point ${index + 1}`}
                  disabled={disabled}
                />
              </div>
              <SmallButton
                label={`Remove point ${index + 1}`}
                disabled={disabled || block.points.length <= 1}
                onClick={() => onChange({ ...block, points: block.points.filter((_, i) => i !== index) })}
              >
                <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
              </SmallButton>
            </div>
          ))}
          <SmallButton
            label="Add takeaway point"
            disabled={disabled}
            onClick={() => onChange({ ...block, points: [...block.points, [{ text: '' }]] })}
          >
            <Plus aria-hidden="true" className="h-3.5 w-3.5" /> Add point
          </SmallButton>
        </div>
      );

    case 'safety_notice':
      return (
        <div className="space-y-2">
          <div className="flex gap-3">
            <div>
              <label className={labelClass}>Type</label>
              <select
                value={block.variant}
                onChange={(e) => onChange({ ...block, variant: e.target.value as 'crisis' | 'disclaimer' })}
                disabled={disabled}
                className={adminSelect}
                aria-label="Safety notice type"
              >
                <option value="crisis">Crisis — urgent help</option>
                <option value="disclaimer">Disclaimer — not a substitute for support</option>
              </select>
            </div>
            <div className="flex-1">
              <label className={labelClass}>Heading</label>
              <input
                value={block.heading ?? ''}
                onChange={(e) => onChange({ ...block, heading: e.target.value || undefined })}
                disabled={disabled}
                className={cn(adminInput, 'w-full')}
              />
            </div>
          </div>
          {inline(block.content, (content) => ({ ...block, content }), 'Safety notice text')}
          <label className="flex items-center gap-2 text-sm text-[var(--admin-text-secondary)]">
            <input
              type="checkbox"
              checked={!!block.showHotlines}
              onChange={(e) => onChange({ ...block, showHotlines: e.target.checked || undefined })}
              disabled={disabled}
              className="h-4 w-4 rounded border-white/20 bg-transparent"
            />
            Show crisis hotlines for the reader&rsquo;s region
          </label>
        </div>
      );

    case 'cta':
      return (
        <div className="space-y-2">
          <div>
            <label className={labelClass}>Button label</label>
            <input
              value={block.label}
              onChange={(e) => onChange({ ...block, label: e.target.value })}
              disabled={disabled}
              maxLength={60}
              className={cn(adminInput, 'w-full')}
            />
          </div>
          <div>
            <label className={labelClass}>Description</label>
            <input
              value={block.description ?? ''}
              onChange={(e) => onChange({ ...block, description: e.target.value || undefined })}
              disabled={disabled}
              maxLength={160}
              className={cn(adminInput, 'w-full')}
            />
          </div>
          <div>
            <label className={labelClass}>Destination</label>
            {/* Route registry only — no arbitrary internal URLs, so a route change stays a
                one-line registry edit rather than a data migration. */}
            <select
              value={block.target.kind === 'route' ? block.target.value : ''}
              onChange={(e) => onChange({ ...block, target: { kind: 'route', value: e.target.value } })}
              disabled={disabled}
              className={cn(adminSelect, 'w-full')}
              aria-label="Call to action destination"
            >
              {ROUTE_KEYS.map((key) => (
                <option key={key} value={key}>
                  {ROUTE_REGISTRY[key].label} ({ROUTE_REGISTRY[key].href})
                </option>
              ))}
            </select>
          </div>
        </div>
      );

    case 'faq':
      return (
        <div className="space-y-3">
          <div>
            <label className={labelClass}>Section heading</label>
            <input
              value={block.heading ?? ''}
              onChange={(e) => onChange({ ...block, heading: e.target.value || undefined })}
              disabled={disabled}
              className={cn(adminInput, 'w-full')}
            />
          </div>

          {block.items.map((item, index) => (
            <div key={item.id} className="rounded-md border border-white/10 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs text-[var(--admin-text-secondary)]">Question {index + 1}</span>
                <span className="flex gap-1">
                  <SmallButton
                    label={`Move question ${index + 1} up`}
                    disabled={disabled || index === 0}
                    onClick={() => {
                      const items = [...block.items];
                      [items[index - 1], items[index]] = [items[index], items[index - 1]];
                      onChange({ ...block, items });
                    }}
                  >
                    ↑
                  </SmallButton>
                  <SmallButton
                    label={`Move question ${index + 1} down`}
                    disabled={disabled || index === block.items.length - 1}
                    onClick={() => {
                      const items = [...block.items];
                      [items[index + 1], items[index]] = [items[index], items[index + 1]];
                      onChange({ ...block, items });
                    }}
                  >
                    ↓
                  </SmallButton>
                  <SmallButton
                    label={`Remove question ${index + 1}`}
                    disabled={disabled || block.items.length <= 1}
                    onClick={() => onChange({ ...block, items: block.items.filter((_, i) => i !== index) })}
                  >
                    <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                  </SmallButton>
                </span>
              </div>

              <input
                value={item.question}
                onChange={(e) => {
                  const items = [...block.items];
                  items[index] = { ...item, question: e.target.value };
                  onChange({ ...block, items });
                }}
                disabled={disabled}
                placeholder="Question"
                aria-label={`Question ${index + 1}`}
                className={cn(adminInput, 'mb-2 w-full')}
              />

              <InlineEditor
                value={item.answer}
                onChange={(answer) => {
                  const items = [...block.items];
                  items[index] = { ...item, answer };
                  onChange({ ...block, items });
                }}
                ariaLabel={`Answer ${index + 1}`}
                disabled={disabled}
              />
            </div>
          ))}

          <SmallButton
            label="Add FAQ question"
            disabled={disabled}
            onClick={() =>
              onChange({
                ...block,
                items: [...block.items, { id: newBlockId(), question: '', answer: [{ text: '' }] }],
              })
            }
          >
            <Plus aria-hidden="true" className="h-3.5 w-3.5" /> Add question
          </SmallButton>
        </div>
      );

    case 'table':
      return (
        <div className="space-y-3 overflow-x-auto">
          <div className="flex flex-wrap gap-2">
            {block.headers.map((header, col) => (
              <input
                key={col}
                value={header}
                onChange={(e) => {
                  const headers = [...block.headers];
                  headers[col] = e.target.value;
                  onChange({ ...block, headers });
                }}
                disabled={disabled}
                aria-label={`Column ${col + 1} heading`}
                placeholder={`Column ${col + 1}`}
                className={cn(adminInput, 'w-40')}
              />
            ))}
            <SmallButton
              label="Add column"
              disabled={disabled || block.headers.length >= 6}
              onClick={() =>
                onChange({
                  ...block,
                  headers: [...block.headers, ''],
                  rows: block.rows.map((row) => [...row, [{ text: '' }]]),
                })
              }
            >
              <Plus aria-hidden="true" className="h-3.5 w-3.5" /> Column
            </SmallButton>
          </div>

          {block.rows.map((row, rowIndex) => (
            <div key={rowIndex} className="flex flex-wrap items-start gap-2">
              {row.map((cell, colIndex) => (
                <div key={colIndex} className="w-40">
                  <InlineEditor
                    value={cell}
                    onChange={(next) => {
                      const rows = block.rows.map((r) => [...r]);
                      rows[rowIndex][colIndex] = next;
                      onChange({ ...block, rows });
                    }}
                    ariaLabel={`Row ${rowIndex + 1} column ${colIndex + 1}`}
                    singleLine
                    disabled={disabled}
                  />
                </div>
              ))}
              <SmallButton
                label={`Remove row ${rowIndex + 1}`}
                disabled={disabled || block.rows.length <= 1}
                onClick={() => onChange({ ...block, rows: block.rows.filter((_, i) => i !== rowIndex) })}
              >
                <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
              </SmallButton>
            </div>
          ))}

          <SmallButton
            label="Add row"
            disabled={disabled || block.rows.length >= 30}
            onClick={() =>
              onChange({ ...block, rows: [...block.rows, block.headers.map(() => [{ text: '' }])] })
            }
          >
            <Plus aria-hidden="true" className="h-3.5 w-3.5" /> Add row
          </SmallButton>
        </div>
      );

    case 'geo_statement':
      return (
        <div className="space-y-3">
          <div>
            <label className={labelClass}>Statement (public)</label>
            {inline(block.statement, (statement) => ({ ...block, statement }), 'Statement')}
          </div>

          <div>
            <label className={labelClass}>Clarification (public)</label>
            {inline(block.clarification, (clarification) => ({ ...block, clarification }), 'Clarification')}
          </div>

          <div>
            <label className={labelClass}>Examples (public, comma separated)</label>
            <input
              value={(block.examples ?? []).join(', ')}
              onChange={(e) => {
                const examples = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                onChange({ ...block, examples: examples.length > 0 ? examples : undefined });
              }}
              disabled={disabled}
              className={cn(adminInput, 'w-full')}
            />
          </div>

          <div className="rounded-md border border-amber-400/20 bg-amber-400/[0.04] p-3">
            <p className="mb-2 text-xs text-amber-200">
              These two fields are never shown to readers and never appear in the public API.
            </p>
            <div className="mb-2">
              <label className={labelClass}>
                Core message {internalBadge}
              </label>
              <input
                value={block.coreMessage ?? ''}
                onChange={(e) => onChange({ ...block, coreMessage: e.target.value || undefined })}
                disabled={disabled}
                className={cn(adminInput, 'w-full')}
              />
            </div>
            <div>
              <label className={labelClass}>
                Citation goal {internalBadge}
              </label>
              <input
                value={block.citationGoal ?? ''}
                onChange={(e) => onChange({ ...block, citationGoal: e.target.value || undefined })}
                disabled={disabled}
                className={cn(adminInput, 'w-full')}
              />
            </div>
          </div>
        </div>
      );

    case 'source':
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Label</label>
            <input
              value={block.label}
              onChange={(e) => onChange({ ...block, label: e.target.value })}
              disabled={disabled}
              className={cn(adminInput, 'w-full')}
            />
          </div>
          <div>
            <label className={labelClass}>URL</label>
            <input
              value={block.url}
              onChange={(e) => onChange({ ...block, url: e.target.value })}
              disabled={disabled}
              placeholder="https://…"
              className={cn(adminInput, 'w-full')}
            />
          </div>
          <div>
            <label className={labelClass}>Publisher</label>
            <input
              value={block.publisher ?? ''}
              onChange={(e) => onChange({ ...block, publisher: e.target.value || undefined })}
              disabled={disabled}
              className={cn(adminInput, 'w-full')}
            />
          </div>
          <div>
            <label className={labelClass}>Accessed</label>
            <input
              type="date"
              value={block.accessedAt ?? ''}
              onChange={(e) => onChange({ ...block, accessedAt: e.target.value || undefined })}
              disabled={disabled}
              className={cn(adminInput, 'w-full')}
            />
          </div>
        </div>
      );

    case 'related_content':
      return (
        <div className="space-y-2">
          <label className={labelClass}>Mode</label>
          <select
            value={block.mode}
            onChange={(e) => onChange({ ...block, mode: e.target.value as 'auto' | 'manual' })}
            disabled={disabled}
            className={adminSelect}
            aria-label="Related content mode"
          >
            <option value="auto">Automatic — from internal links and pillar</option>
            <option value="manual">Manual — choose items</option>
          </select>
          <p className="text-xs text-[var(--admin-text-muted)]">
            Unpublished targets are never shown to readers.
          </p>
        </div>
      );

    case 'divider':
      return <p className="text-xs text-[var(--admin-text-muted)]">A horizontal rule. No settings.</p>;

    default:
      return (
        <p className="text-xs text-[var(--admin-text-muted)]">
          This block type has no editor in this version.
        </p>
      );
  }
}
