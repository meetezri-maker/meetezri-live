import { memo } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { modalMutedText, modalOverlay, modalTitle } from "@/lib/modalTheme";

export interface SessionEndingOverlayProps {
  open: boolean;
}

function SessionEndingOverlayComponent({ open }: SessionEndingOverlayProps) {
  if (!open) return null;

  return (
    <div
      className={cn(
        modalOverlay,
        "z-[100] flex-col px-6",
        "[html[data-ezri-theme=light]_&]:bg-[rgba(251,248,255,0.94)]",
        "[html[data-theme=light]_&]:bg-[rgba(251,248,255,0.94)]"
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2
        className="mb-4 h-12 w-12 animate-spin text-purple-400 [html[data-ezri-theme=light]_&]:text-[#7c3aed] [html[data-theme=light]_&]:text-[#7c3aed]"
        aria-hidden
      />
      <p className={cn(modalTitle, "text-center text-lg")}>Ending Talking</p>
      <p className={cn(modalMutedText, "mt-2 max-w-sm text-center text-sm")}>
        Hang on — we&apos;re saving your Talk and taking you to the lobby.
      </p>
    </div>
  );
}

export const SessionEndingOverlay = memo(SessionEndingOverlayComponent);
