import { useState, useEffect } from "react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { motion } from "motion/react";
import {
  ArrowLeft,
  Mail,
  Phone,
  Calendar,
  Activity,
  MessageSquare,
  Heart,
  AlertTriangle,
  Ban,
  Moon,
  CheckCircle,
  BookOpen
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../../lib/api";
import { format } from "date-fns";

export function UserDetails() {
  const { userId } = useParams<{ userId: string }>();
  const [user, setUser] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [journals, setJournals] = useState<any[]>([]);
  const [sleepEntries, setSleepEntries] = useState<any[]>([]);
  const [habits, setHabits] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!userId) return;
      try {
        setIsLoading(true);
        const [userData, sessionsData, journalsData, sleepData, habitsData] = await Promise.all([
          api.admin.getUserProfile(userId),
          api.sessions.getUserSessions(userId),
          api.journal.getUserJournals(userId),
          api.sleep.getUserEntries(userId),
          api.habits.getUserHabits(userId)
        ]);

        setUser(userData);
        setSessions(sessionsData);
        setJournals(journalsData);
        setSleepEntries(sleepData);
        setHabits(habitsData);
      } catch (error) {
        console.error("Failed to fetch user details:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [userId]);

  if (isLoading) {
    return (
      <AdminLayoutNew>
        <div className="flex items-center justify-center h-full">
          <p>Loading user details...</p>
        </div>
      </AdminLayoutNew>
    );
  }

  if (!user) {
    return (
      <AdminLayoutNew>
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <p>User not found</p>
          <Link to="/admin/user-management">
            <Button>Back to Users</Button>
          </Link>
        </div>
      </AdminLayoutNew>
    );
  }

  // Combine activities for timeline
  const recentActivity = [
    ...sessions.map(s => ({ type: 'session', date: new Date(s.created_at), text: `Session: ${s.type}`, id: s.id })),
    ...journals.map(j => ({ type: 'journal', date: new Date(j.created_at), text: `Journal: ${j.title || 'Untitled'}`, id: j.id })),
    ...sleepEntries.map(s => ({ type: 'sleep', date: new Date(s.created_at), text: `Sleep Log: ${s.quality_rating}/10`, id: s.id })),
    // Add moods if available in user profile or fetch separately
  ].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 5);

  return (
    <AdminLayoutNew>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <Link to="/admin/users">
            <Button variant="ghost" className="gap-2 mb-4">
              <ArrowLeft className="w-4 h-4" />
              Back to Users
            </Button>
          </Link>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-3xl font-bold">
                {user.first_name?.[0] || user.email[0].toUpperCase()}
              </div>
              <div>
                <h1 className="text-3xl font-bold mb-1">{user.first_name} {user.last_name}</h1>
                <p className="text-muted-foreground">{user.email}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="gap-2">
                <Mail className="w-4 h-4" />
                Email User
              </Button>
              <Button variant="outline" className="gap-2 text-red-600 border-red-200 hover:bg-red-50">
                <Ban className="w-4 h-4" />
                Suspend Account
              </Button>
            </div>
          </div>
        </motion.div>

        <div className="grid md:grid-cols-4 gap-4">
          <Card className="p-4">
            <p className="text-sm text-muted-foreground mb-1">Total Sessions</p>
            <p className="text-2xl font-bold">{sessions.length}</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-muted-foreground mb-1">Join Date</p>
            <p className="text-2xl font-bold">{format(new Date(user.created_at), 'MMM d')}</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-muted-foreground mb-1">Journal Entries</p>
            <p className="text-2xl font-bold">{journals.length}</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-muted-foreground mb-1">Habits Tracked</p>
            <p className="text-2xl font-bold">{habits.length}</p>
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4">User Information</h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Full Name</p>
                <p className="font-medium">{user.first_name} {user.last_name || ''}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Email</p>
                <p className="font-medium">{user.email}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Subscription</p>
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                  {user.credits > 0 ? 'Active (Credits)' : 'Trial'}
                </span>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Selected Voice</p>
                <p className="font-medium">{user.selected_voice || 'Default'}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4">Recent Activity</h2>
            <div className="space-y-3">
              {recentActivity.length > 0 ? recentActivity.map((activity, index) => (
                <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                    {activity.type === "session" && <MessageSquare className="w-4 h-4 text-primary" />}
                    {activity.type === "journal" && <BookOpen className="w-4 h-4 text-primary" />}
                    {activity.type === "sleep" && <Moon className="w-4 h-4 text-primary" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{activity.text}</p>
                    <p className="text-xs text-muted-foreground">{format(activity.date, 'MMM d, h:mm a')}</p>
                  </div>
                </div>
              )) : (
                <p className="text-muted-foreground text-sm">No recent activity</p>
              )}
            </div>
          </Card>
        </div>

        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4">Session History</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Duration
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {sessions.map((session, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">{format(new Date(session.created_at), 'MMM d, yyyy')}</td>
                    <td className="px-4 py-3 text-sm capitalize">{session.type}</td>
                    <td className="px-4 py-3 text-sm font-medium">{session.duration_seconds ? Math.round(session.duration_seconds / 60) + ' min' : '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        session.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {session.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {sessions.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                      No sessions found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AdminLayoutNew>
  );
}