import { motion } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import {
  Save,
  Eye,
  X,
  Upload,
  Image as ImageIcon,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Plus,
  Trash2,
  ArrowLeft,
  Sparkles,
  Heart,
  Brain,
  Wind,
  Moon,
  Sun,
  Zap,
  Target,
  CheckCircle2,
} from "lucide-react";
import { useState } from "react";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { useNavigate } from "react-router-dom";

import { api } from "../../../lib/api";

export function WellnessToolEditor() {
  const navigate = useNavigate();
  const [showPreview, setShowPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    category: "Breathing",
    description: "",
    duration: 5,
    difficulty: "Beginner",
    icon: "Wind",
    tags: [] as string[],
    scriptSteps: [
      { id: "1", duration: 60, instruction: "" },
    ],
    enabledForGuidedMode: true,
    audioEnabled: false,
    visualsEnabled: true,
  });

  const [tagInput, setTagInput] = useState("");

  const categories = [
    "Breathing",
    "Meditation",
    "Sleep",
    "Anxiety Relief",
    "Stress Management",
    "Mindfulness",
    "Energy Boost",
  ];

  const iconOptions = [
    { name: "Wind", icon: Wind, color: "#06b6d4" },
    { name: "Brain", icon: Brain, color: "#8b5cf6" },
    { name: "Moon", icon: Moon, color: "#3b82f6" },
    { name: "Sun", icon: Sun, color: "#f59e0b" },
    { name: "Heart", icon: Heart, color: "#ec4899" },
    { name: "Zap", icon: Zap, color: "#10b981" },
    { name: "Target", icon: Target, color: "#f97316" },
    { name: "Sparkles", icon: Sparkles, color: "#a855f7" },
  ];

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData({
        ...formData,
        tags: [...formData.tags, tagInput.trim()],
      });
      setTagInput("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter((t) => t !== tag),
    });
  };

  const handleAddStep = () => {
    const newStep = {
      id: Date.now().toString(),
      duration: 60,
      instruction: "",
    };
    setFormData({
      ...formData,
      scriptSteps: [...formData.scriptSteps, newStep],
    });
  };

  const handleRemoveStep = (id: string) => {
    setFormData({
      ...formData,
      scriptSteps: formData.scriptSteps.filter((step) => step.id !== id),
    });
  };

  const handleUpdateStep = (id: string, field: string, value: any) => {
    setFormData({
      ...formData,
      scriptSteps: formData.scriptSteps.map((step) =>
        step.id === id ? { ...step, [field]: value } : step
      ),
    });
  };

  const handleSaveDraft = async () => {
    await handleSave("draft");
  };

  const handlePublish = async () => {
    await handleSave("published");
  };

  const handleSave = async (status: "draft" | "published") => {
    try {
      setIsSaving(true);
      const payload = {
        title: formData.title,
        category: formData.category,
        description: formData.description,
        duration_minutes: formData.duration,
        difficulty: formData.difficulty,
        icon: formData.icon,
        status: status,
        content: JSON.stringify({
          scriptSteps: formData.scriptSteps,
          tags: formData.tags,
          enabledForGuidedMode: formData.enabledForGuidedMode,
          audioEnabled: formData.audioEnabled,
          visualsEnabled: formData.visualsEnabled
        })
      };

      await api.wellness.create(payload);
      navigate("/admin/wellness-tools-cms");
    } catch (error) {
      console.error("Failed to save tool:", error);
      alert("Failed to save tool. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const selectedIcon = iconOptions.find((opt) => opt.name === formData.icon);

  return (
    <AdminLayoutNew>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => navigate("/admin/wellness-tools-cms")}
              className="text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                Create Wellness Tool
              </h1>
              <p className="text-gray-600">
                Build a guided wellness exercise for users
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => setShowPreview(!showPreview)}
              className="border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              <Eye className="w-4 h-4 mr-2" />
              {showPreview ? "Hide" : "Show"} Preview
            </Button>
            <Button
              variant="outline"
              onClick={handleSaveDraft}
              className="border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              <Save className="w-4 h-4 mr-2" />
              Save Draft
            </Button>
            <Button
              onClick={handlePublish}
              className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Publish Tool
            </Button>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Form Section */}
          <div className="space-y-6">
            {/* Basic Info */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="bg-white border border-gray-200 p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Basic Information</h3>

                {/* Title */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tool Title *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    placeholder="e.g., Box Breathing Technique"
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {/* Category & Duration */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Category *
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) =>
                        setFormData({ ...formData, category: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Duration (min)
                    </label>
                    <input
                      type="number"
                      value={formData.duration}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          duration: parseInt(e.target.value),
                        })
                      }
                      min="1"
                      max="60"
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>

                {/* Description */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description *
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="Brief description of the wellness tool..."
                    rows={3}
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                  />
                </div>

                {/* Difficulty */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Difficulty Level
                  </label>
                  <div className="flex gap-3">
                    {["Beginner", "Intermediate", "Advanced"].map((level) => (
                      <button
                        key={level}
                        onClick={() =>
                          setFormData({ ...formData, difficulty: level as any })
                        }
                        className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all ${
                          formData.difficulty === level
                            ? "bg-gradient-to-r from-purple-500 to-pink-600 text-white"
                            : "bg-gray-100 border border-gray-300 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* Icon Selection */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="bg-white border border-gray-200 p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Icon & Branding</h3>
                <div className="grid grid-cols-4 gap-3">
                  {iconOptions.map((option) => (
                    <button
                      key={option.name}
                      onClick={() =>
                        setFormData({ ...formData, icon: option.name })
                      }
                      className={`p-4 rounded-xl transition-all ${
                        formData.icon === option.name
                          ? "ring-2 ring-purple-500 bg-purple-50"
                          : "bg-gray-50 hover:bg-gray-100"
                      }`}
                    >
                      <div
                        className="w-12 h-12 rounded-lg mx-auto flex items-center justify-center mb-2"
                        style={{ backgroundColor: `${option.color}20` }}
                      >
                        <option.icon
                          className="w-6 h-6"
                          style={{ color: option.color }}
                        />
                      </div>
                      <p className="text-xs text-gray-600 text-center">
                        {option.name}
                      </p>
                    </button>
                  ))}
                </div>
              </Card>
            </motion.div>

            {/* Tags */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="bg-white border border-gray-200 p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Tags</h3>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleAddTag()}
                    placeholder="Add tag..."
                    className="flex-1 px-4 py-2 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <Button
                    onClick={handleAddTag}
                    className="bg-purple-500 hover:bg-purple-600"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-2 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm"
                    >
                      {tag}
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="hover:text-purple-900"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </Card>
            </motion.div>

            {/* Settings */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="bg-white border border-gray-200 p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Settings</h3>
                <div className="space-y-4">
                  <label className="flex items-center justify-between">
                    <span className="text-gray-900">Enable for Guided Mode</span>
                    <input
                      type="checkbox"
                      checked={formData.enabledForGuidedMode}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          enabledForGuidedMode: e.target.checked,
                        })
                      }
                      className="w-5 h-5 rounded border-gray-300 bg-white text-purple-500 focus:ring-purple-500"
                    />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className="text-gray-900">Audio Guidance</span>
                    <input
                      type="checkbox"
                      checked={formData.audioEnabled}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          audioEnabled: e.target.checked,
                        })
                      }
                      className="w-5 h-5 rounded border-gray-300 bg-white text-purple-500 focus:ring-purple-500"
                    />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className="text-gray-900">Visual Effects</span>
                    <input
                      type="checkbox"
                      checked={formData.visualsEnabled}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          visualsEnabled: e.target.checked,
                        })
                      }
                      className="w-5 h-5 rounded border-gray-300 bg-white text-purple-500 focus:ring-purple-500"
                    />
                  </label>
                </div>
              </Card>
            </motion.div>
          </div>

          {/* Guided Script Section */}
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="bg-white border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-900">Guided Script</h3>
                  <Button
                    onClick={handleAddStep}
                    size="sm"
                    className="bg-purple-500 hover:bg-purple-600"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Step
                  </Button>
                </div>

                <div className="space-y-4">
                  {formData.scriptSteps.map((step, index) => (
                    <div
                      key={step.id}
                      className="bg-gray-50 border border-gray-200 rounded-xl p-4"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-purple-600">
                          Step {index + 1}
                        </span>
                        {formData.scriptSteps.length > 1 && (
                          <button
                            onClick={() => handleRemoveStep(step.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div className="mb-3">
                        <label className="block text-xs text-gray-600 mb-1">
                          Duration (seconds)
                        </label>
                        <input
                          type="number"
                          value={step.duration}
                          onChange={(e) =>
                            handleUpdateStep(
                              step.id,
                              "duration",
                              parseInt(e.target.value)
                            )
                          }
                          min="1"
                          className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-gray-600 mb-1">
                          Instruction
                        </label>
                        <textarea
                          value={step.instruction}
                          onChange={(e) =>
                            handleUpdateStep(step.id, "instruction", e.target.value)
                          }
                          placeholder="e.g., Breathe in slowly through your nose for 4 counts..."
                          rows={3}
                          className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <p className="text-sm text-blue-800">
                    💡 <strong>Tip:</strong> Keep instructions clear and concise. Use
                    calming language and specific timing cues.
                  </p>
                </div>
              </Card>
            </motion.div>

            {/* Preview */}
            {showPreview && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <Card className="bg-white border border-gray-200 p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">Preview</h3>

                  <div className="bg-gradient-to-br from-purple-100 to-pink-100 rounded-xl p-8 text-center">
                    {selectedIcon && (
                      <div
                        className="w-20 h-20 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                        style={{
                          backgroundColor: `${selectedIcon.color}20`,
                        }}
                      >
                        <selectedIcon.icon
                          className="w-10 h-10"
                          style={{ color: selectedIcon.color }}
                        />
                      </div>
                    )}

                    <h4 className="text-2xl font-bold text-gray-900 mb-2">
                      {formData.title || "Tool Title"}
                    </h4>
                    <p className="text-gray-700 mb-4">
                      {formData.description || "Tool description will appear here"}
                    </p>

                    <div className="flex items-center justify-center gap-6 mb-6">
                      <div className="text-center">
                        <p className="text-xs text-gray-600">Duration</p>
                        <p className="text-lg font-bold text-gray-900">
                          {formData.duration} min
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-600">Difficulty</p>
                        <p className="text-lg font-bold text-gray-900">
                          {formData.difficulty}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-600">Steps</p>
                        <p className="text-lg font-bold text-gray-900">
                          {formData.scriptSteps.length}
                        </p>
                      </div>
                    </div>

                    <Button className="w-full bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white">
                      <Play className="w-4 h-4 mr-2" />
                      Start Exercise
                    </Button>
                  </div>
                </Card>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </AdminLayoutNew>
  );
}
