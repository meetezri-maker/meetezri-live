import { Link } from "react-router-dom";
import { PublicNav } from "../components/PublicNav";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { motion } from "motion/react";
import { Check, X, Package, Zap, ArrowRight, Sparkles } from "lucide-react";
import { SUBSCRIPTION_PLANS } from "../utils/subscriptionPlans";
import type { PlanTier } from "../utils/subscriptionPlans";

export function Pricing() {
  const plans = Object.values(SUBSCRIPTION_PLANS);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-purple-50/30 to-white">
      <PublicNav />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">
              Simple, Transparent Pricing
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              Choose the plan that fits your wellness journey. No hidden fees.
            </p>
          </motion.div>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="relative"
            >
              <Card className={`h-full p-8 flex flex-col relative overflow-hidden border-2 ${
                plan.popular ? 'border-purple-500 shadow-xl' : 'border-border'
              }`}>
                {plan.popular && (
                  <div className="absolute top-0 right-0 bg-purple-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                    POPULAR
                  </div>
                )}

                <div className="mb-8">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${plan.gradient} flex items-center justify-center mb-4`}>
                    {plan.id === 'trial' && <Sparkles className="w-6 h-6 text-white" />}
                    {plan.id === 'core' && <Package className="w-6 h-6 text-white" />}
                    {plan.id === 'pro' && <Zap className="w-6 h-6 text-white" />}
                  </div>
                  
                  <h3 className="text-2xl font-bold mb-2">{plan.displayName}</h3>
                  <div className="flex items-baseline gap-1 mb-4">
                    <span className="text-4xl font-bold">${plan.price}</span>
                    <span className="text-muted-foreground">/mo</span>
                  </div>
                  
                  {plan.allowanceDescription && (
                    <div className="bg-muted/50 rounded-lg p-3 mb-4 text-sm font-medium text-center">
                      {plan.allowanceDescription}
                    </div>
                  )}

                  <Link to="/signup" className="block" onClick={() => localStorage.setItem('selectedPlan', plan.id)}>
                    <Button 
                      className="w-full" 
                      variant={plan.popular ? "default" : "outline"}
                      size="lg"
                    >
                      {plan.id === 'trial' ? 'Start Trial' : 'Get Started'}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>
                </div>

                <div className="space-y-4 flex-1">
                  <p className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                    What's Included
                  </p>
                  <ul className="space-y-3">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm">
                        <Check className="w-5 h-5 text-green-500 shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {plan.notIncluded && plan.notIncluded.length > 0 && (
                    <>
                      <div className="h-px bg-border my-4" />
                      <p className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                        Not Included
                      </p>
                      <ul className="space-y-3 opacity-60">
                        {plan.notIncluded.map((feature, i) => (
                          <li key={i} className="flex items-start gap-3 text-sm">
                            <X className="w-5 h-5 text-muted-foreground shrink-0" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="mt-16 max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-4">Pay-As-You-Go Flexibility</h2>
          <p className="text-muted-foreground mb-6">
            Need more time? Add minutes anytime with our flexible Pay-As-You-Go option, available on Core and Pro plans.
          </p>
          <div className="bg-white p-6 rounded-xl border shadow-sm inline-block">
            <div className="text-3xl font-bold text-primary mb-2">$5 <span className="text-lg text-muted-foreground font-normal">per 25 minutes</span></div>
            <p className="text-sm text-muted-foreground">Credits expire at the end of your billing cycle</p>
          </div>
        </div>
      </main>
    </div>
  );
}
