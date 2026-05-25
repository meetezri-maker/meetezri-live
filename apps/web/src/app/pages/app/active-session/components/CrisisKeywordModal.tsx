import { memo } from "react";
import { AlertCircle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import {
  modalAlertIconWrap,
  modalAlertPanel,
  modalBodyText,
  modalDestructiveButton,
  modalOverlay,
  modalSecondaryButton,
  modalTitle,
} from "@/lib/modalTheme";

export interface CrisisKeywordModalProps {
  open: boolean;
  detectedCrisisKeywords: string[];
  crisisDialTarget: string | null;
  onCallEmergency: () => void;
  onViewSafetyResources: () => void;
  onDismiss: () => void;
}

const crisisHeroIcon = cn(
  modalAlertIconWrap,
  "mb-3 h-14 w-14 bg-red-600",
  "[html[data-ezri-theme=light]_&]:bg-[#dc2626]",
  "[html[data-theme=light]_&]:bg-[#dc2626]"
);

const crisisKeywordChip = cn(
  "rounded-md border px-2 py-1 text-xs",
  "border-red-300/30 bg-red-900/60 text-red-100",
  "[html[data-ezri-theme=light]_&]:border-[#fecaca]",
  "[html[data-ezri-theme=light]_&]:bg-[#fef2f2]",
  "[html[data-ezri-theme=light]_&]:text-[#991b1b]",
  "[html[data-theme=light]_&]:border-[#fecaca]",
  "[html[data-theme=light]_&]:bg-[#fef2f2]",
  "[html[data-theme=light]_&]:text-[#991b1b]"
);

const crisisDismissButton = cn(
  "w-full rounded-xl bg-transparent px-4 py-3 font-medium",
  "text-red-200",
  "[html[data-ezri-theme=light]_&]:text-[#b91c1c]",
  "[html[data-theme=light]_&]:text-[#b91c1c]"
);

function CrisisKeywordModalComponent({
  open,
  detectedCrisisKeywords,
  crisisDialTarget,
  onCallEmergency,
  onViewSafetyResources,
  onDismiss,
}: CrisisKeywordModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={cn(modalOverlay, "p-3 sm:p-4")}
          role="presentation"
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            className={cn(
              modalAlertPanel,
              "max-h-[92dvh] w-full max-w-md overflow-y-auto p-4 sm:rounded-3xl sm:p-6"
            )}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="crisis-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 text-center">
              <div className={cn(crisisHeroIcon, "mx-auto")}>
                <AlertCircle className="h-7 w-7 text-white" aria-hidden />
              </div>
              <h3 id="crisis-modal-title" className={cn(modalTitle, "text-xl sm:text-2xl")}>
                Emergency alert detected
              </h3>
              <p
                className={cn(
                  modalBodyText,
                  "mt-2 text-sm sm:text-base",
                  "text-red-100",
                  "[html[data-ezri-theme=light]_&]:text-[#991b1b]",
                  "[html[data-theme=light]_&]:text-[#991b1b]"
                )}
              >
                We detected wording that suggests you may need immediate help. Please contact
                emergency support now.
              </p>
            </div>

            {detectedCrisisKeywords.length > 0 ? (
              <div className="mb-5">
                <p
                  className={cn(
                    modalBodyText,
                    "mb-2 text-xs",
                    "text-red-100/90",
                    "[html[data-ezri-theme=light]_&]:text-[#b91c1c]",
                    "[html[data-theme=light]_&]:text-[#b91c1c]"
                  )}
                >
                  Detected keywords:
                </p>
                <div className="flex flex-wrap gap-2">
                  {detectedCrisisKeywords.slice(0, 6).map((kw) => (
                    <span key={kw} className={crisisKeywordChip}>
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <button
                type="button"
                onClick={onCallEmergency}
                className={cn(modalDestructiveButton, "w-full bg-red-600 py-3 hover:bg-red-700")}
              >
                Call Emergency Now{crisisDialTarget ? ` (${crisisDialTarget})` : ""}
              </button>
              <button
                type="button"
                onClick={onViewSafetyResources}
                className={cn(modalSecondaryButton, "w-full py-3")}
              >
                View Safety Resources
              </button>
              <button type="button" onClick={onDismiss} className={crisisDismissButton}>
                Dismiss
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export const CrisisKeywordModal = memo(CrisisKeywordModalComponent);
