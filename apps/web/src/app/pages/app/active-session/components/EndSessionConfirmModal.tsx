import { memo } from "react";
import { Loader2, PhoneOff } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { MouseEvent } from "react";
import { formatSessionTime } from "../utils/sessionFormat";

export interface EndSessionConfirmModalProps {
  open: boolean;
  companionName: string;
  sessionTime: number;
  isUploading: boolean;
  onClose: () => void;
  onEndSession: () => void;
}

function EndSessionConfirmModalComponent({
  open,
  companionName,
  sessionTime,
  isUploading,
  onClose,
  onEndSession,
}: EndSessionConfirmModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e: MouseEvent) => e.stopPropagation()}
            className="bg-slate-900 rounded-2xl p-6 max-w-md w-full border-2 border-red-500/30"
          >
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <PhoneOff className="w-8 h-8 text-red-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">
                End Talking?
              </h3>
              <p className="text-gray-300">
                Are you sure you want to end your video session with{" "}
                {companionName}?
              </p>
              <p className="text-sm text-gray-400 mt-2">
                Talking duration: {formatSessionTime(sessionTime)}
              </p>
            </div>

            <div className="flex gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onClose}
                className="flex-1 px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium"
              >
                Continue Talking
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onEndSession}
                disabled={isUploading}
                className={`flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 text-white font-medium flex items-center justify-center gap-2 ${isUploading ? "opacity-70 cursor-not-allowed" : ""
                  }`}
              >
                {isUploading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : null}
                {isUploading ? "Ending..." : "End Talking"}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export const EndSessionConfirmModal = memo(EndSessionConfirmModalComponent);
