import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Link, useSearchParams } from "react-router";
import { useAuth } from "../../contexts/AuthContext";
import { api } from "@/lib/api";
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
  Crown,
  Download,
  RefreshCw,
  ShoppingCart,
  Sparkles,
  ChevronRight,
  History,
  ExternalLink,
  ArrowLeft
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { AppLayout } from "../../components/AppLayout";
import { Skeleton } from "../../components/ui/skeleton";
import { SUBSCRIPTION_PLANS } from "../../utils/subscriptionPlans";
import type { PlanTier, UserSubscription, UsageRecord } from "../../utils/subscriptionPlans";

export function Billing() {
  const { session, profile, refreshProfile } = useAuth();
  const [searchParams] = useSearchParams();
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
      if (!session?.user) return;
      
      try {
        if (searchParams.get('success') === 'true') {
          try {
            await Promise.all([
              api.billing.syncSubscription(),
              api.billing.syncCredits()
            ]);
          } catch (syncError) {
            console.error('Failed to sync billing data after checkout success:', syncError);
          }
        }

        let latestProfile = profile;
        try {
           const refreshed = await refreshProfile();
           if (refreshed) {
             latestProfile = refreshed;
           }
        } catch (e) {
          console.error("Error refreshing profile:", e);
        }

        const [subData, sessionsData, historyData, invoiceData, creditsData] = await Promise.all([
          api.billing.getSubscription(),
          api.sessions.list(),
          api.billing.getHistory(),
          api.billing.getInvoices(),
          api.getCredits()
        ]);

        const rawPlanId = subData.plan_type;
        // Fallback to trial if plan type is not recognized (e.g. legacy plans)
        const planId = (SUBSCRIPTION_PLANS[rawPlanId as PlanTier] ? rawPlanId : 'trial') as PlanTier;
        const plan = SUBSCRIPTION_PLANS[planId];
        const now = new Date();
        
        // Canonical amounts from GET /users/credits (subscription + PAYG + lifetime used)
        const subscriptionCredits = creditsData.subscription ?? latestProfile?.credits ?? 0;
        const purchasedCredits = creditsData.purchased ?? latestProfile?.purchased_credits ?? 0;
        const accountRemainingMinutes =
          creditsData.remaining_minutes ??
          subscriptionCredits + purchasedCredits;
        const accountTotalMinutes =
          creditsData.total_minutes ??
          accountRemainingMinutes + (creditsData.used_minutes ?? latestProfile?.minutes_used ?? 0);
        const accountUsedMinutes =
          creditsData.used_minutes ?? latestProfile?.minutes_used ?? 0;

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
          }))
          .slice(0, 5); 

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
        setBillingHistory(historyData || []);
        setInvoices(invoiceData || []);
      } catch (error) {
        console.error('Failed to fetch billing data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [session, searchParams]);

  const currentPlan = SUBSCRIPTION_PLANS[userSubscription.planId];
  const usagePercentage = userSubscription.creditsTotal > 0 
    ? ((userSubscription.creditsTotal - userSubscription.creditsRemaining) / userSubscription.creditsTotal) * 100
    : 0;
  const daysUntilRenewal = Math.ceil((new Date(userSubscription.billingCycle.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

  const [showPAYGModal, setShowPAYGModal] = useState(false);
  const [paygMinutes, setPaygMinutes] = useState(60);
  const [processingAction, setProcessingAction] = useState<string | null>(null);

  const paygCost = currentPlan.payAsYouGoRate ? (currentPlan.payAsYouGoRate * paygMinutes) : 0;

  const handleSyncCredits = async () => {
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
    if (paygCost <= 0) return;
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
    if (planId === 'trial') return; 
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

  const handleCancelSubscription = async () => {
    if (userSubscription.planId === 'trial') return;
    const confirmed = window.confirm("Are you sure you want to cancel your subscription? You will keep access until the end of the current billing period.");
    if (!confirmed) return;
    setProcessingAction('cancel_subscription');
    try {
      await api.billing.cancelSubscription();
      alert("Your subscription has been cancelled. It will remain active until the end of the current billing period.");
      window.location.reload();
    } catch (error) {
      console.error('Failed to cancel subscription:', error);
      alert('Failed to cancel subscription. Please try again.');
      setProcessingAction(null);
    }
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

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card className="p-6 md:col-span-2 border-2 border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${currentPlan.gradient} flex items-center justify-center`}>
                    <Package className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Current Plan</p>
                    <h3 className="text-2xl font-bold">{currentPlan.displayName}</h3>
                  </div>
                </div>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-3xl font-bold text-purple-700 dark:text-purple-300">
                    ${currentPlan.price}
                  </span>
                  <span className="text-muted-foreground">/month</span>
                </div>
              </div>
              {userSubscription.planId !== 'trial' && (
                <div className="flex flex-col gap-2 items-end">
                  <Button 
                    onClick={handleManageBilling}
                    isLoading={processingAction === 'manage_billing'}
                    disabled={processingAction !== null}
                    className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                  >
                    <CreditCard className="w-4 h-4 mr-2" />
                    Manage Billing
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleCancelSubscription}
                    isLoading={processingAction === 'cancel_subscription'}
                    disabled={processingAction !== null}
                    className="border-red-200 text-red-600 hover:bg-red-400 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-900/30"
                  >
                    Cancel Plan
                  </Button>
                </div>
              )}
            </div>

            {/* Renewal Info */}
            <div className="flex items-center gap-2 p-3 bg-white/60 dark:bg-black/40 backdrop-blur-sm rounded-lg border border-purple-200 dark:border-purple-800">
              <Calendar className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span className="text-sm">
                <span className="font-medium">
                  {userSubscription.planId === 'trial' ? 'Expires in ' : 'Renews in '} 
                  {daysUntilRenewal} days
                </span> 
                <span className="text-muted-foreground"> • 
                  {userSubscription.planId === 'trial' ? ' Expiry: ' : ' Next billing: '}
                  {userSubscription.billingCycle.endDate ? new Date(userSubscription.billingCycle.endDate).toLocaleDateString() : 'N/A'}
                </span>
              </span>
            </div>
          </Card>

          {/* Credits Remaining Card */}
          <Card className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-2 border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h3 className="font-semibold text-blue-900 dark:text-blue-100">Minutes Balance</h3>
            </div>
            {userSubscription.accountTotalMinutes != null && (
              <p className="text-sm text-blue-800/80 dark:text-blue-200/80 mb-4">
                Account:{" "}
                <span className="font-semibold">{userSubscription.accountRemainingMinutes ?? 0} min</span>{" "}
                remaining ·{" "}
                <span className="font-semibold">{userSubscription.accountTotalMinutes} min</span> total ·{" "}
                <span className="font-semibold">{userSubscription.accountUsedMinutes ?? 0} min</span> used
              </p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* Plan Minutes */}
              <div className="p-4 bg-white/60 dark:bg-black/20 rounded-xl border border-blue-100 dark:border-blue-900/30">
                <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">Monthly Plan</p>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-3xl font-bold text-blue-900 dark:text-blue-100">
                    {userSubscription.creditsRemaining}
                  </span>
                  <span className="text-sm text-blue-600/80 dark:text-blue-400/80">
                    / {userSubscription.creditsTotal} min
                  </span>
                </div>
                {/* Progress Bar */}
                <div className="w-full h-2 bg-blue-100 dark:bg-blue-900/50 rounded-full overflow-hidden mb-1">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${usagePercentage}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className="h-full bg-blue-500 rounded-full"
                  />
                </div>
                <p className="text-xs text-blue-500 dark:text-blue-400">
                  {usagePercentage.toFixed(0)}% used
                </p>
              </div>

              {/* PAYG Minutes */}
              <div className="p-4 bg-green-50/50 dark:bg-green-900/10 rounded-xl border border-green-100 dark:border-green-900/30 group relative">
                <div className="flex justify-between items-start mb-1">
                  <p className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wider">Pay-As-You-Go</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={handleSyncCredits}
                    disabled={processingAction === 'sync_credits'}
                    title="Check for missing purchases"
                  >
                    <RefreshCw className={`w-3 h-3 ${processingAction === 'sync_credits' ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
                <div className="flex items-baseline gap-2 mb-2">
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

            <Link 
              to="/app/settings" 
              className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-2 transition-colors text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Settings
            </Link>

            {(userSubscription.accountRemainingMinutes ??
              userSubscription.creditsRemaining + userSubscription.payAsYouGoCredits) <= 50 && (
              <div className="flex items-start gap-2 p-3 mt-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Running low on minutes. Consider purchasing more or upgrading your plan.
                </p>
              </div>
            )}
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

        <Card className="p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <h3 className="text-xl font-bold">Recent Sessions</h3>
            </div>
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>

          <div className="space-y-3">
            {userSubscription.usageHistory.map((record) => (
              <div 
                key={record.id}
                className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-border hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-medium">Session with {record.avatarName}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(record.date).toLocaleDateString()} at {new Date(record.date).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{record.minutesUsed} minutes</p>
                  <p className="text-sm text-muted-foreground">
                    {record.cost > 0 ? `$${record.cost.toFixed(2)}` : 'Included'}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {userSubscription.usageHistory.length === 0 && (
            <div className="text-center py-12">
              <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="text-muted-foreground">No sessions yet</p>
              <Link to="/app/session-lobby">
                <Button className="mt-4">
                  Start Your First Session
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          )}
        </Card>

        {/* All Available Plans */}
        <Card className="p-6">
          <h3 className="text-xl font-bold mb-6">Compare All Plans</h3>
          
          <div className="grid md:grid-cols-3 gap-6">
            {(Object.keys(SUBSCRIPTION_PLANS) as PlanTier[]).map((planId) => {
              const plan = SUBSCRIPTION_PLANS[planId];
              const isCurrent = planId === userSubscription.planId;
              
              return (
                <div
                  key={planId}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    isCurrent 
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' 
                      : 'border-border bg-muted/30 hover:border-purple-300 dark:hover:border-purple-700'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${plan.gradient} flex items-center justify-center mb-3`}>
                    {planId === 'core' && <Package className="w-5 h-5 text-white" />}
                    {planId === 'pro' && <Zap className="w-5 h-5 text-white" />}
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

                  {isCurrent ? (
                    <div className="flex items-center justify-center gap-2 py-2 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded-lg font-medium">
                      <Check className="w-4 h-4" />
                      Current Plan
                    </div>
                  ) : (
                    <Button 
                      className="w-full" 
                      variant={planId === 'pro' ? 'default' : 'outline'}
                      onClick={() => handleSubscribe(planId)}
                      isLoading={processingAction === `subscribe_${planId}`}
                      disabled={processingAction !== null}
                    >
                      {SUBSCRIPTION_PLANS[planId].price > currentPlan.price ? 'Upgrade' : 'Switch'}
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* PAYG Purchase Modal */}
      <AnimatePresence>
        {showPAYGModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => !processingAction && setShowPAYGModal(false)}
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
                      disabled={processingAction !== null}
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
                    disabled={processingAction !== null}
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
                  disabled={processingAction !== null}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleBuyPAYG}
                  isLoading={processingAction === 'buy_credits'}
                  disabled={processingAction !== null}
                  className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                >
                  Purchase
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppLayout>
  );
}
