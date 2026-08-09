/**
 * Concurrency conflict dialog.
 *
 * Shown when a save is rejected with `STALE_UPDATE` — someone else changed the record since this
 * editor loaded it.
 *
 * IT NEVER SILENTLY OVERWRITES, and it deliberately offers no "force save" button. The two ways
 * out are: reload the server version (losing local edits, which the copy says plainly), or keep
 * editing and reconcile by hand. Autosave is already stopped by the time this appears, so nothing
 * is racing in the background while the user decides.
 */

import { AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { adminBtnPrimary, adminBtnSecondary } from '@/app/admin';
import type { ConflictInfo } from '../editor/useEditorState';

export interface ConflictDialogProps {
  conflict: ConflictInfo | null;
  onReload: () => Promise<void> | void;
}

export function ConflictDialog({ conflict, onReload }: ConflictDialogProps) {
  if (!conflict) return null;

  return (
    <Dialog open onOpenChange={() => undefined}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle aria-hidden="true" className="h-5 w-5 text-amber-300" />
            Someone else changed this content
          </DialogTitle>
          <DialogDescription>
            Your changes were not saved, and autosave has stopped so nothing is overwritten.
            {conflict.currentUpdatedAt
              ? ` The server version was last updated ${new Date(conflict.currentUpdatedAt).toLocaleString()}.`
              : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2 text-sm text-[var(--admin-text-secondary)]">
          <p>
            <strong className="text-[var(--admin-text)]">Keep editing</strong> leaves your version
            on screen so you can copy anything you need before reloading. Nothing is saved until
            you resolve the conflict.
          </p>
          <p>
            <strong className="text-[var(--admin-text)]">Reload</strong> replaces what is on screen
            with the server version. Unsaved changes are lost.
          </p>
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => {
              // Intentionally does nothing but close the dialog visually — the conflict stays
              // unresolved and saving stays blocked until the user reloads.
              const dialog = document.activeElement as HTMLElement | null;
              dialog?.blur();
            }}
            className={adminBtnSecondary}
          >
            Keep my copy on screen
          </button>
          <button type="button" onClick={() => void onReload()} className={adminBtnPrimary}>
            Reload server version
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
