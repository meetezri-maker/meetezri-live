import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { OnboardingLayout } from "../../components/OnboardingLayout";
import { Button } from "../../components/ui/button";
import { SUBSCRIPTION_PLANS, PlanTier } from "../../utils/subscriptionPlans";
import { Check, Loader2, Sparkles, Zap, Crown } from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormField, FormItem, FormControl, FormMessage } from "../../components/ui/form";
import { cn } from "@/lib/utils";

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
    // Cast to avoid Zod minor-version type mismatches between deps.
    resolver: zodResolver(subscriptionSchema as any),
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
      // Subscription/billing must not happen inside onboarding for plan buyers.
      // Signup flow already created billing/subscription (or the trialDetails step did it).
      try {
        window.localStorage.setItem("selectedPlan", values.selectedPlan);
      } catch {
        // ignore storage errors
      }

      toast.success("Membership selected. Continuing onboarding...");
      navigate("/onboarding/wellness-baseline");
    } catch (error) {
      console.error("Subscription error:", error);
      toast.error("Failed to process subscription selection");
      setIsProcessing(false);
    }
  };

  const plans: PlanTier[] = ["trial", "core", "pro"];

  const planStyles: Record<string, { border: string; bg: string; badge: string; text: string }> = {
    gray: {
      border: "border-zinc-400/55",
      bg: "bg-zinc-500/10",
      badge: "bg-zinc-500",
      text: "text-zinc-300",
    },
    blue: {
      border: "border-blue-400/55",
      bg: "bg-blue-500/10",
      badge: "bg-blue-500",
      text: "text-blue-300",
    },
    purple: {
      border: "border-purple-400/55",
      bg: "bg-purple-500/10",
      badge: "bg-purple-500",
      text: "text-purple-300",
    },
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
        <div
          className={cn(
            "relative cursor-pointer overflow-hidden rounded-2xl border-2 p-4 transition-all duration-200",
            isSelected
              ? `${styles.border} ${styles.bg} shadow-[0_0_24px_-12px_rgba(139,92,246,0.35)]`
              : "border-white/[0.08] bg-black/28 hover:border-violet-400/25 hover:bg-black/35",
          )}
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
                  <h3 className="text-lg font-semibold text-zinc-100">{plan.displayName}</h3>
                  <p className="text-sm text-violet-200/65">{plan.allowanceDescription}</p>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-zinc-100">
                    {plan.price === 0 ? "$0" : `$${plan.price}`}
                  </div>
                  {plan.price > 0 ? <div className="text-xs text-violet-200/55">/month</div> : null}
                </div>
              </div>
              
              <div className="space-y-2 mt-3">
                {plan.features.map((feature, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-violet-200/70">
                    <Check className={`w-3 h-3 ${styles.text}`} />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <OnboardingLayout
      currentStep={2}
      totalSteps={8}
      title="Choose Your Membership"
      subtitle="Select the membership that best fits your wellness journey"
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
                      
                      <div className="space-y-2 rounded-2xl border border-white/[0.08] bg-black/28 p-4">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-sm font-medium text-zinc-100">Want to switch memberships?</p>
                        </div>
                        <Select
                          value={selectedPlan}
                          onValueChange={(val) => form.setValue("selectedPlan", val as PlanTier)}
                        >
                          <SelectTrigger className="w-full border-white/12 bg-white/[0.045] text-zinc-100">
                            <SelectValue placeholder="Select a membership" />
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
                            className="text-xs text-violet-200/65 underline decoration-dotted transition-colors hover:text-violet-200"
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
