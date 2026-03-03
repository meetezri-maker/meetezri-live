import { motion } from "motion/react";
import { Card } from "../../components/ui/card";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export function Settings() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-purple-50/30 to-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Link to="/app/dashboard" className="inline-flex items-center gap-2 text-primary hover:underline mb-6">
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl font-bold mb-4">Settings</h1>
          <p className="text-muted-foreground text-lg">
            This is a placeholder for the settings page (Phase 4+)
          </p>
        </motion.div>

        <Card className="p-8">
          <p className="text-center text-muted-foreground">
            Settings configuration coming soon...
          </p>
        </Card>
      </div>
    </div>
  );
}
