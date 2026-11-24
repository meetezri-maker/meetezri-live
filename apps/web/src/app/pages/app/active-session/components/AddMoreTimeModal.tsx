import { memo, useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import {
  modalAlertIconWrap,
  modalAlertPanel,
  modalMutedText,
  modalOverlay,
  modalPrimaryButton,
  modalSecondaryButton,
  modalSubtitle,
  modalTitle,
} from "@/lib/modalTheme";
import { extensionMinuteChoices, type ExtensionHoldState } from "../utils/sessionExtension";
import { formatSessionTime } from "../utils/sessionFormat";

export interface AddMoreTimeModalProps {
  hold: ExtensionHoldState | null;
  onAddMinutes: (minutes: number) => void;
  onEndSession: () => void;
}

function DecisionCountdown({ deadlineMs }: { deadlineMs: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const secondsLeft = Math.max(0, Math.ceil((deadlineMs - now) / 1000));
  return (
    <p className={cn(modalMutedText, "mb-4 text-center text-sm")}>
      Decide within <span className="font-mono">{formatSessionTime(secondsLeft)}</span> or your
      session will end and be saved.
    </p>
  );
}

function AddMoreTimeModalComponent({ hold, onAddMinutes, onEndSession }: AddMoreTimeModalProps) {
  const choices = hold && !hold.unavailable ? extensionMinuteChoices(hold.availableSeconds) : [];
  const [picked, setPicked] = useState<number | null>(null);
  const minutes =
    picked !== null && choices.includes(picked)
      ? picked
      : choices.includes(10)
        ? 10
        : (choices[choices.length - 1] ?? null);
  const busy = hold?.phase !== "choosing";

  return (
    <AnimatePresence>
      {hold && (
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
            aria-labelledby="add-more-time-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6 text-center">
              <div className={cn(modalAlertIconWrap, "h-20 w-20")}>
                <Clock className="h-10 w-10 text-white" aria-hidden />
              </div>
              <h3 id="add-more-time-title" className={cn(modalTitle, "mb-2 text-3xl")}>
                Your session time is up
              </h3>
              <p className={cn(modalSubtitle, "text-lg")}>
                {choices.length > 0
                  ? "Your conversation is paused. Add more time from your balance to keep talking."
                  : hold.unavailable
                    ? "Your conversation is paused."
                    : "You don't have enough minutes left to add more time."}
              </p>
            </div>

            <DecisionCountdown deadlineMs={hold.deadlineMs} />

            {choices.length > 0 && (
              <div className="mb-4 flex flex-wrap justify-center gap-2" role="group" aria-label="Minutes to add">
                {choices.map((choice) => (
                  <button
                    key={choice}
                    type="button"
                    disabled={busy}
                    aria-pressed={choice === minutes}
                    onClick={() => setPicked(choice)}
                    className={cn(
                      choice === minutes ? modalPrimaryButton : modalSecondaryButton,
                      "rounded-xl px-4 py-2",
                    )}
                  >
                    {choice} min
                  </button>
                ))}
              </div>
            )}

            {hold.phase === "securing" && (
              <p className={cn(modalMutedText, "mb-4 text-center text-sm")} role="status">
                Time added. Getting your conversation ready…
              </p>
            )}
            {hold.error && (
              <p className={cn(modalMutedText, "mb-4 text-center text-sm")} role="alert">
                {hold.error}
              </p>
            )}

            <div className="space-y-3">
              {minutes !== null && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onAddMinutes(minutes)}
                  className={cn(modalPrimaryButton, "w-full py-3")}
                >
                  Add more time
                </button>
              )}
              <button
                type="button"
                onClick={onEndSession}
                className={cn(modalSecondaryButton, "w-full py-3")}
              >
                End session &amp; return to dashboard
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export const AddMoreTimeModal = memo(AddMoreTimeModalComponent);
