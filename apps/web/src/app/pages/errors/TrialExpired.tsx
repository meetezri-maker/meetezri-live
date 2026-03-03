import { motion } from "motion/react";
import { Clock, TrendingUp, Zap, Check, Star, ArrowRight, Home, Shield } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";

export function TrialExpired() {
  const [selectedPlan, setSelectedPlan] = useState<"core" | "pro">("pro");

  const plans = [
    {
      id: "core" as const,
      name: "Core Habit Plan",
      price: "$25",
      period: "month",
      features: [
        "200 minutes of AI sessions per month",
        "Mood tracking & journaling",
        "Wellness tools",
        "Email support",
        "Pay-As-You-Go enabled"
      ],
      gradient: "from-blue-500 to-cyan-500",
      popular: false
    },
    {
      id: "pro" as const,
      name: "Pro / Clarity",
      price: "$49",
      period: "month",
      features: [
        "400 minutes of AI sessions per month",
        "Advanced mood analytics",
        "Full wellness tool library",
        "Priority support",
        "Crisis resources 24/7"
      ],
      gradient: "from-purple-500 to-pink-500",
      popular: true
    }
  ];

  const selectedPlanData = plans.find(p => p.id === selectedPlan) || plans[1];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-pink-50">
      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <motion.div
            animate={{ 
              scale: [1, 1.05, 1],
              rotate: [0, -3, 3, 0]
            }}
            transition={{ duration: 3, repeat: Infinity }}
            className="inline-flex items-center justify-center w-32 h-32 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full shadow-2xl mb-6 relative"
          >
            <Clock className="w-16 h-16 text-white" />
            <motion.div
              animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute inset-0 bg-gradient-to-br from-purple-400 to-pink-500 rounded-full"
              style={{ filter: 'blur(20px)', zIndex: -1 }}
            />
          </motion.div>

          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Your Trial Has Ended
          </h1>
          <p className="text-xl text-gray-600 mb-2">
            Continue your mental wellness journey with Ezri
          </p>
          <p className="text-sm text-gray-500">
            Choose a plan that works best for you
          </p>
        </motion.div>

        {/* Trial Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 mb-8 max-w-3xl mx-auto"
        >
          <h3 className="font-bold text-gray-900 mb-4 text-center">Your Trial Journey</h3>
          
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-blue-600 mb-1">12</div>
              <p className="text-sm text-gray-600">Sessions Completed</p>
            </div>
            
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-purple-600 mb-1">45</div>
              <p className="text-sm text-gray-600">Journal Entries</p>
            </div>
            
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-green-600 mb-1">8.2</div>
              <p className="text-sm text-gray-600">Avg. Mood Score</p>
            </div>
          </div>

          <div className="mt-6 p-4 bg-gradient-to-br from-yellow-50 to-amber-50 border-2 border-yellow-200 rounded-xl">
            <p className="text-sm text-yellow-900 text-center">
              <Star className="w-4 h-4 inline text-yellow-600 mr-1" />
              You've made incredible progress! Keep the momentum going with a subscription.
            </p>
          </div>
        </motion.div>

        {/* Pricing Plans */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid md:grid-cols-3 gap-6 mb-8"
        >
          {plans.map((plan, index) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + index * 0.1 }}
              whileHover={{ scale: 1.02, y: -5 }}
              onClick={() => setSelectedPlan(plan.id)}
              className={`relative bg-white rounded-2xl p-6 shadow-lg cursor-pointer transition-all ${
                selectedPlan === plan.id 
                  ? 'ring-4 ring-purple-500 ring-opacity-50' 
                  : 'border-2 border-gray-100 hover:border-purple-200'
              }`}
            >
              {/* Popular Badge */}
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-1 rounded-full text-xs font-bold shadow-lg">
                    MOST POPULAR
                  </div>
                </div>
              )}

              {/* Selected Indicator */}
              {selectedPlan === plan.id && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-4 right-4 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center"
                >
                  <Check className="w-4 h-4 text-white" />
                </motion.div>
              )}

              {/* Plan Header */}
              <div className={`w-16 h-16 bg-gradient-to-br ${plan.gradient} rounded-2xl flex items-center justify-center mb-4 shadow-lg`}>
                <Zap className="w-8 h-8 text-white" />
              </div>

              <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
              
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                <span className="text-gray-500">/{plan.period}</span>
              </div>

              {/* Features */}
              <div className="space-y-3 mb-6">
                {plan.features.map((feature, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-gray-600">{feature}</p>
                  </div>
                ))}
              </div>

              {/* Select Button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`w-full py-3 rounded-xl font-bold transition-all ${
                  selectedPlan === plan.id
                    ? `bg-gradient-to-r ${plan.gradient} text-white shadow-lg`
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {selectedPlan === plan.id ? 'Selected' : 'Select Plan'}
              </motion.button>
            </motion.div>
          ))}
        </motion.div>

        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="max-w-3xl mx-auto"
        >
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 rounded-2xl p-8 mb-6">
            <h3 className="text-2xl font-bold text-gray-900 mb-4 text-center">
              Ready to Continue Your Journey?
            </h3>
            <p className="text-center text-gray-600 mb-6">
              You've selected the <strong>{selectedPlanData.name}</strong> plan at <strong>{selectedPlanData.price}/month</strong>
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/app/settings/account?tab=plan" className="flex-1">
                <motion.button
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  className={`w-full flex items-center justify-center gap-3 px-8 py-4 rounded-xl bg-gradient-to-r ${selectedPlanData.gradient} text-white font-bold shadow-lg hover:shadow-xl transition-all`}
                >
                  <TrendingUp className="w-5 h-5" />
                  Subscribe Now
                  <ArrowRight className="w-5 h-5" />
                </motion.button>
              </Link>
            </div>
          </div>

          {/* Trust Indicators */}
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl p-4 shadow-md text-center">
              <Shield className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-900">Secure Payment</p>
              <p className="text-xs text-gray-500">256-bit encryption</p>
            </div>
            
            <div className="bg-white rounded-xl p-4 shadow-md text-center">
              <Star className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-900">Cancel Anytime</p>
              <p className="text-xs text-gray-500">No commitments</p>
            </div>
            
            <div className="bg-white rounded-xl p-4 shadow-md text-center">
              <Check className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-900">30-Day Guarantee</p>
              <p className="text-xs text-gray-500">Money back if not satisfied</p>
            </div>
          </div>

          {/* Alternative Action */}
          <div className="text-center">
            <Link to="/app/dashboard">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white border-2 border-gray-200 hover:border-gray-300 text-gray-700 font-medium shadow-md transition-all"
              >
                <Home className="w-5 h-5" />
                View Dashboard (Limited Access)
              </motion.button>
            </Link>
            <p className="text-xs text-gray-500 mt-2">
              You can still access some features without a subscription
            </p>
          </div>
        </motion.div>

        {/* FAQ Section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-12 max-w-3xl mx-auto bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
        >
          <h3 className="font-bold text-gray-900 mb-4 text-center">Frequently Asked Questions</h3>
          
          <div className="space-y-4 text-sm">
            <div>
              <p className="font-medium text-gray-900 mb-1">Can I change my plan later?</p>
              <p className="text-gray-600">Yes! You can upgrade, downgrade, or cancel anytime from your account settings.</p>
            </div>
            
            <div>
              <p className="font-medium text-gray-900 mb-1">What happens to my data?</p>
              <p className="text-gray-600">All your journals, mood logs, and session history are preserved regardless of your plan.</p>
            </div>
            
            <div>
              <p className="font-medium text-gray-900 mb-1">Do you offer a trial?</p>
              <p className="text-gray-600">Yes! We offer a trial plan to help you get started with your wellness journey.</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
