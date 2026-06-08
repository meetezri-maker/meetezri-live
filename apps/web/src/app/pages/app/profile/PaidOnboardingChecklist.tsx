import { motion } from "motion/react";
import { CheckCircle2, Circle, ChevronRight, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  PaidOnboardingChecklistResult,
  PaidOnboardingStepAction,
  PaidOnboardingStepStatus,
} from "@/lib/onboarding/paidOnboardingSteps";
import {
  profileBannerBtnViolet,
  profileTrialBanner,
  profileCard,
  profileCardTitle,
  profileCardSubtitle,
  profilePillEmerald,
  profilePillAmber,
} from "./profileUi";

interface PaidOnboardingChecklistProps {
  checklist: PaidOnboardingChecklistResult;
  onStepAction: (action: PaidOnboardingStepAction) => void;
}

function StepRow({
  step,
  onStepAction,
  emphasize,
}: {
  step: PaidOnboardingStepStatus;
  onStepAction: (action: PaidOnboardingStepAction) => void;
  emphasize?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3.5 transition-colors",
        step.isComplete
          ? "border-white/[0.06] bg-white/[0.02]"
          : emphasize
            ? "border-amber-400/25 bg-amber-500/[0.07]"
            : "border-violet-400/20 bg-violet-500/[0.06]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {step.isComplete ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" aria-hidden />
          ) : (
            <Circle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300/80" aria-hidden />
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white/92">{step.title}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-violet-200/62">{step.description}</p>
            {step.missingItems.length > 0 && (
              <ul className="mt-2 space-y-1">
                {step.missingItems.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-xs text-amber-100/85">
                    <span className="h-1 w-1 rounded-full bg-amber-300/80" aria-hidden />
                    <span>Missing: {item}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        {!step.isComplete && (
          <button
            type="button"
            onClick={() => onStepAction(step.action)}
            className={cn(profileBannerBtnViolet, "shrink-0 px-3 py-2 text-xs")}
          >
            Update
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}

export function PaidOnboardingChecklist({
  checklist,
  onStepAction,
}: PaidOnboardingChecklistProps) {
  if (!checklist.hasIncomplete) return null;

  const completedSteps = checklist.steps.filter((step) => step.isComplete);

  return (
    <motion.section
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(profileCard, "overflow-hidden")}
      aria-label="Onboarding setup checklist"
    >
      <div className={cn("border-b border-white/[0.06] px-5 py-4", profileTrialBanner)}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-500/20">
              <ListChecks className="h-5 w-5 text-violet-200" aria-hidden />
            </div>
            <div className="min-w-0">
              <h2 className={profileCardTitle}>Complete your setup</h2>
              <p className={profileCardSubtitle}>
                You can finish skipped onboarding steps here without restarting the full flow.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={profilePillEmerald}>
              {checklist.completedCount}/{checklist.totalCount} done
            </span>
            <span className={profilePillAmber}>{checklist.percentComplete}%</span>
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.06]">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-[#FF4E91] via-[#d946ef] to-[#8A4FFF]"
            initial={{ width: 0 }}
            animate={{ width: `${checklist.percentComplete}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
        {checklist.incompleteSteps[0] && (
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => onStepAction(checklist.incompleteSteps[0].action)}
              className={profileBannerBtnViolet}
            >
              Continue setup
            </button>
          </div>
        )}
      </div>

      <div className="space-y-3 p-4 sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-200/55">
          Still to complete
        </p>
        {checklist.incompleteSteps.map((step) => (
          <StepRow key={step.id} step={step} onStepAction={onStepAction} emphasize />
        ))}

        {completedSteps.length > 0 && (
          <details className="group pt-2">
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.18em] text-violet-200/45 transition-colors hover:text-violet-200/70">
              Completed steps ({completedSteps.length})
            </summary>
            <div className="mt-3 space-y-2">
              {completedSteps.map((step) => (
                <StepRow key={step.id} step={step} onStepAction={onStepAction} />
              ))}
            </div>
          </details>
        )}
      </div>
    </motion.section>
  );
}
