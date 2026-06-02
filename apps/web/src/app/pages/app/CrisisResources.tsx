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
  HandHeart,
  Lock,
  Timer,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { trackResourceInteraction } from "@/app/utils/resourceTracking";
import { useSafety } from "@/app/contexts/SafetyContext";
import {
  categoryVisualsForReading,
  fetchReadingLibraryArticles,
  type ReadingLibraryArticle,
} from "@/lib/readingLibraryArticles";
import {
  EMERGENCY_HERO_IMG,
  EMERGENCY_RAIL_IMG,
  CRISIS_ALONE_BANNER_IMG,
  crisisAloneBanner,
  crisisAloneBannerContent,
  crisisAloneBannerImage,
  crisisAloneBannerOverlay,
  crisisArticleRow,
  crisisContactRow,
  crisisDangerCard,
  crisisDangerCta,
  crisisHotlineCard,
  crisisHotlineDial,
  crisisOutlineBtn,
  crisisPanelCard,
  crisisRailHeartWrap,
  crisisSafetyStep,
  crisisSectionTitle,
  crisisStepBadge,
  crisisViewAllLink,
  emergencyActionBtn,
  emergencyBackLink,
  emergencyBtnPrimary,
  emergencyContactAvatar,
  emergencyHeroAccent,
  emergencyHeroCard,
  emergencyHeroImage,
  emergencyHeroLightScrim,
  emergencyHeroOverlayAccent,
  emergencyHeroOverlayBottom,
  emergencyHeroOverlayReadability,
  emergencyHeroTitle,
  emergencyIconChip,
  emergencyPageAtmosphere,
  emergencyPageFogMid,
  emergencyPageGlowTop,
  emergencyPageVignette,
  emergencyRailCard,
  emergencyResourcesCta,
  emergencySafetyRow,
} from "@/app/pages/app/crisis-resources/crisisResourcesUi";

const CRISIS_RESOURCES_ARTICLE_LIMIT = 4;

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

function contactInitials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

const HOTLINE_RESOURCES = [
  {
    name: "National Suicide Prevention Lifeline",
    phone: "988",
    description: "24/7 emotional support",
    icon: Phone,
    variant: "lifeline" as const,
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
    variant: "text" as const,
    resourceId: "us_crisis_text",
    resourceLabel: "Crisis Text Line",
    resourceType: "text_line" as const,
    interactionOnDial: "text" as const,
    telHref: "tel:741741",
  },
  {
    name: "Emergency Services",
    phone: "911",
    description: "Immediate emergency assistance",
    icon: AlertTriangle,
    variant: "emergency" as const,
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
    variant: "samhsa" as const,
    resourceId: "us_samhsa_helpline",
    resourceLabel: "SAMHSA National Helpline",
    resourceType: "crisis_line" as const,
    interactionOnDial: "call" as const,
  },
];

const SAFETY_PLAN_STEPS = [
  {
    step: 1,
    title: "Warning Signs",
    content: "Recognize when you're in distress",
  },
  {
    step: 2,
    title: "Coping Strategies",
    content: "Things you can do on your own",
  },
  {
    step: 3,
    title: "Social Support",
    content: "People who can help distract you",
  },
  {
    step: 4,
    title: "Professional Help",
    content: "Contacts for professional support",
  },
  {
    step: 5,
    title: "Emergency",
    content: "Remove means and contact emergency services",
  },
];

const RESOURCE_GUIDANCE = [
  {
    tone: "pink" as const,
    icon: HandHeart,
    title: "You decide",
    description: "You're in control. Use what feels right for you.",
  },
  {
    tone: "cyan" as const,
    icon: Lock,
    title: "You are safe",
    description: "These services are confidential and secure.",
  },
  {
    tone: "violet" as const,
    icon: Heart,
    title: "We're here",
    description: "Help is available whenever you need it.",
  },
  {
    tone: "amber" as const,
    icon: Timer,
    title: "Take your time",
    description: "Know that help is here when you're ready.",
  },
];

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

    void loadContacts();
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

  const displayedArticles = libraryArticles.slice(0, CRISIS_RESOURCES_ARTICLE_LIMIT);
  const hasMoreArticles = libraryArticles.length > CRISIS_RESOURCES_ARTICLE_LIMIT;

  return (
    <motion.div
      className={emergencyPageAtmosphere}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
    >
      <motion.div className={emergencyPageGlowTop} aria-hidden />
      <motion.div className={emergencyPageFogMid} aria-hidden />
      <motion.div className={emergencyPageVignette} aria-hidden />

      <motion.div className="relative z-10 mx-auto w-full max-w-[1500px] px-4 py-7 sm:px-7 sm:py-9">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
          {/* Main column */}
          <div className="min-w-0 space-y-6 xl:col-start-1">
            {/* 1. Cinematic header / hero */}
            <section className={emergencyHeroCard}>
              <img
                src={EMERGENCY_HERO_IMG}
                alt=""
                className={emergencyHeroImage}
                width={1600}
                height={900}
                loading="eager"
                decoding="async"
              />
              <div className={emergencyHeroLightScrim} aria-hidden />
              <div className={emergencyHeroOverlayReadability} aria-hidden />
              <div className={emergencyHeroOverlayAccent} aria-hidden />
              <div className={emergencyHeroOverlayBottom} aria-hidden />

              <motion.div className="relative z-10 flex min-h-[240px] flex-col justify-between p-6 sm:min-h-[260px] sm:p-8">
                <div>
                  <Link to="/app/settings" className={emergencyBackLink}>
                    <ArrowLeft className="h-4 w-4" aria-hidden />
                    Back to Settings
                  </Link>

                  <motion.div className="mt-5 max-w-2xl">
                    <div className="flex flex-wrap items-center gap-3">
                      <Shield
                        className="h-8 w-8 shrink-0 text-fuchsia-300/90 drop-shadow-[0_0_16px_rgba(236,72,153,0.45)]"
                        strokeWidth={1.5}
                        aria-hidden
                      />
                      <h1 className={emergencyHeroTitle}>
                        Emergency <span className={emergencyHeroAccent}>Resources</span>
                      </h1>
                    </div>
                    <p className="mt-3 max-w-xl text-sm leading-relaxed text-[rgba(255,255,255,0.62)] sm:text-[15px]">
                      24/7 support when you need it most. You&apos;re not alone.
                    </p>
                  </motion.div>
                </div>
              </motion.div>
            </section>

            {/* 2. Immediate danger alert */}
            <section className={crisisDangerCard} aria-labelledby="immediate-danger-heading">
              <Shield
                className="pointer-events-none absolute right-4 top-1/2 hidden h-28 w-28 -translate-y-1/2 text-rose-200/10 sm:block"
                strokeWidth={1}
                aria-hidden
              />
              <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start">
                <div
                  className={cn(
                    emergencyIconChip("rose"),
                    "h-12 w-12 shrink-0 [&_svg]:h-5 [&_svg]:w-5"
                  )}
                >
                  <AlertTriangle className="h-5 w-5" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <h2
                    id="immediate-danger-heading"
                    className="text-lg font-semibold text-rose-50/95 sm:text-xl"
                  >
                    If you&apos;re in immediate danger:
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-rose-100/75">
                    Call 911 or go to your nearest emergency room. Your safety is the top
                    priority.
                  </p>
                  <motion.a
                    href="tel:911"
                    className={cn(crisisDangerCta, "mt-4")}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
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
                    <Phone className="h-5 w-5" aria-hidden />
                    Call 911 Now
                  </motion.a>
                </div>
              </div>
            </section>

            {/* 3. 24/7 Emergency Hotlines */}
            <section aria-labelledby="hotlines-heading">
              <h2 id="hotlines-heading" className={crisisSectionTitle}>
                24/7 Emergency Hotlines
              </h2>
              <motion.div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {HOTLINE_RESOURCES.map((contact, index) => {
                  const Icon = contact.icon;
                  return (
                    <motion.article
                      key={contact.resourceId}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 + index * 0.04 }}
                      className={crisisHotlineCard(contact.variant)}
                    >
                      <div className="flex items-start gap-3">
                        <motion.div
                          className={cn(
                            emergencyIconChip(
                              contact.variant === "text"
                                ? "cyan"
                                : contact.variant === "samhsa"
                                  ? "violet"
                                  : contact.variant === "emergency"
                                    ? "rose"
                                    : "orange"
                            ),
                            "h-11 w-11 [&_svg]:h-5 [&_svg]:w-5"
                          )}
                        >
                          <Icon className="h-5 w-5" aria-hidden />
                        </motion.div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-white">{contact.name}</h3>
                          <p className="mt-0.5 text-sm text-[rgba(255,255,255,0.58)]">
                            {contact.description}
                          </p>
                        </div>
                      </div>
                      <motion.a
                        href={
                          "telHref" in contact && contact.telHref
                            ? contact.telHref
                            : `tel:${contact.phone.replace(/\D/g, "")}`
                        }
                        className="block"
                        whileTap={{ scale: 0.98 }}
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
                        <motion.div className={crisisHotlineDial}>
                          <span className="text-xl font-bold tracking-tight text-white sm:text-2xl">
                            {contact.phone}
                          </span>
                          <span
                            className={cn(
                              emergencyActionBtn,
                              "h-10 w-10 border-white/15 bg-white/10"
                            )}
                            aria-hidden
                          >
                            <Phone className="h-4 w-4" />
                          </span>
                        </motion.div>
                      </motion.a>
                    </motion.article>
                  );
                })}
              </motion.div>
            </section>

            {/* 4. Emergency Contacts + Safety Plan */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* Your Emergency Contacts */}
              <section className={crisisPanelCard} aria-labelledby="contacts-heading">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <motion.div className="flex items-center gap-2.5">
                    <div className={emergencyIconChip("violet")}>
                      <Users className="h-4 w-4" aria-hidden />
                    </div>
                    <h2 id="contacts-heading" className={crisisSectionTitle}>
                      Your Emergency Contacts
                    </h2>
                  </motion.div>
                  <button
                    type="button"
                    onClick={() => navigate("/app/settings/emergency-contacts")}
                    className={crisisOutlineBtn}
                  >
                    + Add Contact
                  </button>
                </div>

                <div>
                  {isLoadingContacts ? (
                    <div className="flex items-center justify-center gap-2 py-8 text-sm text-[rgba(255,255,255,0.48)]">
                      <Loader2 className="h-4 w-4 animate-spin text-violet-300/70" aria-hidden />
                      Loading your emergency contacts…
                    </div>
                  ) : null}

                  {!isLoadingContacts && contacts.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-sm leading-relaxed text-[rgba(255,255,255,0.48)]">
                      You haven&apos;t added any emergency contacts yet. Add someone you trust
                      so their real phone number is available here during an emergency.
                    </p>
                  ) : null}

                  {!isLoadingContacts &&
                    contacts.map((contact) => (
                      <div key={contact.id} className={crisisContactRow}>
                        <motion.div className={emergencyContactAvatar} aria-hidden>
                          {contactInitials(contact.name)}
                        </motion.div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-white">
                            {contact.name}
                          </p>
                          <p className="text-xs text-[rgba(255,255,255,0.42)]">
                            {contact.relationship || "Emergency contact"}
                          </p>
                          {contact.phone ? (
                            <p className="mt-0.5 text-xs text-[rgba(255,255,255,0.62)]">
                              {contact.phone}
                            </p>
                          ) : (
                            <p className="mt-0.5 text-xs text-[rgba(255,255,255,0.38)]">
                              No phone number saved
                            </p>
                          )}
                          {contact.phone ? (
                            <p className="mt-0.5 flex items-center gap-1 text-[10px] text-[rgba(255,255,255,0.32)]">
                              <Clock className="h-3 w-3" aria-hidden />
                              Available as listed
                            </p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {contact.phone ? (
                            <a
                              href={`tel:${contact.phone.replace(/\D/g, "")}`}
                              className={emergencyActionBtn}
                              aria-label={`Call ${contact.name}`}
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
                              <Phone className="h-4 w-4" />
                            </a>
                          ) : null}
                          {contact.email || contact.phone ? (
                            <a
                              href={
                                contact.email
                                  ? `mailto:${contact.email}`
                                  : `sms:${contact.phone?.replace(/\s/g, "")}`
                              }
                              className={emergencyActionBtn}
                              aria-label={
                                contact.email ? `Email ${contact.name}` : `Message ${contact.name}`
                              }
                            >
                              <MessageCircle className="h-4 w-4" />
                            </a>
                          ) : null}
                        </div>
                      </div>
                    ))}
                </div>

                <Link
                  to="/app/settings/emergency-contacts"
                  className={cn(crisisViewAllLink, "mt-3")}
                >
                  View all contacts
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </Link>
              </section>

              {/* Safety Plan */}
              <section className={crisisPanelCard} aria-labelledby="safety-plan-heading">
                <div className="mb-4 flex items-center gap-2.5">
                  <div className={emergencyIconChip("pink")}>
                    <Shield className="h-4 w-4" aria-hidden />
                  </div>
                  <h2 id="safety-plan-heading" className={crisisSectionTitle}>
                    Safety Plan
                  </h2>
                </div>

                <div>
                  {SAFETY_PLAN_STEPS.map((item) => (
                    <div key={item.step} className={crisisSafetyStep}>
                      <div className={crisisStepBadge}>{item.step}</div>
                      <div className="min-w-0 pt-0.5">
                        <p className="text-sm font-medium text-white">{item.title}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-[rgba(255,255,255,0.45)]">
                          {item.content}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => navigate("/app/settings/wellness-plan")}
                  className={cn(emergencyBtnPrimary, "mt-5 w-full")}
                >
                  View Full Safety Plan
                </button>
              </section>
            </div>

            {/* 5. Articles & readings */}
            <section className={crisisPanelCard} aria-labelledby="articles-heading">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2.5">
                    <div className={emergencyIconChip("violet")}>
                      <BookOpen className="h-4 w-4" aria-hidden />
                    </div>
                    <h2 id="articles-heading" className={crisisSectionTitle}>
                      Articles & readings
                    </h2>
                  </div>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-[rgba(255,255,255,0.48)]">
                    Short reads and guided reflections from Solace, organized by topic.
                  </p>
                </div>
                <Link to="/app/settings/resources" className={cn(crisisOutlineBtn, "shrink-0 self-start")}>
                  View all
                </Link>
              </div>

              {isLoadingLibrary ? (
                <div className="flex items-center justify-center gap-2 py-14 text-sm text-[rgba(255,255,255,0.48)]">
                  <Loader2 className="h-5 w-5 animate-spin text-violet-300/70" aria-hidden />
                  Loading your resources…
                </div>
              ) : libraryArticles.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-[rgba(255,255,255,0.45)]">
                  No articles published yet. When your team adds wellness readings, they&apos;ll
                  appear here automatically.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {displayedArticles.map((article) => {
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
                      <div key={article.id} className="flex flex-col">
                        <Link
                          to={to}
                          onClick={trackOpenArticle}
                          className={cn(crisisArticleRow, "flex-1")}
                        >
                          <span
                            className={cn(
                              emergencyIconChip("violet"),
                              "h-10 w-10 shrink-0 [&_svg]:h-4 [&_svg]:w-4"
                            )}
                          >
                            <Icon className="h-4 w-4" aria-hidden />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-[rgba(255,255,255,0.38)]">
                              <FileText className="h-3 w-3" aria-hidden />
                              {article.category}
                            </span>
                            <span className="mt-1 block font-semibold leading-snug text-white group-hover:text-fuchsia-100/95">
                              {article.title}
                            </span>
                            <span className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-[rgba(255,255,255,0.45)]">
                              {article.description}
                            </span>
                            <span className="mt-2 inline-flex items-center gap-1 text-[11px] text-[rgba(255,255,255,0.38)]">
                              <Clock className="h-3.5 w-3.5" aria-hidden />
                              {article.duration}
                            </span>
                          </span>
                          <ChevronRight
                            className="h-4 w-4 shrink-0 self-center text-violet-300/40 transition group-hover:text-fuchsia-300/80"
                            aria-hidden
                          />
                        </Link>
                        {article.contentUrl ? (
                          <button
                            type="button"
                            className="mt-1 inline-flex items-center gap-1 px-1 text-[11px] font-medium text-fuchsia-300/75 hover:text-fuchsia-200"
                            onClick={openExternal}
                          >
                            <ExternalLink className="h-3 w-3" aria-hidden />
                            Open external supplement
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}

              {!isLoadingLibrary && libraryArticles.length > 0 ? (
                <div className="mt-6 flex flex-col items-center gap-3">
                  {hasMoreArticles ? (
                    <p className="text-center text-sm text-[rgba(255,255,255,0.45)]">
                      Showing {displayedArticles.length} of {libraryArticles.length} articles.
                    </p>
                  ) : null}
                  <Link to="/app/settings/resources" className={cn(emergencyBtnPrimary, "min-w-[220px]")}>
                    View all
                  </Link>
                </div>
              ) : null}
            </section>

            {/* 6. You Are Not Alone banner */}
            <section className={crisisAloneBanner} aria-labelledby="not-alone-heading">
              <img
                src={CRISIS_ALONE_BANNER_IMG}
                alt=""
                className={crisisAloneBannerImage}
                width={1200}
                height={400}
                loading="lazy"
                decoding="async"
              />
              <div className={crisisAloneBannerOverlay} aria-hidden />
              <div className={crisisAloneBannerContent}>
                <div className="flex items-start gap-4">
                  <div className={crisisRailHeartWrap}>
                    <Heart className="h-7 w-7 text-fuchsia-100/95" aria-hidden />
                  </div>
                  <div>
                    <h2 id="not-alone-heading" className="text-lg font-semibold text-white sm:text-xl">
                      You Are Not Alone
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-[rgba(255,255,255,0.72)]">
                      Reaching out for help is a sign of strength, not weakness. These resources are
                      here for you 24/7. Your life matters, and there are people who care and want to
                      help.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Right rail */}
          <aside className="space-y-5 xl:col-start-2 xl:row-start-1 xl:sticky xl:top-6 xl:self-start">
            {/* 1. You're not alone */}
            <motion.div
              className={cn(emergencyRailCard, "text-center")}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
            >
              <div className={cn(crisisRailHeartWrap, "mb-4")}>
                <Heart className="h-7 w-7 text-fuchsia-100/95" aria-hidden />
              </div>
              <h2 className="font-serif text-lg font-light text-white">You&apos;re not alone</h2>
              <p className="mt-3 text-sm leading-relaxed text-[rgba(255,255,255,0.55)]">
                Reaching out for help is a sign of strength, not weakness. These resources are here
                for you 24/7.
              </p>
            </motion.div>

            {/* 2. How to use these resources */}
            <motion.div
              className={emergencyRailCard}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
            >
              <h2 className="font-serif text-lg font-light text-white">
                How to use these resources
              </h2>
              <div className="mt-4">
                {RESOURCE_GUIDANCE.map((item) => (
                  <div key={item.title} className={emergencySafetyRow}>
                    <div className={emergencyIconChip(item.tone)}>
                      <item.icon className="h-4 w-4" aria-hidden />
                    </div>
                    <motion.div className="min-w-0">
                      <p className="text-sm font-medium text-[rgba(255,255,255,0.92)]">
                        {item.title}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-[rgba(255,255,255,0.45)]">
                        {item.description}
                      </p>
                    </motion.div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* 3. Need help right now? */}
            <motion.div
              className={cn(emergencyRailCard, "relative overflow-hidden")}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.16 }}
            >
              <img
                src={EMERGENCY_RAIL_IMG}
                alt=""
                className="absolute inset-0 h-full w-full object-cover object-[center_70%] brightness-[0.38] saturate-[1.1]"
              />
              <div
                className="absolute inset-0 bg-gradient-to-t from-[#0a0b18]/95 via-[#0a0b18]/70 to-[#0a0b18]/35"
                aria-hidden
              />
              <motion.div
                className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_100%,rgba(251,146,60,0.18)_0%,transparent_60%)]"
                aria-hidden
              />

              <div className="relative">
                <h2 className="font-serif text-lg font-light text-white">
                  Need help right now?
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-[rgba(255,255,255,0.58)]">
                  You don&apos;t have to go through this alone.
                </p>
                <Link
                  to="/app/settings/resources"
                  className={cn(emergencyResourcesCta, "group")}
                >
                  <span>View all resources</span>
                  <ChevronRight
                    className="h-5 w-5 shrink-0 transition group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </Link>
              </div>
            </motion.div>
          </aside>
        </div>
      </motion.div>
    </motion.div>
  );
}
