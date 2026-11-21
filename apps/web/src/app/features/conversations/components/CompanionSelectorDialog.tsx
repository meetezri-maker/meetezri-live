import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/app/components/ui/dialog";
import { cn } from "@/lib/utils";
import { listConversationCompanions } from "../conversationCompanions";
import { useConversationService } from "../ConversationsServiceContext";
import type { ConversationCompanionKey } from "../types";
import { CompanionAvatar } from "./CompanionAvatar";
import { conversationsPrimaryPill } from "./conversationsUi";

interface CompanionSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the canonical companion key. */
  onConfirm: (companionKey: ConversationCompanionKey) => void;
}

/**
 * Companion selector (modal on desktop, bottom sheet below `sm`). Confirming starts a preview
 * conversation in the in-memory mock service — no backend conversation, no AI request.
 */
export function CompanionSelectorDialog({ open, onOpenChange, onConfirm }: CompanionSelectorDialogProps) {
  const companions = useMemo(() => listConversationCompanions(), []);
  const [selectedKey, setSelectedKey] = useState<ConversationCompanionKey | null>(null);
  const preview = useConversationService().kind === "mock";

  useEffect(() => {
    if (!open) setSelectedKey(null);
  }, [open]);

  const selected = companions.find((c) => c.key === selectedKey) ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "solace-app border-[color:var(--solace-border)] bg-[color:var(--solace-bg-elevated)] text-[color:var(--solace-text)]",
          "shadow-[0_0_60px_-16px_rgba(168,85,247,0.55),0_40px_100px_-48px_rgba(0,0,0,0.85)] sm:max-w-md sm:rounded-[1.5rem]",
          "max-sm:top-auto max-sm:bottom-0 max-sm:max-w-full max-sm:translate-y-0 max-sm:rounded-t-[1.5rem] max-sm:rounded-b-none",
          "max-sm:pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]"
        )}
      >
        <div className="text-center">
          <DialogTitle className="text-lg font-semibold text-[color:var(--solace-text)]">Start a Conversation</DialogTitle>
          <DialogDescription className="mt-1 text-sm text-[color:var(--solace-muted)]">
            Choose your Solace companion.
          </DialogDescription>
        </div>

        {/* Wraps four per row; the second row of three centres under the first, as in the references. */}
        <ul
          className="mx-auto flex max-w-[19rem] flex-wrap justify-center gap-x-2 gap-y-4"
          aria-label="Companions"
        >
          {companions.map((companion) => {
            const isSelected = companion.key === selectedKey;
            return (
              <li key={companion.key}>
                <button
                  type="button"
                  onClick={() => setSelectedKey(companion.key)}
                  aria-pressed={isSelected}
                  className={cn(
                    "flex w-[4.25rem] flex-col items-center gap-1.5 rounded-2xl px-1 py-2 transition-colors",
                    isSelected
                      ? "bg-violet-500/20 ring-1 ring-fuchsia-300/60 [html[data-ezri-theme=light]_&]:bg-violet-100"
                      : "hover:bg-[color-mix(in_srgb,var(--solace-text)_6%,transparent)]"
                  )}
                >
                  <span className="relative">
                    <CompanionAvatar
                      companion={companion}
                      sizeClassName="h-14 w-14"
                      className={isSelected ? "ring-2 ring-fuchsia-300" : undefined}
                    />
                    {isSelected ? (
                      <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-white text-violet-700 shadow">
                        <Check className="h-3 w-3" aria-hidden />
                      </span>
                    ) : null}
                  </span>
                  <span className="max-w-full truncate text-xs font-medium text-[color:var(--solace-text)]">
                    {companion.displayName}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            disabled={!selected}
            onClick={() => selected && onConfirm(selected.key)}
            className={cn(conversationsPrimaryPill, "w-full")}
          >
            {selected ? `Start Chat with ${selected.displayName}` : "Choose a companion"}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
          {preview ? (
            <p className="text-center text-xs text-[color:var(--solace-muted)]">
              Preview — conversations are simulated and aren’t saved.
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
