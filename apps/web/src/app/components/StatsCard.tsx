import { LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import { Card } from "./ui/card";

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  color?: "primary" | "secondary" | "accent" | "success" | "warning" | "danger";
  delay?: number;
}

const colorClasses = {
  primary: "from-primary/20 to-primary/5 text-primary",
  secondary: "from-secondary/20 to-secondary/5 text-secondary",
  accent: "from-accent/20 to-accent/5 text-accent",
  success: "from-green-500/20 to-green-500/5 text-green-600",
  warning: "from-yellow-500/20 to-yellow-500/5 text-yellow-600",
  danger: "from-red-500/20 to-red-500/5 text-red-600",
};

export function StatsCard({
  title,
  value,
  change,
  changeType = "neutral",
  icon: Icon,
  color = "primary",
  delay = 0,
}: StatsCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
    >
      <Card className="p-6 hover:shadow-xl transition-shadow relative overflow-hidden group">
        {/* Background gradient effect */}
        <motion.div
          className={`absolute inset-0 bg-gradient-to-br ${colorClasses[color]} opacity-0 group-hover:opacity-100 transition-opacity`}
          initial={false}
        />

        <div className="relative z-10">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <p className="text-sm text-muted-foreground mb-1">{title}</p>
              <motion.p
                className="text-3xl font-bold"
                initial={{ scale: 0.5 }}
                animate={{ scale: 1 }}
                transition={{ delay: delay + 0.1, type: "spring", stiffness: 200 }}
              >
                {value}
              </motion.p>
            </div>
            <motion.div
              whileHover={{ rotate: 360, scale: 1.1 }}
              transition={{ duration: 0.5 }}
              className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colorClasses[color]} flex items-center justify-center shadow-lg`}
            >
              <Icon className="w-6 h-6" />
            </motion.div>
          </div>

          {change && (
            <div className="flex items-center gap-2">
              <span
                className={`text-sm font-medium ${
                  changeType === "positive"
                    ? "text-green-600"
                    : changeType === "negative"
                    ? "text-red-600"
                    : "text-gray-600"
                }`}
              >
                {change}
              </span>
              <span className="text-xs text-muted-foreground">vs last period</span>
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}
