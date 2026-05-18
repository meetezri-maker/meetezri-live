import { useEffect, useId, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  EMERGENCY_CONTACT_CONSENT_PROMPT,
  type EmergencyContactConsentPrompt,
} from "@meetezri/shared";
import { cn } from "@/app/components/ui/utils";
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Label } from "../ui/label";

export interface EmergencyContactConsentModalProps {
  open: boolean;
  /** Defaults to shared production prompt; inject alternatives for A/B or admin preview. */
  promptConfig?: EmergencyContactConsentPrompt;
  onConsent: () => void | Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

/**
 * Blocking consent dialog for emergency contact notification policy.
 * Must be controlled by the parent (`open`). Does not close on overlay click or Escape.
 */
export function EmergencyContactConsentModal({
  open,
  promptConfig = EMERGENCY_CONTACT_CONSENT_PROMPT,
  onConsent,
  onCancel,
  isSubmitting = false,
}: EmergencyContactConsentModalProps) {
  const baseId = useId();
  const [checkboxChecked, setCheckboxChecked] = useState(false);

  useEffect(() => {
    if (open) {
      setCheckboxChecked(false);
    }
  }, [open]);

  const descriptionId = `${baseId}-description`;
  const checkboxDescId = `${baseId}-checkbox-help`;

  return (
    <Dialog open={open} modal>
      <DialogPortal>
        <DialogOverlay
          className={cn(
            "z-[200] bg-black/70 backdrop-blur-sm data-[state=open]:animate-in",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          )}
        />
        <DialogPrimitive.Content
          aria-describedby={descriptionId}
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          className={cn(
            "bg-background fixed top-[50%] left-[50%] z-[201] grid max-h-[min(90vh,calc(100%-2rem))] w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 overflow-y-auto rounded-lg border p-6 shadow-lg duration-200 sm:max-w-lg",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          )}
        >
          <DialogHeader>
            <DialogTitle>{promptConfig.title}</DialogTitle>
          </DialogHeader>

          <div id={descriptionId} className="space-y-4 text-sm">
            <section className="space-y-2">
              <h3 className="text-foreground font-semibold">
                {promptConfig.purposeHeading}
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {promptConfig.purposeBody}
              </p>
            </section>
            <section
              className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-950/30"
              role="note"
            >
              <h3 className="text-amber-950 font-semibold dark:text-amber-100">
                {promptConfig.emergencyOnlyHeading}
              </h3>
              <p className="text-amber-950/90 leading-relaxed dark:text-amber-100/90">
                {promptConfig.emergencyOnlyBody}
              </p>
            </section>
            {promptConfig.additionalNotes.length > 0 && (
              <ul className="text-muted-foreground list-inside list-disc space-y-1">
                {promptConfig.additionalNotes.map((line) => (
                  <li key={line} className="leading-relaxed">
                    {line}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-rose-100 bg-rose-50/50 px-3 py-2.5 dark:border-rose-900/40 dark:bg-rose-950/25">
            <div className="flex items-start gap-2">
              <Checkbox
                id={`${baseId}-consent-cb`}
                checked={checkboxChecked}
                onCheckedChange={(v) => setCheckboxChecked(v === true)}
                className="mt-0.5"
                aria-describedby={checkboxDescId}
                disabled={isSubmitting}
              />
              <div className="min-w-0 space-y-1">
                <Label
                  htmlFor={`${baseId}-consent-cb`}
                  className="text-foreground cursor-pointer text-xs leading-snug font-normal"
                >
                  {promptConfig.checkboxLabel}
                </Label>
                <p id={checkboxDescId} className="text-muted-foreground text-xs">
                  Required before you can continue to emergency contacts.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              {promptConfig.cancelButtonLabel}
            </Button>
            <Button
              type="button"
              onClick={() => void onConsent()}
              disabled={!checkboxChecked || isSubmitting}
            >
              {promptConfig.consentButtonLabel}
            </Button>
          </DialogFooter>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
