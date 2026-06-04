import { useState, useEffect, useMemo, useId, useRef, type MouseEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  CreditCard,
  Zap,
  ArrowRight,
  Check,
  Package,
  Shield,
  Download,
  ExternalLink,
  AlertTriangle,
  Sparkles,
  MessageCircle,
  History,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../../components/ui/dialog";
import { SUBSCRIPTION_PLANS } from "../../utils/subscriptionPlans";
import type { PlanTier, UserSubscription, UsageRecord } from "../../utils/subscriptionPlans";
import { cn } from "@/lib/utils";
import { SolaceSelect } from "@/app/solace";
import { SolacePrivacyFooter } from "@/app/solace/SolacePrivacyFooter";
import {
  billingCard,
  billingChevronMuted,
  billingCurrentBadge,
  billingFeatureCheck,
  billingGhostBtn,
  billingHeroBtnPrimary,
  billingHeroBtnSecondary,
  billingHeroStatChip,
  billingHeroContent,
  billingHeroEyebrow,
  billingHeroImage,
  billingHeroLead,
  billingHeroOverlay,
  billingHeroOverlayBottom,
  billingHeroSection,
  billingHeroTitle,
  billingIconChip,
  billingPageAtmosphere,
  billingPageFogMid,
  billingPageGlowTop,
  billingPageSubtitle,
  billingPageTitle,
  billingPaginationBar,
  billingPaginationBtn,
  billingPlanCard,
  billingPlanCardCurrent,
  billingPlanIconChipClass,
  billingRailCard,
  billingSectionHeading,
  billingSelectTrigger,
  billingStatusBadgeClass,
} from "@/app/pages/app/billing/billingUi";

const PAYG_CAPSULES = [25, 50, 100, 200] as const;

const INVOICE_PAGE_SIZE_OPTIONS = [8, 10, 20, 50] as const;

/** Cinematic environment only — not UI mockups or reference screenshots */
const HERO_SCENERY_SRC = "/community/hero-lake.jpg";
const HELP_SCENERY_SRC = "/community/scene-water.jpg";

interface GlowRingProps {
  progress: number;
  size: number;
  strokeWidth: number;
  centerPrimary: string;
  centerSecondary?: string;
  eyebrow?: string;
  gradientFrom: string;
  gradientTo: string;
  ariaLabel: string;
}

function GlowRing({
  progress,
  size,
  strokeWidth,
  centerPrimary,
  centerSecondary,
  eyebrow = "Minutes",
  gradientFrom,
  gradientTo,
  ariaLabel,
}: GlowRingProps) {
  const uid = useId().replace(/:/g, "");
  const gradId = `gr-${uid}`;
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(100, Math.max(0, progress));
  const offset = c - (clamped / 100) * c;

  return (
    <div
      className="relative mx-auto flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={ariaLabel}
    >
      <div
        className="pointer-events-none absolute inset-[-16%] rounded-full bg-gradient-to-br from-fuchsia-500/22 via-violet-600/14 to-cyan-500/14 blur-2xl"
        aria-hidden
      />
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={gradientFrom} />
            <stop offset="100%" stopColor={gradientTo} />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          style={{ filter: "drop-shadow(0 0 12px rgba(192,132,252,0.42))" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center px-3 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-zinc-500">{eyebrow}</p>
        <p className="mt-1 font-serif text-xl font-light tracking-tight text-zinc-50 sm:text-2xl">{centerPrimary}</p>
        {centerSecondary ? (
          <p className="mt-1 max-w-[12rem] text-[11px] leading-relaxed text-zinc-500">{centerSecondary}</p>
        ) : null}
      </div>
    </div>
  );
}

function formatBillingCycle(raw: unknown): string {
  const s = String(raw ?? "monthly").toLowerCase();
  if (s === "yearly" || s === "annual") return "Yearly";
  return "Monthly";
}

/** Canonical minutes view from GET /users/credits (seconds-first, matches dashboard). */
function buildCreditsMinutesView(creditsData: Record<string, unknown>) {
  const ceilMinFromSec = (sec: number) => (sec <= 0 ? 0 : Math.ceil(sec / 60));

  const subscriptionRemainingMinutes =
    typeof creditsData.subscription === "number"
      ? Math.max(0, creditsData.subscription)
      : typeof creditsData.subscription_seconds === "number"
        ? ceilMinFromSec(Math.max(0, creditsData.subscription_seconds))
        : 0;

  const purchasedRemainingMinutes =
    typeof creditsData.purchased === "number"
      ? Math.max(0, creditsData.purchased)
      : typeof creditsData.purchased_seconds === "number"
        ? ceilMinFromSec(Math.max(0, creditsData.purchased_seconds))
        : 0;

  const remainingSeconds =
    typeof creditsData.credits_seconds === "number"
      ? Math.max(0, creditsData.credits_seconds)
      : typeof creditsData.credits === "number"
        ? Math.max(0, creditsData.credits * 60)
        : (subscriptionRemainingMinutes + purchasedRemainingMinutes) * 60;

  const remainingMinutes = ceilMinFromSec(remainingSeconds);

  const subscriptionTotalSeconds =
    typeof creditsData.subscription_total_seconds === "number"
      ? Math.max(0, creditsData.subscription_total_seconds)
      : typeof creditsData.subscription_total === "number"
        ? Math.max(0, creditsData.subscription_total * 60)
        : null;

  const purchasedSeconds =
    typeof creditsData.purchased_seconds === "number"
      ? Math.max(0, creditsData.purchased_seconds)
      : purchasedRemainingMinutes * 60;

  const accountTotalSeconds =
    subscriptionTotalSeconds !== null
      ? subscriptionTotalSeconds + purchasedSeconds
      : remainingSeconds;

  const usedSeconds = Math.max(0, accountTotalSeconds - remainingSeconds);
  const accountTotalMinutes = ceilMinFromSec(accountTotalSeconds);
  const accountUsedMinutes = ceilMinFromSec(usedSeconds);
  const accountProgressPercent =
    accountTotalSeconds > 0
      ? Math.min(100, Math.max(0, (usedSeconds / accountTotalSeconds) * 100))
      : 0;

  const subscriptionPeriodTotalMinutes =
    subscriptionTotalSeconds !== null ? ceilMinFromSec(subscriptionTotalSeconds) : 0;

  return {
    remainingMinutes,
    subscriptionRemainingMinutes,
    purchasedRemainingMinutes,
    accountTotalMinutes,
    accountUsedMinutes,
    accountProgressPercent,
    subscriptionPeriodTotalMinutes,
  };
}

export function Billing() {
  const { session } = useAuth();
  const [searchParams] = useSearchParams();
  const checkoutSuccess = searchParams.get("success") === "true";
  const historyTableRef = useRef<HTMLElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [invoices, setInvoices] = useState<any[]>([]);
  /** Raw GET /billing payload — billing_cycle, payment_method, etc. (no fabricated card digits) */
  const [subscriptionSource, setSubscriptionSource] = useState<Record<string, unknown> | null>(null);
  const [userSubscription, setUserSubscription] = useState<UserSubscription>({
    userId: "",
    planId: "trial",
    status: "active",
    creditsRemaining: 0,
    creditsTotal: 0,
    billingCycle: {
      startDate: new Date().toISOString(),
      endDate: new Date().toISOString(),
      renewsOn: null,
    },
    payAsYouGoCredits: 0,
    totalSpent: 0,
    usageHistory: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!session?.user) {
        setIsLoading(false);
        return;
      }

      try {
        if (checkoutSuccess) {
          try {
            await Promise.all([api.billing.syncSubscription(), api.billing.syncCredits()]);
          } catch (syncError) {
            console.error("Failed to sync billing data after checkout success:", syncError);
          }
        }

        const [subDataRaw, sessionsDataRaw, historyDataRaw, invoiceDataRaw, creditsDataRaw] = await Promise.all([
          api.billing.getSubscription(),
          api.sessions.list({ status: "completed", limit: 50 }),
          api.billing.getHistory(),
          api.billing.getInvoices(),
          api.getCredits({ bypassCache: true }),
        ]);

        const subData = subDataRaw && typeof subDataRaw === "object" ? (subDataRaw as Record<string, any>) : {};
        setSubscriptionSource(subData);
        const sessionsData = Array.isArray(sessionsDataRaw) ? sessionsDataRaw : [];
        const _billingHistoryParallel = Array.isArray(historyDataRaw) ? historyDataRaw : [];
        void _billingHistoryParallel;
        const invoiceData = Array.isArray(invoiceDataRaw) ? invoiceDataRaw : [];
        const creditsData =
          creditsDataRaw && typeof creditsDataRaw === "object"
            ? (creditsDataRaw as Record<string, unknown>)
            : {};

        const rawPlanId = subData.plan_type;
        const planId = (SUBSCRIPTION_PLANS[rawPlanId as PlanTier] ? rawPlanId : "trial") as PlanTier;
        const plan = SUBSCRIPTION_PLANS[planId];
        const now = new Date();

        const creditsView = buildCreditsMinutesView(creditsData);
        const creditsRemaining = creditsView.subscriptionRemainingMinutes;
        const payAsYouGoCredits = creditsView.purchasedRemainingMinutes;

        const usageHistory: UsageRecord[] = sessionsData
          .filter((s: any) => s.status === "completed")
          .sort(
            (a: any, b: any) =>
              new Date(b.started_at || b.created_at).getTime() - new Date(a.started_at || a.created_at).getTime()
          )
          .map((s: any) => ({
            id: s.id,
            date: s.started_at || s.scheduled_at || s.created_at,
            minutesUsed: s.duration_minutes || 0,
            sessionType: "ai-avatar",
            avatarName: s.config?.avatar || "Ezri",
            cost: 0,
          }));

        const subscriptionStartDate = subData.start_date || new Date().toISOString();
        const parsedStartDate = new Date(subscriptionStartDate);
        const trialFallbackEndDate = new Date(
          (Number.isNaN(parsedStartDate.getTime()) ? now : parsedStartDate).getTime() + 30 * 24 * 60 * 60 * 1000
        ).toISOString();
        const fallbackEndDate =
          planId === "trial" ? trialFallbackEndDate : new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

        const subscription: UserSubscription = {
          userId: subData.user_id,
          planId: planId,
          status: subData.status as any,
          creditsRemaining,
          creditsTotal: creditsView.subscriptionPeriodTotalMinutes || plan.credits,
          billingCycle: {
            startDate: subscriptionStartDate,
            endDate: subData.next_billing_at || fallbackEndDate,
            renewsOn: subData.next_billing_at,
          },
          payAsYouGoCredits,
          totalSpent: 0,
          usageHistory,
          createdAt: subData.created_at || new Date().toISOString(),
          updatedAt: subData.updated_at || new Date().toISOString(),
          accountTotalMinutes: creditsView.accountTotalMinutes,
          accountUsedMinutes: creditsView.accountUsedMinutes,
          accountRemainingMinutes: creditsView.remainingMinutes,
        };

        setUserSubscription(subscription);
        setInvoices(invoiceData);
      } catch (error) {
        console.error("Failed to fetch billing data:", error);
        setSubscriptionSource(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [session?.user?.id, checkoutSuccess]);

  useEffect(() => {
    if (!session?.user?.id) return;

    const refreshCredits = async () => {
      try {
        const creditsDataRaw = await api.getCredits({ bypassCache: true });
        if (!creditsDataRaw || typeof creditsDataRaw !== "object") return;
        const creditsView = buildCreditsMinutesView(creditsDataRaw as Record<string, unknown>);
        setUserSubscription((prev) => ({
          ...prev,
          creditsRemaining: creditsView.subscriptionRemainingMinutes,
          payAsYouGoCredits: creditsView.purchasedRemainingMinutes,
          accountTotalMinutes: creditsView.accountTotalMinutes,
          accountUsedMinutes: creditsView.accountUsedMinutes,
          accountRemainingMinutes: creditsView.remainingMinutes,
          creditsTotal: creditsView.subscriptionPeriodTotalMinutes || prev.creditsTotal,
        }));
      } catch {
        /* keep last snapshot */
      }
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshCredits();
    };

    const intervalId = window.setInterval(() => void refreshCredits(), 60_000);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [session?.user?.id]);

  const isCancelled = ["canceled", "cancelled"].includes(String(userSubscription.status || "").toLowerCase());
  const currentPlan = SUBSCRIPTION_PLANS[userSubscription.planId] ?? SUBSCRIPTION_PLANS.trial;
  const canCancelSubscription = ["active", "trialing", "past_due"].includes(
    String(userSubscription.status || "").toLowerCase()
  );

  const billingEndDate = userSubscription.billingCycle.endDate ? new Date(userSubscription.billingCycle.endDate) : null;
  const billingEndIsValid = !!billingEndDate && !Number.isNaN(billingEndDate.getTime());
  const daysUntilRenewal = billingEndIsValid
    ? Math.ceil((billingEndDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const normalizedDaysUntilRenewal = daysUntilRenewal == null ? null : Math.max(0, daysUntilRenewal);

  const heroRenewalLead = useMemo(() => {
    if (isCancelled) {
      return normalizedDaysUntilRenewal === 0
        ? "Your plan access ends today."
        : `Your plan access ends in ${normalizedDaysUntilRenewal ?? 0} days.`;
    }
    if (userSubscription.planId === "trial") {
      return normalizedDaysUntilRenewal === 0
        ? "Your trial period ends today."
        : `Your trial continues · ${normalizedDaysUntilRenewal ?? 0} days remaining.`;
    }
    return normalizedDaysUntilRenewal === 0
      ? "Your plan renews today."
      : `Your plan renews in ${normalizedDaysUntilRenewal ?? 0} days.`;
  }, [isCancelled, userSubscription.planId, normalizedDaysUntilRenewal]);

  const [showPAYGModal, setShowPAYGModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [paygMinutes, setPaygMinutes] = useState<number>(25);
  const [invoicePage, setInvoicePage] = useState(1);
  const [invoicePageSize, setInvoicePageSize] = useState<number>(8);
  const [processingAction, setProcessingAction] = useState<string | null>(null);
  const isActionLocked = processingAction !== null;

  const paygCost = currentPlan.payAsYouGoRate ? currentPlan.payAsYouGoRate * paygMinutes : 0;

  const accountTotal = userSubscription.accountTotalMinutes ?? 0;
  const accountUsed = userSubscription.accountUsedMinutes ?? 0;
  const accountRemaining = userSubscription.accountRemainingMinutes ?? 0;
  const accountProgress =
    accountTotal > 0
      ? Math.min(100, Math.max(0, (accountUsed / accountTotal) * 100))
      : 0;
  const accountProgressRounded = Math.round(accountProgress);

  const googleCalendarRenewalUrl = useMemo(() => {
    if (!billingEndIsValid || !billingEndDate) return null;
    const day = new Date(billingEndDate);
    day.setHours(9, 0, 0, 0);
    const end = new Date(day.getTime() + 60 * 60 * 1000);
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const text = encodeURIComponent("Solace — plan renewal");
    const details = encodeURIComponent("Your Solace membership renews.");
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&details=${details}&dates=${fmt(day)}/${fmt(end)}`;
  }, [billingEndIsValid, billingEndDate]);

  const sortedInvoices = useMemo(() => {
    return [...invoices].sort((a, b) => {
      const ta = a.created ? new Date(a.created).getTime() : 0;
      const tb = b.created ? new Date(b.created).getTime() : 0;
      return tb - ta;
    });
  }, [invoices]);

  const invoicePagination = useMemo(() => {
    const total = sortedInvoices.length;
    const totalPages = Math.max(1, Math.ceil(total / invoicePageSize));
    const safePage = Math.min(Math.max(1, invoicePage), totalPages);
    const start = (safePage - 1) * invoicePageSize;
    const visibleInvoices = sortedInvoices.slice(start, start + invoicePageSize);
    const from = total === 0 ? 0 : start + 1;
    const to = Math.min(start + invoicePageSize, total);
    return { total, totalPages, safePage, visibleInvoices, from, to };
  }, [sortedInvoices, invoicePage, invoicePageSize]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(sortedInvoices.length / invoicePageSize));
    setInvoicePage((p) => Math.min(Math.max(1, p), totalPages));
  }, [sortedInvoices.length, invoicePageSize]);

  const scrollToHistory = () => {
    historyTableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleSyncCredits = async () => {
    if (isActionLocked) return;
    setProcessingAction("sync_credits");
    try {
      const result = await api.billing.syncCredits();
      const creditsDataRaw = await api.getCredits({ bypassCache: true });
      if (creditsDataRaw && typeof creditsDataRaw === "object") {
        const creditsView = buildCreditsMinutesView(creditsDataRaw as Record<string, unknown>);
        setUserSubscription((prev) => ({
          ...prev,
          creditsRemaining: creditsView.subscriptionRemainingMinutes,
          payAsYouGoCredits: creditsView.purchasedRemainingMinutes,
          accountTotalMinutes: creditsView.accountTotalMinutes,
          accountUsedMinutes: creditsView.accountUsedMinutes,
          accountRemainingMinutes: creditsView.remainingMinutes,
          creditsTotal: creditsView.subscriptionPeriodTotalMinutes || prev.creditsTotal,
        }));
      }
      if (result.added > 0) {
        toast.success(`Synced ${result.added} credits from past purchases.`);
      } else {
        toast.success("Minutes balance updated.");
      }
    } catch (error) {
      console.error("Failed to sync credits:", error);
      toast.error("Could not sync minutes. Please try again.");
    } finally {
      setProcessingAction(null);
    }
  };

  const handleBuyPAYG = async () => {
    if (paygCost <= 0 || isActionLocked) return;
    setProcessingAction("buy_credits");
    try {
      const response = await api.billing.buyCredits({ credits: paygMinutes });
      if (response.checkoutUrl) {
        window.location.href = response.checkoutUrl;
      }
    } catch (error) {
      console.error("Failed to start credit purchase:", error);
      toast.error("Could not start checkout", {
        description: "Please wait a moment and try again.",
      });
      setProcessingAction(null);
    }
  };

  const handleSubscribe = async (planId: PlanTier) => {
    if (planId === "trial" || isActionLocked) return;
    setProcessingAction(`subscribe_${planId}`);
    try {
      const response = await api.billing.createSubscription({ plan_type: planId });
      if (response.checkoutUrl) {
        window.location.href = response.checkoutUrl;
      }
    } catch (error) {
      console.error("Failed to start subscription:", error);
      toast.error("Could not start checkout", {
        description: "Please wait a moment and try again.",
      });
      setProcessingAction(null);
    }
  };

  const handleManageBilling = async () => {
    if (isActionLocked) return;
    setProcessingAction("manage_billing");
    const portalErrorToast = () => {
      toast.error("Unable to load Manage Billing", {
        description:
          "The billing page link did not open. Check your connection, try again in a moment, or contact support if you are on trial or have not completed a paid checkout yet.",
      });
    };
    try {
      const response = await api.billing.createPortalSession();
      if (response.portalUrl) {
        window.location.href = response.portalUrl;
        return;
      }
      portalErrorToast();
    } catch (error) {
      console.error("Failed to open billing portal:", error);
      portalErrorToast();
    } finally {
      setProcessingAction(null);
    }
  };

  const handleCancelSubscription = () => {
    if (isActionLocked) return;
    setShowCancelModal(true);
  };

  const confirmCancelSubscription = async () => {
    setShowCancelModal(false);
    setProcessingAction("cancel_subscription");
    try {
      await api.billing.cancelSubscription();
      toast.success("Subscription cancelled. You'll keep access until the end of the current billing period.");
      window.location.reload();
    } catch (error) {
      console.error("Failed to cancel subscription:", error);
      toast.error("Failed to cancel subscription. Please try again.");
      setProcessingAction(null);
    }
  };

  const openPaygWithMins = (mins: number) => {
    setPaygMinutes(mins);
    setShowPAYGModal(true);
  };

  const panel = cn(
    billingCard,
    "rounded-3xl border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
  );

  const paymentMethodLabel = useMemo(() => {
    const pm = subscriptionSource?.payment_method;
    if (pm != null && String(pm).trim() !== "") return String(pm).trim();
    return null;
  }, [subscriptionSource]);

  const autoRenewalLabel = isCancelled ? "Off at period end" : "On";
  const emailReceiptsLabel = "Manage in portal";

  if (isLoading) {
    return (
      <div className="relative min-h-[50vh] overflow-hidden bg-[#07080f] px-4 py-12">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_50%_at_50%_0%,rgba(109,40,217,0.18),transparent_55%)]" />
        <div className="relative mx-auto max-w-[1500px] animate-pulse space-y-8">
          <div className="h-8 max-w-xs rounded-lg bg-white/[0.05]" />
          <div className="h-56 rounded-3xl bg-white/[0.04]" />
          <div className="h-36 rounded-3xl bg-white/[0.03]" />
        </div>
      </div>
    );
  }

  const ringPrimary = `${accountUsed} / ${accountTotal} min`;
  const ringSecondary = `${accountProgressRounded}% used this cycle`;

  const minutesRailBlock = (
    <div className={cn("p-6", panel)}>
      <p className="text-center text-[10px] font-semibold uppercase tracking-[0.28em] text-zinc-500">Minutes usage</p>
      <div className="mt-5">
        <GlowRing
          progress={accountProgress}
          size={168}
          strokeWidth={11}
          eyebrow="Account"
          centerPrimary={ringPrimary}
          centerSecondary={ringSecondary}
          gradientFrom="#e9d5ff"
          gradientTo="#22d3ee"
          ariaLabel={`Minutes: ${accountUsed} of ${accountTotal} used, about ${accountProgressRounded} percent`}
        />
      </div>
      <div className="mt-6 space-y-2 border-t border-white/[0.06] pt-5 text-center text-sm text-zinc-400">
        <p>
          Total remaining{" "}
          <span className="font-medium text-zinc-100">{accountRemaining.toLocaleString()} min</span>
        </p>
        <p>
          Subscription balance{" "}
          <span className="font-medium text-zinc-100">
            {userSubscription.creditsRemaining.toLocaleString()} min
          </span>
        </p>
        <p>
          Pay-as-you-go{" "}
          <span className="font-medium text-zinc-100">
            {userSubscription.payAsYouGoCredits.toLocaleString()} min
          </span>
        </p>
        <p className="mt-2 text-[11px] text-zinc-500">
          {accountProgressRounded}% used ({accountUsed.toLocaleString()} of {accountTotal.toLocaleString()} min
          total capacity).
        </p>
        <button
          type="button"
          onClick={handleSyncCredits}
          disabled={processingAction === "sync_credits" || isActionLocked}
          className="mt-3 inline-flex items-center gap-1.5 text-xs text-violet-300/85 hover:text-violet-200 disabled:opacity-40"
        >
          <RefreshCw className={cn("size-3.5", processingAction === "sync_credits" && "animate-spin")} aria-hidden />
          Sync purchased minutes
        </button>
      </div>
    </div>
  );

  return (
    <>
      <div className={cn(billingPageAtmosphere, "relative mx-auto max-w-[1500px] [--void:var(--card-muted,#f8f3ff)]")}>
        <div className={billingPageGlowTop} aria-hidden />
        <div className={billingPageFogMid} aria-hidden />

        <div className="relative z-10">
          {searchParams.get("success") && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 flex items-start gap-3 rounded-2xl border border-emerald-400/18 bg-emerald-500/[0.06] px-4 py-3 text-sm text-emerald-100/95"
              role="status"
            >
              <Check className="mt-0.5 size-4 shrink-0 text-emerald-300" aria-hidden />
              <p>Subscription updated successfully.</p>
            </motion.div>
          )}

          <header className="mb-10 flex flex-row items-start justify-between gap-3 border-b border-[color:var(--solace-border)] pb-8 sm:items-center sm:gap-6">
            <div className="min-w-0 flex-1 space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.38em] text-[color:var(--accent-violet,#a78bfa)]">Account</p>
              <h1 className={billingPageTitle}>
                Billing &{" "}
                <span className="bg-gradient-to-r from-violet-600 via-fuchsia-600 to-teal-600 bg-clip-text text-transparent">
                  Subscription
                </span>
              </h1>
              <p className={billingPageSubtitle}>
                Manage your plan, view usage, and purchase additional minutes.
              </p>
            </div>
            <button
              type="button"
              onClick={scrollToHistory}
              className={billingGhostBtn}
            >
              <History className="size-4" aria-hidden />
              Billing history
            </button>
          </header>

          <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-10">
            {/* ——— Main column ——— */}
            <div className="min-w-0 flex-1 space-y-10">
              {/* 2 Current plan hero */}
              <section aria-labelledby="current-plan-title" className={billingHeroSection}>
                <img
                  src={HERO_SCENERY_SRC}
                  alt=""
                  className={billingHeroImage}
                  width={1600}
                  height={1000}
                  loading="eager"
                  decoding="async"
                />
                <div className={cn(billingHeroOverlay, "pointer-events-none absolute inset-0 z-[1]")} aria-hidden />
                <div className={cn(billingHeroOverlayBottom, "pointer-events-none absolute inset-0 z-[1]")} aria-hidden />

                <div
                  className={cn(
                    billingHeroContent,
                    "flex flex-col gap-8 p-6 sm:p-8 lg:flex-row lg:items-end lg:justify-between lg:p-10"
                  )}
                >
                  <div className="max-w-xl space-y-5">
                    <p className={billingHeroEyebrow}>Current plan</p>
                    <h2 id="current-plan-title" className={billingHeroTitle}>
                      {currentPlan.displayName}
                    </h2>
                    <p className={billingHeroLead}>{heroRenewalLead}</p>
                    {billingEndIsValid ? (
                      <p className="text-sm font-medium text-zinc-100 [text-shadow:0_1px_10px_rgba(0,0,0,0.45)]">
                        {billingEndDate!.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap gap-3 pt-1">
                      <Button
                        type="button"
                        onClick={handleManageBilling}
                        isLoading={processingAction === "manage_billing"}
                        disabled={isActionLocked}
                        className={billingHeroBtnPrimary}
                      >
                        Manage Plan
                      </Button>
                      {canCancelSubscription ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleCancelSubscription}
                          disabled={isActionLocked}
                          className={billingHeroBtnSecondary}
                        >
                          Cancel plan
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  <dl className="grid w-full max-w-md shrink-0 grid-cols-2 gap-2 sm:grid-cols-4 lg:max-w-lg">
                    {[
                      { k: "Plan price", v: `$${currentPlan.price}/mo` },
                      { k: "Monthly minutes", v: `${currentPlan.credits} min` },
                      { k: "Extra minute", v: currentPlan.payAsYouGoRate != null ? `$${currentPlan.payAsYouGoRate}` : "—" },
                      { k: "Included tools", v: String(currentPlan.features.length) },
                    ].map((chip) => (
                      <div
                        key={chip.k}
                        className={billingHeroStatChip}
                      >
                        <dt className="text-[9px] font-semibold uppercase tracking-[0.16em] text-zinc-500">{chip.k}</dt>
                        <dd className="mt-1.5 text-sm font-medium text-zinc-100">{chip.v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </section>

              {/* Mobile: minutes usage below hero (full rail stays on desktop) */}
              <div className="lg:hidden">{minutesRailBlock}</div>

              {/* 3 Manage your plan */}
              <section aria-labelledby="manage-plan-heading" className="space-y-5">
                <h2 id="manage-plan-heading" className={billingSectionHeading}>
                  Manage your plan
                </h2>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {(Object.keys(SUBSCRIPTION_PLANS) as PlanTier[]).map((planId) => {
                    const plan = SUBSCRIPTION_PLANS[planId];
                    const isCurrent = planId === userSubscription.planId && !isCancelled;
                    const isCurrentEnding = planId === userSubscription.planId && isCancelled;
                    const Icon = planId === "trial" ? Shield : planId === "pro" ? Sparkles : Package;

                    return (
                      <article
                        key={planId}
                        className={cn(billingPlanCard, isCurrent && billingPlanCardCurrent)}
                      >
                        {isCurrent && (
                          <span className={billingCurrentBadge}>
                            Current plan
                          </span>
                        )}
                        <div className={billingPlanIconChipClass(planId)}>
                          <Icon className="size-5" aria-hidden />
                        </div>
                        <h3 className="font-medium text-[var(--solace-text)]">{plan.displayName}</h3>
                        <p className="mt-2 text-2xl font-light text-[var(--solace-text)]">
                          ${plan.price}
                          <span className="text-sm font-normal text-[var(--solace-muted)]">/mo</span>
                        </p>
                        <p className="mt-1 text-xs text-[var(--solace-muted)]">{plan.credits} min/mo · extra ${plan.payAsYouGoRate ?? "—"}/min</p>
                        <ul className="mt-5 flex-1 space-y-2.5 text-[13px] leading-snug text-[var(--solace-muted)]">
                          {plan.features.map((f) => (
                            <li key={f} className="flex gap-2">
                              <Check className={billingFeatureCheck} aria-hidden />
                              <span>{f}</span>
                            </li>
                          ))}
                        </ul>
                        <div className="mt-7">
                          {planId === "trial" ? (
                            isCurrent ? (
                              <Button disabled className="h-11 min-h-[44px] w-full rounded-full bg-white/[0.08] text-zinc-400">
                                Current plan
                              </Button>
                            ) : (
                              <Button disabled variant="outline" className="h-11 min-h-[44px] w-full rounded-full border-white/10">
                                Trial
                              </Button>
                            )
                          ) : planId === "core" ? (
                            isCurrent ? (
                              <Button
                                type="button"
                                onClick={handleManageBilling}
                                isLoading={processingAction === "manage_billing"}
                                disabled={isActionLocked}
                                className="h-11 min-h-[44px] w-full rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white"
                              >
                                Manage Plan
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                onClick={() => handleSubscribe("core")}
                                isLoading={processingAction === "subscribe_core"}
                                disabled={isActionLocked}
                                className="h-11 min-h-[44px] w-full rounded-full bg-gradient-to-r from-violet-600 to-cyan-600 text-white"
                              >
                                Choose Core
                                <ArrowRight className="size-4" aria-hidden />
                              </Button>
                            )
                          ) : (
                            /* pro */
                            isCurrent ? (
                              <Button disabled className="h-11 min-h-[44px] w-full rounded-full bg-white/[0.08] text-zinc-400">
                                Current plan
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                onClick={() => handleSubscribe("pro")}
                                isLoading={processingAction === "subscribe_pro"}
                                disabled={isActionLocked}
                                className="h-11 min-h-[44px] w-full rounded-full bg-gradient-to-r from-fuchsia-600 to-pink-500 text-white"
                              >
                                Upgrade to Pro
                                <ArrowRight className="size-4" aria-hidden />
                              </Button>
                            )
                          )}
                        </div>
                        {isCurrentEnding ? (
                          <p className="mt-3 text-center text-[11px] text-rose-300/90">Cancellation scheduled — access through this period.</p>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
                <p className="text-center text-[11px] leading-relaxed text-zinc-600">
                  All plans include bank-level encryption, companion-aware support, and your privacy always.
                </p>
              </section>

              {/* 4 Need more minutes */}
              {currentPlan.payAsYouGoRate ? (
                <section aria-labelledby="more-minutes-heading" className={cn("p-6 sm:p-8", panel)}>
                  <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-start gap-4">
                      <div className={cn("solace-icon-chip solace-icon-chip--amber", "!size-11 !rounded-2xl")}>
                        <Zap className="size-6" aria-hidden />
                      </div>
                      <div>
                        <h2 id="more-minutes-heading" className="font-serif text-xl font-light text-zinc-50">
                          Need more minutes?
                        </h2>
                        <p className="mt-1 text-sm text-zinc-500">Purchase additional minutes at any time.</p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      onClick={() => setShowPAYGModal(true)}
                      className="h-11 min-h-[44px] shrink-0 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 px-8 text-white lg:self-center"
                    >
                      Buy minutes
                    </Button>
                  </div>
                  <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {PAYG_CAPSULES.map((m) => {
                      const price = (currentPlan.payAsYouGoRate ?? 0) * m;
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => openPaygWithMins(m)}
                          disabled={isActionLocked}
                          className="min-h-[44px] rounded-2xl border border-white/[0.08] bg-black/30 px-4 py-3 text-left transition hover:border-violet-400/30 hover:bg-white/[0.04] disabled:opacity-40"
                        >
                          <p className="text-lg font-medium text-zinc-100">{m} min</p>
                          <p className="text-sm text-violet-200/90">${price.toFixed(2)}</p>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ) : null}

              {/* 5 Billing history & invoices */}
              <section ref={historyTableRef} id="billing-history" className="scroll-mt-24 space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <h2 className={billingSectionHeading}>Billing history & invoices</h2>
                  {invoices.length > 0 ? (
                    <button
                      type="button"
                      onClick={handleManageBilling}
                      className="text-left text-sm text-violet-300/90 underline-offset-4 hover:text-violet-200 hover:underline sm:text-right"
                    >
                      View all invoices
                    </button>
                  ) : null}
                </div>

                <div className={cn("overflow-hidden", panel)}>
                  {sortedInvoices.length === 0 ? (
                    <p className="p-8 text-sm text-zinc-500">No invoices yet. When payments process, they will appear here.</p>
                  ) : (
                    <>
                      <div className="hidden overflow-x-auto md:block">
                        <table className="w-full min-w-[640px] text-left text-sm">
                          <thead>
                            <tr className="border-b border-white/[0.08] text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                              <th className="px-6 py-4 font-medium">Date</th>
                              <th className="px-4 py-4 font-medium">Description</th>
                              <th className="px-4 py-4 font-medium">Amount</th>
                              <th className="px-4 py-4 font-medium">Status</th>
                              <th className="px-6 py-4 text-right font-medium">Invoice</th>
                            </tr>
                          </thead>
                          <tbody>
                            {invoicePagination.visibleInvoices.map((invoice) => {
                              const st = String(invoice.status ?? "").toLowerCase();
                              const paid = st === "paid" || st === "complete";
                              return (
                                <tr key={invoice.id} className="border-b border-white/[0.05] last:border-0 hover:bg-white/[0.02]">
                                  <td className="whitespace-nowrap px-6 py-4 text-zinc-400">
                                    {invoice.created ? new Date(invoice.created).toLocaleDateString(undefined, { dateStyle: "medium" }) : "—"}
                                  </td>
                                  <td className="max-w-[240px] truncate px-4 py-4 text-zinc-200">
                                    {invoice.description || "Solace subscription"}
                                  </td>
                                  <td className="whitespace-nowrap px-4 py-4 tabular-nums text-zinc-200">
                                    ${Number(invoice.amount_due).toFixed(2)}
                                  </td>
                                  <td className="px-4 py-4">
                                    <span className={billingStatusBadgeClass(paid)}>
                                      {invoice.status || "—"}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 text-right">
                                    <div className="inline-flex justify-end gap-1">
                                      {invoice.hosted_invoice_url ? (
                                        <Button
                                          type="button"
                                          size="icon"
                                          variant="ghost"
                                          className="size-10 min-h-[44px] min-w-[44px] rounded-full text-violet-300/90 hover:bg-white/[0.06] hover:text-violet-200"
                                          onClick={() =>
                                            window.open(invoice.hosted_invoice_url, "_blank", "noopener,noreferrer")
                                          }
                                          aria-label="View invoice"
                                        >
                                          <ExternalLink className="size-4" />
                                        </Button>
                                      ) : null}
                                      {invoice.invoice_pdf ? (
                                        <Button
                                          type="button"
                                          size="icon"
                                          variant="ghost"
                                          className="size-10 min-h-[44px] min-w-[44px] rounded-full text-violet-300/90 hover:bg-white/[0.06] hover:text-violet-200"
                                          onClick={() => window.open(invoice.invoice_pdf, "_blank", "noopener,noreferrer")}
                                          aria-label="Download invoice PDF"
                                        >
                                          <Download className="size-4" />
                                        </Button>
                                      ) : null}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      <ul className="divide-y divide-white/[0.06] md:hidden">
                        {invoicePagination.visibleInvoices.map((invoice) => {
                          const st = String(invoice.status ?? "").toLowerCase();
                          const paid = st === "paid" || st === "complete";
                          return (
                            <li key={invoice.id} className="p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-medium text-zinc-100">{invoice.description || "Solace subscription"}</p>
                                  <p className="mt-1 text-xs text-zinc-500">
                                    {invoice.created ? new Date(invoice.created).toLocaleDateString(undefined, { dateStyle: "medium" }) : ""}
                                  </p>
                                </div>
                                <span className="shrink-0 text-sm tabular-nums text-zinc-200">${Number(invoice.amount_due).toFixed(2)}</span>
                              </div>
                              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                                <span className={billingStatusBadgeClass(paid)}>
                                  {invoice.status || "—"}
                                </span>
                                <div className="flex gap-1">
                                  {invoice.hosted_invoice_url ? (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className="h-11 min-h-[44px] rounded-full border-white/12"
                                      onClick={() =>
                                        window.open(invoice.hosted_invoice_url, "_blank", "noopener,noreferrer")
                                      }
                                    >
                                      View
                                    </Button>
                                  ) : null}
                                  {invoice.invoice_pdf ? (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className="h-11 min-h-[44px] rounded-full border-white/12"
                                      onClick={() => window.open(invoice.invoice_pdf, "_blank", "noopener,noreferrer")}
                                    >
                                      PDF
                                    </Button>
                                  ) : null}
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>

                      <div className={billingPaginationBar}>
                        <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-center gap-3">
                            <label htmlFor="billing-invoice-page-size" className="sr-only">
                              Rows per page
                            </label>
                            <SolaceSelect
                              id="billing-invoice-page-size"
                              value={String(invoicePageSize)}
                              onValueChange={(value) => {
                                setInvoicePageSize(Number(value));
                                setInvoicePage(1);
                              }}
                              ariaLabel="Rows per page"
                              variant="default"
                              triggerClassName={billingSelectTrigger}
                              options={INVOICE_PAGE_SIZE_OPTIONS.map((n) => ({
                                value: String(n),
                                label: `${n} per page`,
                              }))}
                            />
                          </div>
                          <div className="flex items-center justify-center gap-2 sm:justify-end">
                            <button
                              type="button"
                              aria-label="Previous page"
                              onClick={() => setInvoicePage((p) => Math.max(1, p - 1))}
                              disabled={invoicePagination.safePage <= 1}
                              className={billingPaginationBtn}
                            >
                              <ChevronLeft className="size-5" />
                            </button>
                            <span className="min-w-[8.5rem] text-center text-xs tabular-nums text-[var(--solace-muted)] sm:text-sm">
                              {invoicePagination.from}–{invoicePagination.to} of {invoicePagination.total}
                            </span>
                            <button
                              type="button"
                              aria-label="Next page"
                              onClick={() =>
                                setInvoicePage((p) => Math.min(invoicePagination.totalPages, p + 1))
                              }
                              disabled={invoicePagination.safePage >= invoicePagination.totalPages}
                              className={billingPaginationBtn}
                            >
                              <ChevronRight className="size-5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </section>

              {/* 6 Privacy banner */}
              <SolacePrivacyFooter />
            </div>

            {/* ——— Right rail (desktop only for minutes block duplicate fix: minutes hidden lg:block in rail) ——— */}
            <aside className="w-full shrink-0 space-y-5 lg:w-[280px] xl:w-[300px]">
              <div className="hidden lg:block">{minutesRailBlock}</div>

              {/* 2 Payment method */}
              <div className={cn("p-6", panel)}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-zinc-500">Payment method</p>
                <div className="mt-5 flex items-center gap-4">
                  <div className={billingIconChip}>
                    <CreditCard className="size-6" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-100">
                      {paymentMethodLabel ?? "Card on file"}
                    </p>
                    <p className="text-xs text-zinc-500">Full card details are managed securely in Stripe.</p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleManageBilling}
                  isLoading={processingAction === "manage_billing"}
                  disabled={isActionLocked}
                  className="mt-4 h-11 min-h-[44px] w-full rounded-full text-sm text-violet-300/90 hover:bg-white/[0.05] hover:text-violet-100"
                >
                  Update payment method
                </Button>
              </div>

              {/* 3 Upcoming renewal */}
              <div className={cn("p-6", panel)}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-zinc-500">Upcoming renewal</p>
                <p className="mt-4 font-serif text-xl font-light text-zinc-50">
                  {billingEndIsValid ? billingEndDate!.toLocaleDateString(undefined, { dateStyle: "long" }) : "—"}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-zinc-500">{heroRenewalLead}</p>
                {googleCalendarRenewalUrl ? (
                  <a
                    href={googleCalendarRenewalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 flex h-11 min-h-[44px] w-full items-center justify-center rounded-full border border-white/12 text-sm text-zinc-200 transition hover:border-cyan-400/35"
                  >
                    Add to calendar
                  </a>
                ) : null}
              </div>

              {/* 4 Billing preferences */}
              <div className={cn("p-6", panel)}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-zinc-500">Billing preferences</p>
                <ul className="mt-4 space-y-0 divide-y divide-white/[0.06]">
                  <li className="flex items-center justify-between gap-2 py-3 text-sm">
                    <span className="text-[var(--solace-muted)]">Billing cycle</span>
                    <span className="flex items-center gap-1 font-medium text-[var(--solace-text)]">
                      {formatBillingCycle(subscriptionSource?.billing_cycle)}
                      <ChevronRight className={billingChevronMuted} aria-hidden />
                    </span>
                  </li>
                  <li className="flex items-center justify-between gap-2 py-3 text-sm">
                    <span className="text-[var(--solace-muted)]">Email receipts</span>
                    <span className="flex items-center gap-1 text-[var(--solace-muted)]">
                      {emailReceiptsLabel}
                      <ChevronRight className={billingChevronMuted} aria-hidden />
                    </span>
                  </li>
                  <li className="flex items-center justify-between gap-2 py-3 text-sm">
                    <span className="text-[var(--solace-muted)]">Auto renewal</span>
                    <span className="flex items-center gap-1 font-medium text-[var(--solace-text)]">
                      {autoRenewalLabel}
                      <ChevronRight className={billingChevronMuted} aria-hidden />
                    </span>
                  </li>
                </ul>
                <Button
                  type="button"
                  onClick={handleManageBilling}
                  isLoading={processingAction === "manage_billing"}
                  disabled={isActionLocked}
                  className="mt-4 h-11 min-h-[44px] w-full rounded-full border border-white/12 bg-white/[0.04] text-sm text-zinc-100 hover:bg-white/[0.07]"
                >
                  Update preferences
                </Button>
              </div>

              {/* 5 Need help */}
              <div className={cn("relative overflow-hidden p-6", panel)}>
                <img
                  src={HELP_SCENERY_SRC}
                  alt=""
                  className="absolute inset-0 size-full object-cover"
                  width={400}
                  height={300}
                  loading="lazy"
                  decoding="async"
                />
                <div
                  className="absolute inset-0 bg-gradient-to-br from-[#07080f]/97 via-[#07080f]/90 to-[#07080f]/65"
                  aria-hidden
                />
                <MessageCircle className="relative size-5 text-violet-300/90" aria-hidden />
                <p className="relative mt-3 text-sm font-medium text-zinc-100">Need help?</p>
                <p className="relative mt-2 max-w-[14rem] text-xs leading-relaxed text-zinc-500">
                  We&apos;re here for you. Our support team is always ready to help.
                </p>
                <Link
                  to="/app/settings/help-support"
                  className="relative mt-5 flex h-11 min-h-[44px] w-full items-center justify-center rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 text-sm font-medium text-white"
                >
                  Contact support
                </Link>
              </div>
            </aside>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showPAYGModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
            onClick={() => !isActionLocked && setShowPAYGModal(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              onClick={(e: MouseEvent<HTMLDivElement>) => e.stopPropagation()}
              className={cn(billingCard, "w-full max-w-md overflow-hidden rounded-3xl p-7")}
              role="dialog"
              aria-modal="true"
              aria-labelledby="payg-title"
            >
              <h3 id="payg-title" className="text-center font-serif text-xl font-light text-zinc-50">
                Buy minutes
              </h3>
              <p className="mt-2 text-center text-xs text-zinc-500">
                ${currentPlan.payAsYouGoRate}/min · your plan rate
              </p>
              <div className="mt-6 grid grid-cols-2 gap-2" role="group" aria-label="Select minutes">
                {PAYG_CAPSULES.map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setPaygMinutes(mins)}
                    disabled={isActionLocked}
                    className={cn(
                      "min-h-[44px] rounded-xl border px-3 py-3 text-left text-sm transition",
                      paygMinutes === mins
                        ? "border-fuchsia-400/45 bg-fuchsia-500/12 text-fuchsia-50"
                        : "border-white/10 bg-white/[0.03] hover:border-violet-400/25",
                      isActionLocked && "opacity-50"
                    )}
                  >
                    <span className="font-medium">{mins} min</span>
                    <span className="mt-1 block text-xs text-zinc-500">
                      ${((currentPlan.payAsYouGoRate ?? 0) * mins).toFixed(2)}
                    </span>
                  </button>
                ))}
              </div>
              <div className="mt-6 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowPAYGModal(false)}
                  className="h-11 min-h-[44px] flex-1 rounded-full border-white/12"
                  disabled={isActionLocked}
                >
                  Close
                </Button>
                <Button
                  type="button"
                  onClick={handleBuyPAYG}
                  isLoading={processingAction === "buy_credits"}
                  disabled={isActionLocked}
                  className="h-11 min-h-[44px] flex-1 rounded-full border-0 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white"
                >
                  Continue · ${paygCost.toFixed(2)}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={showCancelModal} onOpenChange={setShowCancelModal}>
        <DialogContent className={cn(billingCard, "sm:max-w-md text-[var(--solace-text)]")}>
          <DialogHeader>
            <div className="mb-1 flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-rose-500/15 text-rose-300">
                <AlertTriangle className="size-5" aria-hidden />
              </div>
              <DialogTitle className="text-lg text-zinc-50">Cancel subscription?</DialogTitle>
            </div>
            <DialogDescription className="pt-1 text-sm leading-relaxed text-zinc-400">
              Are you sure you want to cancel your <span className="font-medium text-zinc-200">{currentPlan.name}</span>{" "}
              subscription?
              <br />
              <br />
              You will keep full access until the end of your current billing period
              {billingEndIsValid && (
                <>
                  {" "}
                  on{" "}
                  <span className="font-medium text-zinc-200">
                    {billingEndDate!.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
                  </span>
                </>
              )}
              . After that, your account will revert to the free plan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-2 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowCancelModal(false)}
              disabled={processingAction === "cancel_subscription"}
              className="rounded-full border-white/12"
            >
              Keep subscription
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmCancelSubscription}
              isLoading={processingAction === "cancel_subscription"}
              className="rounded-full bg-rose-600 hover:bg-rose-700"
            >
              Yes, cancel plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
