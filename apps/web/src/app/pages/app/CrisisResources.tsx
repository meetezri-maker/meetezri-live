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
  getCrisisHotlineDisplayResources,
  getPrimaryEmergencyResource,
  getRegionInfo,
  type CrisisHotlineVariant,
} from "@/app/utils/safetyResources";
import {
  categoryVisualsForReading,
  fetchReadingLibraryArticles,
  type ReadingLibraryArticle,
} from "@/lib/readingLibraryArticles";
import {
  EMERGENCY_HERO_IMG,
  EMERGENCY_RAIL_IMG,
  crisisAloneBanner,
  crisisAloneBannerContent,
  crisisAloneBody,
  crisisAloneTitle,
  crisisArticleCategory,
  crisisArticleChevron,
  crisisArticleDesc,
  crisisArticleMeta,
  crisisArticleRow,
  crisisArticleTitle,
  crisisBannerBody,
  crisisBannerContent,
  crisisBannerTitle,
  crisisBodyText,
  crisisContactRow,
  crisisDangerBody,
  crisisDangerCard,
  crisisDangerCta,
  crisisDangerShield,
  crisisDangerTitle,
  crisisEmptyState,
  crisisExternalLink,
  crisisHeroShield,
  crisisHotlineCard,
  crisisHotlineDesc,
  crisisHotlineDial,
  crisisHotlineName,
  crisisHotlinePhone,
  crisisLabelText,
  crisisLoadingText,
  crisisMutedText,
  crisisOutlineBtn,
  crisisPageAtmosphere,
  crisisPanelCard,
  crisisRailBody,
  crisisRailHeartWrap,
  crisisRailHeartIcon,
  crisisRailItemBody,
  crisisRailItemTitle,
  crisisRailTitle,
  crisisSafetyStep,
  crisisScenicBanner,
  crisisScenicBannerImage,
  crisisScenicLightScrim,
  crisisScenicOverlayDark,
  crisisScenicOverlayWarm,
  crisisSectionTitle,
  crisisStepBadge,
  crisisSubLabelText,
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
  emergencyHeroSubtitle,
  emergencyHeroTitle,
  emergencyIconChip,
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

const HOTLINE_ICON_BY_VARIANT: Record<
  CrisisHotlineVariant,
  typeof Phone
> = {
  lifeline: Phone,
  text: MessageCircle,
  emergency: AlertTriangle,
  samhsa: HeartPulse,
};

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
  const { currentState, userRegion } = useSafety();
  const regionInfo = getRegionInfo(userRegion);
  const primaryEmergency = getPrimaryEmergencyResource(userRegion);
  const hotlineResources = getCrisisHotlineDisplayResources(userRegion);
  const emergencyNumber = primaryEmergency?.phone ?? regionInfo.emergencyNumber;
  const emergencyTelHref = primaryEmergency?.phone
    ? `tel:${primaryEmergency.phone.replace(/\D/g, "")}`
    : undefined;

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
      className={crisisPageAtmosphere}
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
                        className={crisisHeroShield}
                        strokeWidth={1.5}
                        aria-hidden
                      />
                      <h1 className={emergencyHeroTitle}>
                        Emergency <span className={emergencyHeroAccent}>Resources</span>
                      </h1>
                    </div>
                    <p className={emergencyHeroSubtitle}>
                      24/7 support when you need it most. You&apos;re not alone.
                    </p>
                  </motion.div>
                </div>
              </motion.div>
            </section>

            {/* 2. Immediate danger alert */}
            <section className={crisisDangerCard} aria-labelledby="immediate-danger-heading">
              <Shield
                className={crisisDangerShield}
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
                    className={crisisDangerTitle}
                  >
                    If you&apos;re in immediate danger:
                  </h2>
                  <p className={crisisDangerBody}>
                    Call {emergencyNumber} or go to your nearest emergency room. Your safety is the
                    top priority.
                  </p>
                  {emergencyTelHref ? (
                  <motion.a
                    href={emergencyTelHref}
                    className={cn(crisisDangerCta, "mt-4")}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() =>
                      trackResourceInteraction(
                        primaryEmergency?.id ?? "emergency",
                        primaryEmergency?.name ?? "Emergency Services",
                        "emergency",
                        "call",
                        undefined,
                        currentState
                      )
                    }
                  >
                    <Phone className="h-5 w-5" aria-hidden />
                    Call {emergencyNumber} Now
                  </motion.a>
                  ) : null}
                </div>
              </div>
            </section>

            {/* 3. 24/7 Emergency Hotlines */}
            <section aria-labelledby="hotlines-heading">
              <h2 id="hotlines-heading" className={crisisSectionTitle}>
                24/7 Emergency Hotlines
              </h2>
              <motion.div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {hotlineResources.map((contact, index) => {
                  const Icon = HOTLINE_ICON_BY_VARIANT[contact.variant];
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
                          <h3 className={crisisHotlineName}>{contact.name}</h3>
                          <p className={crisisHotlineDesc}>
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
                          <span className={crisisHotlinePhone}>
                            {contact.phone}
                          </span>
                          <span
                            className={cn(
                              emergencyActionBtn,
                              "h-10 w-10 [html[data-ezri-theme=light]_&]:border-[color:var(--border,#e7ddfb)] [html[data-ezri-theme=light]_&]:bg-[var(--surface-lavender,#f5eeff)] [html[data-theme=light]_&]:border-[color:var(--border,#e7ddfb)] [html[data-theme=light]_&]:bg-[var(--surface-lavender,#f5eeff)]"
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
                    <div className={cn(crisisLoadingText, "flex items-center justify-center gap-2 py-8")}>
                      <Loader2 className="h-4 w-4 animate-spin text-violet-300/70" aria-hidden />
                      Loading your emergency contacts…
                    </div>
                  ) : null}

                  {!isLoadingContacts && contacts.length === 0 ? (
                    <p className={crisisEmptyState}>
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
                          <p className={cn(crisisLabelText, "truncate text-sm font-semibold")}>
                            {contact.name}
                          </p>
                          <p className={crisisSubLabelText}>
                            {contact.relationship || "Emergency contact"}
                          </p>
                          {contact.phone ? (
                            <p className={cn(crisisBodyText, "mt-0.5 text-xs")}>
                              {contact.phone}
                            </p>
                          ) : (
                            <p className={cn(crisisMutedText, "mt-0.5 text-xs")}>
                              No phone number saved
                            </p>
                          )}
                          {contact.phone ? (
                            <p className={cn(crisisMutedText, "mt-0.5 flex items-center gap-1 text-[10px]")}>
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
                        <p className={crisisLabelText}>{item.title}</p>
                        <p className={cn(crisisSubLabelText, "mt-0.5 leading-relaxed")}>
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
                  <p className={cn(crisisMutedText, "mt-2 max-w-xl")}>
                    Short reads and guided reflections from Solace, organized by topic.
                  </p>
                </div>
                <Link to="/app/settings/resources" className={cn(crisisOutlineBtn, "shrink-0 self-start")}>
                  View all
                </Link>
              </div>

              {isLoadingLibrary ? (
                <div className={cn(crisisLoadingText, "flex items-center justify-center gap-2 py-14")}>
                  <Loader2 className="h-5 w-5 animate-spin text-violet-300/70" aria-hidden />
                  Loading your resources…
                </div>
              ) : libraryArticles.length === 0 ? (
                <p className={cn(crisisEmptyState, "px-4 py-10 text-center")}>
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
                            <span className={crisisArticleCategory}>
                              <FileText className="h-3 w-3" aria-hidden />
                              {article.category}
                            </span>
                            <span className={crisisArticleTitle}>
                              {article.title}
                            </span>
                            <span className={crisisArticleDesc}>
                              {article.description}
                            </span>
                            <span className={crisisArticleMeta}>
                              <Clock className="h-3.5 w-3.5" aria-hidden />
                              {article.duration}
                            </span>
                          </span>
                          <ChevronRight
                            className={crisisArticleChevron}
                            aria-hidden
                          />
                        </Link>
                        {article.contentUrl ? (
                          <button
                            type="button"
                            className={crisisExternalLink}
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
                    <p className={cn(crisisMutedText, "text-center")}>
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
              <div className={crisisAloneBannerContent}>
                <div className="flex items-start gap-4">
                  <div className={crisisRailHeartWrap}>
                    <Heart className={crisisRailHeartIcon} aria-hidden />
                  </div>
                  <div>
                    <h2 id="not-alone-heading" className={crisisAloneTitle}>
                      You Are Not Alone
                    </h2>
                    <p className={crisisAloneBody}>
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
                <Heart className={crisisRailHeartIcon} aria-hidden />
              </div>
              <h2 className={crisisRailTitle}>You&apos;re not alone</h2>
              <p className={crisisRailBody}>
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
              <h2 className={crisisRailTitle}>
                How to use these resources
              </h2>
              <div className="mt-4">
                {RESOURCE_GUIDANCE.map((item) => (
                  <div key={item.title} className={emergencySafetyRow}>
                    <div className={emergencyIconChip(item.tone)}>
                      <item.icon className="h-4 w-4" aria-hidden />
                    </div>
                    <motion.div className="min-w-0">
                      <p className={crisisRailItemTitle}>
                        {item.title}
                      </p>
                      <p className={crisisRailItemBody}>
                        {item.description}
                      </p>
                    </motion.div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* 3. Need help right now? */}
            <motion.div
              className={crisisScenicBanner}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.16 }}
            >
              <img
                src={EMERGENCY_RAIL_IMG}
                alt=""
                className={crisisScenicBannerImage}
                width={800}
                height={600}
                loading="lazy"
                decoding="async"
              />
              <div className={crisisScenicLightScrim} aria-hidden />
              <div className={crisisScenicOverlayDark} aria-hidden />
              <div className={crisisScenicOverlayWarm} aria-hidden />

              <div className={crisisBannerContent}>
                <h2 className={crisisBannerTitle}>
                  Need help right now?
                </h2>
                <p className={crisisBannerBody}>
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
