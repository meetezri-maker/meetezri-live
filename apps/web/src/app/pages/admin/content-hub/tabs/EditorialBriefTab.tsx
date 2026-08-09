/**
 * Editorial Brief tab — INTERNAL ONLY.
 *
 * Everything here lives in `content_items.editorial` or the internal half of `type_fields`. The
 * public query never selects `editorial`, and the serializer's per-type allow-list drops the
 * internal `type_fields`. The banner says so, because an author needs to know which of their
 * notes a reader can see.
 */

import type { ContentType } from '@meetezri/shared';
import { Lock } from 'lucide-react';
import { adminCardStatic, adminInput } from '@/app/admin';
import { cn } from '@/lib/utils';

const labelClass = 'mb-1 block text-sm text-[var(--admin-text-secondary)]';

export interface EditorialBriefTabProps {
  contentType: ContentType;
  editorial: Record<string, unknown>;
  typeFields: Record<string, unknown>;
  onEditorialChange: (next: Record<string, unknown>) => void;
  onTypeFieldsChange: (next: Record<string, unknown>) => void;
}

function TextField({
  id,
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  id: string;
  label: string;
  value: unknown;
  onChange: (next: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <input
        id={id}
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(adminInput, 'w-full')}
      />
      {hint ? <p className="mt-1 text-xs text-[var(--admin-text-muted)]">{hint}</p> : null}
    </div>
  );
}

function ListField({
  id,
  label,
  value,
  onChange,
  hint,
}: {
  id: string;
  label: string;
  value: unknown;
  onChange: (next: string[]) => void;
  hint?: string;
}) {
  const list = Array.isArray(value) ? (value as string[]) : [];
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <input
        id={id}
        value={list.join(', ')}
        onChange={(e) => onChange(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
        placeholder="Comma separated"
        className={cn(adminInput, 'w-full')}
      />
      {hint ? <p className="mt-1 text-xs text-[var(--admin-text-muted)]">{hint}</p> : null}
    </div>
  );
}

export function EditorialBriefTab({
  contentType,
  editorial,
  typeFields,
  onEditorialChange,
  onTypeFieldsChange,
}: EditorialBriefTabProps) {
  const setEditorial = (key: string, value: unknown) =>
    onEditorialChange({ ...editorial, [key]: value === '' ? undefined : value });
  const setTypeField = (key: string, value: unknown) =>
    onTypeFieldsChange({ ...typeFields, [key]: value === '' ? undefined : value });

  const kpiTargets = Array.isArray(editorial.kpi_targets)
    ? (editorial.kpi_targets as Array<{ metric: string; goal: string }>)
    : [];

  return (
    <div className="space-y-4">
      <div
        className={cn(adminCardStatic, 'flex items-start gap-3 border-amber-400/25 bg-amber-400/[0.05] p-4')}
        role="note"
      >
        <Lock aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
        <div>
          <p className="text-sm font-medium text-[var(--admin-text)]">Internal only</p>
          <p className="mt-1 text-sm text-[var(--admin-text-secondary)]">
            Nothing on this tab is shown to readers, included in the preview, or returned by the
            public API. It is planning context for the team.
          </p>
        </div>
      </div>

      <div className={cn(adminCardStatic, 'space-y-4 p-6')}>
        <h2 className="text-sm font-semibold text-[var(--admin-text)]">Strategy</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField id="eb-purpose" label="Purpose" value={editorial.purpose} onChange={(v) => setEditorial('purpose', v)} />
          <TextField id="eb-strategy" label="Strategy" value={editorial.strategy} onChange={(v) => setEditorial('strategy', v)} />
          <TextField id="eb-goal" label="Goal" value={editorial.goal} onChange={(v) => setEditorial('goal', v)} />
          <TextField id="eb-business" label="Business goal" value={editorial.business_goal} onChange={(v) => setEditorial('business_goal', v)} />
          <TextField id="eb-intent" label="Search intent" value={editorial.search_intent} onChange={(v) => setEditorial('search_intent', v)} />
          <TextField id="eb-state" label="User state" value={editorial.user_state} onChange={(v) => setEditorial('user_state', v)} />
          <TextField id="eb-outcome" label="Expected outcome" value={editorial.expected_outcome} onChange={(v) => setEditorial('expected_outcome', v)} />
          <ListField id="eb-engines" label="Target engines" value={editorial.target_engines} onChange={(v) => setEditorial('target_engines', v)} />
        </div>
      </div>

      <div className={cn(adminCardStatic, 'space-y-4 p-6')}>
        <h2 className="text-sm font-semibold text-[var(--admin-text)]">KPI targets</h2>
        <p className="text-xs text-[var(--admin-text-muted)]">
          Editorial intent only. Version One does not measure performance, and these are never
          compared against real data.
        </p>

        {kpiTargets.map((target, index) => (
          <div key={index} className="grid gap-2 sm:grid-cols-2">
            <input
              value={target.metric}
              onChange={(e) => {
                const next = [...kpiTargets];
                next[index] = { ...target, metric: e.target.value };
                setEditorial('kpi_targets', next);
              }}
              aria-label={`KPI ${index + 1} metric`}
              placeholder="Metric"
              className={cn(adminInput, 'w-full')}
            />
            <div className="flex gap-2">
              <input
                value={target.goal}
                onChange={(e) => {
                  const next = [...kpiTargets];
                  next[index] = { ...target, goal: e.target.value };
                  setEditorial('kpi_targets', next);
                }}
                aria-label={`KPI ${index + 1} goal`}
                placeholder="Goal"
                className={cn(adminInput, 'w-full')}
              />
              <button
                type="button"
                onClick={() => setEditorial('kpi_targets', kpiTargets.filter((_, i) => i !== index))}
                aria-label={`Remove KPI target ${index + 1}`}
                className="rounded-md border border-white/10 px-2 text-xs text-red-300 hover:bg-red-500/10"
              >
                Remove
              </button>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={() => setEditorial('kpi_targets', [...kpiTargets, { metric: '', goal: '' }])}
          className="rounded-md border border-white/10 px-3 py-1.5 text-sm text-[var(--admin-text-secondary)] hover:bg-white/[0.06]"
        >
          Add KPI target
        </button>
      </div>

      <div className={cn(adminCardStatic, 'space-y-4 p-6')}>
        <h2 className="text-sm font-semibold text-[var(--admin-text)]">
          Planning for this content type
        </h2>

        {contentType === 'aeo_answer' ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              id="eb-primary-question"
              label="Primary question"
              value={typeFields.primary_question}
              onChange={(v) => setTypeField('primary_question', v)}
              hint="The canonical question this page answers."
            />
            <ListField
              id="eb-supporting-queries"
              label="Supporting questions"
              value={typeFields.supporting_queries}
              onChange={(v) => setTypeField('supporting_queries', v)}
              hint="Query-targeting intent. Not rendered on the page."
            />
            <TextField id="eb-aeo-signal" label="Answer-format notes" value={editorial.aeo_signal} onChange={(v) => setEditorial('aeo_signal', v)} />
            <TextField id="eb-snippet-target" label="Featured-snippet target" value={editorial.geo_signal} onChange={(v) => setEditorial('geo_signal', v)} />
          </div>
        ) : null}

        {contentType === 'geo_article' ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField id="eb-core-concept" label="Core concept" value={typeFields.core_concept} onChange={(v) => setTypeField('core_concept', v)} hint="The article's thesis. Not rendered." />
            <ListField id="eb-supporting-concepts" label="Supporting concepts" value={typeFields.supporting_concepts} onChange={(v) => setTypeField('supporting_concepts', v)} />
            <TextField
              id="eb-primary-topic"
              label="Primary topic"
              value={(typeFields.topics as { primary?: string } | undefined)?.primary}
              onChange={(v) => setTypeField('topics', { ...(typeFields.topics as object ?? {}), primary: v })}
            />
            <ListField
              id="eb-secondary-topics"
              label="Secondary topics"
              value={(typeFields.topics as { secondary?: string[] } | undefined)?.secondary}
              onChange={(v) => setTypeField('topics', { ...(typeFields.topics as object ?? {}), secondary: v })}
            />
            <TextField id="eb-citation-strategy" label="Citation strategy" value={editorial.geo_focus} onChange={(v) => setEditorial('geo_focus', v)} />
            <TextField id="eb-question-coverage" label="Question coverage" value={editorial.question_coverage} onChange={(v) => setEditorial('question_coverage', v)} />
          </div>
        ) : null}

        {contentType === 'seo_blog' ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              id="eb-primary-keyword"
              label="Primary keyword"
              value={(typeFields.keywords as { primary?: string } | undefined)?.primary}
              onChange={(v) => setTypeField('keywords', { ...(typeFields.keywords as object ?? {}), primary: v })}
            />
            <ListField
              id="eb-secondary-keywords"
              label="Supporting keywords"
              value={(typeFields.keywords as { secondary?: string[] } | undefined)?.secondary}
              onChange={(v) => setTypeField('keywords', { ...(typeFields.keywords as object ?? {}), secondary: v })}
            />
            <TextField
              id="eb-word-target"
              label="Word-count target"
              value={typeFields.word_count_target}
              onChange={(v) => setTypeField('word_count_target', v)}
              placeholder="e.g. 2,200–2,500"
            />
            <TextField id="eb-funnel" label="Funnel stage" value={typeFields.funnel_stage} onChange={(v) => setTypeField('funnel_stage', v)} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
