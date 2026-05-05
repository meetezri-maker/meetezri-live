import { AppLayout } from "../../components/AppLayout";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate, Link } from "react-router";
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
  ExternalLink,
  Mail,
} from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import type { LucideIcon } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/app/contexts/AuthContext";
import { toast } from "sonner";
import { api } from "@/lib/api";

interface SafetyPlanSection {
  id: string;
  title: string;
  icon: LucideIcon;
  items: string[];
  placeholder: string;
}

interface EmergencyContact {
  id: string;
  name: string;
  relationship: string | null;
  phone: string | null;
  email: string | null;
  is_trusted: boolean;
}

const SECTION_BLUEPRINT: Omit<SafetyPlanSection, "items">[] = [
  {
    id: "warning-signs",
    title: "Warning Signs",
    icon: AlertTriangle,
    placeholder: "Add a warning sign...",
  },
  {
    id: "coping-strategies",
    title: "Coping Strategies",
    icon: Heart,
    placeholder: "Add a coping strategy...",
  },
  {
    id: "distractions",
    title: "Healthy Distractions",
    icon: Activity,
    placeholder: "Add a distraction...",
  },
  {
    id: "safe-people",
    title: "People I Can Contact",
    icon: Users,
    placeholder: "Add a contact person...",
  },
  {
    id: "safe-places",
    title: "Safe Places",
    icon: MapPin,
    placeholder: "Add a safe place...",
  },
  {
    id: "reasons-to-live",
    title: "Reasons to Live",
    icon: Heart,
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
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sections, setSections] = useState<SafetyPlanSection[]>(() =>
    emptySections()
  );
  const [planId, setPlanId] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">(
    "idle"
  );
  const [isDirty, setIsDirty] = useState(false);
  const saveStatusClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [newItem, setNewItem] = useState("");

  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);
  const [ecLoading, setEcLoading] = useState(true);

  useEffect(() => {
    api.emergencyContacts.getAll()
      .then((data) => setEmergencyContacts(data as EmergencyContact[]))
      .catch(() => toast.error("Could not load emergency contacts."))
      .finally(() => setEcLoading(false));
  }, []);

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

    const get = (id: string) =>
      sections.find((s) => s.id === id)?.items ?? [];

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

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-muted-foreground hover:text-primary mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Settings
          </button>
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <Shield className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">My Wellness Plan</h1>
            {loadState === "ready" && (
              <span className="text-sm text-muted-foreground flex items-center gap-2">
                {saveStatus === "saving" && (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving…
                  </>
                )}
                {saveStatus === "saved" && (
                  <span className="text-emerald-600 dark:text-emerald-400">
                    Saved
                  </span>
                )}
              </span>
            )}
          </div>
          <p className="text-muted-foreground">
            Your personalized plan for managing difficult moments and staying
            safe. Changes save automatically to your account.
          </p>
        </motion.div>

        {loadState === "loading" && (
          <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
            <Loader2 className="w-6 h-6 animate-spin" />
            Loading your wellness plan…
          </div>
        )}

        {loadState === "error" && (
          <Card className="p-6 mb-6 border-destructive/50">
            <p className="text-sm mb-4">
              We couldn&apos;t load your plan. You can try again or continue
              editing locally until sync works.
            </p>
            <Button type="button" variant="outline" onClick={() => void loadPlan()}>
              Retry
            </Button>
          </Card>
        )}

        <AnimatePresence>
          {loadState === "ready" && (
            <>
              {/* Info Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="mb-6"
              >
                <Card className="p-4 bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800">
                  <div className="flex items-start gap-3">
                    <BookOpen className="w-5 h-5 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-1">
                        What is a Wellness Plan?
                      </h3>
                      <p className="text-sm text-purple-800 dark:text-purple-200">
                        A wellness plan is a personalized, practical plan to help
                        you recognize warning signs and use coping strategies
                        when you&apos;re in distress. It can help you stay safe
                        during difficult times.
                      </p>
                    </div>
                  </div>
                </Card>
              </motion.div>

              {/* Emergency Numbers */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="mb-6"
              >
                <Card className="p-6 bg-gradient-to-r from-red-500 to-pink-500 text-white shadow-xl">
                  <div className="flex items-start gap-4">
                    <Phone className="w-8 h-8 flex-shrink-0" />
                    <div className="flex-1">
                      <h3 className="font-bold text-lg mb-3">
                        Just In Case Resources - Available 24/7
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <a
                          href="tel:988"
                          className="flex items-center gap-2 p-3 bg-white/20 backdrop-blur-sm rounded-lg hover:bg-white/30 transition-colors"
                        >
                          <Phone className="w-4 h-4" />
                          <div>
                            <div className="font-semibold">
                              988 Suicide & Crisis Lifeline
                            </div>
                            <div className="text-sm text-white/90">
                              Call or Text 988
                            </div>
                          </div>
                        </a>
                        <a
                          href="tel:911"
                          className="flex items-center gap-2 p-3 bg-white/20 backdrop-blur-sm rounded-lg hover:bg-white/30 transition-colors"
                        >
                          <Phone className="w-4 h-4" />
                          <div>
                            <div className="font-semibold">
                              Emergency Services
                            </div>
                            <div className="text-sm text-white/90">
                              Call 911
                            </div>
                          </div>
                        </a>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>

              {/* Emergency Contacts */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mb-6"
              >
                <Card className="p-6 shadow-lg">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Phone className="w-5 h-5 text-primary" />
                      </div>
                      <h3 className="font-bold text-lg">Emergency Contacts</h3>
                    </div>
                    <Link
                      to="/app/emergency-contacts"
                      className="flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      Manage
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>

                  {ecLoading ? (
                    <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading contacts…
                    </div>
                  ) : emergencyContacts.length === 0 ? (
                    <div className="text-center py-6">
                      <Users className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground mb-3">
                        No emergency contacts added yet.
                      </p>
                      <Link to="/app/emergency-contacts">
                        <Button type="button" size="sm" variant="outline">
                          <Plus className="w-4 h-4 mr-1" />
                          Add Emergency Contact
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {emergencyContacts.map((contact, idx) => (
                        <motion.div
                          key={contact.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
                        >
                          <div className="w-9 h-9 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                            {contact.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm">{contact.name}</p>
                            {contact.relationship && (
                              <p className="text-xs text-muted-foreground capitalize">{contact.relationship}</p>
                            )}
                            <div className="flex flex-wrap gap-3 mt-1">
                              {contact.phone && (
                                <a
                                  href={`tel:${contact.phone}`}
                                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                                >
                                  <Phone className="w-3 h-3" />
                                  {contact.phone}
                                </a>
                              )}
                              {contact.email && (
                                <a
                                  href={`mailto:${contact.email}`}
                                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                                >
                                  <Mail className="w-3 h-3" />
                                  {contact.email}
                                </a>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </Card>
              </motion.div>

              {/* Safety Plan Sections */}
              <div className="space-y-6">
                {sections.map((section, index) => {
                  const Icon = section.icon;
                  return (
                    <motion.div
                      key={section.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 + index * 0.05 }}
                    >
                      <Card className="p-6 shadow-lg">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="p-2 bg-primary/10 rounded-lg">
                            <Icon className="w-5 h-5 text-primary" />
                          </div>
                          <h3 className="font-bold text-lg">{section.title}</h3>
                        </div>

                        <div className="space-y-2 mb-4">
                          {section.items.map((item, itemIndex) => (
                            <motion.div
                              key={`${section.id}-${itemIndex}-${item.slice(0, 24)}`}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              className="flex items-start justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg group hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            >
                              <div className="flex items-start gap-3">
                                <div className="w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center text-xs font-bold mt-0.5 flex-shrink-0">
                                  {itemIndex + 1}
                                </div>
                                <p className="text-sm text-foreground">{item}</p>
                              </div>
                              <motion.button
                                type="button"
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() =>
                                  handleDeleteItem(section.id, itemIndex)
                                }
                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded transition-all"
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </motion.button>
                            </motion.div>
                          ))}
                        </div>

                        {editingSection === section.id ? (
                          <div className="flex gap-2 flex-wrap">
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
                              className="flex-1 min-w-[200px] p-3 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
                              autoFocus
                            />
                            <Button
                              type="button"
                              onClick={() => handleAddItem(section.id)}
                            >
                              Add
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                setEditingSection(null);
                                setNewItem("");
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <motion.button
                            type="button"
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                            onClick={() => setEditingSection(section.id)}
                            className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2"
                          >
                            <Plus className="w-4 h-4" />
                            Add Item
                          </motion.button>
                        )}
                      </Card>
                    </motion.div>
                  );
                })}
              </div>

              {/* Export/Print */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="mt-8 print:hidden"
              >
                <Card className="p-6 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-blue-200 dark:border-blue-800">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <h3 className="font-bold mb-1 text-foreground">
                        Keep Your Wellness Plan Accessible
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Print or save as PDF from the print dialog so you can
                        access it when you need it most.
                      </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handlePrintOrPdf}
                      >
                        Print Plan
                      </Button>
                      <Button type="button" onClick={handlePrintOrPdf}>
                        <Download className="w-4 h-4 mr-2" />
                        Save as PDF
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}
