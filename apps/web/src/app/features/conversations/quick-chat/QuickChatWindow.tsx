import type { ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Maximize2, Minus, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickChatWindowProps {
  isDesktop: boolean;
  label: string;
  onMinimize: () => void;
  /** Return focus here when the window hides. */
  onRestoreFocus: () => void;
  children: ReactNode;
}

/**
 * Frame for the compact chat.
 *
 * - Desktop: non-modal floating panel (bottom-right) — the page behind stays usable. Escape
 *   minimizes.
 * - Mobile: modal slide-up bottom sheet (Radix Dialog): backdrop, focus trap, scroll lock and
 *   Escape / backdrop-tap minimize. It stacks above the bottom navigation (z-50) and below the
 *   navigation drawer and app dialogs (z-[60]).
 */
export function QuickChatWindow({ isDesktop, label, onMinimize, onRestoreFocus, children }: QuickChatWindowProps) {
  if (isDesktop) {
    return (
      <section
        role="dialog"
        aria-modal="false"
        aria-label={label}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            onMinimize();
          }
        }}
        className="fixed bottom-6 right-6 z-[45] flex h-[min(40rem,calc(100dvh-7.5rem))] w-[min(24rem,calc(100vw-3rem))] flex-col motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4"
      >
        {children}
      </section>
    );
  }

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => !open && onMinimize()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[55] bg-[rgba(8,4,24,0.6)] backdrop-blur-[2px] motion-safe:animate-in motion-safe:fade-in" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            onRestoreFocus();
          }}
          className={cn(
            // Portaled outside `.solace-app`, so the theme scope is re-applied here.
            "solace-app fixed inset-x-0 bottom-0 z-[56] flex h-[min(88dvh,46rem)] flex-col outline-none",
            "max-lg:[@media(max-height:480px)]:h-[100dvh]",
            "motion-safe:animate-in motion-safe:slide-in-from-bottom-10"
          )}
        >
          <DialogPrimitive.Title className="sr-only">{label}</DialogPrimitive.Title>
          <span
            className="absolute left-1/2 top-1.5 z-20 h-1 w-10 -translate-x-1/2 rounded-full bg-white/40 [html[data-ezri-theme=light]_&]:bg-violet-300"
            aria-hidden
          />
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

const actionButton =
  "rounded-full p-1.5 text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-300/70 [html[data-ezri-theme=light]_&]:text-[color:var(--solace-muted)] [html[data-ezri-theme=light]_&]:hover:bg-violet-50";

/** Minimize / Expand / Close, rendered in the compact ChatPanel header. */
export function QuickChatActions({
  onMinimize,
  onExpand,
  onClose,
}: {
  onMinimize: () => void;
  onExpand?: () => void;
  onClose: () => void;
}) {
  return (
    <div className="-mr-1 flex items-center">
      <button type="button" onClick={onMinimize} aria-label="Minimize chat" title="Minimize" className={actionButton}>
        <Minus className="h-4 w-4" aria-hidden />
      </button>
      {onExpand ? (
        <button
          type="button"
          onClick={onExpand}
          aria-label="Open in Conversations"
          title="Open in Conversations"
          className={actionButton}
        >
          <Maximize2 className="h-4 w-4" aria-hidden />
        </button>
      ) : null}
      <button type="button" onClick={onClose} aria-label="Close chat" title="Close" className={actionButton}>
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
