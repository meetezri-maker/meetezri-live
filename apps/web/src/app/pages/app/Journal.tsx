import { AppLayout } from "../../components/AppLayout";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { motion, AnimatePresence } from "motion/react";
import { RichTextEditor } from "../../components/RichTextEditor";
import { JournalExportModal } from "../../components/modals";
import {
  BookOpen,
  Plus,
  Search,
  Calendar,
  Heart,
  Sparkles,
  Lock,
  Edit,
  Trash2,
  X,
  Filter,
  Download,
  Loader2
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { api } from "../../../lib/api";
import { useAuth } from "../../contexts/AuthContext";
import { Skeleton } from "../../components/ui/skeleton";

interface JournalEntry {
  id: string;
  title: string | null;
  content: string | null;
  mood_tags: string[];
  is_private: boolean | null;
  location: string | null;
  created_at: string;
  updated_at: string;
  // Derived fields for UI
  date?: string;
  preview?: string;
  mood?: string;
  favorite?: boolean;
}

export function Journal() {
  const { session, profile } = useAuth();
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
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Journaling is a Core Feature</h2>
            <p className="text-slate-600 max-w-md mx-auto mb-8">
              Upgrade to Core or Pro to unlock unlimited journaling, mood tracking, and more.
            </p>
            <Button onClick={() => navigate('/app/billing')}>
              View Plans
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  const [showNewEntry, setShowNewEntry] = useState(false);
  const [newEntryTitle, setNewEntryTitle] = useState("");
  const [newEntryContent, setNewEntryContent] = useState("");
  const [selectedMood, setSelectedMood] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showExportModal, setShowExportModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<string | null>(null);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filterMood, setFilterMood] = useState<string>("");
  const [filterFavorites, setFilterFavorites] = useState(false);
  const [filterDateRange, setFilterDateRange] = useState<"all" | "week" | "month" | "year">("all");
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingFavoriteId, setTogglingFavoriteId] = useState<string | null>(null);

  const moods = [
    { value: "happy", emoji: "😊" },
    { value: "calm", emoji: "😌" },
    { value: "anxious", emoji: "😰" },
    { value: "sad", emoji: "😢" },
    { value: "excited", emoji: "🤩" },
    { value: "angry", emoji: "😡" }
  ];

  const fetchEntries = async () => {
    if (!session) return;
    try {
      setIsLoading(true);
      const data = await api.journal.getAll();
      
      const formattedEntries = data.map((entry: any) => {
        let moodDisplay = '😐';
        if (entry.mood_tags && entry.mood_tags.length > 0) {
          const rawMood = entry.mood_tags[0];
          // Try to match with our known moods (check emoji or value)
          const moodObj = moods.find(m => 
            m.emoji === rawMood || 
            m.value.toLowerCase() === rawMood.toLowerCase()
          );
          moodDisplay = moodObj ? moodObj.emoji : rawMood;
        }

        return {
          ...entry,
          date: new Date(entry.created_at).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
          }),
          preview: entry.content ? entry.content.replace(/<[^>]*>/g, '').substring(0, 100) + '...' : '',
          mood: moodDisplay,
          favorite: entry.is_favorite || false
        };
      });

      setEntries(formattedEntries);
    } catch (error) {
      console.error("Failed to fetch journal entries", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleFavorite = async (entryId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setTogglingFavoriteId(entryId);
      await api.journal.toggleFavorite(entryId);
      setEntries(prev => prev.map(entry => 
        entry.id === entryId ? { ...entry, favorite: !entry.favorite } : entry
      ));
    } catch (error) {
      console.error("Failed to toggle favorite", error);
    } finally {
      setTogglingFavoriteId(null);
    }
  };

  useEffect(() => {
    fetchEntries();
  }, [session]);

  const handleSaveEntry = async () => {
    if (!session) return;
    
    try {
      setIsSaving(true);
      const entryData = {
        title: newEntryTitle,
        content: newEntryContent,
        mood_tags: selectedMood ? [selectedMood] : [],
        is_private: true
      };

      if (editingEntry) {
        await api.journal.update(editingEntry, entryData);
      } else {
        await api.journal.create(entryData);
      }

      await fetchEntries();
      
      setShowNewEntry(false);
      setNewEntryTitle("");
      setNewEntryContent("");
      setSelectedMood("");
      setEditingEntry(null);
    } catch (error) {
      console.error("Failed to save journal entry", error);
      alert("Failed to save entry. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditEntry = (entryId: string) => {
    const entry = entries.find(e => e.id === entryId);
    if (entry) {
      setNewEntryTitle(entry.title || "");
      setNewEntryContent(entry.content || "");
      
      // Map back to emoji for the selector
      let moodToSelect = "";
      if (entry.mood_tags && entry.mood_tags.length > 0) {
        const rawMood = entry.mood_tags[0];
        const moodObj = moods.find(m => 
          m.emoji === rawMood || 
          m.value.toLowerCase() === rawMood.toLowerCase()
        );
        moodToSelect = moodObj ? moodObj.emoji : rawMood;
      }
      setSelectedMood(moodToSelect);
      
      setEditingEntry(entryId);
      setShowNewEntry(true);
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (confirm("Are you sure you want to delete this journal entry?")) {
      try {
        setDeletingId(entryId);
        await api.journal.delete(entryId);
        setEntries(entries.filter(e => e.id !== entryId));
      } catch (error) {
        console.error("Failed to delete journal entry", error);
        alert("Failed to delete entry.");
      } finally {
        setDeletingId(null);
      }
    }
  };

  // Filter logic
  const filteredEntries = entries.filter(entry => {
    // Search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const titleMatch = entry.title?.toLowerCase().includes(query);
      const contentMatch = entry.content?.toLowerCase().includes(query);
      if (!titleMatch && !contentMatch) return false;
    }

    // Mood filter
    if (filterMood) {
      // filterMood is emoji
      const moodValue = moods.find(m => m.emoji === filterMood)?.value;
      const entryMood = entry.mood_tags?.[0];
      
      if (!entryMood) return false;
      
      // Check for exact match (emoji) or case-insensitive value match
      const isMatch = 
        entryMood === filterMood || 
        (moodValue && entryMood.toLowerCase() === moodValue.toLowerCase());
        
      if (!isMatch) return false;
    }

    // Date range filter
    if (filterDateRange !== 'all') {
      const entryDate = new Date(entry.created_at);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - entryDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (filterDateRange === 'week' && diffDays > 7) return false;
      if (filterDateRange === 'month' && diffDays > 30) return false;
      if (filterDateRange === 'year' && diffDays > 365) return false;
    }

    // Favorites filter
    if (filterFavorites && !entry.favorite) return false;

    return true;
  });

  // Stats calculation
  const totalEntries = entries.length;
  // Simple streak calculation (consecutive days with entries)
  const calculateStreak = () => {
    if (entries.length === 0) return 0;
    
    // Sort entries by date descending
    const sortedEntries = [...entries].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Check if there's an entry today
    const lastEntryDate = new Date(sortedEntries[0].created_at);
    lastEntryDate.setHours(0, 0, 0, 0);
    
    if (lastEntryDate.getTime() === today.getTime()) {
      streak = 1;
    } else if ((today.getTime() - lastEntryDate.getTime()) > (1000 * 60 * 60 * 24)) {
      // If last entry was before yesterday, streak is broken
      return 0;
    }

    // Iterate backwards
    let currentDate = lastEntryDate;
    
    for (let i = 1; i < sortedEntries.length; i++) {
      const entryDate = new Date(sortedEntries[i].created_at);
      entryDate.setHours(0, 0, 0, 0);
      
      const diffTime = currentDate.getTime() - entryDate.getTime();
      const diffDays = diffTime / (1000 * 60 * 60 * 24);
      
      if (diffDays === 1) {
        streak++;
        currentDate = entryDate;
      } else if (diffDays === 0) {
        // Multiple entries same day, continue
        continue;
      } else {
        break;
      }
    }
    
    return streak;
  };

  const streak = calculateStreak();

  const entriesThisWeek = entries.filter(e => {
    const entryDate = new Date(e.created_at);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - entryDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 7;
  }).length;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="mb-8">
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-80" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {[0, 1, 2].map((i) => (
              <Card key={i} className="p-4">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-6 w-16 mb-1" />
                <Skeleton className="h-3 w-20" />
              </Card>
            ))}
          </div>
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Card key={i} className="p-5">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-3 w-full" />
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
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <BookOpen className="w-8 h-8 text-primary" />
                <h1 className="text-3xl font-bold">My Journal</h1>
              </div>
              <p className="text-muted-foreground">
                Your private space for thoughts and reflections
              </p>
            </div>
            <div className="flex gap-2">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowExportModal(true)}
                className="flex items-center gap-2 px-4 py-3 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600 rounded-lg shadow-md hover:shadow-lg transition-all"
              >
                <Download className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                <span className="hidden sm:inline text-gray-700 dark:text-gray-300 font-medium">Export</span>
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setEditingEntry(null);
                  setNewEntryTitle("");
                  setNewEntryContent("");
                  setSelectedMood("");
                  setShowNewEntry(true);
                }}
                className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-500 dark:to-indigo-500 text-white rounded-lg shadow-lg hover:shadow-xl transition-shadow"
              >
                <Plus className="w-5 h-5" />
                <span className="hidden sm:inline">New Entry</span>
              </motion.button>
            </div>
          </div>

          {/* Search and Filter */}
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search your entries..."
                className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setFilterFavorites(!filterFavorites)}
              className={`px-4 py-3 border rounded-lg transition-colors flex items-center gap-2 ${
                filterFavorites 
                  ? "bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-500 dark:text-red-400" 
                  : "border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
              }`}
            >
              <Heart className={`w-5 h-5 ${filterFavorites ? "fill-current" : ""}`} />
              <span className="hidden sm:inline font-medium">Favorites</span>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowFilterModal(true)}
              className="px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <Filter className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </motion.button>
          </div>
        </motion.div>

        {/* New Entry Modal */}
        <AnimatePresence>
          {showNewEntry && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowNewEntry(false)}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="fixed inset-4 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-2xl z-50"
              >
                <Card className="p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold">{editingEntry ? 'Edit Journal Entry' : 'New Journal Entry'}</h2>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setShowNewEntry(false)}
                      className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                      <X className="w-6 h-6" />
                    </motion.button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Title (Optional)</label>
                      <input
                        type="text"
                        value={newEntryTitle}
                        onChange={(e) => setNewEntryTitle(e.target.value)}
                        placeholder="Give your entry a title..."
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">How are you feeling?</label>
                      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                        {moods.map((mood) => (
                          <motion.button
                            key={mood.value}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => setSelectedMood(mood.emoji)}
                            className={`text-4xl p-2 rounded-lg transition-all flex-shrink-0 ${
                              selectedMood === mood.emoji
                                ? "bg-primary/10 ring-2 ring-primary dark:bg-primary/20"
                                : "hover:bg-gray-100 dark:hover:bg-gray-800"
                            }`}
                          >
                            {mood.emoji}
                          </motion.button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Write your thoughts...</label>
                      <RichTextEditor
                        value={newEntryContent}
                        onChange={(e) => setNewEntryContent(e)}
                        placeholder="Start writing... Let your thoughts flow freely."
                        className="w-full focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent"
                        hideMoodSelector={true}
                      />
                    </div>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Lock className="w-4 h-4" />
                      <span>Your journal is private and secure</span>
                    </div>

                    <div className="flex gap-3">
                      <Button
                        onClick={() => setShowNewEntry(false)}
                        variant="outline"
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                      <Button onClick={handleSaveEntry} className="flex-1" disabled={isSaving}>
                        {isSaving ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          "Save Entry"
                        )}
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="p-4 text-center shadow-lg bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 dark:border-blue-800">
              <div className="text-3xl font-bold text-primary dark:text-blue-400 mb-1">{totalEntries}</div>
              <div className="text-sm text-muted-foreground">Total Entries</div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <Card className="p-4 text-center shadow-lg bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 dark:border-purple-800">
              <div className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-1">{streak}</div>
              <div className="text-sm text-muted-foreground">Day Streak</div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="p-4 text-center shadow-lg bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 dark:border-amber-800">
              <div className="text-3xl font-bold text-amber-600 dark:text-amber-400 mb-1">{entriesThisWeek}</div>
              <div className="text-sm text-muted-foreground">This Week</div>
            </Card>
          </motion.div>
        </div>

        {/* Journal Entries */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center py-10">Loading entries...</div>
          ) : filteredEntries.length === 0 ? (
             <div className="text-center py-10 text-muted-foreground">No entries found. Start writing!</div>
          ) : (
            filteredEntries.map((entry, index) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + index * 0.05 }}
                whileHover={{ scale: 1.01, y: -2 }}
              >
                <Card className="p-6 shadow-lg hover:shadow-xl transition-all cursor-pointer group">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <motion.span
                        whileHover={{ scale: 1.2, rotate: 10 }}
                        className="text-3xl"
                      >
                        {entry.mood}
                      </motion.span>
                      <div>
                        <h3 className="font-bold text-lg group-hover:text-primary transition-colors">
                          {entry.title || "Untitled Entry"}
                        </h3>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="w-4 h-4" />
                          {entry.date}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => handleToggleFavorite(entry.id, e)}
                        disabled={togglingFavoriteId === entry.id}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors z-10 disabled:opacity-50"
                      >
                         {togglingFavoriteId === entry.id ? (
                           <Loader2 className="w-5 h-5 animate-spin text-red-500" />
                         ) : (
                           <Heart className={`w-5 h-5 ${entry.favorite ? "text-red-500 fill-red-500" : "text-gray-400 dark:text-gray-500"}`} />
                         )}
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        className="opacity-0 group-hover:opacity-100 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all"
                        onClick={() => handleEditEntry(entry.id)}
                      >
                        <Edit className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        className="opacity-0 group-hover:opacity-100 p-2 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all"
                        onClick={() => handleDeleteEntry(entry.id)}
                        disabled={deletingId === entry.id}
                      >
                        {deletingId === entry.id ? (
                          <Loader2 className="w-4 h-4 text-red-500 dark:text-red-400 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4 text-red-500 dark:text-red-400" />
                        )}
                      </motion.button>
                    </div>
                  </div>
                  <p className="text-muted-foreground line-clamp-2">{entry.preview}</p>
                </Card>
              </motion.div>
            ))
          )}
        </div>

        {/* Inspiration Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="mt-8"
        >
          <Card className="p-6 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white shadow-xl">
            <div className="flex items-start gap-3">
              <Sparkles className="w-6 h-6 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-bold mb-2">Journaling Prompt</h3>
                <p className="text-white/90 mb-3">
                  "What are three things that brought you joy this week, and why were they meaningful to you?"
                </p>
                <Button
                  onClick={() => setShowNewEntry(true)}
                  variant="outline"
                  className="bg-white text-primary hover:bg-white/90"
                  size="sm"
                >
                  Write About This
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Filter Modal */}
      <AnimatePresence>
        {showFilterModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowFilterModal(false)}
              className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md"
              >
                <Card className="p-6 shadow-2xl bg-white dark:bg-gray-900">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <Filter className="w-5 h-5 text-primary" />
                      <h2 className="text-xl font-bold">Filter Entries</h2>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setShowFilterModal(false)}
                      className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </motion.button>
                  </div>

                  {/* Filter by Mood */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium mb-3">Filter by Mood</label>
                    <div className="flex gap-2 flex-wrap">
                      {moods.map((mood) => (
                        <motion.button
                          key={mood.value}
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => setFilterMood(filterMood === mood.emoji ? "" : mood.emoji)}
                          className={`text-3xl p-3 rounded-lg transition-all ${
                            filterMood === mood.emoji
                              ? "bg-primary/10 ring-2 ring-primary"
                              : "hover:bg-gray-100"
                          }`}
                        >
                          {mood.emoji}
                        </motion.button>
                      ))}
                    </div>
                    {filterMood && (
                      <motion.button
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        onClick={() => setFilterMood("")}
                        className="text-sm text-primary mt-2 hover:underline"
                      >
                        Clear mood filter
                      </motion.button>
                    )}
                  </div>

                  {/* Filter by Date Range */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium mb-3">Filter by Date</label>
                    <div className="grid grid-cols-2 gap-2">
                      {["all", "week", "month", "year"].map((range) => (
                        <motion.button
                          key={range}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setFilterDateRange(range as any)}
                          className={`p-3 rounded-lg border-2 transition-all capitalize ${
                            filterDateRange === range
                              ? "border-primary bg-primary text-white"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          {range === "all" ? "All Time" : `Past ${range}`}
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  {/* Filter by Favorites */}
                  <div className="mb-6">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setFilterFavorites(!filterFavorites)}
                      className={`w-full p-4 rounded-lg border-2 transition-all flex items-center justify-between ${
                        filterFavorites
                          ? "border-red-500 bg-red-50"
                          : "border-border hover:border-red-500/50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Heart className={`w-5 h-5 ${filterFavorites ? "text-red-500 fill-red-500" : "text-gray-400"}`} />
                        <span className="font-medium">Show Favorites Only</span>
                      </div>
                      <div className={`w-12 h-6 rounded-full transition-colors ${filterFavorites ? "bg-red-500" : "bg-gray-300"}`}>
                        <motion.div
                          animate={{ x: filterFavorites ? 24 : 0 }}
                          className="w-6 h-6 bg-white rounded-full shadow-md"
                        />
                      </div>
                    </motion.button>
                  </div>

                  {/* Footer Buttons */}
                  <div className="flex items-center gap-3 pt-4 border-t">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setFilterMood("");
                        setFilterDateRange("all");
                        setFilterFavorites(false);
                      }}
                      className="flex-1"
                    >
                      Clear All
                    </Button>
                    <Button
                      className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600"
                      onClick={() => setShowFilterModal(false)}
                    >
                      Apply Filters
                    </Button>
                  </div>
                </Card>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Export Modal */}
      <JournalExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        entriesCount={entries.length}
      />
    </AppLayout>
  );
}
