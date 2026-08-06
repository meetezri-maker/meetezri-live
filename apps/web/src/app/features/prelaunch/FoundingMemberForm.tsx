import { useId, useRef, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Link } from "react-router-dom";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { FOUNDING_FORM } from "./prelaunch.content";
import {
  PRELAUNCH_CONSENT_SOURCE,
  resolvePrelaunchAttribution,
} from "./prelaunch.attribution";
import { trackPrelaunchEvent } from "./prelaunch.analytics";

const foundingMemberSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Please enter your email address")
    .email("Please enter a valid email address (e.g. name@domain.com)"),
  // Optional in the product sense, but kept required-with-empty-default here:
  // `ZodOptional` fields don't line up with this project's zod/resolver versions.
  firstName: z.string().trim().max(80, "Please use 80 characters or fewer"),
});

type FoundingMemberFormValues = z.infer<typeof foundingMemberSchema>;

type SubmissionState =
  | { kind: "idle" }
  | { kind: "success"; status: "created" | "existing" }
  | { kind: "error"; message: string };

export interface FoundingMemberFormProps {
  /** Distinguishes which entry point produced the signup, for analytics only. */
  origin: string;
  className?: string;
  /** Rendered inside a modal — the success state announces itself more assertively. */
  compact?: boolean;
}

/**
 * The single Founding Circle signup form.
 *
 * Every primary CTA on the page ends up here, whether inline in Section 8 or in
 * the modal. Submission is idempotent server-side, so a returning visitor sees a
 * reassuring confirmation rather than an error.
 */
export function FoundingMemberForm({ origin, className, compact = false }: FoundingMemberFormProps) {
  const [submission, setSubmission] = useState<SubmissionState>({ kind: "idle" });
  const hasStartedRef = useRef(false);
  const fieldPrefix = useId();
  const emailId = `${fieldPrefix}-email`;
  const firstNameId = `${fieldPrefix}-first-name`;
  const emailErrorId = `${emailId}-error`;
  const firstNameErrorId = `${firstNameId}-error`;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FoundingMemberFormValues>({
    // The installed zod (v4) and @hookform/resolvers versions disagree on the
    // schema type, which is why other forms in this app report TS2769 here.
    // Runtime behaviour is correct and covered by FoundingMemberForm.test.tsx.
    resolver: zodResolver(foundingMemberSchema as never) as Resolver<FoundingMemberFormValues>,
    defaultValues: { email: "", firstName: "" },
    mode: "onSubmit",
  });

  function handleFirstInteraction() {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;
    trackPrelaunchEvent("founding_member_form_started", { origin });
  }

  async function onSubmit(values: FoundingMemberFormValues) {
    // `isSubmitting` already disables the control; this guards programmatic double submits.
    if (isSubmitting) return;

    setSubmission({ kind: "idle" });
    trackPrelaunchEvent("founding_member_form_submitted", { origin });

    const attribution = resolvePrelaunchAttribution();

    try {
      const result = await api.joinFoundingCircle({
        email: values.email,
        firstName: values.firstName.trim() || null,
        consentSource: PRELAUNCH_CONSENT_SOURCE,
        ...attribution,
      });

      setSubmission({ kind: "success", status: result.status });
      trackPrelaunchEvent("founding_member_submission_succeeded", {
        origin,
        status: result.status,
      });
      if (result.status === "existing") {
        trackPrelaunchEvent("founding_member_existing_email", { origin });
      }
    } catch (error) {
      const message =
        error instanceof Error && error.message ? error.message : FOUNDING_FORM.errorFallback;
      setSubmission({ kind: "error", message });
      trackPrelaunchEvent("founding_member_submission_failed", { origin });
    }
  }

  if (submission.kind === "success") {
    return (
      <FoundingMemberSuccess status={submission.status} compact={compact} className={className} />
    );
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      className={cn("flex w-full flex-col gap-4 text-left", className)}
      aria-describedby={`${fieldPrefix}-consent`}
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor={emailId} className="text-sm font-medium text-white/90">
          {FOUNDING_FORM.emailLabel}
        </label>
        <input
          id={emailId}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder={FOUNDING_FORM.emailPlaceholder}
          aria-required="true"
          aria-invalid={errors.email ? "true" : undefined}
          aria-describedby={errors.email ? emailErrorId : undefined}
          disabled={isSubmitting}
          {...register("email", { onChange: handleFirstInteraction })}
          className={cn(
            "w-full rounded-xl border bg-black/30 px-4 py-3 text-[15px] text-white",
            "placeholder:text-white/35 backdrop-blur-sm transition-colors",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70",
            "disabled:cursor-not-allowed disabled:opacity-60",
            errors.email ? "border-rose-400/70" : "border-white/15 focus-visible:border-violet-400/60",
          )}
        />
        {errors.email ? (
          <p id={emailErrorId} role="alert" className="text-sm text-rose-300">
            {errors.email.message}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={firstNameId} className="text-sm font-medium text-white/90">
          {FOUNDING_FORM.firstNameLabel}{" "}
          <span className="font-normal text-white/45">({FOUNDING_FORM.firstNameOptional})</span>
        </label>
        <input
          id={firstNameId}
          type="text"
          autoComplete="name"
          placeholder={FOUNDING_FORM.firstNamePlaceholder}
          aria-invalid={errors.firstName ? "true" : undefined}
          aria-describedby={errors.firstName ? firstNameErrorId : undefined}
          disabled={isSubmitting}
          {...register("firstName", { onChange: handleFirstInteraction })}
          className={cn(
            "w-full rounded-xl border bg-black/30 px-4 py-3 text-[15px] text-white",
            "placeholder:text-white/35 backdrop-blur-sm transition-colors",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70",
            "disabled:cursor-not-allowed disabled:opacity-60",
            errors.firstName
              ? "border-rose-400/70"
              : "border-white/15 focus-visible:border-violet-400/60",
          )}
        />
        {errors.firstName ? (
          <p id={firstNameErrorId} role="alert" className="text-sm text-rose-300">
            {errors.firstName.message}
          </p>
        ) : null}
      </div>

      {submission.kind === "error" ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-rose-400/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-100"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{submission.message}</span>
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className={cn(
          "landing-cta-glow inline-flex w-full items-center justify-center gap-2 rounded-xl",
          "bg-gradient-to-r from-[#E91E63] to-[#9C27B0] px-8 py-3.5 text-base font-semibold text-white",
          "transition-transform hover:scale-[1.01] active:scale-[0.99]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80",
          "focus-visible:ring-offset-2 focus-visible:ring-offset-[#050816]",
          "disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:scale-100",
        )}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {FOUNDING_FORM.submittingLabel}
          </>
        ) : (
          FOUNDING_FORM.submitLabel
        )}
      </button>

      <p
        id={`${fieldPrefix}-consent`}
        className="text-xs leading-relaxed text-[var(--solace-ds-text-muted)]"
      >
        {FOUNDING_FORM.consent}{" "}
        <Link to="/privacy" className="text-violet-300 underline underline-offset-2 hover:text-violet-200">
          Privacy Policy
        </Link>
        .
      </p>
    </form>
  );
}

/** Premium confirmation state shown in place of the form after a successful signup. */
export function FoundingMemberSuccess({
  status,
  compact = false,
  className,
}: {
  status: "created" | "existing";
  compact?: boolean;
  className?: string;
}) {
  const isExisting = status === "existing";
  const heading = isExisting ? FOUNDING_FORM.existingHeading : FOUNDING_FORM.successHeading;
  const body = isExisting ? FOUNDING_FORM.existingBody : FOUNDING_FORM.successBody;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex w-full flex-col items-center gap-4 rounded-2xl border border-emerald-400/25",
        "bg-emerald-500/[0.07] px-6 text-center backdrop-blur-sm",
        compact ? "py-8" : "py-10",
        className,
      )}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15">
        <CheckCircle2 className="h-6 w-6 text-emerald-300" aria-hidden />
      </span>
      <h3 className="landing-serif text-xl font-semibold text-white sm:text-2xl">{heading}</h3>
      <div className="space-y-2 text-[15px] leading-relaxed text-white/80">
        {body.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
    </div>
  );
}
