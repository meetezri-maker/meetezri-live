import React, { useState } from 'react';
import { motion } from 'motion/react';
import { AppLayout } from '@/app/components/AppLayout';
import { Users, MessageCircle, Heart, Share2, Plus, TrendingUp, Clock, Eye, ThumbsUp, MessageSquare, Search, Filter, Globe, Lock, ArrowLeft } from 'lucide-react';
import { AnimatedCard } from '@/app/components/AnimatedCard';
import { Link } from 'react-router-dom';

interface Post {
  id: string;
  author: {
    name: string;
    avatar: string;
    role: 'member' | 'moderator' | 'companion';
  };
  content: string;
  category: string;
  timestamp: string;
  likes: number;
  comments: number;
  views: number;
  isLiked: boolean;
  tags: string[];
}

interface Group {
  id: string;
  name: string;
  description: string;
  members: number;
  posts: number;
  category: string;
  isJoined: boolean;
  privacy: 'public' | 'private';
}

export function Community() {
  const [activeTab, setActiveTab] = useState<'feed' | 'groups' | 'trending'>('feed');
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewPostModal, setShowNewPostModal] = useState(false);
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostCategory, setNewPostCategory] = useState('General Discussion');
  const [postsData, setPostsData] = useState<Post[]>([
    {
      id: '1',
      author: {
        name: 'Sarah M.',
        avatar: '👩‍🦰',
        role: 'member'
      },
      content: 'Just completed my 30-day streak with Ezri! Feeling so much more grounded and aware of my emotions. The mood tracking feature has been a game-changer. 🎉',
      category: 'Wins & Progress',
      timestamp: '2 hours ago',
      likes: 24,
      comments: 8,
      views: 156,
      isLiked: true,
      tags: ['progress', 'mood-tracking', 'milestone']
    },
    {
      id: '2',
      author: {
        name: 'Alex T.',
        avatar: '👨',
        role: 'member'
      },
      content: 'Does anyone have tips for dealing with anxiety before important meetings? I\'ve been using the breathing exercises but would love to hear what works for others.',
      category: 'Support & Advice',
      timestamp: '4 hours ago',
      likes: 15,
      comments: 12,
      views: 98,
      isLiked: false,
      tags: ['anxiety', 'advice', 'workplace']
    },
    {
      id: '3',
      author: {
        name: 'Dr. Martinez',
        avatar: '👨‍⚕️',
        role: 'companion'
      },
      content: 'Reminder: It\'s okay to not be okay. Progress isn\'t linear, and setbacks are part of the journey. Be gentle with yourself today. 💜',
      category: 'Professional Insights',
      timestamp: '6 hours ago',
      likes: 89,
      comments: 23,
      views: 445,
      isLiked: true,
      tags: ['mental-health', 'reminder', 'self-compassion']
    },
    {
      id: '4',
      author: {
        name: 'Jamie L.',
        avatar: '👤',
        role: 'moderator'
      },
      content: 'Weekly Check-in: How is everyone doing this week? Share one thing you\'re grateful for today. Let\'s spread some positivity! ✨',
      category: 'Community Events',
      timestamp: '8 hours ago',
      likes: 45,
      comments: 67,
      views: 312,
      isLiked: false,
      tags: ['weekly-checkin', 'gratitude', 'community']
    }
  ]);

  const groups: Group[] = [
    {
      id: '1',
      name: 'Anxiety Support Circle',
      description: 'A safe space to share experiences and coping strategies for anxiety.',
      members: 1234,
      posts: 456,
      category: 'Support Groups',
      isJoined: true,
      privacy: 'private'
    },
    {
      id: '2',
      name: 'Mindfulness & Meditation',
      description: 'Share mindfulness practices, meditation techniques, and peaceful moments.',
      members: 2103,
      posts: 892,
      category: 'Wellness',
      isJoined: true,
      privacy: 'public'
    },
    {
      id: '3',
      name: 'Sleep Better Together',
      description: 'Tips, tricks, and support for improving sleep quality and routines.',
      members: 876,
      posts: 234,
      category: 'Wellness',
      isJoined: false,
      privacy: 'public'
    },
    {
      id: '4',
      name: 'Parent Wellness Network',
      description: 'Mental health support specifically for parents navigating parenthood.',
      members: 654,
      posts: 321,
      category: 'Support Groups',
      isJoined: false,
      privacy: 'private'
    }
  ];

  const trendingTopics = [
    { tag: 'self-care', posts: 234 },
    { tag: 'anxiety-relief', posts: 189 },
    { tag: 'gratitude-journal', posts: 156 },
    { tag: 'sleep-tips', posts: 142 },
    { tag: 'mindfulness', posts: 128 }
  ];

  const stats = {
    members: 12456,
    posts: 3421,
    groups: 24,
    activeNow: 234
  };

  const getRoleBadge = (role: string) => {
    const badges = {
      member: { bg: 'bg-gray-200', text: 'text-gray-700', label: 'Member' },
      moderator: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Moderator' },
      companion: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Companion' }
    };
    return badges[role as keyof typeof badges] || badges.member;
  };

  const handleLikePost = (postId: string) => {
    setPostsData(postsData.map(post => {
      if (post.id === postId) {
        return {
          ...post,
          isLiked: !post.isLiked,
          likes: post.isLiked ? post.likes - 1 : post.likes + 1
        };
      }
      return post;
    }));
  };

  const handleCommentPost = (postId: string) => {
    alert('Comment feature coming soon! This will open a comment dialog.');
  };

  const handleSharePost = (postId: string) => {
    alert('Share feature coming soon! This will open share options.');
  };

  const handleCreatePost = () => {
    if (!newPostContent.trim()) {
      alert('Please write something before posting!');
      return;
    }

    const newPost: Post = {
      id: (postsData.length + 1).toString(),
      author: {
        name: 'You',
        avatar: '👤',
        role: 'member'
      },
      content: newPostContent,
      category: newPostCategory,
      timestamp: 'just now',
      likes: 0,
      comments: 0,
      views: 1,
      isLiked: false,
      tags: ['new']
    };
    
    setPostsData([newPost, ...postsData]);
    setNewPostContent('');
    setNewPostCategory('General Discussion');
    setShowNewPostModal(false);
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
            
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Community</h1>
                  <p className="text-gray-600 dark:text-slate-400">Connect, share, and support each other</p>
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-6 py-3 bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl text-white font-semibold flex items-center gap-2 hover:shadow-lg hover:shadow-purple-500/50 transition-all"
                onClick={() => setShowNewPostModal(true)}
              >
                <Plus className="w-5 h-5" />
                New Post
              </motion.button>
            </div>

            {/* Stats Bar */}
            <div className="grid grid-cols-4 gap-4">
              <AnimatedCard delay={0.1}>
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-4 text-center shadow-sm">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.members.toLocaleString()}</p>
                  <p className="text-sm text-gray-600 dark:text-slate-400">Members</p>
                </div>
              </AnimatedCard>
              <AnimatedCard delay={0.15}>
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-4 text-center shadow-sm">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.posts.toLocaleString()}</p>
                  <p className="text-sm text-gray-600 dark:text-slate-400">Posts</p>
                </div>
              </AnimatedCard>
              <AnimatedCard delay={0.2}>
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-4 text-center shadow-sm">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.groups}</p>
                  <p className="text-sm text-gray-600 dark:text-slate-400">Groups</p>
                </div>
              </AnimatedCard>
              <AnimatedCard delay={0.25}>
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-4 text-center shadow-sm">
                  <p className="text-2xl font-bold text-green-600 dark:text-green-500 flex items-center justify-center gap-2">
                    <span className="w-2 h-2 bg-green-600 dark:bg-green-500 rounded-full animate-pulse" />
                    {stats.activeNow}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-slate-400">Active Now</p>
                </div>
              </AnimatedCard>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="mb-6 flex items-center gap-4">
            <div className="flex gap-2">
              {[
                { id: 'feed', label: 'Feed', icon: MessageCircle },
                { id: 'groups', label: 'Groups', icon: Users },
                { id: 'trending', label: 'Trending', icon: TrendingUp }
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <motion.button
                    key={tab.id}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`px-6 py-3 rounded-xl flex items-center gap-2 font-semibold transition-all ${
                      isActive
                        ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-md'
                        : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-slate-700 hover:border-purple-300 dark:hover:border-purple-500 hover:bg-gray-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {tab.label}
                  </motion.button>
                );
              })}
            </div>

            <div className="flex-1 relative">
              <Search className="w-5 h-5 text-gray-400 dark:text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search posts, groups, or topics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl pl-12 pr-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900 transition-all"
              />
            </div>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-4 py-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-all"
            >
              <Filter className="w-5 h-5" />
            </motion.button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {activeTab === 'feed' && postsData.map((post, index) => (
                <AnimatedCard key={post.id} delay={index * 0.05}>
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6 hover:border-purple-400 dark:hover:border-purple-500 hover:shadow-lg transition-all">
                    {/* Post Header */}
                    <div className="flex items-start gap-4 mb-4">
                      <div className="text-4xl">{post.author.avatar}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-bold text-gray-900 dark:text-white">{post.author.name}</h3>
                          <span className={`text-xs px-2 py-1 rounded-full ${getRoleBadge(post.author.role).bg} ${getRoleBadge(post.author.role).text}`}>
                            {getRoleBadge(post.author.role).label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-400">
                          <span>{post.category}</span>
                          <span>•</span>
                          <Clock className="w-4 h-4" />
                          <span>{post.timestamp}</span>
                        </div>
                      </div>
                    </div>

                    {/* Post Content */}
                    <p className="text-gray-700 dark:text-slate-300 mb-4 leading-relaxed">{post.content}</p>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      {post.tags.map((tag) => (
                        <span key={tag} className="text-xs px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full">
                          #{tag}
                        </span>
                      ))}
                    </div>

                    {/* Post Stats & Actions */}
                    <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-slate-800">
                      <div className="flex items-center gap-6 text-sm text-gray-600 dark:text-slate-400">
                        <div className="flex items-center gap-2">
                          <Eye className="w-4 h-4" />
                          {post.views}
                        </div>
                        <div className="flex items-center gap-2">
                          <ThumbsUp className="w-4 h-4" />
                          {post.likes}
                        </div>
                        <div className="flex items-center gap-2">
                          <MessageSquare className="w-4 h-4" />
                          {post.comments}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          className={`p-2 rounded-lg transition-all ${
                            post.isLiked
                              ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                              : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400'
                          }`}
                          onClick={() => handleLikePost(post.id)}
                        >
                          <Heart className="w-5 h-5" fill={post.isLiked ? 'currentColor' : 'none'} />
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          className="p-2 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:text-purple-600 dark:hover:text-purple-400 transition-all"
                          onClick={() => handleCommentPost(post.id)}
                        >
                          <MessageCircle className="w-5 h-5" />
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          className="p-2 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 transition-all"
                          onClick={() => handleSharePost(post.id)}
                        >
                          <Share2 className="w-5 h-5" />
                        </motion.button>
                      </div>
                    </div>
                  </div>
                </AnimatedCard>
              ))}

              {activeTab === 'groups' && groups.map((group, index) => (
                <AnimatedCard key={group.id} delay={index * 0.05}>
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6 hover:border-purple-400 dark:hover:border-purple-500 hover:shadow-lg transition-all">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-xl font-bold text-gray-900 dark:text-white">{group.name}</h3>
                          {group.privacy === 'private' ? (
                            <Lock className="w-4 h-4 text-gray-600 dark:text-slate-400" />
                          ) : (
                            <Globe className="w-4 h-4 text-green-600 dark:text-green-500" />
                          )}
                        </div>
                        <p className="text-gray-600 dark:text-slate-400 mb-3">{group.description}</p>
                        <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-slate-400">
                          <span className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            {group.members.toLocaleString()} members
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageCircle className="w-4 h-4" />
                            {group.posts} posts
                          </span>
                        </div>
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className={`px-6 py-2 rounded-xl font-semibold transition-all ${
                          group.isJoined
                            ? 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 border-2 border-gray-300 dark:border-slate-700'
                            : 'bg-gradient-to-r from-purple-500 to-blue-500 text-white'
                        }`}
                      >
                        {group.isJoined ? 'Joined' : 'Join Group'}
                      </motion.button>
                    </div>
                  </div>
                </AnimatedCard>
              ))}

              {activeTab === 'trending' && (
                <div className="space-y-4">
                  {trendingTopics.map((topic, index) => (
                    <AnimatedCard key={topic.tag} delay={index * 0.05}>
                      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6 hover:border-purple-400 dark:hover:border-purple-500 hover:shadow-lg transition-all">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">#{topic.tag}</h3>
                            <p className="text-gray-600 dark:text-slate-400">{topic.posts} posts</p>
                          </div>
                          <TrendingUp className="w-8 h-8 text-purple-600 dark:text-purple-500" />
                        </div>
                      </div>
                    </AnimatedCard>
                  ))}
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Trending Topics */}
              <AnimatedCard delay={0.3}>
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6 shadow-sm">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-500" />
                    Trending Topics
                  </h3>
                  <div className="space-y-3">
                    {trendingTopics.slice(0, 5).map((topic, index) => (
                      <motion.button
                        key={topic.tag}
                        whileHover={{ scale: 1.02 }}
                        className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-purple-50 hover:border-purple-200 border border-transparent transition-all"
                      >
                        <span className="text-gray-700 font-medium">#{topic.tag}</span>
                        <span className="text-sm text-gray-600">{topic.posts}</span>
                      </motion.button>
                    ))}
                  </div>
                </div>
              </AnimatedCard>

              {/* Guidelines */}
              <AnimatedCard delay={0.4}>
                <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-2xl border border-purple-200 p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-3">Community Guidelines</h3>
                  <ul className="space-y-2 text-sm text-gray-700">
                    <li className="flex items-start gap-2">
                      <span className="text-purple-600">•</span>
                      Be respectful and supportive
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-600">•</span>
                      Share your experiences, not advice
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-600">•</span>
                      Maintain privacy and confidentiality
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-600">•</span>
                      Report harmful content
                    </li>
                  </ul>
                </div>
              </AnimatedCard>
            </div>
          </div>
        </div>
      </div>

      {/* New Post Modal */}
      {showNewPostModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-blue-900/20 backdrop-blur-md flex items-center justify-center z-50 p-4"
          onClick={() => setShowNewPostModal(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl p-8 w-full max-w-2xl shadow-2xl"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-900">Create a New Post</h3>
              <button
                className="text-gray-400 hover:text-gray-600 transition-colors"
                onClick={() => setShowNewPostModal(false)}
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <textarea
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                placeholder="Write your post here..."
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all resize-none"
                rows={6}
              />

              <div className="flex items-center gap-4">
                <label className="text-gray-700 font-medium">Category:</label>
                <select
                  value={newPostCategory}
                  onChange={(e) => setNewPostCategory(e.target.value)}
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all"
                >
                  <option value="General Discussion">General Discussion</option>
                  <option value="Wins & Progress">Wins & Progress</option>
                  <option value="Support & Advice">Support & Advice</option>
                  <option value="Professional Insights">Professional Insights</option>
                  <option value="Community Events">Community Events</option>
                </select>
              </div>

              <div className="flex items-center gap-4">
                <label className="text-gray-700 font-medium">Tags:</label>
                <input
                  type="text"
                  placeholder="Add tags (comma-separated)"
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all"
                />
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full px-6 py-4 bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl text-white font-semibold text-lg flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-purple-500/50 transition-all"
                onClick={handleCreatePost}
              >
                <Plus className="w-5 h-5" />
                Post
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AppLayout>
  );
}