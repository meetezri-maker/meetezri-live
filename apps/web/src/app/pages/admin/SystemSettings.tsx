import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { motion } from "motion/react";
import { Save, Settings, Shield, Database, Bell } from "lucide-react";

export function SystemSettings() {
  return (
    <AdminLayoutNew>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold mb-2">System Settings</h1>
          <p className="text-muted-foreground">
            Configure application settings and preferences
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <Settings className="w-6 h-6 text-primary" />
              <h2 className="text-xl font-bold">General Settings</h2>
            </div>
            <div className="space-y-6 max-w-2xl">
              <div>
                <Label htmlFor="appName">Application Name</Label>
                <Input id="appName" defaultValue="Ezri" className="mt-2" />
              </div>
              <div>
                <Label htmlFor="supportEmail">Support Email</Label>
                <Input
                  id="supportEmail"
                  type="email"
                  defaultValue="support@ezri.com"
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="maxSessions">Max Daily Sessions Per User</Label>
                <Input id="maxSessions" type="number" defaultValue="10" className="mt-2" />
              </div>
              <Button className="gap-2">
                <Save className="w-4 h-4" />
                Save Changes
              </Button>
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <Shield className="w-6 h-6 text-primary" />
              <h2 className="text-xl font-bold">Security & Privacy</h2>
            </div>
            <div className="space-y-4">
              {[
                { name: "Two-Factor Authentication", enabled: true },
                { name: "Automatic Session Timeout", enabled: true },
                { name: "Email Verification Required", enabled: true },
                { name: "Crisis Keyword Monitoring", enabled: true },
                { name: "Data Encryption at Rest", enabled: true },
              ].map((setting, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium">{setting.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {setting.enabled ? "Currently enabled" : "Currently disabled"}
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked={setting.enabled} />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <Bell className="w-6 h-6 text-primary" />
              <h2 className="text-xl font-bold">Notification Settings</h2>
            </div>
            <div className="space-y-4">
              {[
                { name: "Crisis Alert Notifications", enabled: true },
                { name: "Daily User Reports", enabled: true },
                { name: "New User Signups", enabled: false },
                { name: "System Performance Alerts", enabled: true },
              ].map((setting, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <p className="font-medium">{setting.name}</p>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked={setting.enabled} />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <Database className="w-6 h-6 text-primary" />
              <h2 className="text-xl font-bold">Data & Backup</h2>
            </div>
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium">Last Backup</p>
                  <span className="text-sm text-green-600 font-medium">
                    ✓ Completed 2 hours ago
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">Next scheduled backup: Today at 11:59 PM</p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline">Run Manual Backup</Button>
                <Button variant="outline">Configure Backup Schedule</Button>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </AdminLayoutNew>
  );
}