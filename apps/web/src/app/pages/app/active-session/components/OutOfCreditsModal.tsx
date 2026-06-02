import { memo } from "react";
import {
  AlertCircle,
  ArrowRight,
  Clock,
  Crown,
  Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import {
  modalAlertIconWrap,
  modalAlertPanel,
  modalEmphasisText,
  modalInsetPanel,
  modalMutedText,
  modalOverlay,
  modalPrimaryButton,
  modalSecondaryButton,
  modalSectionTitle,
  modalSubtitle,
  modalTitle,
} from "@/lib/modalTheme";
import { formatSessionTime } from "../utils/sessionFormat";

export interface OutOfCreditsModalProps {
  open: boolean;
  sessionTime: number;
  onBuyMoreMinutes: () => void;
  onUpgradePlan: () => void;
  onReturnToDashboard: () => void;
}

const creditsHeroIcon = cn(
  modalAlertIconWrap,
  "h-20 w-20 bg-gradient-to-br from-red-500 to-rose-600",
  "[html[data-ezri-theme=light]_&]:from-[#f87171] [html[data-ezri-theme=light]_&]:to-[#fb7185]",
  "[html[data-theme=light]_&]:from-[#f87171] [html[data-theme=light]_&]:to-[#fb7185]"
);

const creditsActionButton = cn(
  "group flex w-full items-center justify-between rounded-xl p-4 font-semibold text-white transition-all",
  "bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700",
  "[html[data-ezri-theme=light]_&]:from-[#059669] [html[data-ezri-theme=light]_&]:to-[#10b981]",
  "[html[data-theme=light]_&]:from-[#059669] [html[data-theme=light]_&]:to-[#10b981]"
);

const upgradeActionButton = cn(
  modalPrimaryButton,
  "group flex w-full items-center justify-between rounded-xl p-4 text-base"
);

function OutOfCreditsModalComponent({
  open,
  sessionTime,
  onBuyMoreMinutes,
  onUpgradePlan,
  onReturnToDashboard,
}: OutOfCreditsModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={modalOverlay}
          role="presentation"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            className={cn(modalAlertPanel, "max-w-lg p-8")}
            role="dialog"
            aria-modal="true"
            aria-labelledby="out-of-credits-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6 text-center">
              <motion.div
                animate={{ scale: [1, 1.1, 1], rotate: [0, 10, -10, 0] }}
                transition={{ duration: 0.5, repeat: 3 }}
                className={creditsHeroIcon}
              >
                <Clock className="h-10 w-10 text-white" aria-hidden />
              </motion.div>
              <h3 id="out-of-credits-title" className={cn(modalTitle, "mb-2 text-3xl")}>
                Talking Paused
              </h3>
              <p className={cn(modalSubtitle, "text-lg")}>
                You&apos;ve used all your included minutes for this month.
              </p>
            </div>

            <div className={cn(modalInsetPanel, "mb-6 p-6")}>
              <div className="mb-4 text-center">
                <p className={cn(modalMutedText, "mb-2")}>Your Talk time:</p>
                <p className={cn(modalEmphasisText, "font-mono text-4xl")}>
                  {formatSessionTime(sessionTime)}
                </p>
              </div>
              <div
                className={cn(
                  "flex items-center justify-center gap-2 text-amber-400",
                  "[html[data-ezri-theme=light]_&]:text-[#b45309]",
                  "[html[data-theme=light]_&]:text-[#b45309]"
                )}
              >
                <AlertCircle className="h-5 w-5" aria-hidden />
                <span className="text-sm font-medium">0 minutes remaining</span>
              </div>
            </div>

            <div className="mb-6 space-y-3">
              <h4 className={cn(modalSectionTitle, "mb-3 text-center")}>
                Continue Your Wellness Journey:
              </h4>
              <button type="button" onClick={onBuyMoreMinutes} className={creditsActionButton}>
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-lg bg-white/20",
                      "[html[data-ezri-theme=light]_&]:bg-white/25",
                      "[html[data-theme=light]_&]:bg-white/25"
                    )}
                  >
                    <Zap className="h-5 w-5" aria-hidden />
                  </div>
                  <div className="text-left">
                    <p className="font-bold">Buy More Minutes</p>
                    <p
                      className={cn(
                        "text-xs text-green-100",
                        "[html[data-ezri-theme=light]_&]:text-emerald-50",
                        "[html[data-theme=light]_&]:text-emerald-50"
                      )}
                    >
                      Pay-as-you-go available
                    </p>
                  </div>
                </div>
                <ArrowRight
                  className="h-5 w-5 transition-transform group-hover:translate-x-1"
                  aria-hidden
                />
              </button>

              <button type="button" onClick={onUpgradePlan} className={upgradeActionButton}>
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-lg bg-white/20",
                      "[html[data-ezri-theme=light]_&]:bg-white/25",
                      "[html[data-theme=light]_&]:bg-white/25"
                    )}
                  >
                    <Crown className="h-5 w-5" aria-hidden />
                  </div>
                  <div className="text-left">
                    <p className="font-bold">Upgrade Your Plan</p>
                    <p
                      className={cn(
                        "text-xs text-purple-100",
                        "[html[data-ezri-theme=light]_&]:text-fuchsia-50",
                        "[html[data-theme=light]_&]:text-fuchsia-50"
                      )}
                    >
                      Get more minutes & better rates
                    </p>
                  </div>
                </div>
                <ArrowRight
                  className="h-5 w-5 transition-transform group-hover:translate-x-1"
                  aria-hidden
                />
              </button>
            </div>

            <button
              type="button"
              onClick={onReturnToDashboard}
              className={cn(modalSecondaryButton, "w-full py-3")}
            >
              End Talking & Return to Dashboard
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export const OutOfCreditsModal = memo(OutOfCreditsModalComponent);
