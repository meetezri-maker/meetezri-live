/**
 * Overview tab — identity and ownership.
 *
 * The content TYPE is read-only here: changing it after creation would orphan `type_fields`, and
 * the backend rejects it outright.
 */

import { useEffect } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { AlertTriangle } from 'lucide-react';
import { normaliseSlug } from '@meetezri/shared';
import { adminCardStatic, adminInput } from '@/app/admin';
import { cn } from '@/lib/utils';
import type { ContentHubDetail } from '@/lib/api';
import type { EditorFormValues } from '../schema/contentHubEditor.schema';
import { ContentTypeBadge } from '../components/ContentTypeBadge';
import { PersonSelect } from '../components/PersonSelect';

const labelClass = 'mb-1 block text-sm text-[var(--admin-text-secondary)]';

export interface OverviewTabProps {
  form: UseFormReturn<EditorFormValues>;
  content: ContentHubDetail;
  slugTouched: boolean;
  onSlugTouched: () => void;
  onChange: () => void;
}

export function OverviewTab({ form, content, slugTouched, onSlugTouched, onChange }: OverviewTabProps) {
  const { register, watch, setValue, formState } = form;
  const errors = formState.errors;

  const title = watch('title');
  const slug = watch('slug');
  const featuredImageUrl = watch('featuredImageUrl');

  // Auto-derive only while the slug has never been touched — which, for an existing record, it
  // always has. This matters for records created before a slug was set.
  useEffect(() => {
    if (slugTouched) return;
    setValue('slug', title ? normaliseSlug(title) : '');
  }, [title, slugTouched, setValue]);

  const isPublished = content.status === 'published';
  const slugChanged = normaliseSlug(slug ?? '') !== content.slug;

  return (
    <div className={cn(adminCardStatic, 'space-y-5 p-6')}>
      <div>
        <label htmlFor="ov-title" className={labelClass}>
          Title <span aria-hidden="true">*</span>
        </label>
        <input
          id="ov-title"
          {...register('title', { onChange })}
          aria-invalid={!!errors.title}
          aria-describedby={errors.title ? 'ov-title-error' : undefined}
          className={cn(adminInput, 'w-full')}
        />
        {errors.title ? (
          <p id="ov-title-error" role="alert" className="mt-1 text-sm text-red-300">
            {String(errors.title.message)}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="ov-slug" className={labelClass}>
          Slug
        </label>
        <input
          id="ov-slug"
          {...register('slug', { onChange })}
          onFocus={onSlugTouched}
          // A published slug is read-only until the operator explicitly asks to change it.
          readOnly={isPublished && !slugChanged ? false : undefined}
          aria-invalid={!!errors.slug}
          aria-describedby={errors.slug ? 'ov-slug-error' : 'ov-slug-hint'}
          className={cn(adminInput, 'w-full')}
        />
        {errors.slug ? (
          <p id="ov-slug-error" role="alert" className="mt-1 text-sm text-red-300">
            {String(errors.slug.message)}
          </p>
        ) : (
          <p id="ov-slug-hint" className="mt-1 text-xs text-[var(--admin-text-muted)]">
            Public URL: /resources/{normaliseSlug(slug ?? '') || '…'}
          </p>
        )}

        {isPublished && slugChanged ? (
          <div
            role="alert"
            className="mt-2 flex items-start gap-2 rounded-md border border-amber-400/30 bg-amber-400/[0.06] p-3"
          >
            <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <p className="text-sm text-[var(--admin-text-secondary)]">
              This page is live. Changing its URL makes the old address return 404 — external
              links, bookmarks and search-engine entries pointing at it will break. Internal
              Content Hub links are unaffected because they resolve by id. Saving confirms the
              change, and only a super admin can make it.
            </p>
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <span className={labelClass}>Content type</span>
          <div className="flex h-10 items-center gap-2">
            <ContentTypeBadge contentType={content.contentType} label={content.publicLabel} />
            <span className="text-xs text-[var(--admin-text-muted)]">
              Cannot be changed after creation
            </span>
          </div>
        </div>

        <div>
          <label htmlFor="ov-ref" className={labelClass}>
            Editorial reference
          </label>
          <input
            id="ov-ref"
            {...register('editorialRef', { onChange })}
            placeholder="e.g. W1-A001"
            className={cn(adminInput, 'w-full')}
          />
        </div>

        <div>
          <label htmlFor="ov-pillar" className={labelClass}>
            Pillar
          </label>
          <input id="ov-pillar" {...register('pillar', { onChange })} className={cn(adminInput, 'w-full')} />
        </div>

        <div>
          <label htmlFor="ov-week" className={labelClass}>
            Week
          </label>
          <input
            id="ov-week"
            type="number"
            min={1}
            {...register('week', { onChange })}
            aria-invalid={!!errors.week}
            className={cn(adminInput, 'w-full')}
          />
          {errors.week ? (
            <p role="alert" className="mt-1 text-sm text-red-300">
              {String(errors.week.message)}
            </p>
          ) : null}
        </div>
      </div>

      <div>
        <label htmlFor="ov-tags" className={labelClass}>
          Tags
        </label>
        <input
          id="ov-tags"
          {...register('tagsInput', { onChange })}
          placeholder="Comma separated"
          aria-invalid={!!errors.tagsInput}
          aria-describedby={errors.tagsInput ? 'ov-tags-error' : 'ov-tags-hint'}
          className={cn(adminInput, 'w-full')}
        />
        {errors.tagsInput ? (
          <p id="ov-tags-error" role="alert" className="mt-1 text-sm text-red-300">
            {String(errors.tagsInput.message)}
          </p>
        ) : (
          <p id="ov-tags-hint" className="mt-1 text-xs text-[var(--admin-text-muted)]">
            Internal only — up to 10, lowercased and hyphenated automatically.
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <PersonSelect
          id="ov-author"
          label="Author"
          value={watch('authorId') ?? ''}
          onChange={(value) => {
            setValue('authorId', value, { shouldDirty: true });
            onChange();
          }}
          hint="Shown publicly as the byline."
        />
        <PersonSelect
          id="ov-reviewer"
          label="Reviewer"
          value={watch('reviewerId') ?? ''}
          onChange={(value) => {
            setValue('reviewerId', value, { shouldDirty: true });
            onChange();
          }}
          hint="Public trust signal — separate from the internal approval gates."
        />
      </div>

      <div>
        <label htmlFor="ov-reviewed-at" className={labelClass}>
          Reviewed on
        </label>
        <input
          id="ov-reviewed-at"
          type="date"
          {...register('reviewedAt', { onChange })}
          className={cn(adminInput, 'w-full sm:w-56')}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="ov-image" className={labelClass}>
            Featured image URL
          </label>
          <input
            id="ov-image"
            {...register('featuredImageUrl', { onChange })}
            placeholder="https://…"
            aria-invalid={!!errors.featuredImageUrl}
            className={cn(adminInput, 'w-full')}
          />
          {errors.featuredImageUrl ? (
            <p role="alert" className="mt-1 text-sm text-red-300">
              {String(errors.featuredImageUrl.message)}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="ov-image-alt" className={labelClass}>
            Featured image alt text {featuredImageUrl ? <span aria-hidden="true">*</span> : null}
          </label>
          <input
            id="ov-image-alt"
            {...register('featuredImageAlt', { onChange })}
            aria-invalid={!!errors.featuredImageAlt}
            aria-describedby={errors.featuredImageAlt ? 'ov-alt-error' : undefined}
            className={cn(adminInput, 'w-full')}
          />
          {errors.featuredImageAlt ? (
            <p id="ov-alt-error" role="alert" className="mt-1 text-sm text-red-300">
              {String(errors.featuredImageAlt.message)}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
