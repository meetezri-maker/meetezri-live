import { AppLayout } from "../../components/AppLayout";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import { motion } from "motion/react";
import { Link, useNavigate } from "react-router-dom";
import {
  User,
  Mail,
  Phone,
  Calendar,
  MapPin,
  Edit,
  Camera,
  Bell,
  Lock,
  Shield,
  Heart,
  Volume2,
  Palette,
  LogOut,
  ChevronRight,
  Trash2,
  AlertTriangle,
  X,
  Activity,
  Pill,
  Target,
  Zap,
  Users,
  Loader2
} from "lucide-react";
import { useState, useEffect } from "react";

import { api } from "@/lib/api";
import { useAuth } from "@/app/contexts/AuthContext";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Skeleton } from "../../components/ui/skeleton";

export function UserProfile() {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [joinedAt, setJoinedAt] = useState<string>("");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    birthday: "",
    location: "",
    pronouns: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
    emergency_contact_relationship: "",
    in_therapy: "",
    on_medication: "",
    selected_goals: [] as string[],
    selected_triggers: [] as string[],
    selected_avatar: "",
    selected_voice: "",
    selected_environment: ""
  });

  const [userStats, setUserStats] = useState({
    sessions: 0,
    checkins: 0,
    daysActive: 0
  });

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    try {
      const profile = await api.getMe();
      console.log("Loaded profile data:", profile); // Debug logging
      setFormData({
        name: profile.full_name || "",
        email: profile.email || user?.email || "",
        phone: profile.phone || "",
        birthday: profile.age ? `${profile.age} ` : "",
        location: profile.timezone || "",
        pronouns: profile.pronouns || "",
        emergency_contact_name: profile.emergency_contact_name || "",
        emergency_contact_phone: profile.emergency_contact_phone || "",
        emergency_contact_relationship: profile.emergency_contact_relationship || "",
        in_therapy: profile.in_therapy || "Not specified",
        on_medication: profile.on_medication || "Not specified",
        selected_goals: profile.selected_goals || [],
        selected_triggers: profile.selected_triggers || [],
        selected_avatar: profile.selected_avatar || "Default Avatar",
        selected_voice: profile.selected_voice || "Default Voice",
        selected_environment: profile.selected_environment || "Default Environment"
      });
      setProfileImage(profile.avatar_url);
      if (profile.created_at) {
        setJoinedAt(new Date(profile.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short' }));
      }

      // Update stats from real data
      if (profile.stats) {
        setUserStats({
          sessions: profile.stats.completed_sessions || 0,
          checkins: profile.stats.total_checkins || 0,
          daysActive: profile.stats.streak_days || 0
        });
      } else {
        // Fallback for partial data
        setUserStats({
          sessions: 0,
          checkins: 0,
          daysActive: profile.streak_days || 0
        });
      }
    } catch (error) {
      console.error("Failed to load profile:", error);
      toast.error("Failed to load profile");
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && user) {
      setIsUploading(true);
      try {
        const fileExt = file.name.split('.').pop();
        const filePath = `${user.id}/${Math.random()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);

        setProfileImage(publicUrl);
        
        // Auto-save the profile image
        await api.updateProfile({
          avatar_url: publicUrl
        });
        
        toast.success("Profile photo updated successfully");
      } catch (error) {
        console.error('Error uploading image:', error);
        toast.error("Error uploading image");
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleSaveProfile = async () => {
    if (isEditing) {
      setIsSaving(true);
      try {
        const updatedProfile = await api.updateProfile({
          full_name: formData.name,
          email: formData.email,
          phone: formData.phone,
          age: formData.birthday, // Mapped from birthday field which is actually age
          avatar_url: profileImage,
          pronouns: formData.pronouns,
          timezone: formData.location,
          in_therapy: formData.in_therapy,
          on_medication: formData.on_medication,
          selected_goals: formData.selected_goals,
          selected_triggers: formData.selected_triggers,
          emergency_contact_name: formData.emergency_contact_name,
          emergency_contact_phone: formData.emergency_contact_phone,
          emergency_contact_relationship: formData.emergency_contact_relationship
        });
        setFormData(prev => ({
          ...prev,
          name: updatedProfile.full_name || '',
          email: updatedProfile.email || '',
          phone: updatedProfile.phone || '',
          birthday: updatedProfile.age || '',
          pronouns: updatedProfile.pronouns || '',
          location: updatedProfile.timezone || '',
          in_therapy: updatedProfile.in_therapy || 'Not specified',
          on_medication: updatedProfile.on_medication || 'Not specified',
          selected_goals: updatedProfile.selected_goals || [],
          selected_triggers: updatedProfile.selected_triggers || [],
          emergency_contact_name: updatedProfile.emergency_contact_name || '',
          emergency_contact_phone: updatedProfile.emergency_contact_phone || '',
          emergency_contact_relationship: updatedProfile.emergency_contact_relationship || ''
        }));
        toast.success("Profile updated successfully!");
        setIsEditing(false);
      } catch (error) {
        console.error("Profile update error:", error);
        toast.error("Failed to update profile");
      } finally {
        setIsSaving(false);
      }
    } else {
      setIsEditing(true);
    }
  };

  const handleLogout = async () => {
    if (confirm('Are you sure you want to log out?')) {
      setIsLoggingOut(true);
      try {
        await signOut();
        navigate('/login');
      } catch (error) {
        console.error("Logout error:", error);
        toast.error("Failed to log out");
        setIsLoggingOut(false);
      }
    }
  };

  const stats = [
    { label: "Sessions", value: userStats.sessions.toString(), icon: Heart },
    { label: "Check-ins", value: userStats.checkins.toString(), icon: Calendar },
    { label: "Days Active", value: userStats.daysActive.toString(), icon: Calendar }
  ];

  const preferences = [
    {
      icon: Volume2,
      title: "Voice",
      value: formData.selected_voice || "Not set",
      link: "/app/settings"
    },
    {
      icon: User,
      title: "Avatar",
      value: formData.selected_avatar || "Not set",
      link: "/app/settings"
    },
    {
      icon: Palette,
      title: "Environment",
      value: formData.selected_environment || "Not set",
      link: "/app/settings"
    }
  ];

  const settingsSections = [
    {
      title: "Account",
      items: [
        { icon: Bell, label: "Notifications", link: "/app/settings/notifications" },
        { icon: Lock, label: "Privacy & Security", link: "/app/settings/privacy" },
        { icon: Shield, label: "Data & Permissions", link: "/app/settings/privacy" }
      ]
    },
    {
      title: "Support",
      items: [
        { icon: Heart, label: "Emergency Contacts", link: "/app/settings/emergency-contacts" },
        { icon: Mail, label: "Contact Support", link: "/app/settings/help-support" },
        { icon: Shield, label: "Safety Plan", link: "/app/settings/safety-plan" }
      ]
    }
  ];

  if (isLoading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="mb-8">
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-80" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="space-y-6">
              <Card className="p-6">
                <div className="flex flex-col items-center mb-6">
                  <Skeleton className="w-32 h-32 rounded-full mb-4" />
                  <Skeleton className="h-5 w-40 mb-1" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <div className="grid grid-cols-3 gap-3 mb-6">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="text-center space-y-2">
                      <Skeleton className="h-4 w-4 mx-auto" />
                      <Skeleton className="h-5 w-10 mx-auto" />
                      <Skeleton className="h-3 w-16 mx-auto" />
                    </div>
                  ))}
                </div>
                <Skeleton className="h-10 w-full" />
              </Card>
              <Card className="p-6">
                <Skeleton className="h-5 w-40 mb-4" />
                <div className="space-y-3">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-8 w-8 rounded-lg" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-40" />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
            <div className="lg:col-span-2 space-y-6">
              <Card className="p-6">
                <Skeleton className="h-5 w-48 mb-4" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ))}
                </div>
              </Card>
              <Card className="p-6">
                <Skeleton className="h-5 w-40 mb-4" />
                <div className="space-y-3">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-40" />
                        </div>
                      </div>
                      <Skeleton className="h-4 w-4" />
                    </div>
                  ))}
                </div>
              </Card>
            </div>
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
          <h1 className="text-3xl font-bold mb-2">Profile & Settings</h1>
          <p className="text-muted-foreground">
            Manage your account and preferences
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Profile Card & Preferences */}
          <div className="lg:col-span-1 space-y-6">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="p-6 shadow-xl">
                <div className="text-center mb-6">
                  <div className="relative inline-block mb-4">
                    <input
                      type="file"
                      id="profile-image-upload"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      onClick={() => !isUploading && document.getElementById('profile-image-upload')?.click()}
                      className="w-32 h-32 bg-gradient-to-br from-blue-600 to-indigo-600 dark:from-blue-500 dark:to-indigo-500 rounded-full flex items-center justify-center text-5xl cursor-pointer relative overflow-hidden"
                    >
                      {isUploading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-20">
                          <Loader2 className="w-8 h-8 text-white animate-spin" />
                        </div>
                      )}
                      {profileImage ? (
                        <img src={profileImage} alt="Profile" className="w-full h-full object-cover rounded-full" />
                      ) : (
                        '👤'
                      )}
                      <motion.div
                        whileHover={{ opacity: 1 }}
                        className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 transition-opacity"
                      >
                        <div className="text-center">
                          <Camera className="w-8 h-8 text-white mx-auto mb-1" />
                          <p className="text-white text-xs">Change Photo</p>
                        </div>
                      </motion.div>
                    </motion.div>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => document.getElementById('profile-image-upload')?.click()}
                      className="absolute bottom-0 right-0 p-2 bg-blue-600 dark:bg-blue-500 text-white rounded-full shadow-lg hover:bg-blue-700 dark:hover:bg-blue-400 transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </motion.button>
                  </div>
                  <h2 className="text-2xl font-bold mb-1">{formData.name}</h2>
                  <p className="text-muted-foreground text-sm">Member since {joinedAt || '...'}</p>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                  {stats.map((stat, index) => {
                    const Icon = stat.icon;
                    return (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2 + index * 0.05 }}
                        className="text-center"
                      >
                        <Icon className="w-5 h-5 text-primary mx-auto mb-1" />
                        <div className="text-xl font-bold">{stat.value}</div>
                        <div className="text-xs text-muted-foreground">{stat.label}</div>
                      </motion.div>
                    );
                  })}
                </div>

                <Button
                  onClick={handleSaveProfile}
                  variant="outline"
                  className="w-full"
                  isLoading={isSaving}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  {isEditing ? "Save Changes" : "Edit Profile"}
                </Button>
              </Card>
            </motion.div>

            {/* Session Preferences */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="p-6 shadow-xl">
                <h3 className="font-bold mb-4">Session Preferences</h3>
                <div className="space-y-3">
                  {preferences.map((pref, index) => {
                    const Icon = pref.icon;
                    return (
                      <Link key={index} to={pref.link}>
                        <motion.div
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.4 + index * 0.05 }}
                          whileHover={{ x: 5 }}
                          className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer group"
                        >
                          <div className="p-2 bg-white dark:bg-gray-900 rounded-lg group-hover:bg-primary group-hover:text-white transition-colors">
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium">{pref.title}</p>
                            <p className="text-xs text-muted-foreground">{pref.value}</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-primary transition-colors" />
                        </motion.div>
                      </Link>
                    );
                  })}
                </div>
              </Card>
            </motion.div>
          </div>

          {/* Right Column: Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Personal Information */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className={`p-6 shadow-xl transition-all ${isEditing ? 'ring-2 ring-primary shadow-2xl' : ''}`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-lg">Personal Information</h3>
                  {isEditing && (
                    <motion.span
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-xs bg-primary text-white px-3 py-1 rounded-full"
                    >
                      Editing Mode
                    </motion.span>
                  )}
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="mb-2 block">Full Name</Label>
                      <div className={`flex items-center gap-2 p-3 border rounded-lg transition-all ${
                        isEditing 
                          ? 'border-primary bg-primary/5 dark:bg-primary/10 ring-2 ring-primary/20' 
                          : 'border-gray-300 dark:border-gray-700'
                      }`}>
                        <User className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                        <input
                          type="text"
                          value={formData.name}
                          disabled={!isEditing || isSaving}
                          onChange={(e) =>
                            setFormData({ ...formData, name: e.target.value })
                          }
                          className="flex-1 outline-none bg-transparent disabled:cursor-not-allowed text-gray-900 dark:text-gray-100"
                        />
                      </div>
                    </div>

                    <div>
                      <Label className="mb-2 block">Email</Label>
                      <div className={`flex items-center gap-2 p-3 border rounded-lg transition-all ${
                        isEditing 
                          ? 'border-primary bg-primary/5 dark:bg-primary/10 ring-2 ring-primary/20' 
                          : 'border-gray-300 dark:border-gray-700'
                      }`}>
                        <Mail className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                        <input
                          type="email"
                          value={formData.email}
                          disabled={!isEditing || isSaving}
                          onChange={(e) =>
                            setFormData({ ...formData, email: e.target.value })
                          }
                          className="flex-1 outline-none bg-transparent disabled:cursor-not-allowed text-gray-900 dark:text-gray-100"
                        />
                      </div>
                    </div>

                    <div>
                      <Label className="mb-2 block">Phone</Label>
                      <div className={`flex items-center gap-2 p-3 border rounded-lg transition-all ${
                        isEditing 
                          ? 'border-primary bg-primary/5 dark:bg-primary/10 ring-2 ring-primary/20' 
                          : 'border-gray-300 dark:border-gray-700'
                      }`}>
                        <Phone className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                        <input
                          type="tel"
                          value={formData.phone}
                          disabled={!isEditing || isSaving}
                          onChange={(e) =>
                            setFormData({ ...formData, phone: e.target.value })
                          }
                          className="flex-1 outline-none bg-transparent disabled:cursor-not-allowed text-gray-900 dark:text-gray-100"
                        />
                      </div>
                    </div>

                    <div>
                      <Label className="mb-2 block">Age</Label>
                      <div className={`flex items-center gap-2 p-3 border rounded-lg transition-all ${
                        isEditing 
                          ? 'border-primary bg-primary/5 dark:bg-primary/10 ring-2 ring-primary/20' 
                          : 'border-gray-300 dark:border-gray-700'
                      }`}>
                        <Calendar className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                        <input
                          type="text"
                          value={formData.birthday}
                          disabled={!isEditing || isSaving}
                          onChange={(e) =>
                            setFormData({ ...formData, birthday: e.target.value })
                          }
                          className="flex-1 outline-none bg-transparent disabled:cursor-not-allowed text-gray-900 dark:text-gray-100"
                          placeholder="Age"
                        />
                      </div>
                    </div>

                    <div>
                      <Label className="mb-2 block">Pronouns</Label>
                      <div className={`flex items-center gap-2 p-3 border rounded-lg transition-all ${
                        isEditing 
                          ? 'border-primary bg-primary/5 dark:bg-primary/10 ring-2 ring-primary/20' 
                          : 'border-gray-300 dark:border-gray-700'
                      }`}>
                        <User className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                        <input
                          type="text"
                          value={formData.pronouns}
                          disabled={!isEditing || isSaving}
                          onChange={(e) =>
                            setFormData({ ...formData, pronouns: e.target.value })
                          }
                          className="flex-1 outline-none bg-transparent disabled:cursor-not-allowed text-gray-900 dark:text-gray-100"
                        />
                      </div>
                    </div>

                    <div>
                      <Label className="mb-2 block">Location/Timezone</Label>
                      <div className={`flex items-center gap-2 p-3 border rounded-lg transition-all ${
                        isEditing 
                          ? 'border-primary bg-primary/5 dark:bg-primary/10 ring-2 ring-primary/20' 
                          : 'border-gray-300 dark:border-gray-700'
                      }`}>
                        <MapPin className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                        <input
                          type="text"
                          value={formData.location}
                          disabled={!isEditing || isSaving}
                          onChange={(e) =>
                            setFormData({ ...formData, location: e.target.value })
                          }
                          className="flex-1 outline-none bg-transparent disabled:cursor-not-allowed text-gray-900 dark:text-gray-100"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* Wellness Profile (New Section) */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="p-6 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-primary" />
                    <h3 className="font-bold text-lg">Wellness Profile</h3>
                    {isSaving && <Loader2 className="w-4 h-4 animate-spin ml-2 text-primary" />}
                  </div>
                </div>
                
                <div className="space-y-6">
                  {/* Therapy & Medication */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="w-4 h-4 text-purple-500" />
                        <span className="font-semibold text-sm">Therapy Status</span>
                      </div>
                      {isEditing ? (
                        <select
                          value={formData.in_therapy}
                          disabled={isSaving}
                          onChange={(e) => setFormData({ ...formData, in_therapy: e.target.value })}
                          className="w-full p-2 border dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-sm disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 dark:text-gray-100"
                        >
                          <option value="">Select...</option>
                          <option value="Yes">Yes</option>
                          <option value="No">No</option>
                          <option value="Previously">Previously</option>
                          <option value="Thinking about it">Thinking about it</option>
                        </select>
                      ) : (
                        <p className="text-sm text-gray-700 dark:text-gray-300">{formData.in_therapy || "Not specified"}</p>
                      )}
                    </div>
                    <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Pill className="w-4 h-4 text-blue-500" />
                        <span className="font-semibold text-sm">Medication</span>
                      </div>
                      {isEditing ? (
                         <select
                          value={formData.on_medication}
                          disabled={isSaving}
                          onChange={(e) => setFormData({ ...formData, on_medication: e.target.value })}
                          className="w-full p-2 border dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <option value="">Select...</option>
                          <option value="Yes">Yes</option>
                          <option value="No">No</option>
                          <option value="Prefer not to say">Prefer not to say</option>
                        </select>
                      ) : (
                        <p className="text-sm text-gray-700 dark:text-gray-300">{formData.on_medication || "Not specified"}</p>
                      )}
                    </div>
                  </div>

                  {/* Goals */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Target className="w-4 h-4 text-green-500" />
                      <span className="font-semibold text-sm">Selected Goals</span>
                    </div>
                    {isEditing ? (
                      <div className="space-y-2">
                        <textarea
                          value={formData.selected_goals.join(', ')}
                          disabled={isSaving}
                          onChange={(e) => setFormData({ 
                            ...formData, 
                            selected_goals: e.target.value.split(',').map(s => s.trim())
                          })}
                          className="w-full p-2 border dark:border-gray-700 rounded-md text-sm min-h-[80px] bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                          placeholder="Enter goals separated by commas (e.g., Better sleep, Less anxiety)"
                        />
                        <p className="text-xs text-muted-foreground">Separate goals with commas</p>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {formData.selected_goals.length > 0 ? (
                          formData.selected_goals.map((goal, i) => (
                            <Badge key={i} variant="secondary" className="px-3 py-1">
                              {goal}
                            </Badge>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground italic">No goals selected</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Triggers */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Zap className="w-4 h-4 text-orange-500" />
                      <span className="font-semibold text-sm">Triggers / Challenges</span>
                    </div>
                    {isEditing ? (
                      <div className="space-y-2">
                         <textarea
                          value={formData.selected_triggers.join(', ')}
                          disabled={isSaving}
                          onChange={(e) => setFormData({ 
                            ...formData, 
                            selected_triggers: e.target.value.split(',').map(s => s.trim())
                          })}
                          className="w-full p-2 border dark:border-gray-700 rounded-md text-sm min-h-[80px] bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                          placeholder="Enter triggers separated by commas (e.g., Work stress, Social anxiety)"
                        />
                        <p className="text-xs text-muted-foreground">Separate triggers with commas</p>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {formData.selected_triggers.length > 0 ? (
                          formData.selected_triggers.map((trigger, i) => (
                            <Badge key={i} variant="outline" className="px-3 py-1 border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 text-orange-800 dark:text-orange-300">
                              {trigger}
                            </Badge>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground italic">No triggers specified</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* Emergency Contact (New Section) */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
            >
              <Card className="p-6 shadow-xl border-l-4 border-l-red-400">
                <div className="flex items-center gap-2 mb-4">
                  <Shield className="w-5 h-5 text-red-500" />
                  <h3 className="font-bold text-lg">Emergency Contact</h3>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Name</Label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={formData.emergency_contact_name}
                        disabled={isSaving}
                        onChange={(e) => setFormData({ ...formData, emergency_contact_name: e.target.value })}
                        className="w-full mt-1 p-2 border rounded-lg border-primary bg-primary/5 dark:bg-primary/10 ring-2 ring-primary/20 outline-none text-gray-900 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        placeholder="Contact Name"
                      />
                    ) : (
                      <p className="font-medium mt-1">{formData.emergency_contact_name || "Not set"}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Relationship</Label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={formData.emergency_contact_relationship}
                        disabled={isSaving}
                        onChange={(e) => setFormData({ ...formData, emergency_contact_relationship: e.target.value })}
                        className="w-full mt-1 p-2 border rounded-lg border-primary bg-primary/5 dark:bg-primary/10 ring-2 ring-primary/20 outline-none text-gray-900 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        placeholder="Relationship"
                      />
                    ) : (
                      <p className="font-medium mt-1">{formData.emergency_contact_relationship || "Not set"}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Phone</Label>
                    {isEditing ? (
                      <input
                        type="tel"
                        value={formData.emergency_contact_phone}
                        disabled={isSaving}
                        onChange={(e) => setFormData({ ...formData, emergency_contact_phone: e.target.value })}
                        className="w-full mt-1 p-2 border rounded-lg border-primary bg-primary/5 dark:bg-primary/10 ring-2 ring-primary/20 outline-none text-gray-900 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        placeholder="Contact Phone"
                      />
                    ) : (
                      <div className="flex items-center gap-2 mt-1">
                        <Phone className="w-3 h-3 text-gray-400 dark:text-gray-500" />
                        <p className="font-medium">{formData.emergency_contact_phone || "Not set"}</p>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* Settings Sections */}
            {settingsSections.map((section, sectionIndex) => (
              <motion.div
                key={sectionIndex}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + sectionIndex * 0.1 }}
              >
                <Card className="p-6 shadow-xl">
                  <h3 className="font-bold text-lg mb-4">{section.title}</h3>
                  <div className="space-y-2">
                    {section.items.map((item, itemIndex) => {
                      const Icon = item.icon;
                      return (
                        <Link key={itemIndex} to={item.link}>
                          <motion.div
                            whileHover={{ x: 5 }}
                            className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer group"
                          >
                            <div className="flex items-center gap-3">
                              <Icon className="w-5 h-5 text-gray-600 dark:text-gray-400 group-hover:text-primary transition-colors" />
                              <span className="font-medium">{item.label}</span>
                            </div>
                            <ChevronRight className="w-5 h-5 text-gray-400 dark:text-gray-500 group-hover:text-primary transition-colors" />
                          </motion.div>
                        </Link>
                      );
                    })}
                  </div>
                </Card>
              </motion.div>
            ))}

            {/* Danger Zone */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <Card className="p-6 shadow-xl border-red-200 dark:border-red-900/50">
                <h3 className="font-bold text-lg mb-4 text-red-600 dark:text-red-400">Danger Zone</h3>
                <div className="space-y-3">
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    disabled={isLoggingOut}
                    className="w-full flex items-center justify-between p-3 border-2 border-red-200 dark:border-red-900/50 rounded-lg hover:border-red-300 dark:hover:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handleLogout}
                  >
                    <div className="flex items-center gap-3">
                      {isLoggingOut ? (
                        <Loader2 className="w-5 h-5 text-red-500 animate-spin" />
                      ) : (
                        <LogOut className="w-5 h-5 text-red-500 dark:text-red-400 group-hover:text-red-600 dark:group-hover:text-red-300" />
                      )}
                      <div className="text-left">
                        <p className="font-bold text-red-600 dark:text-red-400">
                          {isLoggingOut ? 'Logging Out...' : 'Log Out'}
                        </p>
                        <p className="text-xs text-red-400 dark:text-red-500">End your current session</p>
                      </div>
                    </div>
                    {!isLoggingOut && (
                      <ChevronRight className="w-5 h-5 text-red-300 dark:text-red-700 group-hover:text-red-500 dark:group-hover:text-red-400" />
                    )}
                  </motion.button>
                  
                  {/* Delete Account Button - Hidden by default or separate logic */}
                </div>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
