import { memo } from "react";
import { Loader2 } from "lucide-react";

export interface SessionEndingOverlayProps {
  open: boolean;
}

function SessionEndingOverlayComponent({ open }: SessionEndingOverlayProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#07041C]/95 backdrop-blur-md px-6">
      <Loader2 className="h-12 w-12 text-purple-400 animate-spin mb-4" />
      <p className="text-lg font-semibold text-white text-center">
        Ending Talking
      </p>
      <p className="text-sm text-gray-400 mt-2 text-center max-w-sm">
        Hang on — we&apos;re saving your Talk and taking you to the lobby.
      </p>
    </div>
  );
}

export const SessionEndingOverlay = memo(SessionEndingOverlayComponent);
