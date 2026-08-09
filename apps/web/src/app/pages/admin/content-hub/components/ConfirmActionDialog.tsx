/**
 * Generic confirmation for irreversible or outward-facing workflow actions.
 *
 * Uses the repository's Radix dialog, so focus trapping, Escape and labelling come for free.
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { adminBtnPrimary, adminBtnSecondary } from '@/app/admin';

export interface ConfirmActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  body: string;
  confirmLabel: string;
  isSubmitting?: boolean;
  onConfirm: () => void;
}

export function ConfirmActionDialog({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel,
  isSubmitting,
  onConfirm,
}: ConfirmActionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{body}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className={adminBtnSecondary}
          >
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={isSubmitting} className={adminBtnPrimary}>
            {isSubmitting ? 'Working…' : confirmLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
