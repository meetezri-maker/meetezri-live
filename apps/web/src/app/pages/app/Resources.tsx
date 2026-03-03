import React, { useState } from 'react';
import { motion } from 'motion/react';
import { AppLayout } from '@/app/components/AppLayout';
import { BookOpen, Video, Headphones, FileText, Search, Filter, Star, Clock, Play, Download, Bookmark, Heart, TrendingUp, Award, ArrowLeft } from 'lucide-react';
import { AnimatedCard } from '@/app/components/AnimatedCard';
import { Link } from 'react-router-dom';

interface Resource {
  id: string;
  title: string;
  description: string;
  type: 'article' | 'video' | 'audio' | 'exercise';
  category: string;
  duration: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  rating: number;
  views: number;
  thumbnail: string;
  isFavorite: boolean;
  tags: string[];
}

export function Resources() {
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [resourcesData, setResourcesData] = useState<Resource[]>([
    {
      id: '1',
      title: 'Understanding Anxiety: A Complete Guide',
      description: 'Learn about the science behind anxiety, common triggers, and evidence-based strategies to manage it effectively.',
      type: 'article',
      category: 'Mental Health',
      duration: '15 min read',
      difficulty: 'beginner',
      rating: 4.8,
      views: 2456,
      thumbnail: '📚',
      isFavorite: true,
      tags: ['anxiety', 'mental-health', 'coping-strategies']
    },
    {
      id: '2',
      title: 'Guided Meditation for Better Sleep',
      description: 'A calming 20-minute guided meditation designed to help you relax and prepare for restful sleep.',
      type: 'audio',
      category: 'Sleep',
      duration: '20 min',
      difficulty: 'beginner',
      rating: 4.9,
      views: 3821,
      thumbnail: '🎧',
      isFavorite: true,
      tags: ['meditation', 'sleep', 'relaxation']
    },
    {
      id: '3',
      title: 'Progressive Muscle Relaxation Technique',
      description: 'Learn and practice the progressive muscle relaxation technique to reduce physical tension and stress.',
      type: 'video',
      category: 'Stress Management',
      duration: '12 min',
      difficulty: 'beginner',
      rating: 4.7,
      views: 1543,
      thumbnail: '🎥',
      isFavorite: false,
      tags: ['stress-relief', 'relaxation', 'physical-wellness']
    },
    {
      id: '4',
      title: '5-4-3-2-1 Grounding Exercise',
      description: 'A quick and effective grounding technique to help manage anxiety and bring you back to the present moment.',
      type: 'exercise',
      category: 'Anxiety Relief',
      duration: '5 min',
      difficulty: 'beginner',
      rating: 4.9,
      views: 4123,
      thumbnail: '🧘',
      isFavorite: true,
      tags: ['grounding', 'anxiety-relief', 'mindfulness']
    },
    {
      id: '5',
      title: 'Building Emotional Resilience',
      description: 'Explore strategies to develop emotional resilience and bounce back stronger from life\'s challenges.',
      type: 'article',
      category: 'Personal Growth',
      duration: '10 min read',
      difficulty: 'intermediate',
      rating: 4.6,
      views: 1876,
      thumbnail: '📖',
      isFavorite: false,
      tags: ['resilience', 'personal-growth', 'emotional-health']
    },
    {
      id: '6',
      title: 'Box Breathing for Calm',
      description: 'Master the box breathing technique used by Navy SEALs to achieve instant calm and focus.',
      type: 'exercise',
      category: 'Breathing Techniques',
      duration: '3 min',
      difficulty: 'beginner',
      rating: 4.8,
      views: 5234,
      thumbnail: '💨',
      isFavorite: true,
      tags: ['breathing', 'calm', 'focus']
    },
    {
      id: '7',
      title: 'Understanding Depression: Signs & Support',
      description: 'Comprehensive video on recognizing depression symptoms and finding appropriate support and treatment.',
      type: 'video',
      category: 'Mental Health',
      duration: '25 min',
      difficulty: 'intermediate',
      rating: 4.7,
      views: 2981,
      thumbnail: '🎬',
      isFavorite: false,
      tags: ['depression', 'mental-health', 'support']
    },
    {
      id: '8',
      title: 'Nature Sounds for Relaxation',
      description: 'Immerse yourself in calming nature sounds - perfect for meditation, work, or sleep.',
      type: 'audio',
      category: 'Relaxation',
      duration: '60 min',
      difficulty: 'beginner',
      rating: 4.9,
      views: 6543,
      thumbnail: '🌿',
      isFavorite: true,
      tags: ['nature', 'ambient', 'relaxation']
    }
  ]);

  const types = [
    { id: 'all', label: 'All Resources', icon: BookOpen },
    { id: 'article', label: 'Articles', icon: FileText },
    { id: 'video', label: 'Videos', icon: Video },
    { id: 'audio', label: 'Audio', icon: Headphones },
    { id: 'exercise', label: 'Exercises', icon: Award }
  ];

  const categories = [
    'All Categories',
    'Mental Health',
    'Sleep',
    'Stress Management',
    'Anxiety Relief',
    'Personal Growth',
    'Breathing Techniques',
    'Relaxation'
  ];

  const stats = {
    totalResources: 156,
    favorites: 12,
    completed: 34,
    hoursSpent: 45
  };

  const filteredResources = resourcesData.filter(resource => {
    const matchesType = selectedType === 'all' || resource.type === selectedType;
    const matchesCategory = selectedCategory === 'all' || selectedCategory === 'All Categories' || resource.category === selectedCategory;
    const matchesSearch = searchQuery === '' || 
      resource.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      resource.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      resource.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    return matchesType && matchesCategory && matchesSearch;
  });

  const getTypeIcon = (type: string) => {
    const icons = {
      article: FileText,
      video: Video,
      audio: Headphones,
      exercise: Award
    };
    return icons[type as keyof typeof icons] || BookOpen;
  };

  const getDifficultyColor = (difficulty: string) => {
    const colors = {
      beginner: 'text-green-700 bg-green-100',
      intermediate: 'text-yellow-700 bg-yellow-100',
      advanced: 'text-red-700 bg-red-100'
    };
    return colors[difficulty as keyof typeof colors] || colors.beginner;
  };

  const handleToggleFavorite = (resourceId: string) => {
    setResourcesData(resourcesData.map(resource => {
      if (resource.id === resourceId) {
        return {
          ...resource,
          isFavorite: !resource.isFavorite
        };
      }
      return resource;
    }));
  };

  const handleStartResource = (resource: Resource) => {
    alert(`Starting: ${resource.title}\n\nThis will open the ${resource.type} player.`);
  };

  const handleBookmarkResource = (resource: Resource) => {
    alert(`Bookmarked: ${resource.title}\n\nThis resource has been saved to your bookmarks!`);
  };

  const handleDownloadResource = (resource: Resource) => {
    alert(`Downloading: ${resource.title}\n\nThis ${resource.type} will be downloaded for offline access.`);
  };

  return (
    <AppLayout>
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <Link 
              to="/app/settings" 
              className="inline-flex items-center gap-2 text-gray-700 hover:text-gray-900 dark:text-slate-400 dark:hover:text-slate-200 mb-6 transition-colors font-medium"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Settings
            </Link>
            
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Resources Library</h1>
                <p className="text-gray-600 dark:text-slate-400">Curated content for your wellness journey</p>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <AnimatedCard delay={0.1}>
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <BookOpen className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalResources}</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-slate-400">Total Resources</p>
                </div>
              </AnimatedCard>

              <AnimatedCard delay={0.15}>
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <Heart className="w-6 h-6 text-red-600 dark:text-red-400" />
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">{stats.favorites}</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-slate-400">Favorites</p>
                </div>
              </AnimatedCard>

              <AnimatedCard delay={0.2}>
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <Award className="w-6 h-6 text-green-600 dark:text-green-400" />
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">{stats.completed}</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-slate-400">Completed</p>
                </div>
              </AnimatedCard>

              <AnimatedCard delay={0.25}>
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <Clock className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">{stats.hoursSpent}h</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-slate-400">Time Spent</p>
                </div>
              </AnimatedCard>
            </div>
          </div>

          {/* Filters */}
          <div className="mb-6 space-y-4">
            {/* Type Filters */}
            <div className="flex flex-wrap gap-2">
              {types.map((type) => {
                const Icon = type.icon;
                const isActive = selectedType === type.id;
                return (
                  <motion.button
                    key={type.id}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setSelectedType(type.id)}
                    className={`px-4 py-2 rounded-xl flex items-center gap-2 font-semibold transition-all ${
                      isActive
                        ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-md'
                        : 'bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-slate-800 hover:border-purple-300 hover:bg-gray-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {type.label}
                  </motion.button>
                );
              })}
            </div>

            {/* Search & Category */}
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="w-5 h-5 text-gray-400 dark:text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search resources..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl pl-12 pr-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900 transition-all"
                />
              </div>

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900 transition-all"
              >
                {categories.map((category) => (
                  <option key={category} value={category} className="bg-white dark:bg-slate-900">
                    {category}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Resources Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredResources.map((resource, index) => {
              const TypeIcon = getTypeIcon(resource.type);
              
              return (
                <AnimatedCard key={resource.id} delay={index * 0.05}>
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 overflow-hidden hover:border-purple-400 hover:shadow-lg transition-all"
                  >
                    {/* Thumbnail */}
                    <div className="relative h-48 bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30 flex items-center justify-center">
                      <span className="text-6xl">{resource.thumbnail}</span>
                      <div className="absolute top-4 right-4">
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          className={`p-2 rounded-lg transition-all ${
                            resource.isFavorite
                              ? 'bg-red-500 text-white'
                              : 'bg-white/80 dark:bg-slate-900/80 text-gray-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-900 hover:text-red-500'
                          }`}
                          onClick={() => handleToggleFavorite(resource.id)}
                        >
                          <Heart className="w-5 h-5" fill={resource.isFavorite ? 'currentColor' : 'none'} />
                        </motion.button>
                      </div>
                      <div className="absolute top-4 left-4">
                        <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl px-3 py-1 rounded-lg flex items-center gap-2 shadow-sm">
                          <TypeIcon className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                          <span className="text-sm font-semibold text-purple-900 dark:text-purple-300 capitalize">{resource.type}</span>
                        </div>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white pr-2 line-clamp-2">{resource.title}</h3>
                        <div className="flex items-center gap-1 text-yellow-500">
                          <Star className="w-4 h-4" fill="currentColor" />
                          <span className="text-sm font-semibold">{resource.rating}</span>
                        </div>
                      </div>

                      <p className="text-sm text-gray-600 dark:text-slate-400 mb-4 line-clamp-2">{resource.description}</p>

                      {/* Meta Info */}
                      <div className="flex items-center justify-between mb-4 text-sm text-gray-500 dark:text-slate-500">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          <span>{resource.duration}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4" />
                          <span>{resource.views.toLocaleString()} views</span>
                        </div>
                      </div>

                      {/* Tags */}
                      <div className="flex flex-wrap gap-2 mb-4">
                        {resource.tags.slice(0, 2).map((tag) => (
                          <span key={tag} className="text-xs px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg">
                            {tag}
                          </span>
                        ))}
                        <span className={`text-xs px-2 py-1 rounded-lg ${getDifficultyColor(resource.difficulty)}`}>
                          {resource.difficulty}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl text-white font-semibold flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-purple-500/50 transition-all"
                          onClick={() => handleStartResource(resource)}
                        >
                          <Play className="w-4 h-4" />
                          Start
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="px-4 py-2 bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700 transition-all"
                          onClick={() => handleBookmarkResource(resource)}
                        >
                          <Bookmark className="w-5 h-5" />
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="px-4 py-2 bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700 transition-all"
                          onClick={() => handleDownloadResource(resource)}
                        >
                          <Download className="w-5 h-5" />
                        </motion.button>
                      </div>
                    </div>
                  </motion.div>
                </AnimatedCard>
              );
            })}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}