import { Link, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { PublicNav } from "../components/PublicNav";
import { PublicFooter } from "../components/PublicFooter";
import { Button } from "../components/ui/button";
import { motion } from "motion/react";
import {
  Heart,
  Video,
  Shield,
  Clock,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  Star,
  Zap,
  Check,
  Crown,
  Loader2,
} from "lucide-react";
import { SUBSCRIPTION_PLANS } from "../utils/subscriptionPlans";
import type { PlanTier } from "../utils/subscriptionPlans";
import { LandingBackground } from "../landing/LandingBackground";
import { LandingHeroScene } from "../landing/LandingHeroScene";
import { LandingGlowCard } from "../landing/LandingGlowCard";
import { LANDING_CTA_CARD_BG, LANDING_STEP_BACKGROUNDS } from "../landing/landingImagery";
import { cn } from "@/lib/utils";

const WHY_FEATURES = [
  {
    icon: Video,
    title: "FaceTime Talk it out",
    description:
      "Connect through natural video conversations whenever you need support",
    glow: "purple" as const,
    iconClass: "from-violet-500/90 to-fuchsia-600/90 shadow-[0_0_20px_rgba(168,85,247,0.5)]",
  },
  {
    icon: Heart,
    title: "Mood Tracking",
    description: "Track your emotional journey with insights and trends over time",
    glow: "green" as const,
    iconClass: "from-emerald-400/90 to-green-600/90 shadow-[0_0_20px_rgba(52,211,153,0.45)]",
  },
  {
    icon: Shield,
    title: "Private & Secure",
    description: "Your conversations are encrypted and your data is always protected",
    glow: "blue" as const,
    iconClass: "from-blue-400/90 to-indigo-600/90 shadow-[0_0_20px_rgba(96,165,250,0.45)]",
  },
  {
    icon: Clock,
    title: "24/7 Available",
    description: "Get support whenever you need it, day or night",
    glow: "amber" as const,
    iconClass: "from-amber-400/90 to-orange-500/90 shadow-[0_0_20px_rgba(251,191,36,0.45)]",
  },
] as const;

const STEPS = [
  {
    step: 1,
    title: "Sign Up & Onboard",
    description:
      "Create your account and complete a quick wellness baseline to help Solace understand you better",
    icon: CheckCircle2,
    glow: "green" as const,
    iconGlow: "text-emerald-300 drop-shadow-[0_0_28px_rgba(52,211,153,0.65)]",
  },
  {
    step: 2,
    title: "Connect With Solace",
    description:
      "Start a FaceTime-style session whenever you need to talk, decompress, or get guided support",
    icon: Video,
    glow: "pink" as const,
    iconGlow: "text-pink-300 drop-shadow-[0_0_28px_rgba(236,72,153,0.65)]",
  },
  {
    step: 3,
    title: "Track & Improve",
    description:
      "Monitor your mood, journal your thoughts, and access wellness tools designed for your needs",
    icon: Heart,
    glow: "pink" as const,
    iconGlow: "text-pink-300 drop-shadow-[0_0_28px_rgba(236,72,153,0.65)]",
  },
] as const;

export function Landing() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  useEffect(() => {
    if (location.hash === "#pricing") {
      setTimeout(() => {
        const el = document.getElementById("pricing");
        if (el) el.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }

    const hash = location.hash;
    const search = location.search;

    if (
      hash &&
      hash.includes("type=invite") &&
      (hash.includes("access_token") || hash.includes("error="))
    ) {
      navigate(`/invite/create-password${search}${hash}`);
      return;
    }

    if (
      (hash &&
        (hash.includes("access_token") ||
          hash.includes("type=recovery") ||
          hash.includes("error="))) ||
      (search && (search.includes("code=") || search.includes("error=")))
    ) {
      navigate(`/auth/callback${search}${hash}`);
    }
  }, [user, isLoading, navigate, location]);

  const isAuthRedirect =
    (location.hash &&
      (location.hash.includes("access_token") ||
        location.hash.includes("type=recovery") ||
        location.hash.includes("type=invite"))) ||
    (location.search && location.search.includes("code="));

  if (isAuthRedirect) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg,#fbf8ff)]">
        <Loader2 className="h-10 w-10 animate-spin text-violet-400" />
      </div>
    );
  }

  return (
    <div className="solace-landing relative min-h-screen overflow-x-hidden">
      <LandingBackground />

      <div className="relative z-10">
        <PublicNav variant="cinematic" />

        {/* Hero — centered, lake/lantern scene contained here only */}
        <LandingHeroScene>
          <div className="landing-section flex flex-col items-center justify-center px-4 py-16 text-center sm:py-20">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="mb-5 inline-flex items-center gap-2 rounded-full border border-pink-500/30 bg-[#1a0f24]/80 px-4 py-1.5 text-sm font-medium text-pink-100/95 shadow-[0_0_20px_-4px_rgba(236,72,153,0.4)] backdrop-blur-sm"
            >
              <Sparkles className="h-3.5 w-3.5 text-pink-300" />
              Your AI-Powered Wellness Companion
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.5 }}
              className="landing-serif mb-5 max-w-3xl text-4xl font-semibold leading-[1.12] tracking-tight text-white sm:text-5xl md:text-6xl"
            >
              Talk to Solace.
              <br />
              <span className="bg-gradient-to-r from-pink-200 via-fuchsia-200 to-violet-100 bg-clip-text text-transparent">
                Feel Better.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="mb-8 max-w-xl text-base leading-relaxed text-white/75 sm:text-lg"
            >
              Connect with your Solace avatar through FaceTime-style sessions. Available 24/7 for
              support, mood tracking, and guided wellness tools.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex w-full max-w-md flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center"
            >
              <div onClick={() => localStorage.setItem("selectedPlan", "trial")} className="w-full sm:w-auto">
                <Link to="/signup" className="block w-full">
                  <motion.span
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="landing-cta-glow inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#E91E63] to-[#9C27B0] px-8 py-3.5 text-base font-semibold text-white sm:w-auto"
                  >
                    Start Your Trial
                    <ArrowRight className="h-4 w-4" />
                  </motion.span>
                </Link>
              </div>
              <Link to="/how-it-works" className="w-full sm:w-auto">
                <motion.span
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="inline-flex w-full items-center justify-center rounded-xl border border-white/20 bg-black/25 px-8 py-3.5 text-base font-semibold text-white/90 backdrop-blur-sm transition-[box-shadow,border-color] hover:border-white/30 hover:shadow-[0_0_28px_-8px_rgba(168,85,247,0.4)] sm:w-auto"
                >
                  Learn More
                </motion.span>
              </Link>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.45 }}
              className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-white/60"
            >
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="landing-check-glow h-4 w-4 text-emerald-400" />
                No credit card required
              </span>
              <span className="hidden text-white/25 sm:inline" aria-hidden>
                •
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="landing-check-glow h-4 w-4 text-emerald-400" />
                7-day trial
              </span>
              <span className="hidden text-white/25 sm:inline" aria-hidden>
                •
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="landing-check-glow h-4 w-4 text-emerald-400" />
                Cancel anytime
              </span>
            </motion.p>
          </div>
        </LandingHeroScene>

        {/* Why Choose Solace */}
        <section className="landing-section py-12 md:py-16">
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-8 text-center text-3xl font-bold text-white md:text-4xl"
          >
            Why Choose Solace?
          </motion.h2>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {WHY_FEATURES.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.06 }}
                className="flex"
              >
                <LandingGlowCard glow={feature.glow} className="flex h-full w-full flex-col p-5">
                  <div
                    className={cn(
                      "mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br",
                      feature.iconClass,
                    )}
                  >
                    <feature.icon className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="mb-2 text-base font-semibold text-white">{feature.title}</h3>
                  <p className="text-sm leading-relaxed text-[var(--solace-ds-text-muted)]">
                    {feature.description}
                  </p>
                </LandingGlowCard>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Simple. Effective. Personal. */}
        <section className="landing-section py-12 md:py-16">
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-10 text-center text-3xl font-bold text-white md:text-4xl"
          >
            Simple. Effective. Personal.
          </motion.h2>

          <div className="space-y-12 md:space-y-14">
            {STEPS.map((item, index) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.08 }}
                className={cn(
                  "flex flex-col items-center gap-8 md:gap-10",
                  index % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse",
                )}
              >
                <div className="flex-1 text-center md:text-left">
                  <span className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-fuchsia-600 text-sm font-bold text-white shadow-[0_0_20px_rgba(236,72,153,0.45)]">
                    {item.step}
                  </span>
                  <h3 className="mb-2 text-xl font-semibold text-white md:text-2xl">{item.title}</h3>
                  <p className="mx-auto max-w-md text-sm leading-relaxed text-[var(--solace-ds-text-muted)] md:mx-0 md:text-base">
                    {item.description}
                  </p>
                </div>
                <LandingGlowCard
                  glow={item.glow}
                  className="landing-step-visual landing-step-visual-image relative flex items-center justify-center overflow-hidden"
                  style={
                    {
                      "--landing-step-bg": `url("${LANDING_STEP_BACKGROUNDS[index]}")`,
                    } as React.CSSProperties
                  }
                >
                  <item.icon className={cn("relative z-[2] h-14 w-14", item.iconGlow)} />
                </LandingGlowCard>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Trust */}
        <section className="landing-section py-10 md:py-12">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <div className="mb-3 flex justify-center gap-1">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className="landing-star-glow h-7 w-7 fill-amber-400 text-amber-400"
                />
              ))}
            </div>
            <p className="text-xl font-semibold text-white md:text-2xl">Trusted by 10,000+ Users</p>
            <p className="mt-1.5 text-sm text-[var(--solace-ds-text-muted)] md:text-base">
              Join our growing community on their wellness journey
            </p>
          </motion.div>
        </section>

        {/* CTA */}
        <section className="landing-section py-10 md:py-12">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <LandingGlowCard
              glow="pink"
              className="landing-cta-card-image relative mx-auto max-w-[720px] text-center"
              style={
                {
                  "--landing-cta-card-bg": `url("${LANDING_CTA_CARD_BG}")`,
                } as React.CSSProperties
              }
            >
              <div className="relative z-[2] px-6 py-10 sm:px-10 sm:py-12">
                <Zap className="mx-auto mb-3 h-6 w-6 text-pink-300" />
                <h2 className="text-2xl font-bold text-white md:text-3xl">
                  Ready to Start Your Wellness Journey?
                </h2>
                <p className="mx-auto mt-3 max-w-lg text-sm text-[var(--solace-ds-text-muted)] md:text-base">
                  Join thousands who trust Solace for their mental health and wellbeing
                </p>
                <div className="mt-6" onClick={() => localStorage.setItem("selectedPlan", "trial")}>
                  <Link to="/signup">
                    <motion.span
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="landing-cta-glow inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[#E91E63] to-[#9C27B0] px-10 py-3.5 text-base font-semibold text-white"
                    >
                      Start Trial
                    </motion.span>
                  </Link>
                </div>
                <p className="mt-3 text-sm text-[var(--solace-ds-text-muted)]">
                  7-day trial • No credit card required
                </p>
              </div>
            </LandingGlowCard>
          </motion.div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="landing-section py-12 md:py-16">
          <div className="mb-8 text-center">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-400/25 bg-violet-500/10 px-4 py-1.5 text-sm font-semibold text-violet-100/90">
                <Crown className="h-4 w-4 text-violet-300" />
                Simple, Transparent Pricing
              </span>
              <h2 className="mb-3 text-3xl font-bold text-white md:text-4xl">
                Choose Your{" "}
                <span className="bg-gradient-to-r from-pink-300 to-fuchsia-400 bg-clip-text text-transparent">
                  Wellness Journey
                </span>
              </h2>
              <p className="mx-auto max-w-2xl text-base text-[var(--solace-ds-text-muted)]">
                Start with a 7-day trial. Upgrade anytime for more AI companion time and better
                pay-as-you-go rates.
              </p>
            </motion.div>
          </div>

          <div className="grid items-stretch gap-6 md:grid-cols-3 lg:gap-8">
            {(Object.keys(SUBSCRIPTION_PLANS) as PlanTier[]).map((planId, index) => {
              const plan = SUBSCRIPTION_PLANS[planId];
              const isPopular = plan.popular;

              return (
                <motion.div
                  key={planId}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.08 }}
                  className="relative flex"
                >
                  {isPopular ? (
                    <div className="absolute -top-3.5 left-0 right-0 z-10 flex justify-center">
                      <span className="rounded-full border border-pink-400/40 bg-gradient-to-r from-violet-600 to-pink-500 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-[0_0_20px_rgba(236,72,153,0.4)]">
                        Most Popular
                      </span>
                    </div>
                  ) : null}

                  <LandingGlowCard
                    glow={isPopular ? "popular" : "purple"}
                    className="flex w-full flex-col p-6 sm:p-7"
                  >
                    <div className="relative z-[1] flex flex-1 flex-col">
                      <div className="mb-5">
                        <div
                          className={cn(
                            "mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br",
                            plan.gradient,
                          )}
                        >
                          {planId === "trial" && <Sparkles className="h-5 w-5 text-white" />}
                          {planId === "core" && <Zap className="h-5 w-5 text-white" />}
                          {planId === "pro" && <Crown className="h-5 w-5 text-white" />}
                        </div>
                        <h3 className="mb-1 text-lg font-bold text-white">{plan.displayName}</h3>
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-bold text-white">${plan.price}</span>
                          {plan.price > 0 ? (
                            <span className="text-sm text-[var(--solace-ds-text-muted)]">/month</span>
                          ) : null}
                        </div>
                        {planId === "trial" ? (
                          <p className="mt-0.5 text-sm text-[var(--solace-ds-text-muted)]">
                            {plan.trialDays}-day trial
                          </p>
                        ) : null}
                      </div>

                      <div className="mb-5 rounded-xl border border-white/[0.08] bg-white/[0.04] p-3.5">
                        <div className="mb-0.5 flex items-center justify-between">
                          <span className="text-xs font-medium text-violet-100/85">
                            AI Companion Time
                          </span>
                          <Video className="h-3.5 w-3.5 text-violet-300" />
                        </div>
                        <p className="text-xl font-bold text-white">{plan.credits} minutes</p>
                        <p className="mt-0.5 text-[11px] text-violet-200/60">
                          {planId === "trial" ? "One-time trial credits" : "Refreshes monthly"}
                        </p>
                      </div>

                      {plan.payAsYouGoRate !== null ? (
                        <div className="mb-5 rounded-lg border border-emerald-400/15 bg-emerald-500/[0.06] p-2.5">
                          <div className="mb-0.5 flex items-center gap-1.5">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                            <span className="text-xs font-semibold text-emerald-100/90">
                              Pay-As-You-Go Available
                            </span>
                          </div>
                          <p className="text-base font-bold text-emerald-200">
                            ${plan.payAsYouGoRate}/min
                          </p>
                          {planId === "pro" ? (
                            <p className="mt-0.5 text-[10px] text-emerald-300/65">
                              40% savings vs Core
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <div className="mb-5 rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-[var(--solace-ds-text-muted)]" />
                            <span className="text-xs text-[var(--solace-ds-text-muted)]">
                              No pay-as-you-go option
                            </span>
                          </div>
                        </div>
                      )}

                      <ul className="mb-6 flex-grow space-y-2.5">
                        {plan.features.map((feature, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <Check
                              className={cn(
                                "landing-check-glow mt-0.5 h-4 w-4 shrink-0",
                                isPopular ? "text-pink-400" : "text-emerald-400",
                              )}
                            />
                            <span className="text-xs leading-relaxed text-[var(--solace-ds-text-muted)] sm:text-sm">
                              {feature}
                            </span>
                          </li>
                        ))}
                      </ul>

                      <div className="mt-auto">
                        {planId === "trial" ? (
                          <div
                            onClick={() => {
                              setLoadingPlan(planId);
                              localStorage.setItem("selectedPlan", planId);
                              setTimeout(() => navigate("/signup"), 500);
                            }}
                          >
                            <Button
                              className={cn(
                                "w-full rounded-xl border-0 py-5 text-sm font-semibold",
                                isPopular
                                  ? "landing-cta-glow bg-gradient-to-r from-violet-600 to-pink-500 text-white"
                                  : "bg-white/10 text-white hover:bg-white/15",
                              )}
                              size="lg"
                              isLoading={loadingPlan === planId}
                            >
                              Start Your Trial
                              <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            onClick={async () => {
                              try {
                                setLoadingPlan(planId);
                                localStorage.setItem("selectedPlan", planId);
                                const origin = window.location.origin;
                                const successUrl = `${origin}/signup?postCheckout=1&plan=${planId}&session_id={CHECKOUT_SESSION_ID}`;
                                const cancelUrl = `${origin}/#pricing`;
                                const { api } = await import("@/lib/api");
                                const result = await api.billing.createGuestSubscription({
                                  plan_type: planId,
                                  billing_cycle: "monthly",
                                  successUrl,
                                  cancelUrl,
                                });
                                if (result.checkoutUrl) {
                                  window.location.href = result.checkoutUrl;
                                }
                              } catch (e) {
                                console.error("Failed to start checkout:", e);
                                setLoadingPlan(null);
                              }
                            }}
                            className={cn(
                              "w-full rounded-xl border-0 py-5 text-sm font-semibold",
                              isPopular
                                ? "landing-cta-glow bg-gradient-to-r from-violet-600 to-pink-500 text-white"
                                : "bg-white/10 text-white hover:bg-white/15",
                            )}
                            size="lg"
                            isLoading={loadingPlan === planId}
                          >
                            Get Started
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      {planId === "trial" ? (
                        <p className="mt-2 text-center text-[11px] text-[var(--solace-ds-text-muted)]">
                          No credit card required
                        </p>
                      ) : null}
                    </div>
                  </LandingGlowCard>
                </motion.div>
              );
            })}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-8"
          >
            <LandingGlowCard glow="blue" className="mx-auto max-w-3xl p-5 sm:p-6">
              <div className="flex items-start gap-4">
                <Shield className="mt-0.5 h-7 w-7 shrink-0 text-blue-300 drop-shadow-[0_0_14px_rgba(96,165,250,0.45)]" />
                <div>
                  <h4 className="mb-1.5 font-semibold text-white">
                    Flexible Plans, No Long-Term Commitments
                  </h4>
                  <p className="text-sm leading-relaxed text-[var(--solace-ds-text-muted)]">
                    Start with a trial, upgrade or downgrade anytime. Cancel whenever you want.
                    Higher-tier plans get better pay-as-you-go rates when you need extra minutes.
                    All plans include access to our AI companions, mood tracking, and wellness
                    tools.
                  </p>
                </div>
              </div>
            </LandingGlowCard>
          </motion.div>
        </section>

        <PublicFooter />
      </div>
    </div>
  );
}
