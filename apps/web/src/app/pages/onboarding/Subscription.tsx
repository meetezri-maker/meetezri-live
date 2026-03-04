import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { OnboardingLayout } from "../../components/OnboardingLayout";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { SUBSCRIPTION_PLANS, PlanTier } from "../../utils/subscriptionPlans";
import { Check, Loader2, Sparkles, Zap, Crown } from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormField, FormItem, FormControl, FormMessage } from "../../components/ui/form";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";

const subscriptionSchema = z.object({
  selectedPlan: z.enum(["trial", "core", "pro"] as const),
});

type SubscriptionValues = z.infer<typeof subscriptionSchema>;

export function OnboardingSubscription() {
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'single'>('list');

  const form = useForm<SubscriptionValues>({
    resolver: zodResolver(subscriptionSchema),
    defaultValues: {
      selectedPlan: "trial",
    },
  });

  const selectedPlan = form.watch("selectedPlan");

  useEffect(() => {
    const storedPlan = localStorage.getItem("selectedPlan") as PlanTier;
    if (storedPlan && SUBSCRIPTION_PLANS[storedPlan]) {
      form.setValue("selectedPlan", storedPlan);
      setViewMode('single');
    }
  }, [form]);

  const onSubmit = async (values: SubscriptionValues) => {
    setIsProcessing(true);
    try {
      console.log("Processing subscription for plan:", values.selectedPlan);
      
      if (values.selectedPlan === "trial") {
        toast.info("Activating your free trial...");
        // For trial, just create subscription and move on
        const result = await api.billing.createSubscription({
          plan_type: "trial",
          billing_cycle: "monthly"
        });
        console.log("Trial subscription result:", result);
        
        // Navigate to wellness baseline
        navigate("/onboarding/wellness-baseline");
      } else {
        toast.info("Redirecting to checkout...");
        // For paid plans, redirect to Stripe
        // We need to provide full URL for success/cancel
        const origin = window.location.origin;
        const successUrl = `${origin}/onboarding/wellness-baseline?session_id={CHECKOUT_SESSION_ID}`;
        const cancelUrl = `${origin}/onboarding/subscription`;

        const result = await api.billing.createSubscription({
          plan_type: values.selectedPlan,
          billing_cycle: "monthly",
          successUrl,
          cancelUrl
        });
        console.log("Paid subscription result:", result);

        if (result.checkoutUrl) {
          window.location.href = result.checkoutUrl;
        } else if (result.subscription) {
          // Fallback if backend handled it without checkout (e.g. 100% coupon or error in logic)
          console.warn("Received subscription object for paid plan instead of checkout URL");
          navigate("/onboarding/wellness-baseline");
        }
      }
    } catch (error) {
      console.error("Subscription error:", error);
      toast.error("Failed to process subscription selection");
      setIsProcessing(false);
    }
  };

  const plans: PlanTier[] = ["trial", "core", "pro"];

  const planStyles: Record<string, { border: string; bg: string; badge: string; text: string }> = {
    gray: {
      border: "border-gray-500",
      bg: "bg-gray-500/5",
      badge: "bg-gray-500",
      text: "text-gray-500"
    },
    blue: {
      border: "border-blue-500",
      bg: "bg-blue-500/5",
      badge: "bg-blue-500",
      text: "text-blue-500"
    },
    purple: {
      border: "border-purple-500",
      bg: "bg-purple-500/5",
      badge: "bg-purple-500",
      text: "text-purple-500"
    }
  };

  const renderPlanCard = (tier: PlanTier) => {
    const plan = SUBSCRIPTION_PLANS[tier];
    const isSelected = selectedPlan === tier;
    const Icon = tier === 'pro' ? Crown : tier === 'core' ? Zap : Sparkles;
    const styles = planStyles[plan.color] || planStyles.gray;

    return (
      <motion.div
        key={tier}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <Card 
          className={`p-4 cursor-pointer relative overflow-hidden transition-all duration-200 border-2 ${
            isSelected 
              ? `${styles.border} ${styles.bg}` 
              : "border-transparent hover:border-border/50 bg-card/50"
          }`}
          onClick={() => form.setValue("selectedPlan", tier)}
        >
          {isSelected && (
            <div className={`absolute top-0 right-0 p-1 ${styles.badge} rounded-bl-lg`}>
              <Check className="w-4 h-4 text-white" />
            </div>
          )}
          
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-xl bg-gradient-to-br ${plan.gradient} text-white shrink-0`}>
              <Icon className="w-6 h-6" />
            </div>
            
            <div className="flex-1">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-semibold text-lg">{plan.displayName}</h3>
                  <p className="text-sm text-muted-foreground">{plan.allowanceDescription}</p>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold">
                    {plan.price === 0 ? "$0" : `$${plan.price}`}
                  </div>
                  {plan.price > 0 && <div className="text-xs text-muted-foreground">/month</div>}
                </div>
              </div>
              
              <div className="space-y-2 mt-3">
                {plan.features.slice(0, 3).map((feature, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className={`w-3 h-3 ${styles.text}`} />
                    <span>{feature}</span>
                  </div>
                ))}
                {plan.features.length > 3 && (
                  <div className="text-xs text-muted-foreground mt-1 ml-5">
                    + {plan.features.length - 3} more features
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>
      </motion.div>
    );
  };

  return (
    <OnboardingLayout
      currentStep={2}
      totalSteps={8}
      title="Choose Your Plan"
      subtitle="Select the plan that best fits your wellness journey"
      showBack={true}
      onBack={() => navigate("/onboarding/profile-setup")}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="selectedPlan"
            render={() => (
              <FormItem>
                <FormControl>
                  {viewMode === 'list' ? (
                    <div className="grid grid-cols-1 gap-4">
                      {plans.map((tier) => renderPlanCard(tier))}
                    </div>
                  ) : (
                    <div className="max-w-md mx-auto space-y-6">
                      {renderPlanCard(selectedPlan)}
                      
                      <div className="space-y-2 bg-slate-50 p-4 rounded-lg border border-slate-100">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-medium text-slate-700">Want to switch plans?</p>
                        </div>
                        <Select 
                          value={selectedPlan} 
                          onValueChange={(val) => form.setValue("selectedPlan", val as PlanTier)}
                        >
                          <SelectTrigger className="w-full bg-white">
                            <SelectValue placeholder="Select a plan" />
                          </SelectTrigger>
                          <SelectContent>
                            {plans.map((tier) => (
                              <SelectItem key={tier} value={tier}>
                                {SUBSCRIPTION_PLANS[tier].displayName} - {SUBSCRIPTION_PLANS[tier].price === 0 ? 'Free' : `$${SUBSCRIPTION_PLANS[tier].price}/mo`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        
                        <div className="pt-2 text-center">
                          <button 
                            type="button"
                            onClick={() => setViewMode('list')}
                            className="text-xs text-muted-foreground hover:text-primary underline decoration-dotted transition-colors"
                          >
                            Compare all features
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-end pt-4">
            <Button 
              type="submit"
              disabled={isProcessing}
              className="w-full md:w-auto min-w-[150px]"
              size="lg"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                "Continue"
              )}
            </Button>
          </div>
        </form>
      </Form>
    </OnboardingLayout>
  );
}
