import { useState } from "react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { motion, AnimatePresence } from "motion/react";
import {
  Dumbbell,
  Plus,
  Edit,
  Trash2,
  Eye,
  Search,
  Clock,
  Target,
  TrendingUp,
  Users,
  Star,
  Play,
  CheckCircle,
  X,
  Heart,
  Zap,
  Activity,
  Save,
} from "lucide-react";

interface Exercise {
  id: number;
  name: string;
  category: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  duration: string;
  description: string;
  benefits: string[];
  steps: string[];
  completions: number;
  avgRating: number;
  tags: string[];
  videoUrl?: string;
  audioUrl?: string;
}

export function ExerciseLibrary() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterDifficulty, setFilterDifficulty] = useState<string>("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // Modal states
  const [playModalExercise, setPlayModalExercise] = useState<Exercise | null>(null);
  const [editModalExercise, setEditModalExercise] = useState<Exercise | null>(null);
  const [deleteModalExercise, setDeleteModalExercise] = useState<Exercise | null>(null);

  const exercises: Exercise[] = [
    {
      id: 1,
      name: "Box Breathing Technique",
      category: "Breathing",
      difficulty: "beginner",
      duration: "5 min",
      description: "A simple but powerful breathing technique to reduce stress and anxiety",
      benefits: ["Reduces stress", "Improves focus", "Lowers heart rate"],
      steps: [
        "Breathe in for 4 counts",
        "Hold for 4 counts",
        "Breathe out for 4 counts",
        "Hold for 4 counts",
        "Repeat for 5 minutes"
      ],
      completions: 12456,
      avgRating: 4.8,
      tags: ["breathing", "stress-relief", "anxiety"],
    },
    {
      id: 2,
      name: "Progressive Muscle Relaxation",
      category: "Relaxation",
      difficulty: "beginner",
      duration: "15 min",
      description: "Systematically tense and relax different muscle groups to release physical tension",
      benefits: ["Reduces muscle tension", "Promotes relaxation", "Improves sleep"],
      steps: [
        "Find a comfortable position",
        "Start with your feet - tense for 5 seconds",
        "Release and relax for 10 seconds",
        "Move up through each muscle group",
        "End with facial muscles"
      ],
      completions: 8923,
      avgRating: 4.7,
      tags: ["relaxation", "tension-relief", "sleep"],
    },
    {
      id: 3,
      name: "Guided Body Scan Meditation",
      category: "Meditation",
      difficulty: "intermediate",
      duration: "20 min",
      description: "A mindfulness practice to increase body awareness and release tension",
      benefits: ["Increases body awareness", "Reduces stress", "Promotes mindfulness"],
      steps: [
        "Lie down in a comfortable position",
        "Close your eyes and take deep breaths",
        "Bring attention to your toes",
        "Slowly move attention through your body",
        "Notice sensations without judgment"
      ],
      completions: 6734,
      avgRating: 4.9,
      tags: ["meditation", "body-scan", "mindfulness"],
    },
    {
      id: 4,
      name: "4-7-8 Breathing",
      category: "Breathing",
      difficulty: "beginner",
      duration: "3 min",
      description: "A natural tranquilizer for the nervous system",
      benefits: ["Reduces anxiety", "Aids sleep", "Manages stress response"],
      steps: [
        "Exhale completely through your mouth",
        "Inhale through nose for 4 counts",
        "Hold breath for 7 counts",
        "Exhale through mouth for 8 counts",
        "Repeat 4 times"
      ],
      completions: 15234,
      avgRating: 4.6,
      tags: ["breathing", "sleep", "anxiety"],
    },
    {
      id: 5,
      name: "Loving-Kindness Meditation",
      category: "Meditation",
      difficulty: "intermediate",
      duration: "10 min",
      description: "Cultivate compassion for yourself and others",
      benefits: ["Increases empathy", "Reduces self-criticism", "Improves mood"],
      steps: [
        "Sit comfortably and close your eyes",
        "Focus on your heart center",
        "Repeat: 'May I be happy, may I be healthy'",
        "Extend wishes to loved ones",
        "Finally, extend to all beings"
      ],
      completions: 5678,
      avgRating: 4.8,
      tags: ["meditation", "compassion", "self-love"],
    },
    {
      id: 6,
      name: "Grounding 5-4-3-2-1 Technique",
      category: "Grounding",
      difficulty: "beginner",
      duration: "5 min",
      description: "Use your senses to anchor yourself in the present moment",
      benefits: ["Reduces anxiety", "Stops panic attacks", "Increases present-moment awareness"],
      steps: [
        "Name 5 things you can see",
        "Name 4 things you can touch",
        "Name 3 things you can hear",
        "Name 2 things you can smell",
        "Name 1 thing you can taste"
      ],
      completions: 11234,
      avgRating: 4.9,
      tags: ["grounding", "anxiety", "panic-relief"],
    },
    {
      id: 7,
      name: "Alternate Nostril Breathing",
      category: "Breathing",
      difficulty: "advanced",
      duration: "10 min",
      description: "Balance the left and right hemispheres of the brain",
      benefits: ["Calms the mind", "Balances energy", "Improves focus"],
      steps: [
        "Sit in a comfortable position",
        "Use thumb to close right nostril",
        "Inhale through left nostril",
        "Close left nostril, exhale through right",
        "Continue alternating for 10 minutes"
      ],
      completions: 3421,
      avgRating: 4.7,
      tags: ["breathing", "balance", "focus"],
    },
    {
      id: 8,
      name: "Mindful Walking",
      category: "Movement",
      difficulty: "beginner",
      duration: "15 min",
      description: "Turn walking into a meditation practice",
      benefits: ["Increases mindfulness", "Gentle exercise", "Reduces rumination"],
      steps: [
        "Walk at a slower pace than usual",
        "Focus on the sensation of each step",
        "Notice the movement of your body",
        "When mind wanders, gently return focus",
        "Continue for 15 minutes"
      ],
      completions: 7892,
      avgRating: 4.5,
      tags: ["mindfulness", "walking", "meditation"],
    },
  ];

  const filteredExercises = exercises.filter((exercise) => {
    const matchesSearch =
      exercise.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      exercise.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      exercise.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = filterCategory === "all" || exercise.category === filterCategory;
    const matchesDifficulty = filterDifficulty === "all" || exercise.difficulty === filterDifficulty;
    return matchesSearch && matchesCategory && matchesDifficulty;
  });

  const stats = {
    total: exercises.length,
    beginner: exercises.filter((e) => e.difficulty === "beginner").length,
    intermediate: exercises.filter((e) => e.difficulty === "intermediate").length,
    advanced: exercises.filter((e) => e.difficulty === "advanced").length,
    totalCompletions: exercises.reduce((sum, e) => sum + e.completions, 0),
    avgRating: (exercises.reduce((sum, e) => sum + e.avgRating, 0) / exercises.length).toFixed(1),
  };

  const categories = ["Breathing", "Meditation", "Relaxation", "Grounding", "Movement", "Stretching"];

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "beginner":
        return "bg-green-100 text-green-700 border-green-300";
      case "intermediate":
        return "bg-yellow-100 text-yellow-700 border-yellow-300";
      case "advanced":
        return "bg-red-100 text-red-700 border-red-300";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "Breathing":
        return Zap;
      case "Meditation":
        return Heart;
      case "Relaxation":
        return Activity;
      case "Grounding":
        return Target;
      case "Movement":
        return Dumbbell;
      default:
        return Star;
    }
  };

  return (
    <AdminLayoutNew>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center shadow-lg">
                <Dumbbell className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Exercise Library</h1>
                <p className="text-muted-foreground">
                  Manage wellness exercises and therapeutic practices
                </p>
              </div>
            </div>
            <Button className="gap-2" onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4" />
              Add Exercise
            </Button>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Exercises</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <Dumbbell className="w-8 h-8 text-primary" />
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Beginner</p>
                  <p className="text-2xl font-bold text-green-600">{stats.beginner}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Intermediate</p>
                  <p className="text-2xl font-bold text-yellow-600">{stats.intermediate}</p>
                </div>
                <Target className="w-8 h-8 text-yellow-500" />
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Advanced</p>
                  <p className="text-2xl font-bold text-red-600">{stats.advanced}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-red-500" />
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Completions</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {(stats.totalCompletions / 1000).toFixed(1)}K
                  </p>
                </div>
                <Users className="w-8 h-8 text-blue-500" />
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Avg Rating</p>
                  <p className="text-2xl font-bold text-yellow-600">{stats.avgRating}</p>
                </div>
                <Star className="w-8 h-8 text-yellow-500" />
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search exercises..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <select
                  className="px-3 py-2 border rounded-lg"
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                >
                  <option value="all">All Categories</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <select
                  className="px-3 py-2 border rounded-lg"
                  value={filterDifficulty}
                  onChange={(e) => setFilterDifficulty(e.target.value)}
                >
                  <option value="all">All Difficulty</option>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Exercises Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredExercises.map((exercise, index) => {
            const CategoryIcon = getCategoryIcon(exercise.category);
            return (
              <motion.div
                key={exercise.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + index * 0.05 }}
              >
                <Card className="p-6 hover:shadow-lg transition-shadow">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <CategoryIcon className="w-5 h-5 text-primary" />
                        <h3 className="font-bold text-lg">{exercise.name}</h3>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-3 py-1 bg-blue-100 text-blue-700 border border-blue-300 rounded-full text-xs font-medium">
                          {exercise.category}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getDifficultyColor(exercise.difficulty)}`}>
                          {exercise.difficulty}
                        </span>
                        <span className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="w-4 h-4" />
                          {exercise.duration}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setPlayModalExercise(exercise)}>
                        <Play className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setEditModalExercise(exercise)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-muted-foreground mb-4">{exercise.description}</p>

                  {/* Benefits */}
                  <div className="mb-4">
                    <p className="text-sm font-medium mb-2">Benefits:</p>
                    <div className="flex flex-wrap gap-2">
                      {exercise.benefits.map((benefit, i) => (
                        <span
                          key={i}
                          className="px-2 py-1 bg-green-50 text-green-700 rounded text-xs"
                        >
                          ✓ {benefit}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Steps */}
                  <div className="mb-4">
                    <p className="text-sm font-medium mb-2">Steps:</p>
                    <ol className="space-y-1 text-sm text-muted-foreground">
                      {exercise.steps.map((step, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="font-medium">{i + 1}.</span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {exercise.tags.map((tag, i) => (
                      <span
                        key={i}
                        className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>

                  {/* Stats */}
                  <div className="border-t pt-4 mb-4">
                    <div className="grid grid-cols-2 gap-4 text-center">
                      <div>
                        <p className="text-xl font-bold text-blue-600">
                          {exercise.completions.toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">Completions</p>
                      </div>
                      <div>
                        <div className="flex items-center justify-center gap-1">
                          <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                          <p className="text-xl font-bold text-yellow-600">{exercise.avgRating}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">Rating</p>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => setEditModalExercise(exercise)}>
                      Edit Exercise
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setDeleteModalExercise(exercise)}>
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Empty State */}
        {filteredExercises.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <Dumbbell className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-bold text-xl mb-2">No Exercises Found</h3>
            <p className="text-muted-foreground mb-4">
              No exercises match the current filters
            </p>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Exercise
            </Button>
          </motion.div>
        )}

        {/* Create/Add Exercise Modal */}
        <AnimatePresence>
          {showCreateModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={() => setShowCreateModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center">
                      <Plus className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">Add New Exercise</h2>
                      <p className="text-sm text-muted-foreground">Create a new wellness exercise</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCreateModal(false)}
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Exercise Name</label>
                    <Input placeholder="e.g., Box Breathing Technique" />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Category</label>
                      <select className="w-full px-3 py-2 border rounded-lg">
                        {categories.map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Difficulty</label>
                      <select className="w-full px-3 py-2 border rounded-lg">
                        <option value="beginner">Beginner</option>
                        <option value="intermediate">Intermediate</option>
                        <option value="advanced">Advanced</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Duration</label>
                    <Input placeholder="e.g., 5 min" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Description</label>
                    <textarea
                      className="w-full p-3 border rounded-lg"
                      rows={3}
                      placeholder="Brief description of the exercise..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Benefits (one per line)</label>
                    <textarea
                      className="w-full p-3 border rounded-lg"
                      rows={3}
                      placeholder="Reduces stress&#10;Improves focus&#10;Lowers heart rate"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Steps (one per line)</label>
                    <textarea
                      className="w-full p-3 border rounded-lg"
                      rows={5}
                      placeholder="Breathe in for 4 counts&#10;Hold for 4 counts&#10;Breathe out for 4 counts..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Tags (comma-separated)</label>
                    <Input placeholder="breathing, stress-relief, anxiety" />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setShowCreateModal(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="flex-1 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white"
                      onClick={() => {
                        alert("Exercise created successfully!");
                        setShowCreateModal(false);
                      }}
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Create Exercise
                    </Button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Play/View Exercise Modal */}
        <AnimatePresence>
          {playModalExercise && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={() => setPlayModalExercise(null)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-start justify-between mb-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      {(() => {
                        const CategoryIcon = getCategoryIcon(playModalExercise.category);
                        return (
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center">
                            <CategoryIcon className="w-6 h-6 text-white" />
                          </div>
                        );
                      })()}
                      <div>
                        <span className="px-3 py-1 bg-blue-100 text-blue-700 border border-blue-300 rounded-full text-xs font-medium">
                          {playModalExercise.category}
                        </span>
                        <span className={`ml-2 px-3 py-1 rounded-full text-xs font-medium border ${getDifficultyColor(playModalExercise.difficulty)}`}>
                          {playModalExercise.difficulty}
                        </span>
                      </div>
                    </div>
                    <h2 className="text-2xl font-bold mb-2">{playModalExercise.name}</h2>
                    <p className="text-muted-foreground flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      {playModalExercise.duration}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPlayModalExercise(null)}
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>

                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-medium mb-2">Description</h3>
                    <p className="text-muted-foreground">{playModalExercise.description}</p>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium mb-3">Benefits</h3>
                    <div className="flex flex-wrap gap-2">
                      {playModalExercise.benefits.map((benefit, i) => (
                        <span
                          key={i}
                          className="px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-sm"
                        >
                          ✓ {benefit}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium mb-3">Steps to Follow</h3>
                    <ol className="space-y-3">
                      {playModalExercise.steps.map((step, i) => (
                        <li key={i} className="flex gap-3 items-start">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold">
                            {i + 1}
                          </span>
                          <span className="pt-0.5">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium mb-2">Tags</h3>
                    <div className="flex flex-wrap gap-2">
                      {playModalExercise.tags.map((tag, i) => (
                        <span
                          key={i}
                          className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <div className="grid grid-cols-2 gap-4 text-center">
                      <div className="p-4 bg-blue-50 rounded-lg">
                        <p className="text-2xl font-bold text-blue-600">
                          {playModalExercise.completions.toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">Completions</p>
                      </div>
                      <div className="p-4 bg-yellow-50 rounded-lg">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                          <p className="text-2xl font-bold text-yellow-600">{playModalExercise.avgRating}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">Average Rating</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      className="flex-1 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white"
                      onClick={() => {
                        alert(`Starting exercise: ${playModalExercise.name}`);
                      }}
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Start Exercise
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setPlayModalExercise(null)}
                    >
                      Close
                    </Button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Edit Exercise Modal */}
        <AnimatePresence>
          {editModalExercise && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={() => setEditModalExercise(null)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                      <Edit className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">Edit Exercise</h2>
                      <p className="text-sm text-muted-foreground">Modify exercise details</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditModalExercise(null)}
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Exercise Name</label>
                    <Input defaultValue={editModalExercise.name} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Category</label>
                      <select className="w-full px-3 py-2 border rounded-lg" defaultValue={editModalExercise.category}>
                        {categories.map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Difficulty</label>
                      <select className="w-full px-3 py-2 border rounded-lg" defaultValue={editModalExercise.difficulty}>
                        <option value="beginner">Beginner</option>
                        <option value="intermediate">Intermediate</option>
                        <option value="advanced">Advanced</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Duration</label>
                    <Input defaultValue={editModalExercise.duration} />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Description</label>
                    <textarea
                      className="w-full p-3 border rounded-lg"
                      rows={3}
                      defaultValue={editModalExercise.description}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Benefits (one per line)</label>
                    <textarea
                      className="w-full p-3 border rounded-lg"
                      rows={3}
                      defaultValue={editModalExercise.benefits.join("\n")}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Steps (one per line)</label>
                    <textarea
                      className="w-full p-3 border rounded-lg"
                      rows={5}
                      defaultValue={editModalExercise.steps.join("\n")}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Tags (comma-separated)</label>
                    <Input defaultValue={editModalExercise.tags.join(", ")} />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setEditModalExercise(null)}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={() => {
                        alert(`Saved changes to: ${editModalExercise.name}`);
                        setEditModalExercise(null);
                      }}
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </Button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Delete Confirmation Modal */}
        <AnimatePresence>
          {deleteModalExercise && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={() => setDeleteModalExercise(null)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-xl p-6 max-w-md w-full"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                    <Trash2 className="w-6 h-6 text-red-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Delete Exercise</h2>
                    <p className="text-sm text-muted-foreground">This action cannot be undone</p>
                  </div>
                </div>

                <p className="text-muted-foreground mb-6">
                  Are you sure you want to delete <strong>"{deleteModalExercise.name}"</strong>?
                  This exercise will be permanently removed from the library and users will no longer have access to it.
                </p>

                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-6">
                  <p className="text-sm text-orange-800">
                    <strong>Note:</strong> This exercise has been completed {deleteModalExercise.completions.toLocaleString()} times by users.
                  </p>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setDeleteModalExercise(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                    onClick={() => {
                      alert(`Deleted: ${deleteModalExercise.name}`);
                      setDeleteModalExercise(null);
                    }}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AdminLayoutNew>
  );
}