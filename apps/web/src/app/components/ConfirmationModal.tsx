import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
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
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[110] flex items-center justify-center p-4"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full"
          >
            <div className="p-6">
              <div className="flex items-start justify-between">
                <h2 className="text-xl font-bold text-gray-900">{title}</h2>
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={confirmLoading}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:pointer-events-none"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <p className="mt-2 text-gray-600">{message}</p>
            </div>
            <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 rounded-b-2xl">
              <Button type="button" variant="outline" onClick={handleClose} disabled={confirmLoading}>
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
