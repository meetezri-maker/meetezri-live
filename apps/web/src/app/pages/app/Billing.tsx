import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { 
  CreditCard, 
  Clock, 
  TrendingUp, 
  Zap, 
  ArrowRight, 
  Check, 
  AlertCircle,
  Calendar,
  DollarSign,
  Package,
  Shield,
  Download,
  RefreshCw,
  ShoppingCart,
  Sparkles,
  ChevronRight,
  History,
  ExternalLink,
  AlertTriangle
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { AppLayout } from "../../components/AppLayout";
import { Skeleton } from "../../components/ui/skeleton";
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

export function Billing() {
  const { session, profile } = useAuth();
  const [searchParams] = useSearchParams();
  const checkoutSuccess = searchParams.get('success') === 'true';
  const [isLoading, setIsLoading] = useState(true);
  const [billingHistory, setBillingHistory] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [userSubscription, setUserSubscription] = useState<UserSubscription>({
    userId: "",
    planId: "trial",
    status: "active",
    creditsRemaining: 0,
    creditsTotal: 0,
    billingCycle: {
      startDate: new Date().toISOString(),
      endDate: new Date().toISOString(),
      renewsOn: null
    },
    payAsYouGoCredits: 0,
    totalSpent: 0,
    usageHistory: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
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
            await Promise.all([
              api.billing.syncSubscription(),
              api.billing.syncCredits()
            ]);
          } catch (syncError) {
            console.error('Failed to sync billing data after checkout success:', syncError);
          }
        }

        const [subDataRaw, sessionsDataRaw, historyDataRaw, invoiceDataRaw, creditsDataRaw] = await Promise.all([
          api.billing.getSubscription(),
          api.sessions.list({ status: "completed", limit: 50 }),
          api.billing.getHistory(),
          api.billing.getInvoices(),
          api.getCredits()
        ]);

        const subData = (subDataRaw && typeof subDataRaw === "object") ? subDataRaw as Record<string, any> : {};
        const sessionsData = Array.isArray(sessionsDataRaw) ? sessionsDataRaw : [];
        const historyData = Array.isArray(historyDataRaw) ? historyDataRaw : [];
        const invoiceData = Array.isArray(invoiceDataRaw) ? invoiceDataRaw : [];
        const creditsData = (creditsDataRaw && typeof creditsDataRaw === "object")
          ? creditsDataRaw as Record<string, any>
          : {};

        const rawPlanId = subData.plan_type;
        // Fallback to trial if plan type is not recognized (e.g. legacy plans)
        const planId = (SUBSCRIPTION_PLANS[rawPlanId as PlanTier] ? rawPlanId : 'trial') as PlanTier;
        const plan = SUBSCRIPTION_PLANS[planId];
        const now = new Date();
        
        // Canonical amounts from GET /users/credits (subscription + PAYG + lifetime used)
        const subscriptionCredits = creditsData.subscription ?? profile?.credits ?? 0;
        const purchasedCredits = creditsData.purchased ?? profile?.purchased_credits ?? 0;
        const accountRemainingMinutes =
          creditsData.remaining_minutes ??
          subscriptionCredits + purchasedCredits;
        const accountTotalMinutes =
          creditsData.total_minutes ??
          accountRemainingMinutes + (creditsData.used_minutes ?? profile?.minutes_used ?? 0);
        const accountUsedMinutes =
          creditsData.used_minutes ?? profile?.minutes_used ?? 0;

        const creditsRemaining = subscriptionCredits;
        const payAsYouGoCredits = purchasedCredits;

        const usageHistory: UsageRecord[] = sessionsData
          .filter((s: any) => s.status === 'completed')
          .sort((a: any, b: any) => new Date(b.started_at || b.created_at).getTime() - new Date(a.started_at || a.created_at).getTime())
          .map((s: any) => ({
            id: s.id,
            date: s.started_at || s.scheduled_at || s.created_at,
            minutesUsed: s.duration_minutes || 0,
            sessionType: 'ai-avatar',
            avatarName: s.config?.avatar || 'Ezri',
            cost: 0 
          }));

        const subscription: UserSubscription = {
          userId: subData.user_id,
          planId: planId,
          status: subData.status as any,
          creditsRemaining,
          // Show a stacked "total" when users upgrade mid-cycle (e.g., 200 + 400 = 600)
          creditsTotal: creditsData.subscription_total ?? plan.credits,
          billingCycle: {
            startDate: subData.start_date || new Date().toISOString(),
            endDate: subData.next_billing_at || new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString(),
            renewsOn: subData.next_billing_at
          },
          payAsYouGoCredits,
          totalSpent: 0,
          usageHistory,
          createdAt: subData.created_at || new Date().toISOString(),
          updatedAt: subData.updated_at || new Date().toISOString(),
          accountTotalMinutes,
          accountUsedMinutes,
          accountRemainingMinutes,
        };

        setUserSubscription(subscription);
        setBillingHistory(historyData);
        setInvoices(invoiceData);
      } catch (error) {
        console.error('Failed to fetch billing data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [session?.user?.id, checkoutSuccess]);

  const isCancelled = ['canceled', 'cancelled'].includes(
    String(userSubscription.status || '').toLowerCase()
  );
  const currentPlan = SUBSCRIPTION_PLANS[userSubscription.planId] ?? SUBSCRIPTION_PLANS.trial;
  const canCancelSubscription = ['active', 'trialing', 'past_due'].includes(
    String(userSubscription.status || '').toLowerCase()
  );
  const PlanIcon =
    userSubscription.planId === 'trial'
      ? Shield
      : userSubscription.planId === 'pro'
        ? Zap
        : Package;
  const usagePercentage = userSubscription.creditsTotal > 0 
    ? ((userSubscription.creditsTotal - userSubscription.creditsRemaining) / userSubscription.creditsTotal) * 100
    : 0;
  const billingEndDate = userSubscription.billingCycle.endDate
    ? new Date(userSubscription.billingCycle.endDate)
    : null;
  const billingEndIsValid = !!billingEndDate && !Number.isNaN(billingEndDate.getTime());
  const daysUntilRenewal = billingEndIsValid
    ? Math.ceil((billingEndDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const normalizedDaysUntilRenewal = daysUntilRenewal == null ? null : Math.max(0, daysUntilRenewal);
  const renewalStatusLabel = isCancelled
    ? normalizedDaysUntilRenewal === 0
      ? 'Access ends today'
      : `Access ends in ${normalizedDaysUntilRenewal ?? 0} days`
    : userSubscription.planId === 'trial'
      ? normalizedDaysUntilRenewal === 0
        ? 'Expires today'
        : `Expires in ${normalizedDaysUntilRenewal ?? 0} days`
      : normalizedDaysUntilRenewal === 0
        ? 'Renews today'
        : `Renews in ${normalizedDaysUntilRenewal ?? 0} days`;
  const recentUsageHistory = userSubscription.usageHistory.slice(0, 5);

  const [showPAYGModal, setShowPAYGModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [paygMinutes, setPaygMinutes] = useState(60);
  const [processingAction, setProcessingAction] = useState<string | null>(null);
  const isActionLocked = processingAction !== null;

  const paygCost = currentPlan.payAsYouGoRate ? (currentPlan.payAsYouGoRate * paygMinutes) : 0;

  const handleSyncCredits = async () => {
    if (isActionLocked) return;
    setProcessingAction('sync_credits');
    try {
      const result = await api.billing.syncCredits();
      if (result.added > 0) {
        alert(`Synced ${result.added} credits from past purchases.`);
        window.location.reload();
      } else {
        // Just refresh the data silently if nothing new found, but show a toast if possible (using alert for now)
        // Or just let it be silent.
      }
    } catch (error) {
      console.error('Failed to sync credits:', error);
    } finally {
      setProcessingAction(null);
    }
  };

  const handleBuyPAYG = async () => {
    if (paygCost <= 0 || isActionLocked) return;
    setProcessingAction('buy_credits');
    try {
      const response = await api.billing.buyCredits({
        credits: paygMinutes
      });
      if (response.checkoutUrl) {
        window.location.href = response.checkoutUrl;
      }
    } catch (error) {
      console.error('Failed to start credit purchase:', error);
      alert('Failed to start purchase. Please try again.');
      setProcessingAction(null);
    }
  };

  const handleSubscribe = async (planId: PlanTier) => {
    if (planId === 'trial' || isActionLocked) return; 
    setProcessingAction(`subscribe_${planId}`);
    try {
      const response = await api.billing.createSubscription({ plan_type: planId });
      if (response.checkoutUrl) {
        window.location.href = response.checkoutUrl;
      }
    } catch (error) {
      console.error('Failed to start subscription:', error);
      alert('Failed to start subscription. Please try again.');
      setProcessingAction(null);
    }
  };

  const handleManageBilling = async () => {
     if (isActionLocked) return;
     setProcessingAction('manage_billing');
     try {
       const response = await api.billing.createPortalSession();
       if (response.portalUrl) {
         window.location.href = response.portalUrl;
       }
     } catch (error) {
       console.error('Failed to open billing portal:', error);
       alert('Failed to open billing portal. Please try again.');
       setProcessingAction(null);
     }
  };

  const handleCancelSubscription = () => {
    if (isActionLocked) return;
    setShowCancelModal(true);
  };

  const confirmCancelSubscription = async () => {
    setShowCancelModal(false);
    setProcessingAction('cancel_subscription');
    try {
      await api.billing.cancelSubscription();
      toast.success("Subscription cancelled. You'll keep access until the end of the current billing period.");
      window.location.reload();
    } catch (error) {
      console.error('Failed to cancel subscription:', error);
      toast.error('Failed to cancel subscription. Please try again.');
      setProcessingAction(null);
    }
  };

  const handleExportSessions = () => {
    if (userSubscription.usageHistory.length === 0) return;

    const escapeCsv = (value: string | number) => {
      const stringValue = String(value);
      if (stringValue.includes(",") || stringValue.includes("\"") || stringValue.includes("\n")) {
        return `"${stringValue.replace(/"/g, "\"\"")}"`;
      }
      return stringValue;
    };

    const rows = userSubscription.usageHistory.map((record) => {
      const date = new Date(record.date);
      return [
        record.id,
        Number.isNaN(date.getTime()) ? "" : date.toISOString(),
        record.avatarName ?? "Ezri",
        record.sessionType ?? "ai-avatar",
        record.minutesUsed,
        record.cost ?? 0,
      ];
    });

    const csvLines = [
      ["session_id", "session_date_utc", "avatar_name", "session_type", "minutes_used", "cost_usd"],
      ...rows,
    ].map((row) => row.map(escapeCsv).join(","));

    const blob = new Blob([csvLines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const today = new Date().toISOString().slice(0, 10);
    const link = document.createElement("a");
    link.href = url;
    link.download = `billing-sessions-${today}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-80" />
          </div>
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <Card className="p-6 md:col-span-2 border-2">
              <div className="flex items-start justify-between mb-4">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-8 w-32" />
                </div>
                <Skeleton className="h-10 w-32 rounded-full" />
              </div>
              <Skeleton className="h-10 w-full" />
            </Card>
            <Card className="p-6 border-2">
              <Skeleton className="h-4 w-40 mb-4" />
              <Skeleton className="h-10 w-32 mb-2" />
              <Skeleton className="h-3 w-24 mb-4" />
              <div className="space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-5/6" />
              </div>
            </Card>
          </div>
          <div className="grid lg:grid-cols-3 gap-6">
            <Card className="p-6 lg:col-span-2">
              <Skeleton className="h-5 w-40 mb-4" />
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            </Card>
            <Card className="p-6">
              <Skeleton className="h-5 w-32 mb-4" />
              <div className="space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-5/6" />
                <Skeleton className="h-10 w-full mt-2" />
              </div>
            </Card>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Billing & Subscription</h1>
          <p className="text-muted-foreground">
            Manage your plan, view usage, and purchase additional minutes
          </p>
          {searchParams.get('success') && (
            <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg border border-green-200 dark:border-green-800 flex items-center gap-2">
              <Check className="w-5 h-5" />
              Subscription updated successfully!
            </div>
          )}
        </div>

        <Card className="p-6 mb-8">
          <h3 className="text-xl font-bold mb-6">Compare All Plans</h3>
          
          <div className="grid md:grid-cols-3 gap-6">
            {(Object.keys(SUBSCRIPTION_PLANS) as PlanTier[]).map((planId) => {
              const plan = SUBSCRIPTION_PLANS[planId];
              const isActivePlan = planId === userSubscription.planId && !isCancelled;
              const isCancellingPlan = planId === userSubscription.planId && isCancelled;
              const isCurrent = isActivePlan;
              const ctaLabel =
                planId === 'pro'
                  ? 'Upgrade to Pro'
                  : planId === 'core'
                    ? 'Choose Core'
                    : 'Start Free Trial';
              
              return (
                <div
                  key={planId}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    isCurrent
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                      : isCancellingPlan
                        ? 'border-red-300 bg-red-50/50 dark:bg-red-900/10 dark:border-red-800'
                        : 'border-border bg-muted/30 hover:border-purple-300 dark:hover:border-purple-700'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${plan.gradient} flex items-center justify-center mb-3`}>
                    {(() => {
                      const Icon = planId === 'trial' ? Shield : planId === 'pro' ? Zap : Package;
                      return <Icon className="w-5 h-5 text-white" />;
                    })()}
                  </div>
                  
                  <h4 className="font-bold mb-1">{plan.displayName}</h4>
                  <div className="flex items-baseline gap-1 mb-3">
                    <span className="text-2xl font-bold">${plan.price}</span>
                    <span className="text-sm text-muted-foreground">/mo</span>
                  </div>
                  
                  <div className="mb-3 p-2 bg-background rounded-lg">
                    <p className="text-sm font-medium">{plan.credits} minutes/mo</p>
                    {plan.payAsYouGoRate && (
                      <p className="text-xs text-muted-foreground">
                        PAYG: ${plan.payAsYouGoRate}/min
                      </p>
                    )}
                  </div>

                  {plan.allowanceDescription && (
                    <p className="text-xs text-muted-foreground mb-4 italic">
                      {plan.allowanceDescription}
                    </p>
                  )}

                  <div className="mb-4 rounded-xl border border-border bg-background/60 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Includes
                      </p>
                      <span className="text-[11px] text-muted-foreground">{plan.features.length} items</span>
                    </div>
                    <ul className="space-y-1.5 text-sm">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-slate-700 dark:text-slate-200">
                          <Check className="w-4 h-4 mt-0.5 text-purple-600 dark:text-purple-300 shrink-0" />
                          <span className="leading-5">{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {isCurrent ? (
                    <div className="flex items-center justify-center gap-2 py-2 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded-lg font-medium">
                      <Check className="w-4 h-4" />
                      Current Plan
                    </div>
                  ) : isCancellingPlan ? (
                    <div className="flex flex-col items-center gap-1 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg">
                      <div className="flex items-center gap-2 font-medium text-sm">
                        <AlertTriangle className="w-4 h-4" />
                        Cancelled
                      </div>
                      {billingEndIsValid && (
                        <p className="text-[11px] text-red-500 dark:text-red-500">
                          Access until {billingEndDate!.toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  ) : (
                    <Button 
                      className={
                        planId === 'pro'
                          ? 'w-full rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md hover:from-purple-700 hover:to-pink-700 hover:text-pink-100 hover:shadow-lg'
                          : planId === 'core'
                            ? 'w-full rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md hover:from-blue-700 hover:to-cyan-700 hover:text-white hover:shadow-lg'
                            : 'w-full rounded-xl border-purple-300 text-purple-700 bg-purple-50 hover:bg-purple-100 hover:text-purple-900 dark:border-purple-700 dark:text-purple-300 dark:bg-purple-900/20 dark:hover:bg-purple-900/30 dark:hover:text-purple-100'
                      }
                      variant={planId === 'pro' ? 'default' : 'outline'}
                      onClick={() => handleSubscribe(planId)}
                      isLoading={processingAction === `subscribe_${planId}`}
                      disabled={isActionLocked}
                    >
                      {ctaLabel}
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card className="p-5 h-full border border-purple-200/70 dark:border-purple-800/70 bg-white/95 dark:bg-slate-900/95 shadow-[0_20px_60px_-30px_rgba(168,85,247,0.45)] backdrop-blur">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${currentPlan.gradient} flex items-center justify-center shadow-lg shadow-purple-500/20`}>
                    <PlanIcon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-purple-500 dark:text-purple-300">Current Plan</p>
                      {isCancelled && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400">
                          <AlertTriangle className="w-3 h-3" />
                          Cancelled
                        </span>
                      )}
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{currentPlan.displayName}</h3>
                  </div>
                </div>
                {isCancelled && (
                  <div className="mt-2 flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                    <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                      Your plan has been cancelled. You'll retain full access until{' '}
                      <span className="font-semibold">
                        {billingEndIsValid ? billingEndDate!.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : 'end of billing period'}
                      </span>
                      , then revert to the free plan.
                    </p>
                  </div>
                )}
                <div className="flex items-baseline gap-2 mt-3">
                  <span className="text-3xl font-bold text-purple-700 dark:text-purple-300">
                    ${currentPlan.price}
                  </span>
                  <span className="text-muted-foreground">/month</span>
                </div>
              </div>
              <div className="flex flex-col gap-2 items-end">
                <Button
                  onClick={handleManageBilling}
                  isLoading={processingAction === 'manage_billing'}
                  disabled={isActionLocked}
                  className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Manage Billing
                </Button>
                <Button
                  variant="outline"
                  onClick={handleCancelSubscription}
                  isLoading={processingAction === 'cancel_subscription'}
                  disabled={isActionLocked || !canCancelSubscription}
                  className="border-red-200 text-red-600 hover:bg-red-400 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-900/30"
                >
                  Cancel Plan
                </Button>
              </div>
            </div>

            {/* Renewal Info */}
            <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-purple-50 to-white dark:from-slate-800 dark:to-slate-900 rounded-2xl border border-purple-100 dark:border-slate-700">
              <Calendar className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span className="text-sm">
                <span className="font-medium">
                  {renewalStatusLabel}
                </span> 
                <span className="text-muted-foreground"> • 
                  {userSubscription.planId === 'trial' ? ' Expiry: ' : ' Next billing: '}
                  {billingEndIsValid ? billingEndDate!.toLocaleDateString() : 'N/A'}
                </span>
              </span>
            </div>

            {/* Plan Details */}
            <div className="mt-4 grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-purple-100 dark:border-slate-700 bg-white/70 dark:bg-slate-900/60 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-purple-500 dark:text-purple-300">
                    Monthly minutes
                  </p>
                  <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                    {currentPlan.credits} min
                  </p>
                  {currentPlan.allowanceDescription && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {currentPlan.allowanceDescription}
                    </p>
                  )}
                </div>

                <div className="rounded-2xl border border-purple-100 dark:border-slate-700 bg-white/70 dark:bg-slate-900/60 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-purple-500 dark:text-purple-300">
                    PAYG rate
                  </p>
                  <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                    {currentPlan.payAsYouGoRate != null ? `$${currentPlan.payAsYouGoRate}/min` : 'Not available'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {currentPlan.payAsYouGoRate != null ? 'Buy extra minutes anytime' : 'Available on paid plans'}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-purple-100 dark:border-slate-700 bg-gradient-to-br from-white to-purple-50/40 dark:from-slate-900/60 dark:to-slate-900 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-purple-500 dark:text-purple-300 mb-2">
                  Includes
                </p>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                  {currentPlan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-slate-700 dark:text-slate-200">
                      <Check className="w-4 h-4 mt-0.5 text-purple-600 dark:text-purple-300 shrink-0" />
                      <span className="leading-5">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>

          {/* Credits Remaining Card */}
          <Card className="p-5 h-full border border-blue-200/70 dark:border-blue-800/70 bg-white/95 dark:bg-slate-900/95 shadow-[0_20px_60px_-30px_rgba(59,130,246,0.4)] backdrop-blur">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h3 className="font-semibold text-blue-900 dark:text-blue-100">Minutes Balance</h3>
            </div>
            <p className="text-sm text-blue-800/80 dark:text-blue-200/80 mb-4 leading-6">
              <span className="font-semibold">{userSubscription.accountRemainingMinutes ?? 0} min</span> available
              {userSubscription.payAsYouGoCredits > 0 && (
                <>
                  {" "}·{" "}
                  <span className="font-semibold">{userSubscription.creditsRemaining} min</span> subscription
                  {" + "}
                  <span className="font-semibold">{userSubscription.payAsYouGoCredits} min</span> PAYG
                </>
              )}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* Plan Minutes */}
              <div className="p-3 bg-gradient-to-br from-blue-50 to-white dark:from-slate-800 dark:to-slate-900 rounded-2xl border border-blue-100 dark:border-slate-700 shadow-sm">
                <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-[0.18em] mb-2">Subscription Balance</p>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-3xl font-bold text-blue-900 dark:text-blue-100">
                    {userSubscription.creditsRemaining}
                  </span>
                  <span className="text-sm text-blue-600/80 dark:text-blue-400/80">
                    / {userSubscription.creditsTotal} min
                  </span>
                </div>
                {/* Progress Bar */}
                <div className="w-full h-2.5 bg-blue-100 dark:bg-blue-900/50 rounded-full overflow-hidden mb-1.5">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${usagePercentage}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className="h-full bg-blue-500 rounded-full"
                  />
                </div>
                <p className="text-xs text-blue-500 dark:text-blue-400">
                  {usagePercentage.toFixed(0)}% used this cycle
                </p>
              </div>

              {/* PAYG Minutes */}
              <div className="p-3 bg-gradient-to-br from-emerald-50 to-white dark:from-slate-800 dark:to-slate-900 rounded-2xl border border-emerald-100 dark:border-slate-700 group relative shadow-sm">
                <div className="flex justify-between items-start mb-1">
                  <p className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-[0.18em]">Pay-As-You-Go</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={handleSyncCredits}
                    disabled={processingAction === 'sync_credits' || isActionLocked}
                    title="Check for missing purchases"
                  >
                    <RefreshCw className={`w-3 h-3 ${processingAction === 'sync_credits' ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="text-3xl font-bold text-green-900 dark:text-green-100">
                    {userSubscription.payAsYouGoCredits}
                  </span>
                  <span className="text-sm text-green-600/80 dark:text-green-400/80">
                    min available
                  </span>
                </div>
                <p className="text-xs text-green-600/80 dark:text-green-400/80">
                  These minutes never expire
                </p>
              </div>
            </div>

            {/* Details */}
            <div className="mt-1 rounded-2xl border border-blue-100 dark:border-slate-700 bg-gradient-to-br from-white to-blue-50/40 dark:from-slate-900/60 dark:to-slate-900 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-300 mb-3">
                Details
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-white/70 dark:bg-slate-900/60 border border-blue-100 dark:border-slate-700 p-3">
                  <p className="text-xs text-muted-foreground">Used this cycle</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">
                    {Math.max(0, (userSubscription.creditsTotal ?? 0) - (userSubscription.creditsRemaining ?? 0))} min
                  </p>
                </div>
                <div className="rounded-xl bg-white/70 dark:bg-slate-900/60 border border-blue-100 dark:border-slate-700 p-3">
                  <p className="text-xs text-muted-foreground">Total available</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">
                    {(userSubscription.creditsRemaining + userSubscription.payAsYouGoCredits) ?? 0} min
                  </p>
                </div>
                <div className="rounded-xl bg-white/70 dark:bg-slate-900/60 border border-blue-100 dark:border-slate-700 p-3">
                  <p className="text-xs text-muted-foreground">Cycle start</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {userSubscription.billingCycle.startDate
                      ? new Date(userSubscription.billingCycle.startDate).toLocaleDateString()
                      : 'N/A'}
                  </p>
                </div>
                <div className="rounded-xl bg-white/70 dark:bg-slate-900/60 border border-blue-100 dark:border-slate-700 p-3">
                  <p className="text-xs text-muted-foreground">Next reset</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {userSubscription.billingCycle.endDate
                      ? new Date(userSubscription.billingCycle.endDate).toLocaleDateString()
                      : 'N/A'}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex items-start gap-2 text-xs text-blue-700/80 dark:text-blue-200/80">
                <AlertCircle className="w-4 h-4 mt-0.5 text-blue-600 dark:text-blue-300 shrink-0" />
                <p className="leading-5">
                  Monthly minutes reset each billing cycle. Pay‑as‑you‑go minutes never expire.
                </p>
              </div>
            </div>

            {/* {(userSubscription.accountRemainingMinutes ??
              userSubscription.creditsRemaining + userSubscription.payAsYouGoCredits) <= 50 && (
              <div className="flex items-start gap-2 p-4 mt-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Running low on minutes. Consider purchasing more or upgrading your plan.
                </p>
              </div>
            )} */}
          </Card>
        </div>

        {currentPlan.payAsYouGoRate && (
          <Card className="p-6 mb-8 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-2 border-green-200 dark:border-green-800">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-6 h-6 text-green-600 dark:text-green-400" />
                  <h3 className="text-xl font-bold text-green-900 dark:text-green-100">Pay-As-You-Go Available</h3>
                </div>
                <p className="text-green-700 dark:text-green-300 mb-4">
                  Need more minutes this month? Purchase additional time at your discounted rate of 
                  <span className="font-bold"> $5 per 25 minutes</span> (${currentPlan.payAsYouGoRate}/min).
                </p>
                <div className="grid sm:grid-cols-3 gap-3">
                  <div className="p-3 bg-white/60 dark:bg-black/40 rounded-lg border border-green-200 dark:border-green-800">
                    <p className="text-sm text-green-700 dark:text-green-300">25 minutes</p>
                    <p className="text-lg font-bold text-green-800 dark:text-green-200">
                      ${(currentPlan.payAsYouGoRate * 25).toFixed(2)}
                    </p>
                  </div>
                  <div className="p-3 bg-white/60 dark:bg-black/40 rounded-lg border border-green-200 dark:border-green-800">
                    <p className="text-sm text-green-700 dark:text-green-300">50 minutes</p>
                    <p className="text-lg font-bold text-green-800 dark:text-green-200">
                      ${(currentPlan.payAsYouGoRate * 50).toFixed(2)}
                    </p>
                  </div>
                  <div className="p-3 bg-white/60 dark:bg-black/40 rounded-lg border border-green-200 dark:border-green-800">
                    <p className="text-sm text-green-700 dark:text-green-300">100 minutes</p>
                    <p className="text-lg font-bold text-green-800 dark:text-green-200">
                      ${(currentPlan.payAsYouGoRate * 100).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
              <Button 
                onClick={() => setShowPAYGModal(true)}
                className="ml-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                size="lg"
              >
                <ShoppingCart className="w-4 h-4 mr-2" />
                Buy Minutes
              </Button>
            </div>
          </Card>
        )}

        {(billingHistory.length > 0 || invoices.length > 0) && (
          <Card className="p-6 mb-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                <h3 className="text-xl font-bold">Billing History & Invoices</h3>
              </div>
            </div>

            {billingHistory.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-semibold mb-3 text-muted-foreground">Subscription history</h4>
                <div className="space-y-3">
                  {billingHistory.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-border"
                    >
                      <div>
                        <p className="font-medium capitalize">
                          {entry.plan_type || 'trial'} plan
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {entry.start_date ? new Date(entry.start_date).toLocaleDateString() : ''}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm capitalize">{entry.status}</p>
                        {entry.amount != null && (
                          <p className="text-xs text-muted-foreground">
                            ${Number(entry.amount).toFixed(2)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h4 className="text-sm font-semibold mb-3 text-muted-foreground">Stripe invoices</h4>
              {invoices.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  You don’t have any invoices yet. Once a payment is processed, your invoices will appear here with links to view and download them.
                </p>
              ) : (
                <div className="space-y-3">
                  {invoices.map((invoice) => (
                    <div
                      key={invoice.id}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-border"
                    >
                      <div>
                        <p className="font-medium">
                          {invoice.description || 'Subscription invoice'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {invoice.created ? new Date(invoice.created).toLocaleDateString() : ''} •{" "}
                          <span className="capitalize">{invoice.status}</span>
                          {typeof invoice.minutes_purchased === 'number' && invoice.minutes_purchased > 0 && (
                            <>
                              {" "}• {invoice.minutes_purchased} min
                            </>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="font-semibold">
                            ${Number(invoice.amount_due).toFixed(2)}
                          </p>
                          <p className="text-xs text-muted-foreground uppercase">
                            {invoice.currency}
                          </p>
                        </div>
                        {invoice.hosted_invoice_url && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              if (invoice.hosted_invoice_url) {
                                window.open(invoice.hosted_invoice_url, "_blank", "noopener,noreferrer");
                              }
                            }}
                            className="flex items-center gap-2"
                          >
                            <ExternalLink className="w-4 h-4" />
                            View
                          </Button>
                        )}
                        {invoice.invoice_pdf && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              if (invoice.invoice_pdf) {
                                window.open(invoice.invoice_pdf, "_blank", "noopener,noreferrer");
                              }
                            }}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        )}


      </div>

      {/* PAYG Purchase Modal */}
      <AnimatePresence>
        {showPAYGModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => !isActionLocked && setShowPAYGModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-900 rounded-2xl p-8 max-w-md w-full border-2 border-green-500/30 shadow-2xl"
            >
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-100 dark:border-green-800">
                  <ShoppingCart className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">Buy Additional Minutes</h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Your rate: <span className="font-bold text-green-600 dark:text-green-400">${currentPlan.payAsYouGoRate}/minute</span>
                </p>
              </div>

              {/* Minutes Selector */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-3 text-gray-900 dark:text-white">How many minutes?</label>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[25, 50, 100].map((mins) => (
                    <button
                      key={mins}
                      onClick={() => setPaygMinutes(mins)}
                      disabled={isActionLocked}
                      className={`p-3 rounded-xl border-2 transition-all ${
                        paygMinutes === mins
                          ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-900 dark:text-green-100'
                          : 'border-gray-200 dark:border-slate-700 hover:border-green-300 dark:hover:border-green-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white'
                      } ${processingAction !== null ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <p className="font-bold">{mins}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">minutes</p>
                    </button>
                  ))}
                </div>
                
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="25"
                    max="250"
                    step="25"
                    value={paygMinutes}
                    disabled={isActionLocked}
                    onChange={(e) => setPaygMinutes(Number(e.target.value))}
                    className="flex-1 accent-green-600 dark:accent-green-500"
                  />
                  <span className="font-mono font-bold text-lg w-16 text-right text-gray-900 dark:text-white">{paygMinutes}m</span>
                </div>
              </div>

              {/* Cost Summary */}
              <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border-2 border-green-200 dark:border-green-800">
                <div className="flex justify-between mb-2">
                  <span className="text-gray-500 dark:text-gray-400">Minutes:</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{paygMinutes}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-500 dark:text-gray-400">Rate:</span>
                  <span className="font-semibold text-gray-900 dark:text-white">${currentPlan.payAsYouGoRate}/min</span>
                </div>
                <div className="border-t border-green-300 dark:border-green-700 pt-2 mt-2 flex justify-between">
                  <span className="font-bold text-green-900 dark:text-green-100">Total:</span>
                  <span className="text-2xl font-bold text-green-700 dark:text-green-300">${paygCost.toFixed(2)}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowPAYGModal(false)}
                  className="flex-1"
                  disabled={isActionLocked}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleBuyPAYG}
                  isLoading={processingAction === 'buy_credits'}
                  disabled={isActionLocked}
                  className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                >
                  Purchase
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cancel Subscription Confirmation Modal */}
      <Dialog open={showCancelModal} onOpenChange={setShowCancelModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <DialogTitle className="text-lg">Cancel Subscription?</DialogTitle>
            </div>
            <DialogDescription className="text-sm text-muted-foreground leading-relaxed pt-1">
              Are you sure you want to cancel your <span className="font-medium text-foreground">{currentPlan.name}</span> subscription?
              <br /><br />
              You'll keep full access to all features until the end of your current billing period
              {billingEndIsValid && (
                <> on <span className="font-medium text-foreground">{billingEndDate!.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</span></>
              )}. After that, your account will revert to the free plan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-2">
            <Button
              variant="outline"
              onClick={() => setShowCancelModal(false)}
              disabled={processingAction === 'cancel_subscription'}
            >
              Keep Subscription
            </Button>
            <Button
              variant="destructive"
              onClick={confirmCancelSubscription}
              isLoading={processingAction === 'cancel_subscription'}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Yes, Cancel Plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
