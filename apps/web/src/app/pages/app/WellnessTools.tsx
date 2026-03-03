import { AppLayout } from "../../components/AppLayout";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { motion, AnimatePresence } from "motion/react";
import { EzriGuidedMode } from "../../components/modals";
import {
  Heart,
  Wind,
  Brain,
  Music,
  Coffee,
  Sun,
  Moon,
  Smile,
  Play,
  Pause,
  RotateCcw,
  X,
  Clock,
  Star,
  Sparkles,
  Lock
} from "lucide-react";
import { useState, useEffect } from "react";
import { api } from "../../../lib/api";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "../../components/ui/skeleton";

export function WellnessTools() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  // Feature Gate for Trial Users
  if (profile?.subscription_plan === 'trial') {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-slate-200">
            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Wellness Tools are a Core Feature</h2>
            <p className="text-slate-600 max-w-md mx-auto mb-8">
              Upgrade to Core or Pro to unlock the full library of wellness exercises and tools.
            </p>
            <Button onClick={() => navigate('/app/billing')}>
              View Plans
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  const [activeExercise, setActiveExercise] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [timer, setTimer] = useState(0);
  const [breathPhase, setBreathPhase] = useState<"inhale" | "hold" | "exhale" | "hold2">("inhale");
  const [phaseTimer, setPhaseTimer] = useState(0);
  const [guidedExercise, setGuidedExercise] = useState<string | null>(null);
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);
  const [exercises, setExercises] = useState<any[]>([]);
  const [progress, setProgress] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  const iconMap: any = { Wind, Brain, Music, Smile, Sun, Moon, Star, Sparkles, Heart };
  const colorMap: any = {
    Breathing: "from-blue-400 to-cyan-500",
    Meditation: "from-purple-400 to-pink-500",
    Sounds: "from-green-400 to-emerald-500",
    Gratitude: "from-amber-400 to-orange-500"
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [toolsRes, progressRes] = await Promise.all([
          api.wellness.getAll(),
          api.wellness.getProgress()
        ]);

        const publishedTools = toolsRes.filter((t: any) => !t.status || t.status === "published");

        const mappedTools = publishedTools.map((t: any) => ({
          id: t.id,
          category: t.category,
          title: t.title,
          description: t.description || "",
          duration: t.duration_minutes ? `${t.duration_minutes} min` : "∞",
          difficulty: t.difficulty || "Beginner",
          icon: iconMap[t.icon || "Sparkles"] || Sparkles,
          color: colorMap[t.category] || "from-indigo-400 to-purple-500",
          favorite: t.is_favorite || false
        }));

        setExercises(mappedTools);
        setProgress(progressRes);
      } catch (error) {
        console.error("Failed to fetch wellness data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, []);

  const categories = [
    { icon: Wind, label: "Breathing", color: "from-blue-400 to-cyan-500" },
    { icon: Brain, label: "Meditation", color: "from-purple-400 to-pink-500" },
    { icon: Music, label: "Sounds", color: "from-green-400 to-emerald-500" },
    { icon: Smile, label: "Gratitude", color: "from-amber-400 to-orange-500" }
  ];

  const stats = [
    { 
      label: "Completed Sessions", 
      value: progress.reduce((acc, curr) => acc + curr.sessionsCompleted, 0).toString(), 
      icon: Star 
    },
    { 
      label: "Total Minutes", 
      value: progress.reduce((acc, curr) => acc + curr.totalMinutes, 0).toString(), 
      icon: Clock 
    },
    { 
      label: "Exercises Tried", 
      value: progress.length.toString(), 
      icon: Heart 
    }
  ];

  const handleStartExercise = async (exerciseId: string) => {
    setActiveExercise(exerciseId);
    setIsPlaying(true);
    setTimer(0);
    setBreathPhase("inhale");
    setPhaseTimer(0);
    
    // Start session in backend
    try {
      const session = await api.wellness.startSession(exerciseId);
      if (session && session.id) {
        setCurrentSessionId(session.id);
      }
    } catch (error) {
      console.error("Failed to start wellness session:", error);
    }
  };

  const handleToggleFavorite = async (exerciseId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await api.wellness.toggleFavorite(exerciseId);
      setExercises(prev => prev.map(ex => 
        ex.id === exerciseId ? { ...ex, favorite: !ex.favorite } : ex
      ));
    } catch (error) {
      console.error("Failed to toggle wellness favorite:", error);
    }
  };

  const handleCloseExercise = () => {
    // Capture current state before clearing
    const exerciseId = activeExercise;
    const timeSpent = timer;
    const sessionId = currentSessionId;

    setActiveExercise(null);
    setIsPlaying(false);
    setTimer(0);
    setBreathPhase("inhale");
    setPhaseTimer(0);
    setCurrentSessionId(null);

    // Track progress if meaningful time spent (e.g. > 10 seconds)
    if (exerciseId && timeSpent > 10) {
      const promise = sessionId 
        ? api.wellness.completeSession(sessionId, { duration_spent: timeSpent })
        : api.wellness.trackProgress(exerciseId, { duration_spent: timeSpent });

      promise
        .then(() => {
          return api.wellness.getProgress();
        })
        .then(setProgress)
        .catch(err => console.error("Failed to track progress on close:", err));
    }
  };

  const activeExerciseData = exercises.find((ex) => ex.id === activeExercise);

  useEffect(() => {
    if (isPlaying && activeExerciseData) {
      const interval = setInterval(() => {
        setTimer((prevTimer) => prevTimer + 1);
        setPhaseTimer((prevPhaseTimer) => prevPhaseTimer + 1);

        const duration = parseInt(activeExerciseData.duration.replace(" min", ""), 10) * 60;

        if (timer >= duration) {
          setIsPlaying(false);
          setTimer(0);
          setBreathPhase("inhale");
          setPhaseTimer(0);
          
          // Track progress
          if (activeExercise) {
            const promise = currentSessionId
              ? api.wellness.completeSession(currentSessionId, { duration_spent: duration })
              : api.wellness.trackProgress(activeExercise, { duration_spent: duration });

            promise
              .then(() => {
                // Refresh progress
                setCurrentSessionId(null);
                return api.wellness.getProgress();
              })
              .then(setProgress)
              .catch(err => console.error("Failed to track progress:", err));
          }
        }

        if (breathPhase === "inhale" && phaseTimer >= 4) {
          setBreathPhase("hold");
          setPhaseTimer(0);
        } else if (breathPhase === "hold" && phaseTimer >= 4) {
          setBreathPhase("exhale");
          setPhaseTimer(0);
        } else if (breathPhase === "exhale" && phaseTimer >= 4) {
          setBreathPhase("hold2");
          setPhaseTimer(0);
        } else if (breathPhase === "hold2" && phaseTimer >= 4) {
          setBreathPhase("inhale");
          setPhaseTimer(0);
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [isPlaying, activeExerciseData, timer, breathPhase, phaseTimer]);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="mb-8">
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-80" />
          </div>
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[0, 1, 2].map((i) => (
              <Card key={i} className="p-4 text-center">
                <Skeleton className="w-6 h-6 rounded-full mx-auto mb-2" />
                <Skeleton className="h-5 w-16 mx-auto mb-1" />
                <Skeleton className="h-3 w-24 mx-auto" />
              </Card>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {[0, 1, 2, 3].map((i) => (
              <Card key={i} className="p-4">
                <div className="flex gap-3">
                  <Skeleton className="w-12 h-12 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <Heart className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">Wellness Tools</h1>
          </div>
          <p className="text-muted-foreground">
            Guided exercises to support your mental wellbeing
          </p>
        </motion.div>

        <div className="grid grid-cols-3 gap-4 mb-8">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + index * 0.05 }}
              >
                <Card className="p-4 text-center shadow-lg">
                  <Icon className="w-6 h-6 text-primary mx-auto mb-2" />
                  <div className="text-2xl font-bold mb-1">{stat.value}</div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Progress Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-4">
             <h2 className="text-xl font-bold">Detailed Progress</h2>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
             {isLoading ? (
               <p className="text-gray-500 text-center py-4">Loading progress...</p>
             ) : progress.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No exercises completed yet. Start one today!</p>
             ) : (
                <div className="space-y-4">
                  {progress.map((p) => (
                    <div key={p.toolId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                           <Star className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{p.toolTitle}</p>
                          <p className="text-sm text-gray-500">{p.sessionsCompleted} sessions completed</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">{p.totalMinutes} min</p>
                        <p className="text-xs text-gray-500">Total Time</p>
                      </div>
                    </div>
                  ))}
                </div>
             )}
          </div>
        </motion.div>

        {/* Categories */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <h2 className="text-xl font-bold mb-4">Categories</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {categories.map((category, index) => {
              const Icon = category.icon;
              return (
                <motion.button
                  key={category.label}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 + index * 0.05 }}
                  whileHover={{ scale: 1.05, y: -5 }}
                  whileTap={{ scale: 0.95 }}
                  className={`p-6 rounded-xl bg-gradient-to-br ${category.color} text-white shadow-lg`}
                >
                  <Icon className="w-8 h-8 mb-2 mx-auto" />
                  <p className="font-bold">{category.label}</p>
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        {/* Exercises Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">
              {showOnlyFavorites ? "Favorite Exercises" : "All Exercises"}
            </h2>
            <button 
              onClick={() => setShowOnlyFavorites(!showOnlyFavorites)}
              className="text-sm text-primary font-medium hover:underline flex items-center gap-1"
            >
              {showOnlyFavorites ? (
                <>
                  <X className="w-4 h-4" />
                  Show All
                </>
              ) : (
                <>
                  <Heart className="w-4 h-4" />
                  View Favorites
                </>
              )}
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(showOnlyFavorites ? exercises.filter(ex => ex.favorite) : exercises).map((exercise, index) => {
              const Icon = exercise.icon;
              return (
                <motion.div
                  key={exercise.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + index * 0.05 }}
                  whileHover={{ y: -5 }}
                >
                  <Card className="p-5 shadow-lg hover:shadow-xl transition-all group cursor-pointer">
                    <div className="flex items-start justify-between mb-3">
                      <motion.div
                        whileHover={{ rotate: 10, scale: 1.1 }}
                        className={`p-3 rounded-xl bg-gradient-to-br ${exercise.color} text-white`}
                      >
                        <Icon className="w-6 h-6" />
                      </motion.div>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => handleToggleFavorite(exercise.id, e)}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors z-10"
                      >
                        <Heart className={`w-5 h-5 ${exercise.favorite ? "text-red-500 fill-red-500" : "text-gray-300"}`} />
                      </motion.button>
                    </div>
                    <h3 className="font-bold mb-2 group-hover:text-primary transition-colors">
                      {exercise.title}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                      {exercise.description}
                    </p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {exercise.duration}
                      </div>
                      <div className="px-2 py-1 bg-gray-100 rounded-full">
                        {exercise.difficulty}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => setGuidedExercise(exercise.id)}
                        variant="outline"
                        className="flex-1 group/ezri border-2 border-purple-200 hover:border-purple-400 hover:bg-purple-50"
                        size="sm"
                      >
                        <Sparkles className="w-4 h-4 mr-2 text-purple-600 group-hover/ezri:scale-110 transition-transform" />
                        <span className="text-purple-700 font-medium">Ezri</span>
                      </Button>
                      <Button
                        onClick={() => handleStartExercise(exercise.id)}
                        className="flex-1 group/btn"
                        size="sm"
                      >
                        <Play className="w-4 h-4 mr-2 group-hover/btn:scale-110 transition-transform" />
                        Start
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Exercise Player Modal */}
        <AnimatePresence>
          {activeExercise && activeExerciseData && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleCloseExercise}
                className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="fixed inset-4 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-lg z-50"
              >
                <Card
                  className={`p-8 shadow-2xl bg-gradient-to-br ${activeExerciseData.color} text-white relative overflow-hidden`}
                >
                  {/* Animated Background */}
                  <motion.div
                    animate={{
                      scale: [1, 1.2, 1],
                      opacity: [0.3, 0.5, 0.3]
                    }}
                    transition={{ duration: 4, repeat: Infinity }}
                    className="absolute -top-20 -right-20 w-60 h-60 bg-white/20 rounded-full blur-3xl"
                  />
                  <motion.div
                    animate={{
                      scale: [1, 1.3, 1],
                      opacity: [0.2, 0.4, 0.2]
                    }}
                    transition={{ duration: 5, repeat: Infinity }}
                    className="absolute -bottom-20 -left-20 w-60 h-60 bg-white/20 rounded-full blur-3xl"
                  />

                  <div className="relative z-10">
                    <motion.button
                      whileHover={{ scale: 1.1, rotate: 90 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={handleCloseExercise}
                      className="absolute top-0 right-0 p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </motion.button>

                    <div className="text-center mb-8">
                      <motion.div
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="w-24 h-24 mx-auto mb-4 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm"
                      >
                        <activeExerciseData.icon className="w-12 h-12" />
                      </motion.div>
                      <h2 className="text-2xl font-bold mb-2">{activeExerciseData.title}</h2>
                      <p className="text-white/90">{activeExerciseData.description}</p>
                    </div>

                    {/* Breathing Animation */}
                    <div className="flex flex-col items-center justify-center mb-8">
                      <motion.div
                        animate={{
                          scale: breathPhase === "inhale" || breathPhase === "hold" ? 1.8 : 1,
                        }}
                        transition={{
                          duration: breathPhase === "inhale" ? 4 : breathPhase === "exhale" ? 4 : 0.5,
                          ease: "easeInOut"
                        }}
                        className="w-40 h-40 rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center relative"
                      >
                        <motion.div
                          animate={{
                            scale: breathPhase === "inhale" || breathPhase === "hold" ? 1.2 : 0.6,
                          }}
                          transition={{
                            duration: breathPhase === "inhale" ? 4 : breathPhase === "exhale" ? 4 : 0.5,
                            ease: "easeInOut"
                          }}
                          className="w-28 h-28 rounded-full bg-white/60 flex items-center justify-center"
                        >
                          <motion.div
                            animate={{
                              scale: breathPhase === "inhale" || breathPhase === "hold" ? 1 : 0.5,
                            }}
                            transition={{
                              duration: breathPhase === "inhale" ? 4 : breathPhase === "exhale" ? 4 : 0.5,
                              ease: "easeInOut"
                            }}
                            className="w-16 h-16 rounded-full bg-white/80"
                          />
                        </motion.div>
                      </motion.div>
                      
                      {/* Breath Phase Indicator */}
                      <motion.div
                        key={breathPhase}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-6 text-center"
                      >
                        <div className="text-2xl font-bold mb-1">
                          {breathPhase === "inhale" && "Breathe In"}
                          {breathPhase === "hold" && "Hold"}
                          {breathPhase === "exhale" && "Breathe Out"}
                          {breathPhase === "hold2" && "Hold"}
                        </div>
                        <div className="text-sm text-white/70">
                          {4 - phaseTimer} seconds
                        </div>
                      </motion.div>
                    </div>

                    {/* Timer */}
                    <div className="text-center mb-6">
                      <div className="text-4xl font-bold mb-2">
                        {Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, "0")}
                      </div>
                      <p className="text-white/80 text-sm">
                        {isPlaying ? "Stay focused on your breath" : "Ready to begin"}
                      </p>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center justify-center gap-4">
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setTimer(0)}
                        className="p-4 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                      >
                        <RotateCcw className="w-5 h-5" />
                      </motion.button>

                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setIsPlaying(!isPlaying)}
                        className="p-6 rounded-full bg-white text-primary shadow-lg hover:shadow-xl transition-all"
                      >
                        {isPlaying ? (
                          <Pause className="w-8 h-8" />
                        ) : (
                          <Play className="w-8 h-8" />
                        )}
                      </motion.button>

                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => handleToggleFavorite(activeExerciseData.id, e)}
                        className="p-4 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                      >
                        <Heart className={`w-5 h-5 ${activeExerciseData.favorite ? "text-red-500 fill-red-500" : "text-white"}`} />
                      </motion.button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Ezri Guided Mode */}
      {guidedExercise && exercises.find(ex => ex.id === guidedExercise) && (
        <EzriGuidedMode
          isOpen={!!guidedExercise}
          onClose={() => setGuidedExercise(null)}
          exerciseTitle={exercises.find(ex => ex.id === guidedExercise)!.title}
          exerciseDescription={exercises.find(ex => ex.id === guidedExercise)!.description}
          exerciseColor={exercises.find(ex => ex.id === guidedExercise)!.color}
          exerciseIcon={exercises.find(ex => ex.id === guidedExercise)!.icon}
          duration={exercises.find(ex => ex.id === guidedExercise)!.duration}
        />
      )}
    </AppLayout>
  );
}
