import { motion, AnimatePresence } from "motion/react";
import { Link } from "react-router-dom";
import {
  Shield,
  Plus,
  Trash2,
  ArrowLeft,
  Phone,
  BookOpen,
  Download,
  Loader2,
  ChevronRight,
  Printer,
  ShieldCheck,
  Eraser,
  RotateCcw,
} from "lucide-react";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/app/contexts/AuthContext";
import { useSafety } from "@/app/contexts/SafetyContext";
import { getPrimaryEmergencyResource, getSafetyResources, getTelHrefForPhone } from "@/app/utils/safetyResources";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/app/components/ui/alert-dialog";
import {
  modalBodyText,
  modalDestructiveButton,
  modalSecondaryButton,
  modalTitle,
} from "@/lib/modalTheme";
import {
  WELLNESS_PLAN_BANNER_IMG,
  WELLNESS_PLAN_HERO_IMG,
  wellnessPlanAddZone,
  wellnessPlanBackLink,
  wellnessPlanBottomBanner,
  wellnessPlanBottomBannerBody,
  wellnessPlanBottomBannerContent,
  wellnessPlanBottomBannerImg,
  wellnessPlanBottomBannerOverlayDark,
  wellnessPlanBottomBannerOverlayWarm,
  wellnessPlanBottomBannerTagline,
  wellnessPlanBottomBannerTitle,
  wellnessPlanBtnGhost,
  wellnessPlanBtnRose,
  wellnessPlanGlassCard,
  wellnessPlanHandwritten,
  wellnessPlanHeroCard,
  wellnessPlanHeroImage,
  wellnessPlanHeroInner,
  wellnessPlanHeroLead,
  wellnessPlanHeroLightScrim,
  wellnessPlanHeroOverlayAccent,
  wellnessPlanHeroOverlayBottom,
  wellnessPlanHeroOverlayReadability,
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
import {
  addWellnessPlanSectionItem,
  applyWellnessPlanToEditor,
  computeWellnessPlanRecoveryPercent,
  createEmptyWellnessPlanSections,
  createInitialWellnessPlanEditorState,
  removeWellnessPlanSectionItem,
  resetWellnessPlanSectionsToSnapshot,
  WELLNESS_PLAN_AUTOSAVE_DEBOUNCE_MS,
  wellnessPlanResponseToSections,
  wellnessPlanSectionsToUpsertBody,
  type WellnessPlanEditorState,
  type WellnessPlanSection,
  type WellnessPlanSectionId,
} from "@/app/pages/app/wellness-plan-settings/wellnessPlanModel";

export function SafetyPlan() {
  const { user } = useAuth();
  const { userRegion } = useSafety();
  const crisisLine = getSafetyResources(userRegion).find((r) => r.type === "crisis_line");
  const emergencyResource = getPrimaryEmergencyResource(userRegion);
  const [editor, setEditor] = useState<WellnessPlanEditorState>(() =>
    createInitialWellnessPlanEditorState()
  );
  const saveStatusClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [editingSection, setEditingSection] = useState<WellnessPlanSectionId | null>(null);
  const [newItem, setNewItem] = useState("");
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [clearLoading, setClearLoading] = useState(false);

  const { sections, planId, loadState, saveStatus, isDirty, savedSnapshot } = editor;
  const setSections = (next: WellnessPlanSection[] | ((prev: WellnessPlanSection[]) => WellnessPlanSection[])) => {
    setEditor((prev) => ({
      ...prev,
      sections: typeof next === "function" ? next(prev.sections) : next,
    }));
  };
  const setPlanId = (id: string | null) => setEditor((prev) => ({ ...prev, planId: id }));
  const setLoadState = (state: WellnessPlanEditorState["loadState"]) =>
    setEditor((prev) => ({ ...prev, loadState: state }));
  const setSaveStatus = (status: WellnessPlanEditorState["saveStatus"]) =>
    setEditor((prev) => ({ ...prev, saveStatus: status }));
  const setIsDirty = (dirty: boolean) => setEditor((prev) => ({ ...prev, isDirty: dirty }));

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

  const recoveryPercent = useMemo(
    () => computeWellnessPlanRecoveryPercent(sections),
    [sections]
  );

  const loadPlan = useCallback(async () => {
    if (!user?.id) {
      setLoadState("ready");
      return;
    }
    setLoadState("loading");
    try {
      const data = await api.wellnessPlan.get();
      const loaded = wellnessPlanResponseToSections(data);
      setEditor((prev) => applyWellnessPlanToEditor(prev, data.id, loaded));
    } catch (error) {
      console.error("Wellness plan load:", error);
      toast.error("Could not load your wellness plan. Please try again.");
      setEditor((prev) => ({
        ...applyWellnessPlanToEditor(prev, null, createEmptyWellnessPlanSections()),
        loadState: "error",
      }));
    }
  }, [user?.id]);

  useEffect(() => {
    void loadPlan();
  }, [loadPlan]);

  const persist = useCallback(async () => {
    if (!user?.id || !isDirty) return;

    const body = wellnessPlanSectionsToUpsertBody(sections);

    setSaveStatus("saving");
    try {
      const saved = await api.wellnessPlan.save(body);
      if (saved.id) setPlanId(saved.id);
      setEditor((prev) => ({
        ...prev,
        isDirty: false,
        savedSnapshot: prev.sections.map((section) => ({
          ...section,
          items: section.items.map((item) => ({ ...item })),
        })),
        saveStatus: "saved",
      }));
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
    }, WELLNESS_PLAN_AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [sections, isDirty, loadState, user?.id, persist]);

  const handleAddItem = (sectionId: WellnessPlanSectionId) => {
    if (!newItem.trim()) return;
    setSections((prev) => addWellnessPlanSectionItem(prev, sectionId, newItem));
    setIsDirty(true);
    setNewItem("");
    setEditingSection(null);
  };

  const handleDeleteItem = (sectionId: WellnessPlanSectionId, itemId: string) => {
    setSections((prev) => removeWellnessPlanSectionItem(prev, sectionId, itemId));
    setIsDirty(true);
  };

  const handlePrintOrPdf = useCallback(() => {
    document.documentElement.classList.add("wellness-plan-printing");
    const cleanup = () => {
      document.documentElement.classList.remove("wellness-plan-printing");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
  }, []);

  const confirmClearPlan = useCallback(async () => {
    setClearLoading(true);
    try {
      const cleared = await api.wellnessPlan.clear();
      const emptySections = wellnessPlanResponseToSections(cleared);
      setEditor((prev) => applyWellnessPlanToEditor(prev, cleared.id, emptySections));
      setShowClearDialog(false);
      toast.success("Plan cleared.");
    } catch {
      toast.error("Could not clear your wellness plan.");
    } finally {
      setClearLoading(false);
    }
  }, []);

  const confirmResetPlan = useCallback(() => {
    setEditor((prev) => ({
      ...prev,
      sections: resetWellnessPlanSectionsToSnapshot(prev.savedSnapshot),
      isDirty: false,
    }));
    setShowResetDialog(false);
    toast.success("Plan reset to last saved version.");
  }, []);

  return (
    <motion.div
      className={cn(wellnessPlanPageAtmosphere, "wellness-plan-print-root")}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
    >
      <motion.div
        className={cn(wellnessPlanPageGlowTop, "wellness-plan-print-atmosphere print:hidden")}
        aria-hidden
      />
      <motion.div
        className={cn(wellnessPlanPageFogMid, "wellness-plan-print-atmosphere print:hidden")}
        aria-hidden
      />
      <motion.div
        className={cn(wellnessPlanPageVignette, "wellness-plan-print-atmosphere print:hidden")}
        aria-hidden
      />

      <div className="relative z-10 mx-auto w-full max-w-[1500px] px-4 py-7 sm:px-7 sm:py-9 print:max-w-none print:px-0 print:py-0">
        <div className="wellness-plan-print-grid grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(300px,340px)]">
          <div className="min-w-0 space-y-6">
            <section className={wellnessPlanHeroCard}>
              <img
                src={WELLNESS_PLAN_HERO_IMG}
                alt=""
                className={wellnessPlanHeroImage}
                width={1600}
                height={900}
                loading="eager"
                decoding="async"
              />
              <div className={wellnessPlanHeroLightScrim} aria-hidden />
              <div className={wellnessPlanHeroOverlayReadability} aria-hidden />
              <div className={wellnessPlanHeroOverlayAccent} aria-hidden />
              <div className={wellnessPlanHeroOverlayBottom} aria-hidden />

              <div className={wellnessPlanHeroInner}>
                <div className="max-w-2xl">
                  <Link to="/app/settings" className={cn(wellnessPlanBackLink, "print:hidden")}>
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
                            <span className="print:hidden">
                              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                              Saving…
                            </span>
                          ) : null}
                          {saveStatus === "saved" ? (
                            <span className="text-emerald-300/80 print:hidden">Saved</span>
                          ) : null}
                        </span>
                      ) : null}
                    </motion.div>
                  </div>

                  <p className={cn(wellnessPlanHeroLead, "mt-4 max-w-xl")}>
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
                    className={cn(wellnessPlanGlassCard, "flex items-start gap-4 p-5 sm:p-6 print:hidden")}
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
                    {/* <ChevronRight
                      className="mt-1 h-5 w-5 shrink-0 text-[rgba(255,255,255,0.25)] print:hidden"
                      aria-hidden
                    /> */}
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
                      {crisisLine?.phone ? (
                      <a href={getTelHrefForPhone(crisisLine.phone)} className={wellnessPlanResourceTile}>
                        <div className={wellnessPlanIconChip("rose")}>
                          <Phone className="h-4 w-4" aria-hidden />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {crisisLine.name}
                          </p>
                          <p className="mt-0.5 text-xs text-rose-200/70">{crisisLine.phone}</p>
                        </div>
                      </a>
                      ) : null}
                      {emergencyResource?.phone ? (
                      <a href={getTelHrefForPhone(emergencyResource.phone)} className={wellnessPlanResourceTile}>
                        <div className={wellnessPlanIconChip("rose")}>
                          <Phone className="h-4 w-4" aria-hidden />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">{emergencyResource.name}</p>
                          <p className="mt-0.5 text-xs text-rose-200/70">{emergencyResource.phone}</p>
                        </div>
                      </a>
                      ) : null}
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
                            {/* <ChevronRight
                              className="mt-1 h-5 w-5 shrink-0 text-[rgba(255,255,255,0.25)] print:hidden"
                              aria-hidden
                            /> */}
                          </div>

                          {section.items.length > 0 ? (
                            <div className="space-y-2 px-5 pb-4 sm:px-6">
                              {section.items.map((item, itemIndex) => (
                                <motion.div
                                  key={item.id}
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
                                      {item.text}
                                    </p>
                                  </motion.div>
                                  <motion.button
                                    type="button"
                                    whileHover={{ scale: 1.08 }}
                                    whileTap={{ scale: 0.92 }}
                                    onClick={() => handleDeleteItem(section.id, item.id)}
                                    className="rounded-lg p-1.5 text-rose-300/60 opacity-0 transition-all group-hover:opacity-100 hover:bg-rose-500/10 hover:text-rose-200 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/40 print:hidden"
                                    aria-label={`Remove item ${itemIndex + 1}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </motion.button>
                                </motion.div>
                              ))}
                            </div>
                          ) : null}

                          {editingSection === section.id ? (
                            <div className="flex flex-wrap gap-2 px-5 pb-5 sm:px-6 print:hidden">
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
                              className={cn(wellnessPlanAddZone, "print:hidden")}
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
                    <img src={WELLNESS_PLAN_BANNER_IMG} alt="" className={wellnessPlanBottomBannerImg} />
                    <div className={wellnessPlanBottomBannerOverlayDark} aria-hidden />
                    <div className={wellnessPlanBottomBannerOverlayWarm} aria-hidden />
                    <div className={wellnessPlanBottomBannerContent}>
                      <div>
                        <p className={wellnessPlanBottomBannerTitle}>
                          You Deserve Support. You Deserve Peace.
                        </p>
                        <p className={wellnessPlanBottomBannerBody}>
                          Your wellness is a priority. Take it one step at a time.
                        </p>
                      </div>
                      <p className={wellnessPlanBottomBannerTagline}>You matter. ♡</p>
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
              onClearPlan={() => setShowClearDialog(true)}
              onResetPlan={() => setShowResetDialog(true)}
            />
          ) : null}
        </div>
      </div>

      <AlertDialog
        open={showClearDialog}
        onOpenChange={(open) => {
          if (clearLoading) return;
          setShowClearDialog(open);
        }}
      >
        <AlertDialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
          <div className="p-6 pb-5">
            <div className="flex items-start gap-4">
              <div className={wellnessPlanIconChip("rose")}>
                <Eraser className="h-5 w-5" aria-hidden />
              </div>
              <AlertDialogHeader className="min-w-0 flex-1 gap-1.5 text-left">
                <AlertDialogTitle className={cn(modalTitle, "text-xl")}>
                  Clear your wellness plan?
                </AlertDialogTitle>
                <AlertDialogDescription className={modalBodyText}>
                  All items will be removed and an empty plan will be saved to your account.
                </AlertDialogDescription>
              </AlertDialogHeader>
            </div>
          </div>
          <AlertDialogFooter className="flex-row justify-end gap-3 border-t border-white/[0.08] bg-black/20 px-6 py-4 sm:justify-end">
            <AlertDialogCancel disabled={clearLoading} className={modalSecondaryButton}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmClearPlan();
              }}
              className={modalDestructiveButton}
              disabled={clearLoading}
            >
              {clearLoading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Clearing…
                </span>
              ) : (
                "Clear plan"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
          <div className="p-6 pb-5">
            <div className="flex items-start gap-4">
              <div className={wellnessPlanIconChip("violet")}>
                <RotateCcw className="h-5 w-5" aria-hidden />
              </div>
              <AlertDialogHeader className="min-w-0 flex-1 gap-1.5 text-left">
                <AlertDialogTitle className={cn(modalTitle, "text-xl")}>
                  Reset to last saved version?
                </AlertDialogTitle>
                <AlertDialogDescription className={modalBodyText}>
                  Unsaved changes will be lost. Your plan will match the last version saved to your
                  account.
                </AlertDialogDescription>
              </AlertDialogHeader>
            </div>
          </div>
          <AlertDialogFooter className="flex-row justify-end gap-3 border-t border-white/[0.08] bg-black/20 px-6 py-4 sm:justify-end">
            <AlertDialogCancel className={modalSecondaryButton}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmResetPlan();
              }}
              className={modalDestructiveButton}
            >
              Reset plan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
