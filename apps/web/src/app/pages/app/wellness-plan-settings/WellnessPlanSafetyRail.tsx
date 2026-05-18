import { motion } from "motion/react";
import { Link } from "react-router-dom";
import {
  Heart,
  Phone,
  Download,
  Eraser,
  RotateCcw,
  Wind,
  HandHeart,
  Plus,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SolaceProgressRing } from "@/app/solace/SolaceProgressRing";
import {
  wellnessPlanBtnGhost,
  wellnessPlanBtnRose,
  wellnessPlanIconChip,
  wellnessPlanRailActionRow,
  wellnessPlanRailCard,
} from "@/app/pages/app/wellness-plan-settings/wellnessPlanSettingsUi";

export interface WellnessPlanEmergencyContact {
  id: string;
  name: string;
  phone: string | null;
}

interface WellnessPlanSafetyRailProps {
  contacts: WellnessPlanEmergencyContact[];
  contactsLoading: boolean;
  recoveryPercent: number;
  onExportPdf: () => void;
  onClearPlan: () => void;
  onResetPlan: () => void;
}

function contactInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function WellnessPlanSafetyRail({
  contacts,
  contactsLoading,
  recoveryPercent,
  onExportPdf,
  onClearPlan,
  onResetPlan,
}: WellnessPlanSafetyRailProps) {
  const displayContacts = contacts.slice(0, 3);

  return (
    <aside className="min-w-0 space-y-5 print:hidden xl:max-w-[340px]">
      <motion.div
        className={wellnessPlanRailCard}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <h2 className="font-serif text-lg font-light text-white">Emergency Support</h2>
        <p className="mt-1 text-xs text-[rgba(255,255,255,0.45)]">Help is always available.</p>

        <motion.div
          className={cn(
            wellnessPlanRailCard,
            "mt-4 rounded-2xl border-rose-400/16 p-4",
            "bg-[linear-gradient(165deg,rgba(50,14,36,0.55)_0%,rgba(16,10,28,0.85)_100%)]"
          )}
        >
          <motion.div className="flex items-start gap-3">
            <motion.div className={wellnessPlanIconChip("rose")}>
              <HandHeart className="h-4 w-4" aria-hidden />
            </motion.div>
            <motion.div>
              <h3 className="text-sm font-semibold text-white">In Crisis?</h3>
              <p className="mt-2 text-xs leading-relaxed text-[rgba(255,255,255,0.55)]">
                You&apos;re not alone. Support is just a call or text away.
              </p>
            </motion.div>
          </motion.div>
          <Link to="/app/emergency-resources" className={cn(wellnessPlanBtnRose, "mt-4 w-full")}>
            Get Help Now
          </Link>
        </motion.div>
      </motion.div>

      <motion.div
        className={wellnessPlanRailCard}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <h2 className="font-serif text-lg font-light text-white">Trusted Contacts</h2>
        <p className="mt-1 text-xs text-[rgba(255,255,255,0.45)]">People you can reach out to.</p>

        <motion.div className="mt-4 space-y-2.5">
          {contactsLoading ? (
            <p className="text-xs text-[rgba(255,255,255,0.4)]">Loading contacts…</p>
          ) : displayContacts.length === 0 ? (
            <p className="text-xs leading-relaxed text-[rgba(255,255,255,0.45)]">
              Add trusted contacts so support is one tap away when you need it.
            </p>
          ) : (
            displayContacts.map((contact) => (
              <motion.div
                key={contact.id}
                className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5"
              >
                <motion.div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/30 to-fuchsia-500/25 text-xs font-semibold text-white ring-1 ring-white/10"
                  aria-hidden
                >
                  {contactInitials(contact.name)}
                </motion.div>
                <motion.div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{contact.name}</p>
                  <p className="truncate text-xs text-[rgba(255,255,255,0.45)]">
                    {contact.phone || "No phone on file"}
                  </p>
                </motion.div>
                {contact.phone ? (
                  <a
                    href={`tel:${contact.phone.replace(/\s/g, "")}`}
                    className={cn(
                      wellnessPlanIconChip("rose"),
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-opacity hover:opacity-90"
                    )}
                    aria-label={`Call ${contact.name}`}
                  >
                    <Phone className="h-4 w-4" />
                  </a>
                ) : null}
              </motion.div>
            ))
          )}
        </motion.div>

        <Link
          to="/app/settings/emergency-contacts"
          className={cn(
            wellnessPlanBtnGhost,
            "mt-4 w-full border-rose-400/18 text-rose-200/90 hover:border-rose-400/30 hover:bg-rose-500/[0.08] hover:text-rose-100"
          )}
        >
          <Plus className="h-4 w-4" aria-hidden />
          Add Contact
        </Link>
      </motion.div>

      <motion.div
        className={wellnessPlanRailCard}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <h2 className="font-serif text-lg font-light text-white">Recovery Readiness</h2>
        <p className="mt-1 text-xs text-[rgba(255,255,255,0.45)]">Your current wellness score</p>

        <motion.div className="mt-5 flex flex-col items-center text-center">
          <SolaceProgressRing value={recoveryPercent} size={120} strokeWidth={10}>
            <span className="text-2xl font-semibold text-white">{recoveryPercent}%</span>
          </SolaceProgressRing>
          <p className="mt-4 text-sm font-semibold text-fuchsia-200/90">Making Progress</p>
          <p className="mt-2 text-xs leading-relaxed text-[rgba(255,255,255,0.45)]">
            Keep going, you&apos;re building a stronger future.
          </p>
        </motion.div>
      </motion.div>

      <motion.div
        className={wellnessPlanRailCard}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h2 className="font-serif text-lg font-light text-white">Take a Breather</h2>
        <p className="mt-1 text-xs text-[rgba(255,255,255,0.45)]">Pause. Breathe. Reset.</p>

        <motion.div
          className={cn(
            wellnessPlanRailCard,
            "mt-4 rounded-2xl border-violet-400/16 p-4",
            "bg-[linear-gradient(165deg,rgba(30,16,48,0.55)_0%,rgba(12,10,28,0.88)_100%)]"
          )}
        >
          <motion.div className="flex items-center gap-3">
            <motion.div className={wellnessPlanIconChip("violet")}>
              <Sparkles className="h-4 w-4" aria-hidden />
            </motion.div>
            <motion.div>
              <h3 className="text-sm font-semibold text-white">Guided Breathing</h3>
              <p className="mt-1 text-xs text-[rgba(255,255,255,0.45)]">5 min breathing exercise</p>
            </motion.div>
          </motion.div>
          <Link
            to="/app/wellness-tools"
            className={cn(
              wellnessPlanBtnGhost,
              "mt-4 w-full border-violet-400/22 hover:border-violet-400/35 hover:bg-violet-500/[0.12]"
            )}
          >
            <Wind className="h-4 w-4" aria-hidden />
            Start Breathing
          </Link>
        </motion.div>
      </motion.div>

      <motion.div
        className={wellnessPlanRailCard}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <motion.div className="flex items-start gap-3">
          <motion.div className={wellnessPlanIconChip("rose")}>
            <Heart className="h-4 w-4" aria-hidden />
          </motion.div>
          <motion.div>
            <h2 className="font-serif text-lg font-light text-white">Safety Reminder</h2>
            <p className="mt-3 text-sm leading-relaxed text-[rgba(255,255,255,0.72)]">
              It&apos;s okay to not be okay.
              <br />
              It&apos;s not okay to give up.
            </p>
            <p className="mt-3 text-xs text-[rgba(255,255,255,0.45)]">
              You are stronger than you think.
            </p>
          </motion.div>
        </motion.div>
      </motion.div>

      <motion.div
        className={wellnessPlanRailCard}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <h2 className="font-serif text-lg font-light text-white">Quick Actions</h2>
        <p className="mt-1 text-xs text-[rgba(255,255,255,0.45)]">Your plan, your control.</p>

        <motion.div className="mt-4 space-y-2">
          <button type="button" onClick={onExportPdf} className={wellnessPlanRailActionRow}>
            <motion.div className={wellnessPlanIconChip("violet")}>
              <Download className="h-4 w-4" aria-hidden />
            </motion.div>
            Export Plan (PDF)
          </button>
          <button
            type="button"
            onClick={onClearPlan}
            className={cn(
              wellnessPlanRailActionRow,
              "text-rose-200/90 hover:border-rose-400/22 hover:bg-rose-500/[0.08]"
            )}
          >
            <motion.div className={wellnessPlanIconChip("rose")}>
              <Eraser className="h-4 w-4" aria-hidden />
            </motion.div>
            Clear Your Plan
          </button>
          <button type="button" onClick={onResetPlan} className={wellnessPlanRailActionRow}>
            <motion.div className={wellnessPlanIconChip("violet")}>
              <RotateCcw className="h-4 w-4" aria-hidden />
            </motion.div>
            Reset Plan
          </button>
        </motion.div>
      </motion.div>
    </aside>
  );
}
