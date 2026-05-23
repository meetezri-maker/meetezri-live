import { memo } from "react";
import { AlertCircle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

export interface SafetyBoundaryBannerProps {
  open: boolean;
  onViewResources: () => void;
  onDismiss: () => void;
}

function SafetyBoundaryBannerComponent({
  open,
  onViewResources,
  onDismiss,
}: SafetyBoundaryBannerProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed bottom-32 left-1/2 -translate-x-1/2 z-40 max-w-md"
        >
          <div className="bg-red-500 border-2 border-red-300 rounded-2xl p-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-white flex-shrink-0" />
              <div className="flex-1">
                <h4 className="text-white font-bold mb-1">Safety Alert!</h4>
                <p className="text-sm text-red-50 mb-3">
                  We've detected a potential safety concern in your
                  conversation. Please take a moment to review the following
                  resources.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={onViewResources}
                    className="px-4 py-2 bg-white text-red-700 rounded-lg font-semibold text-sm hover:bg-red-50 transition-colors"
                  >
                    View Resources
                  </button>
                  <button
                    onClick={onDismiss}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium text-sm hover:bg-red-700 transition-colors"
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

export const SafetyBoundaryBanner = memo(SafetyBoundaryBannerComponent);
