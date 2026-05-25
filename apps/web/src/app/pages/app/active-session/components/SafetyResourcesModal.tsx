import { memo } from "react";
import { Heart } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { SafetyResourceCard } from "@/app/components/safety/SafetyResourceCard";
import type { SafetyResource } from "@/app/types/safety";
import { cn } from "@/lib/utils";
import {
  modalAlertIconWrap,
  modalAlertPanel,
  modalOverlay,
  modalPanelBody,
  modalPanelHeader,
  modalSecondaryButton,
  modalSectionTitle,
  modalSubtitle,
  modalTitle,
} from "@/lib/modalTheme";

export interface SafetyResourcesModalProps {
  open: boolean;
  safetyResources: SafetyResource[];
  sessionId: string | undefined;
  safetyState: string;
  onReturnToDashboard: () => void;
}

const safetyHeroIcon = cn(
  modalAlertIconWrap,
  "mb-3 h-14 w-14 bg-gradient-to-br from-red-500 to-rose-600 sm:mb-4 sm:h-20 sm:w-20",
  "[html[data-ezri-theme=light]_&]:from-[#f87171] [html[data-ezri-theme=light]_&]:to-[#fb7185]",
  "[html[data-theme=light]_&]:from-[#f87171] [html[data-theme=light]_&]:to-[#fb7185]"
);

function SafetyResourcesModalComponent({
  open,
  safetyResources,
  sessionId,
  safetyState,
  onReturnToDashboard,
}: SafetyResourcesModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={cn(modalOverlay, "p-2 sm:p-4")}
          role="presentation"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            className={cn(
              modalAlertPanel,
              "flex h-[94dvh] max-w-2xl flex-col overflow-hidden rounded-2xl sm:h-[90dvh] sm:rounded-3xl"
            )}
            role="dialog"
            aria-modal="true"
            aria-labelledby="safety-resources-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={cn(modalPanelHeader, "shrink-0 px-4 pb-4 pt-4 text-center sm:px-6 sm:pt-6")}>
              <motion.div
                animate={{ scale: [1, 1.1, 1], rotate: [0, 10, -10, 0] }}
                transition={{ duration: 0.5, repeat: 3 }}
                className={cn(safetyHeroIcon, "mx-auto")}
              >
                <Heart className="h-7 w-7 text-white sm:h-10 sm:w-10" aria-hidden />
              </motion.div>
              <h3 id="safety-resources-title" className={cn(modalTitle, "mb-2 text-2xl sm:text-3xl")}>
                Safety Resources
              </h3>
              <p className={cn(modalSubtitle, "text-sm sm:text-lg")}>
                We&apos;ve detected a potential safety concern in your conversation. Here are some
                resources to help you.
              </p>
            </div>

            <div className={cn(modalPanelBody, "flex-1 overflow-y-auto px-3 py-4 sm:px-6")}>
              <h4 className={cn(modalSectionTitle, "mb-3 text-center")}>Emergency Resources:</h4>
              <div className="space-y-3">
                {safetyResources.map((resource) => (
                  <SafetyResourceCard
                    key={resource.id}
                    resource={resource}
                    contextSessionId={sessionId}
                    safetyState={safetyState}
                  />
                ))}
              </div>
            </div>

            <div
              className={cn(
                modalPanelHeader,
                "shrink-0 border-t px-4 py-3 sm:px-6",
                "[html[data-ezri-theme=light]_&]:bg-[var(--surface-soft,#fbf8ff)]",
                "[html[data-theme=light]_&]:bg-[var(--surface-soft,#fbf8ff)]"
              )}
            >
              <button
                type="button"
                onClick={onReturnToDashboard}
                className={cn(modalSecondaryButton, "w-full py-3")}
              >
                End Talking & Return to Dashboard
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export const SafetyResourcesModal = memo(SafetyResourcesModalComponent);
