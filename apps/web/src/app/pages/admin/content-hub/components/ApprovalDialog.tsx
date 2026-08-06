/**
 * Approval dialog — set one gate's state.
 *
 * Uses the repository's Radix dialog primitive (focus trap, Escape and labelling come with it).
 * Gates are read from the shared constant, so a fourth gate appears here automatically.
 *
 * PUBLISHING IS NOT AVAILABLE HERE. Phase 3's review queue clears gates only; publish lives in
 * Phase 4's Approval & Publishing tab.
 */

import { useEffect, useState } from "react";
import { APPROVAL_GATES } from "@meetezri/shared";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { adminBtnPrimary, adminBtnSecondary, adminInput, adminSelect } from "@/app/admin";
import { cn } from "@/lib/utils";
import type { ContentHubApprovalState } from "@/lib/api";
import { approvalStateLabel, gateLabel } from "./ApprovalDots";

export interface ApprovalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentTitle: string;
  /** Current states, so the dialog opens showing where each gate stands. */
  approvals: Record<string, ContentHubApprovalState> | undefined;
  isSubmitting?: boolean;
  onSubmit: (input: { gate: string; state: ContentHubApprovalState; note?: string }) => void;
}

export function ApprovalDialog({
  open,
  onOpenChange,
  contentTitle,
  approvals,
  isSubmitting,
  onSubmit,
}: ApprovalDialogProps) {
  const gates = [...APPROVAL_GATES] as string[];
  const [gate, setGate] = useState<string>(gates[0]);
  const [state, setState] = useState<ContentHubApprovalState>("approved");
  const [note, setNote] = useState("");

  // Reset each time the dialog opens, so a previous decision never leaks into the next one.
  useEffect(() => {
    if (open) {
      setGate(gates[0]);
      setState("approved");
      setNote("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const requestingChanges = state === "changes_requested";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Set approval</DialogTitle>
          <DialogDescription>
            Update one approval gate for “{contentTitle}”.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <label htmlFor="approval-gate" className="mb-1 block text-sm text-[var(--admin-text-secondary)]">
              Gate
            </label>
            <select
              id="approval-gate"
              value={gate}
              onChange={(e) => setGate(e.target.value)}
              className={cn(adminSelect, "w-full")}
            >
              {gates.map((g) => (
                <option key={g} value={g}>
                  {gateLabel(g)} — currently {approvalStateLabel[approvals?.[g] ?? "pending"]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="approval-state" className="mb-1 block text-sm text-[var(--admin-text-secondary)]">
              Decision
            </label>
            <select
              id="approval-state"
              value={state}
              onChange={(e) => setState(e.target.value as ContentHubApprovalState)}
              className={cn(adminSelect, "w-full")}
            >
              <option value="approved">Approve</option>
              <option value="changes_requested">Request changes</option>
              <option value="pending">Return to pending</option>
            </select>
          </div>

          <div>
            <label htmlFor="approval-note" className="mb-1 block text-sm text-[var(--admin-text-secondary)]">
              Note {requestingChanges ? <span className="text-[var(--admin-text-muted)]">(recommended)</span> : "(optional)"}
            </label>
            <input
              id="approval-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              placeholder={
                requestingChanges ? "What needs to change?" : "Any context for the audit trail"
              }
              className={cn(adminInput, "w-full")}
              aria-describedby={requestingChanges ? "approval-note-hint" : undefined}
            />
            {requestingChanges ? (
              // The API accepts an empty note; the UI still nudges toward a useful one, because
              // "changes requested" with no explanation just bounces work back and forth.
              <p id="approval-note-hint" className="mt-1 text-xs text-[var(--admin-text-muted)]">
                A short reason saves a round trip. It is recorded in the audit log.
              </p>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className={adminBtnSecondary}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSubmit({ gate, state, note: note.trim() || undefined })}
            className={adminBtnPrimary}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Saving…" : "Save decision"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
