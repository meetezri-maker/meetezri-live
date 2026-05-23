import { memo } from "react";
import { AlertCircle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

export interface CrisisKeywordModalProps {
  open: boolean;
  detectedCrisisKeywords: string[];
  crisisDialTarget: string | null;
  onCallEmergency: () => void;
  onViewSafetyResources: () => void;
  onDismiss: () => void;
}

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
          className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4"
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-slate-900 to-red-950 rounded-2xl sm:rounded-3xl p-4 sm:p-6 max-w-md w-full max-h-[92dvh] overflow-y-auto border border-red-400/40 shadow-2xl"
          >
            <div className="text-center mb-4">
              <div className="w-14 h-14 rounded-full bg-red-600 flex items-center justify-center mx-auto mb-3">
                <AlertCircle className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-white">Emergency alert detected</h3>
              <p className="text-sm sm:text-base text-red-100 mt-2">
                We detected wording that suggests you may need immediate help. Please contact emergency support now.
              </p>
            </div>

            {detectedCrisisKeywords.length > 0 ? (
              <div className="mb-5">
                <p className="text-xs text-red-100/90 mb-2">Detected keywords:</p>
                <div className="flex flex-wrap gap-2">
                  {detectedCrisisKeywords.slice(0, 6).map((kw) => (
                    <span
                      key={kw}
                      className="px-2 py-1 rounded-md text-xs bg-red-900/60 text-red-100 border border-red-300/30"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <button
                onClick={onCallEmergency}
                className="w-full px-4 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold"
              >
                Call Emergency Now{crisisDialTarget ? ` (${crisisDialTarget})` : ""}
              </button>
              <button
                onClick={onViewSafetyResources}
                className="w-full px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium"
              >
                View Safety Resources
              </button>
              <button
                onClick={onDismiss}
                className="w-full px-4 py-3 rounded-xl bg-transparent text-red-200 font-medium"
              >
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
