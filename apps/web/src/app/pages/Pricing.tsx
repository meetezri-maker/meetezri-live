import { Link, useNavigate } from "react-router-dom";
import { PublicNav } from "../components/PublicNav";
import { Button } from "../components/ui/button";
import { motion } from "motion/react";
import {
  Check,
  Zap,
  ArrowRight,
  Sparkles,
  Crown,
  Video,
  CheckCircle2,
  Clock,
  Shield,
  Twitter,
  Instagram,
  Facebook,
  Youtube,
} from "lucide-react";
import { BrandLogo } from "../components/BrandLogo";
import { SUBSCRIPTION_PLANS } from "../utils/subscriptionPlans";
import { useState } from "react";
import type { PlanTier } from "../utils/subscriptionPlans";
import { LandingBackground } from "../landing/LandingBackground";
import { LandingGlowCard } from "../landing/LandingGlowCard";
import { LANDING_HERO_BG } from "../landing/landingImagery";
import { cn } from "@/lib/utils";

export function Pricing() {
  const navigate = useNavigate();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  return (
    <div className="solace-landing relative min-h-screen overflow-x-hidden">
      <LandingBackground />

      {/* Cinematic lake-night atmosphere — soft, not image-heavy */}
      <motion.div
        className="pointer-events-none fixed inset-0 z-0"
        aria-hidden
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <img
          src={LANDING_HERO_BG}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-[center_42%] opacity-[0.12]"
          width={2400}
          height={1350}
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_45%_at_50%_0%,rgba(88,28,135,0.22)_0%,transparent_55%)]" />
        <motion.div
          className="absolute inset-0 bg-[radial-gradient(ellipse_55%_40%_at_0%_55%,rgba(251,191,36,0.14)_0%,transparent_50%)]"
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute inset-0 bg-[radial-gradient(ellipse_55%_40%_at_100%_55%,rgba(251,191,36,0.12)_0%,transparent_50%)]"
          animate={{ opacity: [0.65, 0.95, 0.65] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        />
        <motion.div
          className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_30%,rgba(236,72,153,0.08)_0%,transparent_60%)]"
          animate={{ opacity: [0.8, 1, 0.8] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
        />
        <motion.div
          className="absolute inset-0 bg-[radial-gradient(ellipse_60%_45%_at_50%_100%,rgba(34,211,238,0.06)_0%,transparent_55%)]"
          animate={{ opacity: [0.75, 1, 0.75] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
        />
        <motion.div
          className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,8,22,0.4)_0%,rgba(5,8,22,0.72)_45%,rgba(5,8,22,0.94)_100%)]"
          animate={{ opacity: [0.92, 1, 0.92] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />
      </motion.div>

      <div className="relative z-10">
        <PublicNav variant="cinematic" />

        <main className="mx-auto max-w-7xl px-4 pb-14 pt-10 sm:px-6 sm:pt-12 lg:px-8 lg:pb-16">
          {/* Hero */}
          <section className="relative mx-auto mb-10 max-w-3xl text-center sm:mb-12">
            <div
              className="pointer-events-none absolute left-1/2 top-1/2 h-48 w-[min(100%,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(168,85,247,0.2)_0%,transparent_70%)] blur-2xl"
              aria-hidden
            />
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="relative"
            >
              <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/10 px-4 py-1.5 text-sm font-semibold text-violet-100/95 shadow-[0_0_24px_-6px_rgba(168,85,247,0.45)] backdrop-blur-sm">
                <Crown className="h-4 w-4 text-violet-300" />
                Simple, Transparent Pricing
              </span>
              <h1 className="landing-serif mb-4 text-4xl font-semibold leading-[1.12] tracking-tight text-white sm:text-5xl md:text-[3.25rem]">
                Choose Your{" "}
                <span className="bg-gradient-to-r from-pink-300 via-fuchsia-300 to-violet-200 bg-clip-text text-transparent drop-shadow-[0_0_32px_rgba(236,72,153,0.35)]">
                  Wellness Journey
                </span>
              </h1>
              <p className="mx-auto max-w-2xl text-base leading-relaxed text-[var(--solace-ds-text-muted)] sm:text-lg">
                Start with a 7-day trial. Upgrade anytime for more AI companion time and better
                pay-as-you-go rates.
              </p>
            </motion.div>
          </section>

          {/* Pricing cards */}
          <div className="grid items-stretch gap-6 md:grid-cols-3 lg:gap-8">
            {(Object.keys(SUBSCRIPTION_PLANS) as PlanTier[]).map((planId, index) => {
              const plan = SUBSCRIPTION_PLANS[planId];
              const isPopular = plan.popular;

              return (
                <motion.div
                  key={planId}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.08 }}
                  className={cn("relative flex", isPopular && "md:z-[1]")}
                >
                  {isPopular ? (
                    <motion.div
                      className="pointer-events-none absolute -inset-3 rounded-[32px] bg-[radial-gradient(ellipse_at_center,rgba(236,72,153,0.22)_0%,transparent_68%)] blur-xl"
                      animate={{ opacity: [0.55, 0.85, 0.55] }}
                      transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                      aria-hidden
                    />
                  ) : null}

                  {isPopular ? (
                    <div className="absolute -top-3.5 left-0 right-0 z-10 flex justify-center">
                      <span className="rounded-full border border-pink-400/40 bg-gradient-to-r from-violet-600 to-pink-500 px-3.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-[0_0_24px_rgba(236,72,153,0.45)]">
                        MOST POPULAR
                      </span>
                    </div>
                  ) : null}

                  <LandingGlowCard
                    glow={isPopular ? "popular" : "purple"}
                    className={cn(
                      "flex w-full flex-col rounded-[28px] p-6 sm:p-7",
                      isPopular && "md:scale-[1.02]",
                    )}
                  >
                    <motion.div
                      className="relative z-[1] flex flex-1 flex-col"
                      whileHover={isPopular ? { y: -2 } : undefined}
                      transition={{ duration: 0.35 }}
                    >
                      <motion.div
                        className="mb-5"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.08 + 0.1 }}
                      >
                        <div
                          className={cn(
                            "mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br shadow-[0_0_20px_-4px_rgba(168,85,247,0.5)]",
                            plan.gradient,
                          )}
                        >
                          {planId === "trial" && <Sparkles className="h-5 w-5 text-white" />}
                          {planId === "core" && <Zap className="h-5 w-5 text-white" />}
                          {planId === "pro" && <Crown className="h-5 w-5 text-white" />}
                        </div>
                        <h3 className="mb-1 text-lg font-bold text-white">{plan.displayName}</h3>
                        <motion.div
                          className="flex items-baseline gap-1"
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.08 + 0.15 }}
                        >
                          <span className="text-3xl font-bold text-white sm:text-4xl">
                            ${plan.price}
                          </span>
                          {plan.price > 0 ? (
                            <span className="text-sm text-[var(--solace-ds-text-muted)]">
                              /month
                            </span>
                          ) : null}
                        </motion.div>
                        {planId === "trial" ? (
                          <p className="mt-0.5 text-sm text-[var(--solace-ds-text-muted)]">
                            {plan.trialDays}-day trial
                          </p>
                        ) : null}
                      </motion.div>

                      <div className="mb-5 rounded-xl border border-violet-400/20 bg-[#080c18]/70 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_28px_-14px_rgba(168,85,247,0.35)] backdrop-blur-sm">
                        <motion.div
                          className="mb-0.5 flex items-center justify-between"
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.08 + 0.2 }}
                        >
                          <span className="text-xs font-medium text-violet-100/90">
                            AI Companion Time
                          </span>
                          <Video className="h-3.5 w-3.5 text-violet-300 drop-shadow-[0_0_8px_rgba(168,85,247,0.6)]" />
                        </motion.div>
                        <p className="text-xl font-bold text-violet-100 drop-shadow-[0_0_16px_rgba(168,85,247,0.35)] sm:text-2xl">
                          {plan.credits} minutes
                        </p>
                        <p className="mt-0.5 text-[11px] text-violet-200/55">
                          {planId === "trial"
                            ? "One-time trial credits"
                            : "Refreshes monthly"}
                        </p>
                      </div>

                      {plan.payAsYouGoRate !== null ? (
                        <div className="mb-5 rounded-xl border border-emerald-400/20 bg-emerald-950/30 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_24px_-12px_rgba(52,211,153,0.3)] backdrop-blur-sm">
                          <div className="mb-0.5 flex items-center gap-1.5">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.55)]" />
                            <span className="text-xs font-semibold text-emerald-100/90">
                              Pay-As-You-Go Available
                            </span>
                          </div>
                          <p className="text-base font-bold text-emerald-200 drop-shadow-[0_0_12px_rgba(52,211,153,0.25)] sm:text-lg">
                            ${plan.payAsYouGoRate}/min
                          </p>
                          {planId === "pro" ? (
                            <p className="mt-0.5 text-[10px] text-emerald-300/70">
                              40% savings vs Core
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <div className="mb-5 rounded-xl border border-white/[0.07] bg-white/[0.03] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
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
                              setTimeout(() => {
                                navigate("/signup");
                              }, 500);
                            }}
                          >
                            <Button
                              className="w-full rounded-full border border-white/10 bg-white/[0.08] py-5 text-sm font-semibold text-white shadow-[0_0_24px_-8px_rgba(168,85,247,0.35)] transition-all hover:border-violet-400/30 hover:bg-white/[0.12] hover:shadow-[0_0_32px_-6px_rgba(168,85,247,0.45)]"
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
                                const cancelUrl = `${origin}/pricing`;

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
                              "w-full rounded-full border-0 py-5 text-sm font-semibold transition-transform hover:scale-[1.02] active:scale-[0.98]",
                              isPopular
                                ? "landing-cta-glow bg-gradient-to-r from-[#E91E63] to-[#9C27B0] text-white shadow-[0_0_28px_rgba(233,30,99,0.4)]"
                                : "border border-white/12 bg-white/[0.08] text-white hover:border-violet-400/25 hover:bg-white/[0.12] hover:shadow-[0_0_28px_-6px_rgba(168,85,247,0.4)]",
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
                    </motion.div>
                  </LandingGlowCard>
                </motion.div>
              );
            })}
          </div>

          {/* Flexible plans info */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.35 }}
            className="mt-8 sm:mt-10"
          >
            <LandingGlowCard glow="blue" className="mx-auto max-w-3xl rounded-[28px] p-5 sm:p-6">
              <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-start">
                <Shield className="mt-0.5 h-8 w-8 shrink-0 text-blue-300 drop-shadow-[0_0_18px_rgba(96,165,250,0.55)]" />
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45 }}
                >
                  <h4 className="mb-1.5 font-semibold text-white">
                    Flexible Plans, No Long-Term Commitments
                  </h4>
                  <p className="text-sm leading-relaxed text-[var(--solace-ds-text-muted)]">
                    Start with a trial, upgrade or downgrade anytime. Cancel whenever you want.
                    Higher-tier plans get better pay-as-you-go rates when you need extra minutes.
                    All plans include access to our AI companions, mood tracking, and wellness
                    tools.
                  </p>
                </motion.div>
              </div>
            </LandingGlowCard>
          </motion.div>
        </main>

        {/* Footer */}
        <footer className="border-t border-white/[0.08] bg-[#04060f]/90">
          <div className="pointer-events-none mx-auto h-px max-w-7xl bg-gradient-to-r from-transparent via-violet-500/35 to-transparent" />
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 md:py-12 lg:px-8">
            <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
              <div className="col-span-2 md:col-span-1">
                <BrandLogo heightClass="h-14" />
                <p className="mt-3 text-sm text-[var(--solace-ds-text-muted)]">
                  Your AI-powered wellness companion, available 24/7
                </p>
                <div className="mt-4 flex gap-2.5">
                  {[
                    { Icon: Twitter, label: "Twitter" },
                    { Icon: Instagram, label: "Instagram" },
                    { Icon: Facebook, label: "Facebook" },
                    { Icon: Youtube, label: "YouTube" },
                  ].map(({ Icon, label }) => (
                    <span
                      key={label}
                      className="flex h-8 w-8 cursor-default items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-white/55 transition-colors hover:border-violet-400/25 hover:text-white/90 hover:shadow-[0_0_16px_-4px_rgba(168,85,247,0.4)]"
                      aria-label={label}
                      role="img"
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                  ))}
                </div>
              </div>

              <motion.div>
                <h4 className="mb-3 text-sm font-semibold text-white">Product</h4>
                <ul className="space-y-1.5 text-sm text-[var(--solace-ds-text-muted)]">
                  <li>
                    <Link to="/how-it-works" className="hover:text-white">
                      How It Works
                    </Link>
                  </li>
                  <li>
                    <Link to="/pricing" className="hover:text-white">
                      Pricing
                    </Link>
                  </li>
                  <li>
                    <Link to="/privacy" className="hover:text-white">
                      Privacy &amp; Safety
                    </Link>
                  </li>
                </ul>
              </motion.div>

              <motion.div>
                <h4 className="mb-3 text-sm font-semibold text-white">Legal</h4>
                <ul className="space-y-1.5 text-sm text-[var(--solace-ds-text-muted)]">
                  <li>
                    <Link to="/terms" className="hover:text-white">
                      Terms &amp; Conditions
                    </Link>
                  </li>
                  <li>
                    <Link to="/privacy" className="hover:text-white">
                      Privacy Policy
                    </Link>
                  </li>
                </ul>
              </motion.div>

              <motion.div>
                <h4 className="mb-3 text-sm font-semibold text-white">Get Started</h4>
                <ul className="space-y-1.5 text-sm text-[var(--solace-ds-text-muted)]">
                  <li>
                    <Link to="/signup" className="hover:text-white">
                      Sign Up
                    </Link>
                  </li>
                  <li>
                    <Link to="/login" className="hover:text-white">
                      Log In
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/admin/credentials"
                      className="font-semibold text-violet-300 hover:text-violet-200"
                    >
                      Admin Credentials
                    </Link>
                  </li>
                  <li>
                    <Link to="/admin/login" className="text-violet-300/90 hover:text-violet-200">
                      Admin Portal
                    </Link>
                  </li>
                </ul>
              </motion.div>
            </div>

            <div className="mt-8 border-t border-white/[0.06] pt-6 text-center text-xs text-[var(--solace-ds-text-muted)] sm:text-sm">
              <p>&copy; 2024 Solace. All rights reserved.</p>
              <p className="mt-1.5">
                This is not a replacement for professional medical or mental health services.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
