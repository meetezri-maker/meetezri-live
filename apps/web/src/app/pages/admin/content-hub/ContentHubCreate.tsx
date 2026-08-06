/**
 * Content Hub — create screen (`/admin/content-hub/new`).
 *
 * Two steps: pick a type, then fill the essentials. Creating first (rather than opening an empty
 * editor) means the record has an id before anything else happens, which removes a whole class of
 * "unsaved new document" edge cases from Phase 4.
 *
 * `react-hook-form` + web Zod v4, per `.cursorrules`.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, FileText, Lightbulb, MessageCircleQuestion } from "lucide-react";
import { PUBLIC_CONTENT_LABEL, normaliseSlug } from "@meetezri/shared";
import { AdminLayoutNew } from "@/app/components/AdminLayoutNew";
import {
  adminBtnPrimary,
  adminBtnSecondary,
  adminCard,
  adminCardStatic,
  adminInput,
  adminPageAtmosphere,
  adminPageGlowTeal,
  adminPageGlowTop,
  adminPageRoot,
  adminPageTitle,
  adminPageVignette,
} from "@/app/admin";
import { useAuth } from "@/app/contexts/AuthContext";
import { isApiError, type ContentHubContentType } from "@/lib/api";
import { useCreateContent } from "@/lib/queries/contentHubQueries";
import { cn } from "@/lib/utils";
import {
  contentHubCreateSchema,
  toCreateBody,
  type ContentHubCreateForm,
} from "./schema/contentHubCreate.schema";

/** Public labels only. The internal value never appears as user-visible text. */
const TYPE_CARDS: Array<{
  value: ContentHubContentType;
  description: string;
  icon: typeof FileText;
}> = [
  {
    value: "aeo_answer",
    description: "A direct answer to one clear question.",
    icon: MessageCircleQuestion,
  },
  {
    value: "geo_article",
    description: "An educational article designed to explain a concept clearly.",
    icon: Lightbulb,
  },
  {
    value: "seo_blog",
    description: "A long-form search-focused resource.",
    icon: FileText,
  },
];

/** Maps stable backend error codes onto the field the user can actually fix. */
function fieldForErrorCode(code: string | undefined): "slug" | "editorialRef" | null {
  switch (code) {
    case "SLUG_TAKEN":
    case "SLUG_RESERVED":
    case "SLUG_INVALID":
      return "slug";
    case "EDITORIAL_REF_TAKEN":
      return "editorialRef";
    default:
      return null;
  }
}

export function ContentHubCreate() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [step, setStep] = useState<1 | 2>(1);
  const [contentType, setContentType] = useState<ContentHubContentType | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const stepTwoHeadingRef = useRef<HTMLHeadingElement>(null);

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ContentHubCreateForm>({
    // `as any` matches the existing repo pattern (ProfileEditModal, Login): @hookform/resolvers v5
    // types against zod v3 shapes, and this schema's `week` transform makes input ≠ output, which
    // the overloads cannot reconcile. Validation itself is unaffected.
    resolver: zodResolver(contentHubCreateSchema as any),
    defaultValues: { title: "", slug: "", pillar: "", tagsInput: "", editorialRef: "" },
  });

  const title = watch("title");
  const slug = watch("slug");

  // Auto-derive the slug until the user edits it — after that the field is theirs.
  useEffect(() => {
    if (slugTouched) return;
    setValue("slug", title ? normaliseSlug(title) : "");
  }, [title, slugTouched, setValue]);

  // Focus management: moving to step 2 must land somewhere meaningful for keyboard users.
  useEffect(() => {
    if (step === 2) stepTwoHeadingRef.current?.focus();
  }, [step]);

  const createMutation = useCreateContent({
    onCreated: (id) => navigate(`/admin/content-hub/${id}`),
  });

  const chooseType = useCallback(
    (value: ContentHubContentType) => {
      setContentType(value);
      // Must live in FORM state, not only component state: the resolver validates the form, and a
      // missing required `contentType` would fail validation silently before onSubmit ever runs.
      setValue("contentType", value);
      setStep(2);
    },
    [setValue],
  );

  const onSubmit = handleSubmit(async (values) => {
    if (!contentType) return;

    try {
      await createMutation.mutateAsync(
        toCreateBody({
          ...values,
          contentType,
          authorId: values.authorId || user?.id || undefined,
        } as never),
      );
    } catch (error) {
      // The toast already fired in the mutation; surface it on the field too where we can.
      if (isApiError(error)) {
        const field = fieldForErrorCode(error.code);
        if (field) setError(field, { type: "server", message: error.message });
      }
    }
  });

  return (
    <AdminLayoutNew>
      <div className={adminPageRoot}>
        <div className={adminPageAtmosphere} aria-hidden="true">
          <div className={adminPageGlowTop} />
          <div className={adminPageGlowTeal} />
          <div className={adminPageVignette} />
        </div>

        <div className="relative z-10 mx-auto max-w-3xl space-y-6 p-6">
          <button
            type="button"
            onClick={() => (step === 2 ? setStep(1) : navigate("/admin/content-hub"))}
            className={cn(adminBtnSecondary, "inline-flex items-center gap-2")}
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            {step === 2 ? "Change type" : "Back to Content Hub"}
          </button>

          <div>
            <h1 className={adminPageTitle}>New content</h1>
            <p className="mt-1 text-sm text-[var(--admin-text-secondary)]">
              {step === 1 ? "Step 1 of 2 — choose what you are creating." : "Step 2 of 2 — the essentials."}
            </p>
          </div>

          {step === 1 ? (
            <div className="grid gap-4 sm:grid-cols-3">
              {TYPE_CARDS.map((card) => {
                const Icon = card.icon;
                return (
                  <button
                    key={card.value}
                    type="button"
                    onClick={() => chooseType(card.value)}
                    className={cn(adminCard, "p-5 text-left transition hover:border-white/25")}
                  >
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-white/[0.06]">
                      <Icon aria-hidden="true" className="h-5 w-5 text-[var(--admin-text-secondary)]" />
                    </div>
                    <h2 className="text-base font-semibold text-[var(--admin-text)]">
                      {PUBLIC_CONTENT_LABEL[card.value]}
                    </h2>
                    <p className="mt-1 text-sm text-[var(--admin-text-secondary)]">{card.description}</p>
                  </button>
                );
              })}
            </div>
          ) : (
            <form onSubmit={onSubmit} noValidate className={cn(adminCardStatic, "space-y-5 p-6")}>
              <h2
                ref={stepTwoHeadingRef}
                tabIndex={-1}
                className="text-base font-semibold text-[var(--admin-text)] outline-none"
              >
                {contentType ? PUBLIC_CONTENT_LABEL[contentType] : ""} details
              </h2>

              <div>
                <label htmlFor="title" className="mb-1 block text-sm text-[var(--admin-text-secondary)]">
                  Title <span aria-hidden="true">*</span>
                </label>
                <input
                  id="title"
                  {...register("title")}
                  aria-invalid={!!errors.title}
                  aria-describedby={errors.title ? "title-error" : undefined}
                  className={cn(adminInput, "w-full")}
                />
                {errors.title ? (
                  <p id="title-error" role="alert" className="mt-1 text-sm text-red-300">
                    {errors.title.message}
                  </p>
                ) : null}
              </div>

              <div>
                <label htmlFor="slug" className="mb-1 block text-sm text-[var(--admin-text-secondary)]">
                  Slug
                </label>
                <input
                  id="slug"
                  {...register("slug")}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setValue("slug", e.target.value);
                  }}
                  aria-invalid={!!errors.slug}
                  aria-describedby={errors.slug ? "slug-error" : "slug-hint"}
                  className={cn(adminInput, "w-full")}
                />
                {errors.slug ? (
                  <p id="slug-error" role="alert" className="mt-1 text-sm text-red-300">
                    {errors.slug.message}
                  </p>
                ) : (
                  <p id="slug-hint" className="mt-1 text-xs text-[var(--admin-text-muted)]">
                    Public URL: /resources/{slug || "…"}
                  </p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="pillar" className="mb-1 block text-sm text-[var(--admin-text-secondary)]">
                    Pillar
                  </label>
                  <input id="pillar" {...register("pillar")} className={cn(adminInput, "w-full")} />
                </div>

                <div>
                  <label htmlFor="week" className="mb-1 block text-sm text-[var(--admin-text-secondary)]">
                    Week
                  </label>
                  <input
                    id="week"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    {...register("week")}
                    aria-invalid={!!errors.week}
                    aria-describedby={errors.week ? "week-error" : undefined}
                    className={cn(adminInput, "w-full")}
                  />
                  {errors.week ? (
                    <p id="week-error" role="alert" className="mt-1 text-sm text-red-300">
                      {errors.week.message}
                    </p>
                  ) : null}
                </div>
              </div>

              <div>
                <label htmlFor="tagsInput" className="mb-1 block text-sm text-[var(--admin-text-secondary)]">
                  Tags
                </label>
                <input
                  id="tagsInput"
                  {...register("tagsInput")}
                  placeholder="Comma separated"
                  aria-invalid={!!errors.tagsInput}
                  aria-describedby={errors.tagsInput ? "tags-error" : "tags-hint"}
                  className={cn(adminInput, "w-full")}
                />
                {errors.tagsInput ? (
                  <p id="tags-error" role="alert" className="mt-1 text-sm text-red-300">
                    {errors.tagsInput.message}
                  </p>
                ) : (
                  <p id="tags-hint" className="mt-1 text-xs text-[var(--admin-text-muted)]">
                    Up to 10. Lowercased and hyphenated automatically.
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="editorialRef" className="mb-1 block text-sm text-[var(--admin-text-secondary)]">
                  Editorial reference
                </label>
                <input
                  id="editorialRef"
                  {...register("editorialRef")}
                  placeholder="e.g. W1-A001"
                  aria-invalid={!!errors.editorialRef}
                  aria-describedby={errors.editorialRef ? "ref-error" : undefined}
                  className={cn(adminInput, "w-full")}
                />
                {errors.editorialRef ? (
                  <p id="ref-error" role="alert" className="mt-1 text-sm text-red-300">
                    {errors.editorialRef.message}
                  </p>
                ) : null}
              </div>

              {/*
                Author defaults to the signed-in admin and is applied at submit time rather than
                through a hidden input: combining `register()` with a `value` prop makes the field
                controlled with no onChange, so RHF reads back an empty string and the uuid check
                silently blocks submission. Reassigning the author happens in the Phase 4 editor.
              */}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => setStep(1)} className={adminBtnSecondary}>
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || createMutation.isPending}
                  className={adminBtnPrimary}
                >
                  {createMutation.isPending ? "Creating…" : "Create draft"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </AdminLayoutNew>
  );
}
