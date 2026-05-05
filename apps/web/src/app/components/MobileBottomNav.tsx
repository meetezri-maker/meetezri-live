import { motion } from "motion/react";
import { Link, useLocation } from "react-router";
import {
  Home,
  Video,
  Heart,
  BookOpen,
  TrendingUp,
  Menu
} from "lucide-react";
import { useState } from "react";

interface MobileBottomNavProps {
  /** Tighter bottom bar when Appearance → Compact mode is on */
  compact?: boolean;
}

export function MobileBottomNav({ compact = false }: MobileBottomNavProps) {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(location.pathname);

  const navItems = [
    { path: "/app/dashboard", icon: Home, label: "Home" },
    { path: "/app/session-lobby", icon: Video, label: "Chat Time" },
    { path: "/app/mood-checkin", icon: Heart, label: "Mood" },
    { path: "/app/journal", icon: BookOpen, label: "Journal" },
    { path: "/app/progress", icon: TrendingUp, label: "Progress" }
  ];

  return (
    <motion.div
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 safe-area-pb lg:hidden"
    >
      <div className={`flex items-center justify-around px-2 ${compact ? "py-1" : "py-2"}`}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setActiveTab(item.path)}
              className="relative flex-1"
            >
              <motion.div
                whileTap={{ scale: 0.9 }}
                className={`flex flex-col items-center relative ${compact ? "gap-0 py-1" : "gap-1 py-2"}`}
              >
                {/* Active Indicator */}
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-12 h-1 bg-primary rounded-full"
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}

                {/* Icon */}
                <motion.div
                  animate={{
                    scale: isActive ? 1.1 : 1,
                    y: isActive ? -2 : 0
                  }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className={`rounded-xl transition-colors ${
                    compact ? "p-1.5" : "p-2"
                  } ${
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-gray-500"
                  }`}
                >
                  <Icon className={compact ? "w-4 h-4" : "w-5 h-5"} />
                </motion.div>

                {/* Label */}
                <span
                  className={`font-medium transition-colors ${
                    compact ? "text-[10px] leading-tight" : "text-xs"
                  } ${isActive ? "text-primary" : "text-gray-500"}`}
                >
                  {item.label}
                </span>

                {/* Notification Badge (example) */}
                {item.path === "/app/session" && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute top-1 right-2 w-2 h-2 bg-red-500 rounded-full"
                  />
                )}
              </motion.div>
            </Link>
          );
        })}
      </div>
    </motion.div>
  );
}