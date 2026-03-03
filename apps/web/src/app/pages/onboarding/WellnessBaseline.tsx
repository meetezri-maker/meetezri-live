import { OnboardingLayout } from "../../components/OnboardingLayout";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowRight, ArrowLeft, Smile, Frown, Meh, Laugh, Angry } from "lucide-react";
import { useState } from "react";
import { useOnboarding } from "@/app/contexts/OnboardingContext";

export function OnboardingWellnessBaseline() {
  const navigate = useNavigate();
  const { data, updateData } = useOnboarding();
  const [currentMood, setCurrentMood] = useState(data.currentMood || "");
  const [selectedGoals, setSelectedGoals] = useState<string[]>(data.selectedGoals || []);

  const moods = [
    { value: "great", label: "Great", icon: Laugh, color: "text-green-500", bg: "bg-green-50" },
    { value: "good", label: "Good", icon: Smile, color: "text-blue-500", bg: "bg-blue-50" },
    { value: "okay", label: "Okay", icon: Meh, color: "text-yellow-500", bg: "bg-yellow-50" },
    { value: "down", label: "Down", icon: Frown, color: "text-orange-500", bg: "bg-orange-50" },
    { value: "struggling", label: "Struggling", icon: Angry, color: "text-red-500", bg: "bg-red-50" }
  ];

  const goals = [
    { value: "reduce-stress", label: "Reduce Stress", emoji: "🧘" },
    { value: "manage-anxiety", label: "Manage Anxiety", emoji: "💭" },
    { value: "improve-sleep", label: "Improve Sleep", emoji: "😴" },
    { value: "boost-mood", label: "Boost Mood", emoji: "✨" },
    { value: "build-confidence", label: "Build Confidence", emoji: "💪" },
    { value: "work-life-balance", label: "Work-Life Balance", emoji: "⚖️" },
    { value: "relationship-support", label: "Relationship Support", emoji: "❤️" },
    { value: "grief-loss", label: "Grief & Loss", emoji: "🕊️" }
  ];

  const toggleGoal = (value: string) => {
    setSelectedGoals(prev =>
      prev.includes(value)
        ? prev.filter(g => g !== value)
        : [...prev, value]
    );
  };

  const handleContinue = () => {
    updateData({ currentMood, selectedGoals });
    navigate("/onboarding/avatar-preferences");
  };

  return (
    <OnboardingLayout
      currentStep={3}
      totalSteps={8}
      title="How Are You Feeling Today?"
      subtitle="This helps us understand where to focus our support"
      showBack={true}
      onBack={() => navigate("/onboarding/subscription")}
    >
      <div className="space-y-8">
        {/* Current Mood */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="p-6 shadow-xl">
            <h3 className="font-semibold mb-4 text-center">How would you describe your mood right now?</h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {moods.map((mood, index) => {
                const Icon = mood.icon;
                return (
                  <motion.button
                    key={mood.value}
                    type="button"
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 + index * 0.05 }}
                    whileHover={{ scale: 1.1, y: -5 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setCurrentMood(mood.value)}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      currentMood === mood.value
                        ? `border-primary ${mood.bg} shadow-lg`
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <Icon className={`w-8 h-8 ${mood.color} mx-auto mb-2`} />
                    <p className="text-xs font-medium">{mood.label}</p>
                  </motion.button>
                );
              })}
            </div>
          </Card>
        </motion.div>

        {/* Wellness Goals */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="p-6 shadow-xl">
            <h3 className="font-semibold mb-2 text-center">What would you like to work on?</h3>
            <p className="text-sm text-muted-foreground text-center mb-4">
              Select all that apply
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {goals.map((goal, index) => (
                <motion.button
                  key={goal.value}
                  type="button"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 + index * 0.05 }}
                  whileHover={{ scale: 1.03, x: 5 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => toggleGoal(goal.value)}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    selectedGoals.includes(goal.value)
                      ? "border-primary bg-primary/10 shadow-md"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{goal.emoji}</span>
                    <span className="font-medium">{goal.label}</span>
                    {selectedGoals.includes(goal.value) && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="ml-auto w-5 h-5 bg-primary rounded-full flex items-center justify-center"
                      >
                        <span className="text-white text-xs">✓</span>
                      </motion.div>
                    )}
                  </div>
                </motion.button>
              ))}
            </div>
          </Card>
        </motion.div>

        {/* Navigation */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="flex gap-3"
        >
          <Link to="/onboarding/profile" className="flex-1">
            <Button type="button" variant="outline" className="w-full group">
              <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
              Back
            </Button>
          </Link>

          <div className="flex-1">
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button 
                onClick={handleContinue}
                className="w-full group relative overflow-hidden"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  Continue
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </span>
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-accent to-secondary"
                  initial={{ x: "-100%" }}
                  whileHover={{ x: 0 }}
                  transition={{ duration: 0.3 }}
                />
              </Button>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </OnboardingLayout>
  );
}
