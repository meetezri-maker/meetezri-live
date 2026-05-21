import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "motion/react";
import {
  modalBodyText,
  modalCloseButton,
  modalOverlay,
  modalPanelSm,
  modalSecondaryButton,
  modalTitle,
} from "@/lib/modalTheme";
import { Button } from "./ui/button";
import { X } from "lucide-react";

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** May return a Promise; Confirm shows a loader until it settles. */
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmLabel?: string;
}

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
}: ConfirmationModalProps) {
  const [confirmLoading, setConfirmLoading] = useState(false);
  const confirmRunRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      setConfirmLoading(false);
      confirmRunRef.current = false;
    }
  }, [isOpen]);

  const handleConfirm = useCallback(async () => {
    if (confirmRunRef.current) return;
    confirmRunRef.current = true;
    setConfirmLoading(true);
    try {
      await Promise.resolve(onConfirm());
    } finally {
      confirmRunRef.current = false;
      setConfirmLoading(false);
    }
  }, [onConfirm]);

  const handleClose = useCallback(() => {
    if (confirmLoading) return;
    onClose();
  }, [confirmLoading, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={cn(modalOverlay, "z-[110]")}
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className={modalPanelSm}
          >
            <div className="p-6">
              <div className="flex items-start justify-between gap-3">
                <h2 className={modalTitle}>{title}</h2>
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={confirmLoading}
                  aria-label="Close"
                  className={cn(modalCloseButton, "disabled:opacity-50 disabled:pointer-events-none")}
                >
                  <X className="size-5" />
                </button>
              </div>
              <p className={cn("mt-2", modalBodyText)}>{message}</p>
            </div>
            <div className="flex justify-end gap-3 border-t border-white/[0.08] px-6 py-4">
              <Button
                type="button"
                variant="ghost"
                onClick={handleClose}
                disabled={confirmLoading}
                className={modalSecondaryButton}
              >
                Cancel
              </Button>
              <Button type="button" onClick={() => void handleConfirm()} isLoading={confirmLoading} disabled={confirmLoading}>
                {confirmLabel}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
