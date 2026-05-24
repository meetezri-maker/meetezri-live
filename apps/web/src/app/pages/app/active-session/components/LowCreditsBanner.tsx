import { memo } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { formatSessionTime } from "../utils/sessionFormat";

export interface LowCreditsBannerProps {
  open: boolean;
  projectedAccountRemainingSeconds: number | null;
  isBuyingMoreMinutes: boolean;
  onBuyMoreMinutes: () => void;
  onDismiss: () => void;
}

function LowCreditsBannerComponent({
  open,
  projectedAccountRemainingSeconds,
  isBuyingMoreMinutes,
  onBuyMoreMinutes,
  onDismiss,
}: LowCreditsBannerProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed bottom-32 left-1/2 -translate-x-1/2 z-40 max-w-md"
        >
          <div className="bg-amber-500 border-2 border-amber-300 rounded-2xl p-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-white flex-shrink-0" />
              <div className="flex-1">
                <h4 className="text-white font-bold mb-1">
                  Running Low on Minutes!
                </h4>
                <p className="text-sm text-amber-50 mb-3">
                  You have{" "}
                  <span className="font-mono">
                    {projectedAccountRemainingSeconds !== null
                      ? formatSessionTime(projectedAccountRemainingSeconds)
                      : "—"}
                  </span>{" "}
                  left. Consider
                  purchasing more or your session will end soon.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={onBuyMoreMinutes}
                    disabled={isBuyingMoreMinutes}
                    className="px-4 py-2 bg-white text-amber-700 rounded-lg font-semibold text-sm hover:bg-amber-50 transition-colors disabled:opacity-70 disabled:cursor-not-allowed inline-flex items-center gap-2"
                  >
                    {isBuyingMoreMinutes && <Loader2 className="w-4 h-4 animate-spin" />}
                    Buy More Minutes
                  </button>
                  <button
                    onClick={onDismiss}
                    disabled={isBuyingMoreMinutes}
                    className="px-4 py-2 bg-amber-600 text-white rounded-lg font-medium text-sm hover:bg-amber-700 transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export const LowCreditsBanner = memo(LowCreditsBannerComponent);
