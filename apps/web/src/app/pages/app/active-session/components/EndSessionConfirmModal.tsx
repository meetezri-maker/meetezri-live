import { memo } from "react";
import { Loader2, PhoneOff } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { MouseEvent } from "react";
import { cn } from "@/lib/utils";
import {
  modalAlertIconWrap,
  modalAlertPanel,
  modalDestructiveButton,
  modalMutedText,
  modalOverlay,
  modalSecondaryButton,
  modalSubtitle,
  modalTitle,
} from "@/lib/modalTheme";
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
          className={modalOverlay}
          onClick={onClose}
          role="presentation"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e: MouseEvent) => e.stopPropagation()}
            className={cn(modalAlertPanel, "max-w-md p-6")}
            role="dialog"
            aria-modal="true"
            aria-labelledby="end-session-title"
          >
            <div className="mb-6 text-center">
              <div className={modalAlertIconWrap}>
                <PhoneOff
                  className="h-8 w-8 text-red-400 [html[data-ezri-theme=light]_&]:text-[#dc2626] [html[data-theme=light]_&]:text-[#dc2626]"
                  aria-hidden
                />
              </div>
              <h3 id="end-session-title" className={cn(modalTitle, "mb-2 text-xl")}>
                End Talking?
              </h3>
              <p className={modalSubtitle}>
                Are you sure you want to end your video session with {companionName}?
              </p>
              <p className={cn(modalMutedText, "mt-2 text-sm")}>
                Talking duration: {formatSessionTime(sessionTime)}
              </p>
            </div>

            <div className="flex gap-3">
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onClose}
                className={cn(modalSecondaryButton, "flex flex-1 items-center justify-center py-3")}
              >
                Continue Talking
              </motion.button>

              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onEndSession}
                disabled={isUploading}
                className={cn(
                  modalDestructiveButton,
                  "flex flex-1 items-center justify-center gap-2 py-3",
                  isUploading && "cursor-not-allowed opacity-70"
                )}
              >
                {isUploading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : null}
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
