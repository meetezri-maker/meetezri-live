import { motion, AnimatePresence } from "motion/react";
import { Link } from "react-router-dom";
import {
  Shield,
  Plus,
  Trash2,
  ArrowLeft,
  AlertTriangle,
  Heart,
  Phone,
  Activity,
  MapPin,
  BookOpen,
  Users,
  Download,
  Loader2,
  ChevronRight,
  Printer,
  ShieldCheck,
} from "lucide-react";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { LucideIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/app/contexts/AuthContext";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  WELLNESS_PLAN_BANNER_IMG,
  WELLNESS_PLAN_HERO_IMG,
  wellnessPlanAddZone,
  wellnessPlanBackLink,
  wellnessPlanBottomBanner,
  wellnessPlanBtnGhost,
  wellnessPlanBtnRose,
  wellnessPlanGlassCard,
  wellnessPlanHandwritten,
  wellnessPlanHeroCard,
  wellnessPlanHeroImage,
  wellnessPlanHeroOverlayLeft,
  wellnessPlanHeroOverlayPurple,
  wellnessPlanHeroOverlayWarmth,
  wellnessPlanHeroTitle,
  wellnessPlanIconChip,
  wellnessPlanItemRow,
  wellnessPlanPageAtmosphere,
  wellnessPlanPageFogMid,
  wellnessPlanPageGlowTop,
  wellnessPlanPageVignette,
  wellnessPlanResourceTile,
  wellnessPlanResourcesCard,
  wellnessPlanSectionCard,
  wellnessPlanSectionChip,
} from "@/app/pages/app/wellness-plan-settings/wellnessPlanSettingsUi";
import { WellnessPlanSafetyRail } from "@/app/pages/app/wellness-plan-settings/WellnessPlanSafetyRail";

type SectionAccent = "rose" | "pink" | "magenta" | "violet" | "amber";

interface SafetyPlanSection {
  id: string;
  title: string;
  description: string;
  accent: SectionAccent;
  icon: LucideIcon;
  items: string[];
  placeholder: string;
}

const SECTION_BLUEPRINT: Omit<SafetyPlanSection, "items">[] = [
  {
    id: "warning-signs",
    title: "Warning Signs",
    description: "Thoughts, feelings, or behaviors that indicate I may need support.",
    icon: AlertTriangle,
    accent: "rose",
    placeholder: "Add a warning sign...",
  },
  {
    id: "coping-strategies",
    title: "Coping Strategies",
    description: "Things I can do to help myself feel better in difficult moments.",
    icon: Heart,
    accent: "pink",
    placeholder: "Add a coping strategy...",
  },
  {
    id: "distractions",
    title: "Healthy Distractions",
    description: "Activities that help take my mind off distressing thoughts.",
    icon: Activity,
    accent: "magenta",
    placeholder: "Add a distraction...",
  },
  {
    id: "safe-people",
    title: "People I Can Contact",
    description: "People I trust and can reach out to for support.",
    icon: Users,
    accent: "violet",
    placeholder: "Add a contact person...",
  },
  {
    id: "safe-places",
    title: "Safe Places",
    description: "Places where I feel safe, calm, and supported.",
    icon: MapPin,
    accent: "amber",
    placeholder: "Add a safe place...",
  },
  {
    id: "reasons-to-live",
    title: "Reasons to Live",
    description: "Reminders of why my life is valuable and worth living.",
    icon: ShieldCheck,
    accent: "violet",
    placeholder: "Add a reason...",
  },
];

function emptySections(): SafetyPlanSection[] {
  return SECTION_BLUEPRINT.map((b) => ({ ...b, items: [] }));
}

function parseTrustedContacts(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    if (raw.length === 0) return [];
    if (typeof raw[0] === "string") return raw as string[];
    return (
      raw as Array<{ name?: string; phone?: string; relation?: string }>
    )
      .map((o) => {
        const bits = [o.name, o.phone, o.relation].filter(Boolean);
        return bits.join(" — ");
      })
      .filter(Boolean);
  }
  return [];
}

function parseReasonsToLive(raw: unknown): string[] {
  if (raw && typeof raw === "object" && "reasons_to_live" in raw) {
    const r = (raw as { reasons_to_live?: unknown }).reasons_to_live;
    if (Array.isArray(r) && r.every((x) => typeof x === "string")) {
      return r;
    }
  }
  return [];
}

type SafetyPlanRow = {
  id: string;
  user_id: string;
  warning_signs: string[] | null;
  coping_strategies: string[] | null;
  social_distractions: string[] | null;
  trusted_contacts: unknown;
  professional_support: unknown;
  environment_safety: string[] | null;
};

function rowToSections(row: SafetyPlanRow): SafetyPlanSection[] {
  const byId: Record<string, string[]> = {
    "warning-signs": row.warning_signs ?? [],
    "coping-strategies": row.coping_strategies ?? [],
    distractions: row.social_distractions ?? [],
    "safe-people": parseTrustedContacts(row.trusted_contacts),
    "safe-places": row.environment_safety ?? [],
    "reasons-to-live": parseReasonsToLive(row.professional_support),
  };
  return SECTION_BLUEPRINT.map((b) => ({
    ...b,
    items: byId[b.id] ?? [],
  }));
}

export function SafetyPlan() {
  const { user } = useAuth();
  const [sections, setSections] = useState<SafetyPlanSection[]>(() => emptySections());
  const [planId, setPlanId] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [isDirty, setIsDirty] = useState(false);
  const saveStatusClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [newItem, setNewItem] = useState("");

  const { data: emergencyContacts = [], isLoading: contactsLoading } = useQuery<
    Array<{ id: string; name: string; phone: string | null }>
  >({
    queryKey: ["emergency-contacts"],
    queryFn: () => api.emergencyContacts.getAll(),
    staleTime: 5 * 60_000,
  });

  const railContacts = useMemo(
    () =>
      emergencyContacts.map((contact) => ({
        id: contact.id,
        name: contact.name,
        phone: contact.phone,
      })),
    [emergencyContacts]
  );

  const recoveryPercent = useMemo(() => {
    if (sections.length === 0) return 0;
    const filled = sections.filter((s) => s.items.length > 0).length;
    return Math.round((filled / sections.length) * 100);
  }, [sections]);

  const loadPlan = useCallback(async () => {
    if (!user?.id) {
      setLoadState("ready");
      return;
    }
    setLoadState("loading");
    const { data: rows, error } = await supabase
      .from("safety_plans")
      .select(
        "id, user_id, warning_signs, coping_strategies, social_distractions, trusted_contacts, professional_support, environment_safety"
      )
      .eq("user_id", user.id)
      .order("last_updated", { ascending: false })
      .limit(1);

    if (error) {
      console.error("Safety plan load:", error);
      toast.error("Could not load your wellness plan. Please try again.");
      setSections(emptySections());
      setLoadState("error");
      return;
    }

    const data = rows?.[0];
    if (data) {
      setPlanId(data.id);
      setSections(rowToSections(data as SafetyPlanRow));
    } else {
      setPlanId(null);
      setSections(emptySections());
    }
    setIsDirty(false);
    setLoadState("ready");
  }, [user?.id]);

  useEffect(() => {
    void loadPlan();
  }, [loadPlan]);

  const persist = useCallback(async () => {
    if (!user?.id || !isDirty) return;

    const get = (id: string) => sections.find((s) => s.id === id)?.items ?? [];

    const payload = {
      user_id: user.id,
      warning_signs: get("warning-signs"),
      coping_strategies: get("coping-strategies"),
      social_distractions: get("distractions"),
      trusted_contacts: get("safe-people"),
      professional_support: { reasons_to_live: get("reasons-to-live") },
      environment_safety: get("safe-places"),
      last_updated: new Date().toISOString(),
    };

    setSaveStatus("saving");
    try {
      if (planId) {
        const { error } = await supabase
          .from("safety_plans")
          .update(payload)
          .eq("id", planId)
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("safety_plans")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        if (data?.id) setPlanId(data.id);
      }
      setIsDirty(false);
      setSaveStatus("saved");
      if (saveStatusClearRef.current) clearTimeout(saveStatusClearRef.current);
      saveStatusClearRef.current = setTimeout(() => {
        setSaveStatus("idle");
        saveStatusClearRef.current = null;
      }, 2000);
    } catch (e) {
      console.error("Safety plan save:", e);
      toast.error("Could not save your wellness plan. Check your connection.");
      setSaveStatus("idle");
    }
  }, [user?.id, isDirty, sections, planId]);

  useEffect(() => {
    if (!isDirty || loadState !== "ready" || !user?.id) return;
    const t = setTimeout(() => {
      void persist();
    }, 700);
    return () => clearTimeout(t);
  }, [sections, isDirty, loadState, user?.id, persist]);

  const handleAddItem = (sectionId: string) => {
    if (!newItem.trim()) return;
    setSections((prev) =>
      prev.map((section) =>
        section.id === sectionId
          ? { ...section, items: [...section.items, newItem.trim()] }
          : section
      )
    );
    setIsDirty(true);
    setNewItem("");
    setEditingSection(null);
  };

  const handleDeleteItem = (sectionId: string, itemIndex: number) => {
    setSections((prev) =>
      prev.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              items: section.items.filter((_, i) => i !== itemIndex),
            }
          : section
      )
    );
    setIsDirty(true);
  };

  const handlePrintOrPdf = () => {
    window.print();
  };

  const handleClearPlan = () => {
    if (
      !window.confirm(
        "Clear all items from your wellness plan? This will save an empty plan to your account."
      )
    ) {
      return;
    }
    setSections(emptySections());
    setIsDirty(true);
    toast.success("Plan cleared. Saving…");
  };

  const handleResetPlan = () => {
    if (
      !window.confirm(
        "Reset your plan to the last saved version? Unsaved changes will be lost."
      )
    ) {
      return;
    }
    void loadPlan();
    toast.success("Plan reset to last saved version.");
  };

  return (
    <motion.div
      className={wellnessPlanPageAtmosphere}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
    >
      <motion.div className={wellnessPlanPageGlowTop} aria-hidden />
      <motion.div className={wellnessPlanPageFogMid} aria-hidden />
      <motion.div className={wellnessPlanPageVignette} aria-hidden />

      <div className="relative z-10 mx-auto w-full max-w-[1500px] px-4 py-7 sm:px-7 sm:py-9">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(300px,340px)]">
          <div className="min-w-0 space-y-6">
            <section className={wellnessPlanHeroCard}>
              <img src={WELLNESS_PLAN_HERO_IMG} alt="" className={wellnessPlanHeroImage} />
              <div className={wellnessPlanHeroOverlayLeft} aria-hidden />
              <motion.div className={wellnessPlanHeroOverlayPurple} aria-hidden />
              <motion.div className={wellnessPlanHeroOverlayWarmth} aria-hidden />

              <div className="relative flex min-h-[280px] flex-col justify-between p-6 sm:min-h-[300px] sm:p-8 lg:min-h-[320px]">
                <div className="max-w-2xl">
                  <Link to="/app/settings" className={wellnessPlanBackLink}>
                    <ArrowLeft className="h-4 w-4" aria-hidden />
                    Back to Settings
                  </Link>

                  <div className="mt-5 flex flex-wrap items-center gap-4">
                    <div className={wellnessPlanIconChip("rose")}>
                      <Shield className="h-7 w-7" aria-hidden />
                    </div>
                    <motion.div className="flex flex-wrap items-center gap-3">
                      <h1 className={wellnessPlanHeroTitle}>My Wellness Plan</h1>
                      {loadState === "ready" ? (
                        <span className="flex items-center gap-2 text-xs text-[rgba(255,255,255,0.45)]">
                          {saveStatus === "saving" ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                              Saving…
                            </>
                          ) : null}
                          {saveStatus === "saved" ? (
                            <span className="text-emerald-300/80">Saved</span>
                          ) : null}
                        </span>
                      ) : null}
                    </motion.div>
                  </div>

                  <p className="mt-4 max-w-xl text-sm leading-relaxed text-rose-200/80 sm:text-[15px]">
                    Your personalized plan for managing difficult moments and staying safe.
                  </p>
                  <p className="mt-3 max-w-xl text-sm leading-relaxed text-[rgba(255,255,255,0.55)]">
                    This is your space to reflect, prepare, and take care of yourself.
                  </p>
                  <p className={cn(wellnessPlanHandwritten, "mt-4")}>You are not alone.</p>
                </div>
              </div>
            </section>

            {loadState === "loading" ? (
              <div className="flex items-center justify-center gap-2 rounded-3xl border border-white/[0.06] bg-white/[0.02] py-24 text-[rgba(255,255,255,0.5)]">
                <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
                Loading your wellness plan…
              </div>
            ) : null}

            {loadState === "error" ? (
              <div className={cn(wellnessPlanGlassCard, "p-6 border-rose-400/25")}>
                <p className="mb-4 text-sm text-[rgba(255,255,255,0.65)]">
                  We couldn&apos;t load your plan. You can try again or continue editing locally
                  until sync works.
                </p>
                <button type="button" onClick={() => void loadPlan()} className={wellnessPlanBtnGhost}>
                  Retry
                </button>
              </div>
            ) : null}

            <AnimatePresence>
              {loadState === "ready" ? (
                <>
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.08 }}
                    className={cn(wellnessPlanGlassCard, "flex items-start gap-4 p-5 sm:p-6")}
                  >
                    <div className={wellnessPlanIconChip("violet")}>
                      <BookOpen className="h-5 w-5" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="font-serif text-lg font-light text-white">
                        What is a Wellness Plan?
                      </h2>
                      <p className="mt-2 text-sm leading-relaxed text-[rgba(255,255,255,0.55)]">
                        A wellness plan helps you recognize warning signs and use coping strategies
                        when you&apos;re in distress. It can help you stay safe during difficult
                        times.
                      </p>
                    </div>
                    <ChevronRight
                      className="mt-1 h-5 w-5 shrink-0 text-[rgba(255,255,255,0.25)]"
                      aria-hidden
                    />
                  </motion.div>

                  <motion.section
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.12 }}
                    className={wellnessPlanResourcesCard}
                    aria-labelledby="wellness-resources-heading"
                  >
                    <div className="flex items-start gap-4">
                      <motion.div className={wellnessPlanIconChip("rose")}>
                        <Phone className="h-5 w-5" aria-hidden />
                      </motion.div>
                      <h2
                        id="wellness-resources-heading"
                        className="font-serif text-lg font-light text-white"
                      >
                        Helpful Resources — Available 24/7
                      </h2>
                    </div>
                    <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <a href="tel:988" className={wellnessPlanResourceTile}>
                        <div className={wellnessPlanIconChip("rose")}>
                          <Phone className="h-4 w-4" aria-hidden />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">
                            988 Suicide &amp; Crisis Lifeline
                          </p>
                          <p className="mt-0.5 text-xs text-rose-200/70">Call or Text 988</p>
                        </div>
                      </a>
                      <a href="tel:911" className={wellnessPlanResourceTile}>
                        <div className={wellnessPlanIconChip("rose")}>
                          <Phone className="h-4 w-4" aria-hidden />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">Emergency Services</p>
                          <p className="mt-0.5 text-xs text-rose-200/70">Call 911</p>
                        </div>
                      </a>
                    </div>
                  </motion.section>

                  <div className="space-y-5">
                    {sections.map((section, index) => {
                      const Icon = section.icon;
                      return (
                        <motion.section
                          key={section.id}
                          initial={{ opacity: 0, y: 16 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.16 + index * 0.04 }}
                          className={wellnessPlanSectionCard(section.accent)}
                        >
                          <div className="flex items-start gap-4 p-5 sm:p-6">
                            <div className={wellnessPlanSectionChip(section.accent)}>
                              <Icon className="h-5 w-5" aria-hidden />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h3 className="font-serif text-lg font-light text-white">
                                {section.title}
                              </h3>
                              <p className="mt-2 text-sm leading-relaxed text-[rgba(255,255,255,0.5)]">
                                {section.description}
                              </p>
                            </div>
                            <ChevronRight
                              className="mt-1 h-5 w-5 shrink-0 text-[rgba(255,255,255,0.25)]"
                              aria-hidden
                            />
                          </div>

                          {section.items.length > 0 ? (
                            <div className="space-y-2 px-5 pb-4 sm:px-6">
                              {section.items.map((item, itemIndex) => (
                                <motion.div
                                  key={`${section.id}-${itemIndex}-${item.slice(0, 24)}`}
                                  initial={{ opacity: 0, x: -8 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  className={wellnessPlanItemRow}
                                >
                                  <motion.div className="flex min-w-0 flex-1 items-start gap-3">
                                    <span
                                      className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-500/20 text-xs font-semibold text-rose-100 ring-1 ring-rose-400/25"
                                      aria-hidden
                                    >
                                      {itemIndex + 1}
                                    </span>
                                    <p className="text-sm leading-relaxed text-[rgba(255,255,255,0.78)]">
                                      {item}
                                    </p>
                                  </motion.div>
                                  <motion.button
                                    type="button"
                                    whileHover={{ scale: 1.08 }}
                                    whileTap={{ scale: 0.92 }}
                                    onClick={() => handleDeleteItem(section.id, itemIndex)}
                                    className="rounded-lg p-1.5 text-rose-300/60 opacity-0 transition-all group-hover:opacity-100 hover:bg-rose-500/10 hover:text-rose-200 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/40"
                                    aria-label={`Remove item ${itemIndex + 1}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </motion.button>
                                </motion.div>
                              ))}
                            </div>
                          ) : null}

                          {editingSection === section.id ? (
                            <div className="flex flex-wrap gap-2 px-5 pb-5 sm:px-6">
                              <input
                                type="text"
                                value={newItem}
                                onChange={(e) => setNewItem(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleAddItem(section.id);
                                  }
                                }}
                                placeholder={section.placeholder}
                                className="min-w-[200px] flex-1 rounded-2xl border border-white/[0.1] bg-[rgba(10,12,28,0.72)] px-4 py-3 text-sm text-white placeholder:text-[rgba(255,255,255,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/35"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => handleAddItem(section.id)}
                                className={wellnessPlanBtnRose}
                              >
                                Add
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingSection(null);
                                  setNewItem("");
                                }}
                                className={wellnessPlanBtnGhost}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <motion.button
                              type="button"
                              whileHover={{ scale: 1.01 }}
                              whileTap={{ scale: 0.99 }}
                              onClick={() => setEditingSection(section.id)}
                              className={wellnessPlanAddZone}
                            >
                              <Plus className="h-4 w-4" aria-hidden />
                              Add Item
                            </motion.button>
                          )}
                        </motion.section>
                      );
                    })}
                  </div>

                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className={cn(wellnessPlanGlassCard, "print:hidden")}
                  >
                    <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                      <div className="flex items-start gap-4">
                        <div className={wellnessPlanIconChip("violet")}>
                          <ShieldCheck className="h-5 w-5" aria-hidden />
                        </div>
                        <div>
                          <h3 className="font-serif text-lg font-light text-white">
                            Keep Your Wellness Plan Accessible
                          </h3>
                          <p className="mt-2 max-w-lg text-sm leading-relaxed text-[rgba(255,255,255,0.5)]">
                            Print or save as PDF from the print dialog so you can access it when
                            you need it most. Your plan stays private and secure.
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <button type="button" onClick={handlePrintOrPdf} className={wellnessPlanBtnGhost}>
                          <Printer className="h-4 w-4" aria-hidden />
                          Print Plan
                        </button>
                        <button type="button" onClick={handlePrintOrPdf} className={wellnessPlanBtnRose}>
                          <Download className="h-4 w-4" aria-hidden />
                          Save as PDF
                        </button>
                      </div>
                    </div>
                  </motion.div>

                  <motion.section
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.55 }}
                    className={cn(wellnessPlanBottomBanner, "print:hidden")}
                  >
                    <img
                      src={WELLNESS_PLAN_BANNER_IMG}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover object-[20%_50%] brightness-[0.38]"
                    />
                    <div
                      className="absolute inset-0 bg-gradient-to-r from-[#0a0b18]/95 via-[#0a0b18]/72 to-[#0a0b18]/45"
                      aria-hidden
                    />
                    <div
                      className="absolute inset-0 bg-[radial-gradient(ellipse_50%_80%_at_12%_50%,rgba(251,146,60,0.18)_0%,transparent_55%)]"
                      aria-hidden
                    />
                    <div className="relative flex min-h-[140px] flex-col items-start justify-center gap-3 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
                      <div>
                        <p className="font-serif text-xl font-light text-white sm:text-2xl">
                          You Deserve Support. You Deserve Peace.
                        </p>
                        <p className="mt-2 max-w-lg text-sm text-[rgba(255,255,255,0.55)]">
                          Your wellness is a priority. Take it one step at a time.
                        </p>
                      </div>
                      <p className={cn(wellnessPlanHandwritten, "shrink-0 sm:text-right")}>
                        You matter. ♡
                      </p>
                    </div>
                  </motion.section>
                </>
              ) : null}
            </AnimatePresence>
          </div>

          {loadState === "ready" ? (
            <WellnessPlanSafetyRail
              contacts={railContacts}
              contactsLoading={contactsLoading}
              recoveryPercent={recoveryPercent}
              onExportPdf={handlePrintOrPdf}
              onClearPlan={handleClearPlan}
              onResetPlan={handleResetPlan}
            />
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}
