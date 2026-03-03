import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import {
  MessageSquare,
  Users,
  Flag,
  TrendingUp,
  ThumbsUp,
  Eye,
  AlertTriangle,
  Lock,
  Unlock,
  Trash2,
  MoreVertical,
  Search,
  X,
  Calendar,
  User,
  Tag,
} from "lucide-react";

interface ForumPost {
  id: string;
  author: string;
  authorAvatar: string;
  title: string;
  content: string;
  category: string;
  timestamp: Date;
  likes: number;
  replies: number;
  views: number;
  flagged: boolean;
  flagCount: number;
  status: "active" | "locked" | "deleted" | "pending";
  tags: string[];
}

interface Group {
  id: string;
  name: string;
  description: string;
  members: number;
  posts: number;
  category: string;
  privacy: "public" | "private";
  moderators: string[];
  active: boolean;
}

export function CommunityManagement() {
  const [selectedTab, setSelectedTab] = useState<"posts" | "groups" | "reported">("posts");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  
  // Modal states
  const [viewingPost, setViewingPost] = useState<ForumPost | null>(null);
  const [lockingPost, setLockingPost] = useState<ForumPost | null>(null);
  const [deletingPost, setDeletingPost] = useState<ForumPost | null>(null);
  const [viewingGroup, setViewingGroup] = useState<Group | null>(null);
  const [groupMenuOpen, setGroupMenuOpen] = useState<string | null>(null);

  // Mock forum posts
  const forumPosts: ForumPost[] = [
    {
      id: "p001",
      author: "Sarah Johnson",
      authorAvatar: "SJ",
      title: "Daily meditation techniques that helped me",
      content: "I wanted to share some meditation techniques that have really helped me manage my anxiety. Starting with just 5 minutes a day made a huge difference...",
      category: "Mindfulness",
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      likes: 45,
      replies: 12,
      views: 234,
      flagged: false,
      flagCount: 0,
      status: "active",
      tags: ["meditation", "anxiety", "mindfulness"]
    },
    {
      id: "p002",
      author: "Michael Chen",
      authorAvatar: "MC",
      title: "How do you deal with panic attacks?",
      content: "I've been struggling with panic attacks lately. Does anyone have advice on techniques that work in the moment?",
      category: "Support",
      timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000),
      likes: 28,
      replies: 34,
      views: 567,
      flagged: false,
      flagCount: 0,
      status: "active",
      tags: ["panic", "anxiety", "help"]
    },
    {
      id: "p003",
      author: "Anonymous User",
      authorAvatar: "AU",
      title: "Feeling hopeless and need support",
      content: "I don't know what to do anymore. Everything feels overwhelming and I can't see a way forward...",
      category: "Crisis Support",
      timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      likes: 89,
      replies: 67,
      views: 892,
      flagged: true,
      flagCount: 3,
      status: "active",
      tags: ["depression", "crisis", "support"]
    },
    {
      id: "p004",
      author: "Spam Bot",
      authorAvatar: "SB",
      title: "Buy wellness supplements here!!!",
      content: "Hey everyone! I've been selling these amazing wellness supplements that totally cured my depression. DM me for details and discounts!",
      category: "General",
      timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      likes: 2,
      replies: 8,
      views: 156,
      flagged: true,
      flagCount: 12,
      status: "pending",
      tags: ["spam", "flagged"]
    },
    {
      id: "p005",
      author: "Emma Rodriguez",
      authorAvatar: "ER",
      title: "30 days of therapy - My progress!",
      content: "Just wanted to share that I completed my first 30 days of consistent therapy sessions! It's been challenging but so worth it.",
      category: "Success Stories",
      timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      likes: 156,
      replies: 45,
      views: 1234,
      flagged: false,
      flagCount: 0,
      status: "active",
      tags: ["progress", "therapy", "success"]
    }
  ];

  // Mock groups
  const groups: Group[] = [
    {
      id: "g001",
      name: "Anxiety Support Group",
      description: "A safe space to share experiences and coping strategies for managing anxiety",
      members: 1847,
      posts: 423,
      category: "Mental Health",
      privacy: "public",
      moderators: ["Sarah J.", "Dr. Mike"],
      active: true
    },
    {
      id: "g002",
      name: "Mindfulness & Meditation",
      description: "Daily meditation practices and mindfulness techniques",
      members: 2341,
      posts: 892,
      category: "Wellness",
      privacy: "public",
      moderators: ["Emma R.", "Alex T."],
      active: true
    },
    {
      id: "g003",
      name: "Parent Support Network",
      description: "Support for parents dealing with mental health challenges",
      members: 856,
      posts: 267,
      category: "Support",
      privacy: "private",
      moderators: ["Jessica L."],
      active: true
    },
    {
      id: "g004",
      name: "Depression Warriors",
      description: "Fighting depression together, one day at a time",
      members: 3142,
      posts: 1523,
      category: "Mental Health",
      privacy: "public",
      moderators: ["Dr. Sarah", "Mike C.", "Anna W."],
      active: true
    }
  ];

  const filteredPosts = forumPosts.filter(post => {
    const matchesSearch = post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         post.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         post.author.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === "all" || post.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const flaggedPosts = forumPosts.filter(post => post.flagged);

  const stats = {
    totalPosts: forumPosts.length,
    flaggedContent: flaggedPosts.length,
    totalGroups: groups.length,
    activeDiscussions: forumPosts.filter(p => p.status === "active").length
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case "active": return "bg-green-100 text-green-700";
      case "locked": return "bg-yellow-100 text-yellow-700";
      case "deleted": return "bg-red-100 text-red-700";
      case "pending": return "bg-orange-100 text-orange-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const handleViewPost = (post: ForumPost) => {
    setViewingPost(post);
  };

  const handleLockToggle = (post: ForumPost) => {
    setLockingPost(post);
  };

  const handleDelete = (post: ForumPost) => {
    setDeletingPost(post);
  };

  const confirmLockToggle = () => {
    if (!lockingPost) return;
    
    const action = lockingPost.status === "active" ? "locked" : "unlocked";
    alert(`✅ Post ${action} successfully!\n\nPost: "${lockingPost.title}"\nAuthor: ${lockingPost.author}\n\nThe post has been ${action}.`);
    
    setLockingPost(null);
  };

  const confirmDelete = () => {
    if (!deletingPost) return;
    
    alert(`✅ Post deleted successfully!\n\nPost: "${deletingPost.title}"\nAuthor: ${deletingPost.author}\n\nThe post has been permanently removed.`);
    
    setDeletingPost(null);
  };

  return (
    <AdminLayoutNew>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-3xl font-bold text-gray-900">Community Management</h1>
          <p className="text-gray-600 mt-1">Manage forum posts, groups, and reported content</p>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600">
                <MessageSquare className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Total Posts</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalPosts}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-red-500 to-pink-600">
                <Flag className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Flagged</p>
                <p className="text-2xl font-bold text-gray-900">{stats.flaggedContent}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Groups</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalGroups}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Active</p>
                <p className="text-2xl font-bold text-gray-900">{stats.activeDiscussions}</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white rounded-2xl p-2 shadow-lg border border-gray-100 flex gap-2"
        >
          <button
            onClick={() => setSelectedTab("posts")}
            className={`flex-1 px-4 py-2 rounded-xl font-medium transition-colors ${
              selectedTab === "posts"
                ? "bg-blue-500 text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <MessageSquare className="w-4 h-4 inline mr-2" />
            Forum Posts
          </button>
          <button
            onClick={() => setSelectedTab("groups")}
            className={`flex-1 px-4 py-2 rounded-xl font-medium transition-colors ${
              selectedTab === "groups"
                ? "bg-blue-500 text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <Users className="w-4 h-4 inline mr-2" />
            Groups
          </button>
          <button
            onClick={() => setSelectedTab("reported")}
            className={`flex-1 px-4 py-2 rounded-xl font-medium transition-colors ${
              selectedTab === "reported"
                ? "bg-blue-500 text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <Flag className="w-4 h-4 inline mr-2" />
            Reported ({flaggedPosts.length})
          </button>
        </motion.div>

        {/* Forum Posts Tab */}
        {selectedTab === "posts" && (
          <>
            {/* Filters */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
            >
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search posts by title, content, or author..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="px-4 py-2 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="all">All Categories</option>
                  <option value="Mindfulness">Mindfulness</option>
                  <option value="Support">Support</option>
                  <option value="Crisis Support">Crisis Support</option>
                  <option value="Success Stories">Success Stories</option>
                  <option value="General">General</option>
                </select>
              </div>
            </motion.div>

            {/* Posts List */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {filteredPosts.map((post, index) => (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`bg-white rounded-2xl p-6 shadow-lg border-2 transition-all ${
                    post.flagged ? "border-red-300" : "border-gray-100"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold flex-shrink-0">
                      {post.authorAvatar}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold text-gray-900">{post.title}</h3>
                            {post.flagged && (
                              <Flag className="w-4 h-4 text-red-500" />
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <span>{post.author}</span>
                            <span>•</span>
                            <span>{post.category}</span>
                            <span>•</span>
                            <span>{new Date(post.timestamp).toLocaleString()}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded-lg text-xs font-medium ${getStatusColor(post.status)}`}>
                            {post.status}
                          </span>
                        </div>
                      </div>

                      <p className="text-gray-700 mb-3">{post.content}</p>

                      <div className="flex flex-wrap gap-2 mb-3">
                        {post.tags.map(tag => (
                          <span key={tag} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-lg">
                            #{tag}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <ThumbsUp className="w-4 h-4" />
                            {post.likes}
                          </div>
                          <div className="flex items-center gap-1">
                            <MessageSquare className="w-4 h-4" />
                            {post.replies}
                          </div>
                          <div className="flex items-center gap-1">
                            <Eye className="w-4 h-4" />
                            {post.views}
                          </div>
                          {post.flagged && (
                            <div className="flex items-center gap-1 text-red-600">
                              <AlertTriangle className="w-4 h-4" />
                              {post.flagCount} flags
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleViewPost(post)}
                            className="p-2 rounded-lg hover:bg-blue-50 text-blue-600"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </motion.button>

                          {post.status === "active" ? (
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => handleLockToggle(post)}
                              className="p-2 rounded-lg hover:bg-yellow-50 text-yellow-600"
                              title="Lock Post"
                            >
                              <Lock className="w-4 h-4" />
                            </motion.button>
                          ) : (
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => handleLockToggle(post)}
                              className="p-2 rounded-lg hover:bg-green-50 text-green-600"
                              title="Unlock Post"
                            >
                              <Unlock className="w-4 h-4" />
                            </motion.button>
                          )}

                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleDelete(post)}
                            className="p-2 rounded-lg hover:bg-red-50 text-red-600"
                            title="Delete Post"
                          >
                            <Trash2 className="w-4 h-4" />
                          </motion.button>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </>
        )}

        {/* Groups Tab */}
        {selectedTab === "groups" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid md:grid-cols-2 gap-6"
          >
            {groups.map((group, index) => (
              <motion.div
                key={group.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-bold text-gray-900 text-lg">{group.name}</h3>
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                        group.privacy === "public" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                      }`}>
                        {group.privacy}
                      </span>
                    </div>
                    <p className="text-gray-600 text-sm mb-3">{group.description}</p>
                    <p className="text-xs text-gray-500">Category: {group.category}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                  <div>
                    <p className="text-gray-600">Members</p>
                    <p className="font-bold text-gray-900">{group.members.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Posts</p>
                    <p className="font-bold text-gray-900">{group.posts}</p>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-xs text-gray-600 mb-1">Moderators</p>
                  <div className="flex flex-wrap gap-1">
                    {group.moderators.map(mod => (
                      <span key={mod} className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-lg">
                        {mod}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setViewingGroup(group)}
                    className="flex-1 px-3 py-2 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-700 text-sm font-medium"
                  >
                    View Details
                  </motion.button>
                  <div className="relative">
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setGroupMenuOpen(groupMenuOpen === group.id ? null : group.id)}
                      className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </motion.button>
                    
                    {/* Dropdown Menu */}
                    <AnimatePresence>
                      {groupMenuOpen === group.id && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10"
                        >
                          <button
                            onClick={() => {
                              setGroupMenuOpen(null);
                              alert(`✅ Editing group: ${group.name}`);
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                          >
                            Edit Group
                          </button>
                          <button
                            onClick={() => {
                              setGroupMenuOpen(null);
                              alert(`✅ Managing moderators for: ${group.name}`);
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                          >
                            Manage Moderators
                          </button>
                          <button
                            onClick={() => {
                              setGroupMenuOpen(null);
                              alert(`✅ Viewing analytics for: ${group.name}`);
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                          >
                            View Analytics
                          </button>
                          <div className="border-t border-gray-200 my-1"></div>
                          <button
                            onClick={() => {
                              setGroupMenuOpen(null);
                              if (confirm(`Are you sure you want to ${group.active ? 'archive' : 'activate'} ${group.name}?`)) {
                                alert(`✅ Group ${group.active ? 'archived' : 'activated'}: ${group.name}`);
                              }
                            }}
                            className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 ${
                              group.active ? 'text-yellow-600' : 'text-green-600'
                            }`}
                          >
                            {group.active ? 'Archive Group' : 'Activate Group'}
                          </button>
                          <button
                            onClick={() => {
                              setGroupMenuOpen(null);
                              if (confirm(`Are you sure you want to delete ${group.name}? This action cannot be undone.`)) {
                                alert(`✅ Group deleted: ${group.name}`);
                              }
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                          >
                            Delete Group
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Reported Tab */}
        {selectedTab === "reported" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
          >
            <h2 className="text-xl font-bold text-gray-900 mb-6">Flagged Content ({flaggedPosts.length})</h2>

            <div className="space-y-4">
              {flaggedPosts.map((post, index) => (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="border-2 border-red-300 rounded-xl p-5 bg-red-50"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center text-white font-bold flex-shrink-0">
                      {post.authorAvatar}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold text-gray-900">{post.title}</h3>
                            <Flag className="w-4 h-4 text-red-600" />
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <span>{post.author}</span>
                            <span>•</span>
                            <span>{post.category}</span>
                          </div>
                        </div>

                        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${getStatusColor(post.status)}`}>
                          {post.status}
                        </span>
                      </div>

                      <p className="text-gray-700 mb-3">{post.content}</p>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-red-600 font-medium">
                          <AlertTriangle className="w-4 h-4" />
                          {post.flagCount} flags reported
                        </div>

                        <div className="flex gap-2">
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleViewPost(post)}
                            className="p-2 rounded-lg hover:bg-blue-50 text-blue-600"
                          >
                            <Eye className="w-4 h-4" />
                          </motion.button>

                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleLockToggle(post)}
                            className="p-2 rounded-lg hover:bg-yellow-50 text-yellow-600"
                          >
                            <Lock className="w-4 h-4" />
                          </motion.button>

                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleDelete(post)}
                            className="p-2 rounded-lg hover:bg-red-50 text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </motion.button>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* View Post Modal */}
        <AnimatePresence>
          {viewingPost && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                onClick={() => setViewingPost(null)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                onClick={() => setViewingPost(null)}
              >
                <div
                  className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Modal Header */}
                  <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">Post Details</h2>
                      <p className="text-sm text-gray-600 mt-1">{viewingPost.title}</p>
                    </div>
                    <button
                      onClick={() => setViewingPost(null)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5 text-gray-500" />
                    </button>
                  </div>

                  {/* Modal Content */}
                  <div className="p-6 space-y-6">
                    {/* Author Info */}
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xl">
                        {viewingPost.authorAvatar}
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-gray-900">{viewingPost.author}</h3>
                        <p className="text-sm text-gray-600">{new Date(viewingPost.timestamp).toLocaleString()}</p>
                      </div>
                    </div>

                    {/* Post Info */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                        <Tag className="w-5 h-5 text-gray-600 mt-0.5" />
                        <div>
                          <p className="text-xs text-gray-600 mb-1">Category</p>
                          <p className="font-medium text-gray-900">{viewingPost.category}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                        <Flag className="w-5 h-5 text-gray-600 mt-0.5" />
                        <div>
                          <p className="text-xs text-gray-600 mb-1">Status</p>
                          <span className={`px-2 py-1 rounded-lg text-xs font-medium ${getStatusColor(viewingPost.status)}`}>
                            {viewingPost.status}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Content */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-2">Content</h3>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-gray-700 leading-relaxed">{viewingPost.content}</p>
                      </div>
                    </div>

                    {/* Tags */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-2">Tags</h3>
                      <div className="flex flex-wrap gap-2">
                        {viewingPost.tags.map(tag => (
                          <span key={tag} className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-lg">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Engagement Stats */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-3">Engagement</h3>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="bg-gray-50 rounded-lg p-3 text-center">
                          <ThumbsUp className="w-5 h-5 text-gray-600 mx-auto mb-1" />
                          <p className="text-2xl font-bold text-gray-900">{viewingPost.likes}</p>
                          <p className="text-xs text-gray-600">Likes</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3 text-center">
                          <MessageSquare className="w-5 h-5 text-gray-600 mx-auto mb-1" />
                          <p className="text-2xl font-bold text-gray-900">{viewingPost.replies}</p>
                          <p className="text-xs text-gray-600">Replies</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3 text-center">
                          <Eye className="w-5 h-5 text-gray-600 mx-auto mb-1" />
                          <p className="text-2xl font-bold text-gray-900">{viewingPost.views}</p>
                          <p className="text-xs text-gray-600">Views</p>
                        </div>
                      </div>
                    </div>

                    {/* Flagged Warning */}
                    {viewingPost.flagged && (
                      <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
                        <div className="flex items-center gap-2 text-red-700">
                          <AlertTriangle className="w-5 h-5" />
                          <span className="font-semibold">This post has been flagged {viewingPost.flagCount} times</span>
                        </div>
                        <p className="text-sm text-red-600 mt-2">Please review this content for policy violations.</p>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-4 border-t">
                      <button
                        onClick={() => {
                          setViewingPost(null);
                          handleLockToggle(viewingPost);
                        }}
                        className="flex-1 px-4 py-3 rounded-xl bg-yellow-600 hover:bg-yellow-700 text-white font-medium"
                      >
                        {viewingPost.status === "active" ? "Lock Post" : "Unlock Post"}
                      </button>
                      <button
                        onClick={() => {
                          setViewingPost(null);
                          handleDelete(viewingPost);
                        }}
                        className="flex-1 px-4 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium"
                      >
                        Delete Post
                      </button>
                      <button
                        onClick={() => setViewingPost(null)}
                        className="px-4 py-3 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Lock/Unlock Confirmation Modal */}
        <AnimatePresence>
          {lockingPost && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                onClick={() => setLockingPost(null)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                onClick={() => setLockingPost(null)}
              >
                <div
                  className="bg-white rounded-2xl shadow-2xl max-w-md w-full"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="p-6">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${
                      lockingPost.status === "active" ? "bg-yellow-100" : "bg-green-100"
                    }`}>
                      {lockingPost.status === "active" ? (
                        <Lock className="w-6 h-6 text-yellow-600" />
                      ) : (
                        <Unlock className="w-6 h-6 text-green-600" />
                      )}
                    </div>
                    
                    <h2 className="text-xl font-bold text-gray-900 text-center mb-2">
                      {lockingPost.status === "active" ? "Lock Post?" : "Unlock Post?"}
                    </h2>
                    <p className="text-gray-600 text-center mb-6">
                      {lockingPost.status === "active" 
                        ? "Locking this post will prevent users from replying. Are you sure?"
                        : "Unlocking this post will allow users to reply again. Are you sure?"
                      }
                    </p>

                    <div className="bg-gray-50 rounded-lg p-4 mb-6">
                      <p className="text-sm font-semibold text-gray-900 mb-1">{lockingPost.title}</p>
                      <p className="text-xs text-gray-600">by {lockingPost.author}</p>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={confirmLockToggle}
                        className={`flex-1 px-4 py-3 rounded-xl text-white font-medium ${
                          lockingPost.status === "active" 
                            ? "bg-yellow-600 hover:bg-yellow-700"
                            : "bg-green-600 hover:bg-green-700"
                        }`}
                      >
                        {lockingPost.status === "active" ? "Lock" : "Unlock"}
                      </button>

                      <button
                        onClick={() => setLockingPost(null)}
                        className="flex-1 px-4 py-3 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Delete Confirmation Modal */}
        <AnimatePresence>
          {deletingPost && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                onClick={() => setDeletingPost(null)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                onClick={() => setDeletingPost(null)}
              >
                <div
                  className="bg-white rounded-2xl shadow-2xl max-w-md w-full"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="p-6">
                    <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                      <Trash2 className="w-6 h-6 text-red-600" />
                    </div>
                    
                    <h2 className="text-xl font-bold text-gray-900 text-center mb-2">Delete Post?</h2>
                    <p className="text-gray-600 text-center mb-6">
                      This action cannot be undone. The post and all its replies will be permanently deleted.
                    </p>

                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                      <p className="text-sm font-semibold text-gray-900 mb-1">{deletingPost.title}</p>
                      <p className="text-xs text-gray-600">by {deletingPost.author}</p>
                      <p className="text-xs text-gray-600 mt-2">{deletingPost.replies} replies • {deletingPost.likes} likes • {deletingPost.views} views</p>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={confirmDelete}
                        className="flex-1 px-4 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium"
                      >
                        Delete
                      </button>

                      <button
                        onClick={() => setDeletingPost(null)}
                        className="flex-1 px-4 py-3 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* View Group Details Modal */}
        <AnimatePresence>
          {viewingGroup && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                onClick={() => setViewingGroup(null)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                onClick={() => setViewingGroup(null)}
              >
                <div
                  className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Modal Header */}
                  <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">Group Details</h2>
                      <p className="text-sm text-gray-600 mt-1">{viewingGroup.name}</p>
                    </div>
                    <button
                      onClick={() => setViewingGroup(null)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5 text-gray-500" />
                    </button>
                  </div>

                  {/* Modal Content */}
                  <div className="p-6 space-y-6">
                    {/* Group Info */}
                    <div>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-2xl">
                          {viewingGroup.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-xl text-gray-900">{viewingGroup.name}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                              viewingGroup.privacy === "public" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                            }`}>
                              {viewingGroup.privacy}
                            </span>
                            <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                              viewingGroup.active ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"
                            }`}>
                              {viewingGroup.active ? "Active" : "Archived"}
                            </span>
                          </div>
                        </div>
                      </div>
                      <p className="text-gray-700">{viewingGroup.description}</p>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-gray-50 rounded-lg p-4 text-center">
                        <Users className="w-6 h-6 text-gray-600 mx-auto mb-2" />
                        <p className="text-2xl font-bold text-gray-900">{viewingGroup.members.toLocaleString()}</p>
                        <p className="text-xs text-gray-600">Members</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4 text-center">
                        <MessageSquare className="w-6 h-6 text-gray-600 mx-auto mb-2" />
                        <p className="text-2xl font-bold text-gray-900">{viewingGroup.posts}</p>
                        <p className="text-xs text-gray-600">Posts</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4 text-center">
                        <Tag className="w-6 h-6 text-gray-600 mx-auto mb-2" />
                        <p className="text-sm font-semibold text-gray-900">{viewingGroup.category}</p>
                        <p className="text-xs text-gray-600">Category</p>
                      </div>
                    </div>

                    {/* Moderators */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-3">Moderators</h3>
                      <div className="flex flex-wrap gap-2">
                        {viewingGroup.moderators.map(mod => (
                          <div key={mod} className="flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                              {mod.substring(0, 2).toUpperCase()}
                            </div>
                            <span className="text-sm font-medium text-gray-900">{mod}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Recent Activity */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-3">Recent Activity</h3>
                      <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <TrendingUp className="w-4 h-4 text-green-600" />
                          <span className="text-gray-700">23% increase in posts this week</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Users className="w-4 h-4 text-blue-600" />
                          <span className="text-gray-700">156 new members joined this month</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <MessageSquare className="w-4 h-4 text-purple-600" />
                          <span className="text-gray-700">Daily average: 12 posts per day</span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-4 border-t">
                      <button
                        onClick={() => {
                          setViewingGroup(null);
                          alert(`✅ Editing group: ${viewingGroup.name}`);
                        }}
                        className="flex-1 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium"
                      >
                        Edit Group
                      </button>
                      <button
                        onClick={() => {
                          setViewingGroup(null);
                          alert(`✅ Managing moderators for: ${viewingGroup.name}`);
                        }}
                        className="flex-1 px-4 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-medium"
                      >
                        Manage Moderators
                      </button>
                      <button
                        onClick={() => setViewingGroup(null)}
                        className="px-4 py-3 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </AdminLayoutNew>
  );
}