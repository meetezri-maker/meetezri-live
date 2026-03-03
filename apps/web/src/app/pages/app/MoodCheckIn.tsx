import { AppLayout } from "../../components/AppLayout";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { motion } from "motion/react";
import { useNavigate } from "react-router-dom";
import {
  Heart,
  ArrowRight,
  CheckCircle,
  Sparkles,
  TrendingUp,
  Lock
} from "lucide-react";
import { useState } from "react";
import { api } from "../../../lib/api";
import { toast } from "sonner";

export function MoodCheckIn() {
  const navigate = useNavigate();
  const [selectedMood, setSelectedMood] = useState("");
  const [selectedIntensity, setSelectedIntensity] = useState(5);
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const moods = [
    { value: "happy", emoji: "😊", label: "Happy", color: "from-yellow-400 to-orange-500" },
    { value: "calm", emoji: "😌", label: "Calm", color: "from-blue-400 to-cyan-500" },
    { value: "anxious", emoji: "😰", label: "Anxious", color: "from-purple-400 to-pink-500" },
    { value: "sad", emoji: "😢", label: "Sad", color: "from-blue-500 to-indigo-600" },
    { value: "angry", emoji: "😠", label: "Angry", color: "from-red-500 to-orange-600" },
    { value: "tired", emoji: "😴", label: "Tired", color: "from-gray-400 to-gray-600" },
    { value: "excited", emoji: "🤩", label: "Excited", color: "from-pink-500 to-rose-600" },
    { value: "neutral", emoji: "😐", label: "Neutral", color: "from-gray-300 to-gray-500" }
  ];

  const activities = [
    { value: "work", label: "Work", emoji: "💼" },
    { value: "exercise", label: "Exercise", emoji: "🏃" },
    { value: "social", label: "Social", emoji: "👥" },
    { value: "rest", label: "Rest", emoji: "🛌" },
    { value: "hobby", label: "Hobby", emoji: "🎨" },
    { value: "family", label: "Family", emoji: "👨‍👩‍👧" }
  ];

  const toggleActivity = (value: string) => {
    if (selectedActivities.includes(value)) {
      setSelectedActivities(selectedActivities.filter((a) => a !== value));
    } else {
      setSelectedActivities([...selectedActivities, value]);
    }
  };

  const handleSubmit = async () => {
    if (!selectedMood) {
      toast.error("Please select a mood");
      return;
    }

    try {
      setIsSubmitting(true);
      await api.moods.create({
        mood: selectedMood,
        intensity: selectedIntensity,
        activities: selectedActivities,
        notes: notes || undefined,
      });

      setSubmitted(true);
      setTimeout(() => {
        navigate("/app/dashboard");
      }, 2000);
    } catch (error) {
      console.error(error);
      toast.error("Failed to submit mood check-in");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-20">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="text-center"
          >
            <motion.div
              animate={{
                scale: [1, 1.2, 1],
                rotate: [0, 360]
              }}
              transition={{ duration: 0.6 }}
              className="w-24 h-24 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center text-5xl mx-auto mb-6 shadow-2xl"
            >
              ✅
            </motion.div>
            <h2 className="text-3xl font-bold mb-4">Check-in Complete!</h2>
            <p className="text-muted-foreground mb-6">
              Thank you for sharing how you're feeling. Your mood has been recorded.
            </p>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <Card className="p-6 bg-gradient-to-r from-primary/10 to-secondary/10 border-primary/20 dark:from-primary/20 dark:to-secondary/20 dark:border-primary/30">
                <p className="text-sm">
                  💡 <span className="font-medium">Tip:</span> Regular check-ins help you understand your emotional patterns better
                </p>
              </Card>
            </motion.div>
          </motion.div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <Heart className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">Mood Check-In</h1>
          </div>
          <p className="text-muted-foreground">
            Take a moment to reflect on how you're feeling right now
          </p>
        </motion.div>

        <div className="space-y-6">
          {/* Mood Selection */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="p-6 shadow-xl">
              <Label className="text-lg mb-4 block">How are you feeling?</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {moods.map((mood, index) => (
                  <motion.button
                    key={mood.value}
                    type="button"
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 + index * 0.05 }}
                    whileHover={{ scale: 1.05, y: -5 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setSelectedMood(mood.value)}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      selectedMood === mood.value
                        ? "border-primary bg-primary/10 dark:bg-primary/20 shadow-lg"
                        : "border-border hover:border-primary/50 dark:hover:border-primary/50 bg-card dark:bg-card"
                    }`}
                  >
                    <motion.div
                      animate={
                        selectedMood === mood.value
                          ? { scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }
                          : {}
                      }
                      transition={{ duration: 0.5 }}
                      className="text-4xl mb-2"
                    >
                      {mood.emoji}
                    </motion.div>
                    <p className="font-semibold text-sm">{mood.label}</p>
                  </motion.button>
                ))}
              </div>
            </Card>
          </motion.div>

          {/* Intensity Slider */}
          {selectedMood && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="p-6 shadow-xl">
                <Label className="text-lg mb-4 block">
                  How intense is this feeling?
                </Label>
                <div className="space-y-4">
                  <div className="relative">
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={selectedIntensity}
                      onChange={(e) => setSelectedIntensity(parseInt(e.target.value))}
                      className="w-full h-3 bg-gradient-to-r from-blue-200 via-purple-300 to-pink-300 rounded-full appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, rgb(147 197 253) ${
                          (selectedIntensity - 1) * 11.11
                        }%, rgb(252 165 165) ${(selectedIntensity - 1) * 11.11}%)`
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Mild</span>
                    <motion.span
                      key={selectedIntensity}
                      initial={{ scale: 1.5, color: "#6366f1" }}
                      animate={{ scale: 1, color: "#64748b" }}
                      className="font-bold text-lg"
                    >
                      {selectedIntensity}
                    </motion.span>
                    <span>Intense</span>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          {/* Activities */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="p-6 shadow-xl">
              <Label className="text-lg mb-4 block">
                What have you been doing? (Optional)
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {activities.map((activity, index) => (
                  <motion.button
                    key={activity.value}
                    type="button"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + index * 0.05 }}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => toggleActivity(activity.value)}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      selectedActivities.includes(activity.value)
                        ? "border-primary bg-primary/10 dark:bg-primary/20"
                        : "border-border hover:border-primary/50 dark:hover:border-primary/50 bg-card dark:bg-card"
                    }`}
                  >
                    <div className="text-2xl mb-1">{activity.emoji}</div>
                    <p className="text-sm font-medium">{activity.label}</p>
                  </motion.button>
                ))}
              </div>
            </Card>
          </motion.div>

          {/* Notes */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="p-6 shadow-xl">
              <Label className="text-lg mb-4 block">
                Any additional notes? (Optional)
              </Label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What's on your mind? You can write freely here..."
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none bg-background dark:bg-gray-800 text-foreground"
              />
            </Card>
          </motion.div>

          {/* Insight Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <Card className="p-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-blue-200 dark:border-blue-800">
              <div className="flex items-start gap-3">
                <Sparkles className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-bold mb-2">Quick Insight</h3>
                  <p className="text-sm text-muted-foreground">
                    You've checked in 12 times this month! Your most common mood is "Calm" 😌
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Submit Button */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                onClick={handleSubmit}
                disabled={!selectedMood || isSubmitting}
                isLoading={isSubmitting}
                className="w-full h-14 text-lg group relative overflow-hidden"
              >
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-secondary to-accent"
                  initial={{ x: "-100%" }}
                  whileHover={{ x: 0 }}
                  transition={{ duration: 0.3 }}
                />
                <span className="relative z-10 flex items-center justify-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  Complete Check-In
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </span>
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </AppLayout>
  );
}