import { OnboardingLayout } from "../../components/OnboardingLayout";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Label } from "../../components/ui/label";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowRight, ArrowLeft, Info, Shield } from "lucide-react";
import { useState } from "react";
import { useOnboarding } from "@/app/contexts/OnboardingContext";

export function OnboardingHealthBackground() {
  const navigate = useNavigate();
  const { data, updateData } = useOnboarding();
  const [inTherapy, setInTherapy] = useState<string>(data.inTherapy || "");
  const [onMedication, setOnMedication] = useState<string>(data.onMedication || "");
  const [selectedTriggers, setSelectedTriggers] = useState<string[]>(data.selectedTriggers || []);

  const triggers = [
    { value: "violence", label: "Violence" },
    { value: "self-harm", label: "Self-harm" },
    { value: "substance-abuse", label: "Substance Abuse" },
    { value: "eating-disorders", label: "Eating Disorders" },
    { value: "trauma", label: "Trauma/PTSD" },
    { value: "none", label: "None of the above" }
  ];

  const toggleTrigger = (value: string) => {
    if (value === "none") {
      setSelectedTriggers(["none"]);
    } else {
      setSelectedTriggers(prev => {
        const filtered = prev.filter(t => t !== "none");
        return filtered.includes(value)
          ? filtered.filter(t => t !== value)
          : [...filtered, value];
      });
    }
  };

  const handleContinue = () => {
    updateData({ inTherapy, onMedication, selectedTriggers });
    navigate("/onboarding/avatar-preferences");
  };

  return (
    <OnboardingLayout
      currentStep={4}
      totalSteps={8}
      title="Health Background"
      subtitle="This information helps us provide better support (all optional)"
    >
      <div className="space-y-6">
        {/* Privacy Notice */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="p-4 bg-blue-50 border-blue-200">
            <div className="flex gap-3">
              <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-blue-900 font-medium mb-1">Your Privacy Matters</p>
                <p className="text-xs text-blue-800">
                  All health information is encrypted and never shared. You can update or remove this anytime.
                </p>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Currently in Therapy */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="p-6 shadow-xl">
            <Label className="text-base mb-3 block">Are you currently working with a companion?</Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {["yes", "no", "prefer-not-to-say"].map((option, index) => (
                <motion.button
                  key={option}
                  type="button"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4 + index * 0.05 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setInTherapy(option)}
                  className={`p-4 rounded-lg border-2 transition-all capitalize ${
                    inTherapy === option
                      ? "border-primary bg-primary/10 font-semibold"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  {option === "prefer-not-to-say" ? "Prefer not to say" : option}
                </motion.button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3 flex items-start gap-2">
              <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>Ezri complements but doesn't replace professional companionship</span>
            </p>
          </Card>
        </motion.div>

        {/* Currently on Medication */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="p-6 shadow-xl">
            <Label className="text-base mb-3 block">Are you currently taking any mental health medication?</Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {["yes", "no", "prefer-not-to-say"].map((option, index) => (
                <motion.button
                  key={option}
                  type="button"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.6 + index * 0.05 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setOnMedication(option)}
                  className={`p-4 rounded-lg border-2 transition-all capitalize ${
                    onMedication === option
                      ? "border-primary bg-primary/10 font-semibold"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  {option === "prefer-not-to-say" ? "Prefer not to say" : option}
                </motion.button>
              ))}
            </div>
          </Card>
        </motion.div>

        {/* Content Warnings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <Card className="p-6 shadow-xl">
            <Label className="text-base mb-2 block">Content Warning Preferences</Label>
            <p className="text-sm text-muted-foreground mb-4">
              Select topics you'd like Ezri to handle with extra care
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {triggers.map((trigger, index) => (
                <motion.button
                  key={trigger.value}
                  type="button"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8 + index * 0.05 }}
                  whileHover={{ scale: 1.03, x: 5 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => toggleTrigger(trigger.value)}
                  className={`p-3 rounded-lg border-2 transition-all text-left ${
                    selectedTriggers.includes(trigger.value)
                      ? "border-primary bg-primary/10 shadow-md"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{trigger.label}</span>
                    {selectedTriggers.includes(trigger.value) && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-5 h-5 bg-primary rounded-full flex items-center justify-center"
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
          transition={{ delay: 1 }}
          className="flex gap-3"
        >
          <Link to="/onboarding/wellness-baseline" className="flex-1">
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

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1 }}
          className="text-center text-sm text-muted-foreground"
        >
          All fields are optional • You can skip this step
        </motion.p>
      </div>
    </OnboardingLayout>
  );
}
