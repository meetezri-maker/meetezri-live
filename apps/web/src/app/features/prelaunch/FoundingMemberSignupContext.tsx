import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { FoundingMemberForm } from "./FoundingMemberForm";
import { FOUNDING_CIRCLE, FOUNDING_FORM, SECTION_IDS } from "./prelaunch.content";
import { trackPrelaunchEvent } from "./prelaunch.analytics";

interface FoundingMemberSignupContextValue {
  /** Opens the shared signup flow. `origin` is analytics context only. */
  openSignup: (origin: string) => void;
}

const FoundingMemberSignupContext = createContext<FoundingMemberSignupContextValue | null>(null);

/**
 * Single source of the Founding Member conversion flow.
 *
 * Every primary CTA on the page calls `openSignup`, which presents the same
 * `FoundingMemberForm` used inline in Section 8 — there is deliberately no
 * second conversion path. Radix Dialog supplies focus trapping, Escape handling,
 * and focus restoration to the triggering button.
 */
export function FoundingMemberSignupProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [origin, setOrigin] = useState("unknown");

  const openSignup = useCallback((nextOrigin: string) => {
    setOrigin(nextOrigin);
    trackPrelaunchEvent("founding_member_cta_clicked", { origin: nextOrigin });

    // Section 8 owns the inline form; sending the visitor there keeps the full
    // benefits context visible instead of hiding it behind a modal.
    if (nextOrigin === "founding_circle_section") {
      document
        .getElementById(SECTION_IDS.foundingCircle)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    setOpen(true);
  }, []);

  const value = useMemo<FoundingMemberSignupContextValue>(() => ({ openSignup }), [openSignup]);

  return (
    <FoundingMemberSignupContext.Provider value={value}>
      {children}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="solace-landing max-w-lg border-white/10 bg-[#080b1a]/95 backdrop-blur-2xl"
          // Remounts the form each time so a previous success state never persists.
          key={open ? "open" : "closed"}
        >
          <DialogHeader>
            <DialogTitle className="landing-serif text-xl text-white sm:text-2xl">
              {FOUNDING_FORM.heading}
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-[var(--solace-ds-text-muted)]">
              {FOUNDING_CIRCLE.supportingCopy[0]}
            </DialogDescription>
          </DialogHeader>

          <FoundingMemberForm origin={origin} compact className="mt-2" />
        </DialogContent>
      </Dialog>
    </FoundingMemberSignupContext.Provider>
  );
}

export function useFoundingMemberSignup(): FoundingMemberSignupContextValue {
  const context = useContext(FoundingMemberSignupContext);
  if (!context) {
    throw new Error(
      "useFoundingMemberSignup must be used inside a FoundingMemberSignupProvider",
    );
  }
  return context;
}
