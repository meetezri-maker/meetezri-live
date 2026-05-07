import { AppLayout } from "../../components/AppLayout";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Phone,
  MessageCircle,
  AlertTriangle,
  Heart,
  Clock,
  ExternalLink,
  Shield,
  HeartPulse,
  Users,
  ArrowLeft,
  Loader2,
  BookOpen,
  FileText,
  ChevronRight,
} from "lucide-react";
import { api } from "@/lib/api";
import { trackResourceInteraction } from "@/app/utils/resourceTracking";
import { useSafety } from "@/app/contexts/SafetyContext";
import {
  categoryVisualsForReading,
  fetchReadingLibraryArticles,
  type ReadingLibraryArticle,
} from "@/lib/readingLibraryArticles";

const LIBRARY_PREVIEW_LIMIT = 12;

interface EmergencyContact {
  id: string;
  name: string;
  relationship: string | null;
  phone: string | null;
  email: string | null;
  is_trusted: boolean;
  created_at: string;
  updated_at: string;
}

export function CrisisResources() {
  const navigate = useNavigate();
  const { currentState } = useSafety();

  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [isLoadingContacts, setIsLoadingContacts] = useState(true);
  const [libraryArticles, setLibraryArticles] = useState<ReadingLibraryArticle[]>([]);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(true);

  useEffect(() => {
    const loadContacts = async () => {
      try {
        const data = await api.emergencyContacts.getAll();
        setContacts(data);
      } catch (error) {
        console.error("Failed to load emergency contacts:", error);
      } finally {
        setIsLoadingContacts(false);
      }
    };

    loadContacts();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadLibrary = async () => {
      try {
        setIsLoadingLibrary(true);
        const rows = await fetchReadingLibraryArticles();
        if (!cancelled) setLibraryArticles(rows);
      } catch (e) {
        console.error("Failed to load reading library for crisis resources:", e);
        if (!cancelled) setLibraryArticles([]);
      } finally {
        if (!cancelled) setIsLoadingLibrary(false);
      }
    };
    void loadLibrary();
    return () => {
      cancelled = true;
    };
  }, []);

  const emergencyContacts = [
    {
      name: "National Suicide Prevention Lifeline",
      phone: "988",
      description: "24/7 emotional support",
      icon: Phone,
      color: "from-red-500 to-orange-600",
      resourceId: "us_988",
      resourceLabel: "988 Suicide & Crisis Lifeline",
      resourceType: "crisis_line" as const,
      interactionOnDial: "call" as const,
    },
    {
      name: "Crisis Text Line",
      phone: "Text HOME to 741741",
      description: "24/7 text-based support",
      icon: MessageCircle,
      color: "from-blue-500 to-cyan-600",
      resourceId: "us_crisis_text",
      resourceLabel: "Crisis Text Line",
      resourceType: "text_line" as const,
      /** Page uses tel: fallback; texting is tracked as intent similar to SMS. */
      interactionOnDial: "text" as const,
      telHref: "tel:741741",
    },
    {
      name: "Emergency Services",
      phone: "911",
      description: "Immediate emergency assistance",
      icon: AlertTriangle,
      color: "from-red-600 to-red-700",
      resourceId: "us_emergency",
      resourceLabel: "Emergency Services",
      resourceType: "emergency" as const,
      interactionOnDial: "call" as const,
    },
    {
      name: "SAMHSA National Helpline",
      phone: "1-800-662-4357",
      description: "Mental health & substance abuse",
      icon: HeartPulse,
      color: "from-purple-500 to-pink-600",
      resourceId: "us_samhsa_helpline",
      resourceLabel: "SAMHSA National Helpline",
      resourceType: "crisis_line" as const,
      interactionOnDial: "call" as const,
    },
  ];

  const safetyPlan = [
    {
      step: 1,
      title: "Warning Signs",
      content: "Recognize when you're in distress"
    },
    {
      step: 2,
      title: "Coping Strategies",
      content: "Things you can do on your own"
    },
    {
      step: 3,
      title: "Social Support",
      content: "People who can help distract you"
    },
    {
      step: 4,
      title: "Professional Help",
      content: "Contacts for professional support"
    },
    {
      step: 5,
      title: "Emergency",
      content: "Remove means and contact emergency services"
    }
  ];

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Link 
            to="/app/settings" 
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Settings
          </Link>

          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">Emergency Resources</h1>
          </div>
          <p className="text-muted-foreground">
            24/7 support when you need it most. You're not alone.
          </p>
        </motion.div>

        {/* Emergency Alert */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <Card className="p-6 bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-xl border-0">
            <div className="flex items-start gap-4">
              <motion.div
                animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <AlertTriangle className="w-8 h-8 flex-shrink-0" />
              </motion.div>
              <div className="flex-1">
                <h2 className="text-xl font-bold mb-2">If you're in immediate danger:</h2>
                <p className="text-white/90 mb-4">
                  Call 911 or go to your nearest emergency room. Your safety is the top priority.
                </p>
                <motion.a
                  href="tel:911"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="inline-block"
                  onClick={() =>
                    trackResourceInteraction(
                      "us_emergency",
                      "Emergency Services",
                      "emergency",
                      "call",
                      undefined,
                      currentState
                    )
                  }
                >
                  <Button
                    size="lg"
                    className="bg-white text-red-600 hover:bg-white/90 font-bold"
                  >
                    <Phone className="w-5 h-5 mr-2" />
                    Call 911 Now
                  </Button>
                </motion.a>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* 24/7 Hotlines */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <h2 className="text-xl font-bold mb-4">24/7 Emergency Hotlines</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {emergencyContacts.map((contact, index) => {
              const Icon = contact.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + index * 0.05 }}
                  whileHover={{ scale: 1.02, y: -3 }}
                >
                  <Card
                    className={`p-6 bg-gradient-to-br ${contact.color} text-white shadow-lg cursor-pointer group`}
                  >
                    <div className="flex items-start gap-4 mb-4">
                      <motion.div
                        whileHover={{ rotate: 10, scale: 1.1 }}
                        className="p-3 bg-white/20 rounded-xl backdrop-blur-sm"
                      >
                        <Icon className="w-6 h-6" />
                      </motion.div>
                      <div className="flex-1">
                        <h3 className="font-bold mb-1">{contact.name}</h3>
                        <p className="text-sm text-white/90">{contact.description}</p>
                      </div>
                    </div>
                    <motion.a
                      href={
                        "telHref" in contact && contact.telHref
                          ? contact.telHref
                          : `tel:${contact.phone.replace(/\D/g, "")}`
                      }
                      whileTap={{ scale: 0.95 }}
                      className="block"
                      onClick={() =>
                        trackResourceInteraction(
                          contact.resourceId,
                          contact.resourceLabel,
                          contact.resourceType,
                          contact.interactionOnDial,
                          undefined,
                          currentState
                        )
                      }
                    >
                      <div className="bg-white/20 backdrop-blur-sm p-4 rounded-lg group-hover:bg-white/30 transition-colors">
                        <div className="flex items-center justify-between">
                          <span className="text-2xl font-bold">{contact.phone}</span>
                          <Phone className="w-5 h-5" />
                        </div>
                      </div>
                    </motion.a>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Personal Contacts */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="p-6 shadow-xl">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-6 h-6 text-primary" />
                <h2 className="text-xl font-bold">Your Emergency Contacts</h2>
              </div>
              <div className="space-y-3">
                {isLoadingContacts && (
                  <div className="flex items-center justify-center py-6 text-muted-foreground">
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    <span>Loading your emergency contacts…</span>
                  </div>
                )}

                {!isLoadingContacts && contacts.length === 0 && (
                  <div className="p-4 bg-gray-50 rounded-lg text-sm text-muted-foreground">
                    You haven't added any emergency contacts yet. Add someone you trust so their
                    real phone number is available here during an emergency.
                  </div>
                )}

                {!isLoadingContacts &&
                  contacts.map((contact, index) => (
                    <motion.div
                      key={contact.id ?? index.toString()}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.6 + index * 0.05 }}
                      whileHover={{ x: 5 }}
                      className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h3 className="font-bold">{contact.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {contact.relationship || "Emergency contact"}
                          </p>
                        </div>
                        {contact.phone && (
                          <motion.a
                            href={`tel:${contact.phone.replace(/\D/g, "")}`}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            className="p-2 bg-primary text-white rounded-full hover:bg-primary/90"
                            onClick={() =>
                              trackResourceInteraction(
                                `trusted_contact_${contact.id}`,
                                contact.name || "Emergency contact",
                                "trusted_contact",
                                "call",
                                undefined,
                                currentState
                              )
                            }
                          >
                            <Phone className="w-4 h-4" />
                          </motion.a>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        {contact.phone ? (
                          <>
                            <span className="font-medium">{contact.phone}</span>
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              <span>Available as listed</span>
                            </div>
                          </>
                        ) : (
                          <span className="text-muted-foreground">
                            No phone number saved for this contact yet.
                          </span>
                        )}
                      </div>
                    </motion.div>
                  ))}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate('/app/settings/emergency-contacts')}
                >
                  + Add Contact
                </Button>
              </div>
            </Card>
          </motion.div>

          {/* Safety Plan */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
          >
            <Card className="p-6 shadow-xl">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-6 h-6 text-primary" />
                <h2 className="text-xl font-bold">Safety Plan</h2>
              </div>
              <div className="space-y-3">
                {safetyPlan.map((item, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.7 + index * 0.05 }}
                    whileHover={{ x: 5 }}
                    className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    <div className="w-8 h-8 flex-shrink-0 bg-primary text-white rounded-full flex items-center justify-center font-bold">
                      {item.step}
                    </div>
                    <div>
                      <h3 className="font-bold mb-1">{item.title}</h3>
                      <p className="text-sm text-muted-foreground">{item.content}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
              <Button
                className="w-full mt-4"
                onClick={() => navigate('/app/settings/safety-plan')}
              >
                View Full Safety Plan
              </Button>
            </Card>
          </motion.div>
        </div>

        {/* Reading library — same articles as Settings → Resources */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <Card className="p-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
              <div>
                <h2 className="text-xl font-bold mb-1 flex items-center gap-2">
                  <BookOpen className="w-6 h-6 text-primary" aria-hidden />
                  Articles & readings
                </h2>
                <p className="text-sm text-muted-foreground max-w-xl">
              Short reads and guided reflections from Solace, organized by topic.
              </p>
              </div>
              <Button variant="outline" size="sm" className="shrink-0" asChild>
                <Link to="/app/settings/resources">Browse full library</Link>
              </Button>
            </div>

            {isLoadingLibrary ? (
              <div className="flex items-center justify-center py-14 text-muted-foreground gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-primary" aria-hidden />
                <span>Loading your resources…</span>
              </div>
            ) : libraryArticles.length === 0 ? (
              <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
                No articles published yet. When your team adds wellness readings, they&apos;ll appear here automatically.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {libraryArticles.slice(0, LIBRARY_PREVIEW_LIMIT).map((article, index) => {
                  const { Icon } = categoryVisualsForReading(article.category);
                  const to = `/app/settings/resources/article/${encodeURIComponent(article.id)}`;

                  const trackOpenArticle = () => {
                    trackResourceInteraction(
                      `reading_article:${article.id}`,
                      article.title,
                      "support_group",
                      "visit",
                      undefined,
                      currentState
                    );
                  };

                  const openExternal = () => {
                    if (!article.contentUrl) return;
                    trackResourceInteraction(
                      `reading_article_external:${article.id}`,
                      article.title,
                      "support_group",
                      "visit",
                      undefined,
                      currentState
                    );
                    window.open(article.contentUrl, "_blank", "noopener,noreferrer");
                  };

                  return (
                    <motion.div
                      key={article.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(0.35, 0.05 * index) }}
                      whileHover={{ scale: 1.01 }}
                      className="relative flex flex-col rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 overflow-hidden hover:border-primary hover:shadow-md transition-all group"
                    >
                      <Link
                        to={to}
                        onClick={trackOpenArticle}
                        className="block flex-1 p-4 text-left"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span className="p-2 rounded-lg bg-gradient-to-br from-violet-100 to-fuchsia-100 dark:from-violet-950/80 dark:to-fuchsia-950/80">
                              <Icon className="w-5 h-5 text-violet-700 dark:text-violet-300" aria-hidden />
                            </span>
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                              <FileText className="w-3 h-3" aria-hidden />
                              {article.category}
                            </span>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-primary transition-colors shrink-0" aria-hidden />
                        </div>
                        <h3 className="font-bold mb-1 group-hover:text-primary transition-colors line-clamp-2">
                          {article.title}
                        </h3>
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{article.description}</p>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" aria-hidden />
                            {article.duration}
                          </span>
                          <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium">
                            {article.source === "builtin" ? "Ezri read" : "Care team"}
                          </span>
                        </div>
                      </Link>
                      {article.contentUrl ? (
                        <div className="border-t border-gray-100 dark:border-slate-800 px-4 py-2 bg-muted/40">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-2 hover:underline"
                            onClick={openExternal}
                          >
                            <ExternalLink className="w-3.5 h-3.5" aria-hidden />
                            Open external supplement
                          </button>
                        </div>
                      ) : null}
                    </motion.div>
                  );
                })}
              </div>
            )}
            {!isLoadingLibrary && libraryArticles.length > LIBRARY_PREVIEW_LIMIT ? (
              <p className="text-sm text-muted-foreground mt-4 text-center">
                Showing first {LIBRARY_PREVIEW_LIMIT}.{" "}
                <Link className="text-primary font-medium underline underline-offset-2" to="/app/settings/resources">
                  View all
                </Link>
              </p>
            ) : null}
          </Card>
        </motion.div>

        {/* Support Message */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
          className="mt-8"
        >
          <Card className="p-6 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 text-white shadow-xl">
            <div className="flex items-start gap-3">
              <Heart className="w-6 h-6 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-bold text-lg mb-2">You Are Not Alone</h3>
                <p className="text-white/90">
                  Reaching out for help is a sign of strength, not weakness. These resources are here for you 24/7. Your life matters, and there are people who care and want to help.
                </p>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </AppLayout>
  );
}
