import { memo } from "react";
import { Heart } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { SafetyResourceCard } from "@/app/components/safety/SafetyResourceCard";
import type { SafetyResource } from "@/app/types/safety";

export interface SafetyResourcesModalProps {
  open: boolean;
  safetyResources: SafetyResource[];
  sessionId: string | undefined;
  safetyState: string;
  onReturnToDashboard: () => void;
}

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
          className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-2 sm:p-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-slate-900 to-purple-900 rounded-2xl sm:rounded-3xl w-full max-w-2xl h-[94dvh] sm:h-[90dvh] border-2 border-red-500/30 shadow-2xl flex flex-col overflow-hidden"
          >
            <div className="text-center px-4 sm:px-6 pt-4 sm:pt-6 pb-4 border-b border-white/10">
              <motion.div
                animate={{ scale: [1, 1.1, 1], rotate: [0, 10, -10, 0] }}
                transition={{ duration: 0.5, repeat: 3 }}
                className="w-14 h-14 sm:w-20 sm:h-20 bg-gradient-to-br from-red-500 to-rose-600 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4"
              >
                <Heart className="w-7 h-7 sm:w-10 sm:h-10 text-white" />
              </motion.div>
              <h3 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                Safety Resources
              </h3>
              <p className="text-sm sm:text-lg text-gray-300">
                We've detected a potential safety concern in your conversation.
                Here are some resources to help you.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4">
              <h4 className="text-white font-semibold text-center mb-3">
                Emergency Resources:
              </h4>
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

            <div className="px-4 sm:px-6 py-3 border-t border-white/10 bg-black/20">
              <button
                onClick={onReturnToDashboard}
                className="w-full px-4 sm:px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-colors"
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
