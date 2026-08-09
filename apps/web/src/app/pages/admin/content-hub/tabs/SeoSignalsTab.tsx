/**
 * SEO & Signals tab.
 *
 * Everything here is either public or feeds a public artefact (meta description, canonical,
 * robots, JSON-LD). The one deliberate restraint: this screen shows character counts and target
 * comparisons but never predicts a ranking or a citation — the product cannot promise either.
 */

import type { UseFormReturn } from 'react-hook-form';
import { CONTENT_LIMITS, ROBOTS_DIRECTIVES, type ContentType } from '@meetezri/shared';
import { adminCardStatic, adminInput, adminSelect } from '@/app/admin';
import { cn } from '@/lib/utils';
import type { EditorFormValues } from '../schema/contentHubEditor.schema';

const labelClass = 'mb-1 block text-sm text-[var(--admin-text-secondary)]';

export interface SeoSignalsTabProps {
  form: UseFormReturn<EditorFormValues>;
  contentType: ContentType;
  typeFields: Record<string, unknown>;
  onTypeFieldsChange: (next: Record<string, unknown>) => void;
  onChange: () => void;
  wordCount: number;
  publicLabel: string;
  slug: string;
}

/** Parses "2,200–2,500" (or "2200-2500") into a range for the comparison hint. */
function parseTarget(target: unknown): { min: number; max: number } | null {
  if (typeof target !== 'string') return null;
  const match = target.match(/(\d[\d,]*)\D+(\d[\d,]*)/);
  if (!match) return null;
  return { min: Number(match[1].replace(/,/g, '')), max: Number(match[2].replace(/,/g, '')) };
}

export function SeoSignalsTab({
  form,
  contentType,
  typeFields,
  onTypeFieldsChange,
  onChange,
  wordCount,
  publicLabel,
  slug,
}: SeoSignalsTabProps) {
  const { register, watch, formState } = form;
  const errors = formState.errors;

  const metaDescription = watch('metaDescription') ?? '';
  const title = watch('title') ?? '';
  const metaLength = metaDescription.trim().length;
  const metaInRange =
    metaLength >= CONTENT_LIMITS.minMetaDescription && metaLength <= CONTENT_LIMITS.maxMetaDescription;

  const setTypeField = (key: string, value: unknown) =>
    onTypeFieldsChange({ ...typeFields, [key]: value === '' ? undefined : value });

  const target = parseTarget(typeFields.word_count_target);
  const withinTarget = target ? wordCount >= target.min && wordCount <= target.max : null;

  return (
    <div className="space-y-4">
      <div className={cn(adminCardStatic, 'space-y-5 p-6')}>
        <h2 className="text-sm font-semibold text-[var(--admin-text)]">Search appearance</h2>

        <div>
          <label htmlFor="seo-meta" className={labelClass}>
            Meta description
          </label>
          <textarea
            id="seo-meta"
            rows={3}
            {...register('metaDescription', { onChange })}
            aria-describedby="seo-meta-count"
            className={cn(adminInput, 'w-full resize-y')}
          />
          <p
            id="seo-meta-count"
            className={cn(
              'mt-1 text-xs',
              metaLength === 0
                ? 'text-[var(--admin-text-muted)]'
                : metaInRange
                  ? 'text-emerald-300'
                  : 'text-amber-300',
            )}
          >
            {metaLength} characters — {CONTENT_LIMITS.minMetaDescription}–
            {CONTENT_LIMITS.maxMetaDescription} required to publish.
          </p>
        </div>

        {/* A plain approximation of a search result. Deliberately not a ranking prediction. */}
        <div className="rounded-md border border-white/10 bg-white/[0.03] p-4">
          <p className="mb-2 text-xs uppercase tracking-wide text-[var(--admin-text-muted)]">
            Search preview — {publicLabel}
          </p>
          <p className="text-sm text-sky-300">{title || 'Untitled'}</p>
          <p className="text-xs text-emerald-300">/resources/{slug}</p>
          <p className="mt-1 text-sm text-[var(--admin-text-secondary)]">
            {metaDescription || 'Add a meta description to control how this appears in search.'}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="seo-canonical" className={labelClass}>
              Canonical URL override
            </label>
            <input
              id="seo-canonical"
              {...register('canonicalUrlOverride', { onChange })}
              placeholder="https://… (leave blank to use this page's URL)"
              aria-invalid={!!errors.canonicalUrlOverride}
              className={cn(adminInput, 'w-full')}
            />
            {errors.canonicalUrlOverride ? (
              <p role="alert" className="mt-1 text-sm text-red-300">
                {String(errors.canonicalUrlOverride.message)}
              </p>
            ) : null}
          </div>

          <div>
            <label htmlFor="seo-robots" className={labelClass}>
              Robots directive
            </label>
            <select
              id="seo-robots"
              {...register('robotsDirective', { onChange })}
              className={cn(adminSelect, 'w-full')}
            >
              {ROBOTS_DIRECTIVES.map((directive) => (
                <option key={directive} value={directive}>
                  {directive}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className={cn(adminCardStatic, 'space-y-4 p-6')}>
        <h2 className="text-sm font-semibold text-[var(--admin-text)]">
          Public fields for this content type
        </h2>

        {contentType === 'aeo_answer' ? (
          <div className="space-y-4">
            <div>
              <label htmlFor="seo-primary-question" className={labelClass}>
                Primary question <span className="text-xs text-[var(--admin-text-muted)]">(public)</span>
              </label>
              <input
                id="seo-primary-question"
                value={(typeFields.primary_question as string) ?? ''}
                onChange={(e) => setTypeField('primary_question', e.target.value)}
                className={cn(adminInput, 'w-full')}
              />
            </div>
            <div>
              <label htmlFor="seo-snippet" className={labelClass}>
                Snippet answer <span className="text-xs text-[var(--admin-text-muted)]">(used in metadata and structured data, not rendered twice)</span>
              </label>
              <textarea
                id="seo-snippet"
                rows={3}
                value={(typeFields.snippet_answer as string) ?? ''}
                onChange={(e) => setTypeField('snippet_answer', e.target.value)}
                className={cn(adminInput, 'w-full resize-y')}
              />
            </div>
          </div>
        ) : null}

        {contentType === 'geo_article' ? (
          <div className="space-y-4">
            <div>
              <label htmlFor="seo-citation-summary" className={labelClass}>
                Citation summary <span className="text-xs text-[var(--admin-text-muted)]">(public)</span>
              </label>
              <textarea
                id="seo-citation-summary"
                rows={3}
                value={(typeFields.citation_summary as string) ?? ''}
                onChange={(e) => setTypeField('citation_summary', e.target.value)}
                className={cn(adminInput, 'w-full resize-y')}
              />
            </div>
            <div>
              <label htmlFor="seo-key-statements" className={labelClass}>
                Key statements <span className="text-xs text-[var(--admin-text-muted)]">(public, one per line)</span>
              </label>
              <textarea
                id="seo-key-statements"
                rows={5}
                value={((typeFields.key_statements as string[]) ?? []).join('\n')}
                onChange={(e) =>
                  setTypeField(
                    'key_statements',
                    e.target.value.split('\n').map((s) => s.trim()).filter(Boolean),
                  )
                }
                className={cn(adminInput, 'w-full resize-y')}
              />
            </div>
          </div>
        ) : null}

        {contentType === 'seo_blog' ? (
          <div className="space-y-3">
            <p className="text-sm text-[var(--admin-text-secondary)]">
              Keywords and the word-count target are internal planning fields and live on the
              Editorial Brief tab. Nothing type-specific is published for this content type.
            </p>
            <div
              className={cn(
                'rounded-md border p-3 text-sm',
                withinTarget === null
                  ? 'border-white/10 text-[var(--admin-text-secondary)]'
                  : withinTarget
                    ? 'border-emerald-400/30 text-emerald-200'
                    : 'border-amber-400/30 text-amber-200',
              )}
            >
              {target
                ? `${wordCount} words — target ${target.min.toLocaleString()}–${target.max.toLocaleString()}.`
                : `${wordCount} words. Set a word-count target on the Editorial Brief tab to compare.`}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
