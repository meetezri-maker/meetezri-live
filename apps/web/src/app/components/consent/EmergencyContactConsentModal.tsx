import { useEffect, useId, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  EMERGENCY_CONTACT_CONSENT_PROMPT,
  type EmergencyContactConsentPrompt,
} from "@meetezri/shared";
import { AlertTriangle, Check, CheckCircle2, Heart, Loader2, Shield } from "lucide-react";
import { cn } from "@/app/components/ui/utils";
import { Dialog, DialogPortal } from "../ui/dialog";
import { Checkbox } from "../ui/checkbox";
import { Label } from "../ui/label";
import {
  emergencyModalAmberNotice,
  emergencyModalAmberTitle,
  emergencyModalBody,
  emergencyModalBtnCancel,
  emergencyModalBtnPrimary,
  emergencyModalBtnRow,
  emergencyModalCheckbox,
  emergencyModalCheckboxHelp,
  emergencyModalCheckboxLabel,
  emergencyModalConsentBox,
  emergencyModalEyebrow,
  emergencyModalHeaderIcon,
  emergencyModalNoteItem,
  emergencyModalNoteList,
  emergencyModalOverlayDialog,
  emergencyModalSectionHeading,
  emergencyModalShell,
  emergencyModalSubtitle,
  emergencyModalTitle,
} from "@/app/pages/app/emergency-contacts/emergencyContactsUi";

export type EmergencyContactConsentModalVariant = "gate" | "review";

export interface EmergencyContactConsentModalProps {
  open: boolean;
  /** `gate` blocks the page until consent; `review` is opened anytime via the eye control. */
  variant?: EmergencyContactConsentModalVariant;
  /** When true in `review` mode, shows read-only “already agreed” state. */
  alreadyConsented?: boolean;
  /** Defaults to shared production prompt; inject alternatives for A/B or admin preview. */
  promptConfig?: EmergencyContactConsentPrompt;
  onConsent: () => void | Promise<void>;
  onCancel: () => void;
  /** Called when the user dismisses a `review` modal (Close, overlay, or Escape). */
  onClose?: () => void;
  isSubmitting?: boolean;
}

/**
 * Blocking consent dialog for emergency contact notification policy.
 * Must be controlled by the parent (`open`). Does not close on overlay click or Escape.
 */
export function EmergencyContactConsentModal({
  open,
  variant = "gate",
  alreadyConsented = false,
  promptConfig = EMERGENCY_CONTACT_CONSENT_PROMPT,
  onConsent,
  onCancel,
  onClose,
  isSubmitting = false,
}: EmergencyContactConsentModalProps) {
  const baseId = useId();
  const [checkboxChecked, setCheckboxChecked] = useState(false);
  const isReview = variant === "review";
  const showAlreadyAgreed = isReview && alreadyConsented;

  useEffect(() => {
    if (open && !showAlreadyAgreed) {
      setCheckboxChecked(false);
    }
  }, [open, showAlreadyAgreed]);

  const descriptionId = `${baseId}-description`;
  const checkboxDescId = `${baseId}-checkbox-help`;

  const handleDismissReview = () => {
    onClose?.();
    onCancel();
  };

  return (
    <Dialog
      open={open}
      modal
      onOpenChange={(next) => {
        if (!next && isReview) {
          handleDismissReview();
        }
      }}
    >
      <DialogPortal>
        <DialogPrimitive.Overlay className={emergencyModalOverlayDialog} />
        <DialogPrimitive.Content
          aria-describedby={descriptionId}
          onEscapeKeyDown={(e) => {
            if (isReview) return;
            e.preventDefault();
          }}
          onPointerDownOutside={(e) => {
            if (isReview) return;
            e.preventDefault();
          }}
          className={cn(
            "fixed inset-0 z-[201] flex items-center justify-center p-4 sm:p-6",
            "outline-none",
          )}
        >
          <div className={emergencyModalShell}>
            <div className="flex items-start gap-4">
              <div className={emergencyModalHeaderIcon}>
                <Shield className="h-5 w-5" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className={emergencyModalEyebrow}>Safety consent</p>
                <DialogPrimitive.Title className={emergencyModalTitle}>
                  {promptConfig.title}
                </DialogPrimitive.Title>
                <p className={emergencyModalSubtitle}>
                  A calm confirmation before you manage emergency contacts.
                </p>
              </div>
            </div>

            <div id={descriptionId} className="mt-6 space-y-5">
              <section className="space-y-2">
                <h3 className={emergencyModalSectionHeading}>{promptConfig.purposeHeading}</h3>
                <p className={emergencyModalBody}>{promptConfig.purposeBody}</p>
              </section>

              <section className={emergencyModalAmberNotice} role="note">
                <h3 className={emergencyModalAmberTitle}>
                  <AlertTriangle className="h-4 w-4 shrink-0 text-violet-300/85" aria-hidden />
                  {promptConfig.emergencyOnlyHeading}
                </h3>
                <p className={emergencyModalBody}>{promptConfig.emergencyOnlyBody}</p>
              </section>

              {promptConfig.additionalNotes.length > 0 ? (
                <ul className={emergencyModalNoteList}>
                  {promptConfig.additionalNotes.map((line) => (
                    <li key={line} className={emergencyModalNoteItem}>
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-violet-300/55" aria-hidden />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <div className={cn(emergencyModalConsentBox, "mt-6")}>
              {showAlreadyAgreed ? (
                <div className="flex items-start gap-3">
                  <CheckCircle2
                    className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300/90"
                    aria-hidden
                  />
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-medium text-emerald-100/95">You already agreed</p>
                    <p className={emergencyModalCheckboxHelp}>
                      You previously consented to emergency contact notification for serious safety
                      situations. You can review the details above at any time.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <Checkbox
                    id={`${baseId}-consent-cb`}
                    checked={checkboxChecked}
                    onCheckedChange={(v) => setCheckboxChecked(v === true)}
                    className={emergencyModalCheckbox}
                    aria-describedby={checkboxDescId}
                    disabled={isSubmitting}
                  />
                  <div className="min-w-0 space-y-1">
                    <Label htmlFor={`${baseId}-consent-cb`} className={emergencyModalCheckboxLabel}>
                      {promptConfig.checkboxLabel}
                    </Label>
                    <p id={checkboxDescId} className={emergencyModalCheckboxHelp}>
                      {isReview
                        ? "Check the box and select I Consent to save your agreement."
                        : "Required before you can continue to emergency contacts."}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className={cn(emergencyModalBtnRow, "mt-6")}>
              {showAlreadyAgreed ? (
                <button
                  type="button"
                  onClick={handleDismissReview}
                  disabled={isSubmitting}
                  className={cn(emergencyModalBtnPrimary, "w-full sm:flex-1")}
                >
                  Close
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={isReview ? handleDismissReview : onCancel}
                    disabled={isSubmitting}
                    className={emergencyModalBtnCancel}
                  >
                    {isReview ? "Close" : promptConfig.cancelButtonLabel}
                  </button>
                  <button
                    type="button"
                    onClick={() => void onConsent()}
                    disabled={!checkboxChecked || isSubmitting}
                    className={emergencyModalBtnPrimary}
                  >
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                    <Heart className="h-4 w-4 opacity-80" aria-hidden />
                    {promptConfig.consentButtonLabel}
                  </button>
                </>
              )}
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
