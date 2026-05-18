import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Skeleton } from "@/app/components/ui/skeleton";
import { Input } from "@/app/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { motion } from "motion/react";
import { ArrowLeft, Activity, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { api } from "@/lib/api";
import { FluentEmoji } from "@/components/ui/FluentEmoji";

interface RecentActivityItem {
  id: string;
  type: string;
  text: string;
  created_at: string;
  mood?: string;
}

const MOOD_EMOJIS: Record<string, string> = {
  happy: "😊",
  calm: "😌",
  excited: "🤩",
  anxious: "😰",
  sad: "😢",
  angry: "😡",
};

function getEmoji(type: string, mood?: string) {
  if (type === "mood" && mood) {
    const normalized = String(mood).trim().toLowerCase();
    return MOOD_EMOJIS[normalized] ?? "😐";
  }
  if (type === "journal") return "📓";
  if (type === "session") return "🎥";
  if (type === "event") return "⚡";
  return "📝";
}

export function RecentActivityHistory() {
  const DEFAULT_PAGE_SIZE = 10;
  const navigate = useNavigate();
  const [items, setItems] = useState<RecentActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSizeOption, setPageSizeOption] = useState("10");
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [customPageSizeInput, setCustomPageSizeInput] = useState("10");

  const loadActivity = async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    try {
      const rows = (await api.getRecentActivity(100)) as RecentActivityItem[];
      setItems(rows);
      setCurrentPage(1);
    } catch (error) {
      console.error("Failed to load recent activity history", error);
      setItems([]);
    } finally {
      setIsLoading(false);
      if (isManualRefresh) setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void loadActivity();
  }, []);

  const mapped = useMemo(
    () =>
      items.map((row) => ({
        ...row,
        emoji: getEmoji(row.type, row.mood),
        relativeTime: formatDistanceToNow(new Date(row.created_at), { addSuffix: true }),
      })),
    [items]
  );

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(mapped.length / pageSize));
    if (currentPage > maxPage) {
      setCurrentPage(maxPage);
    }
  }, [mapped.length, pageSize, currentPage]);

  const handlePageSizeOptionChange = (value: string) => {
    setPageSizeOption(value);
    if (value === "custom") return;
    const nextSize = Number(value);
    if (Number.isFinite(nextSize) && nextSize > 0) {
      setPageSize(nextSize);
      setCurrentPage(1);
      setCustomPageSizeInput(String(nextSize));
    }
  };

  const handleApplyCustomPageSize = () => {
    const parsed = Number(customPageSizeInput);
    if (!Number.isFinite(parsed) || parsed < 1) return;
    const normalized = Math.min(200, Math.floor(parsed));
    setPageSize(normalized);
    setCurrentPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(mapped.length / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, mapped.length);
  const currentPageItems = mapped.slice(startIndex, endIndex);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <button
            onClick={() => navigate("/app/dashboard")}
            className="flex items-center gap-2 text-muted-foreground hover:text-primary mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-7 h-7 text-primary" />
                <h1 className="text-3xl font-bold">Recent Activity History</h1>
              </div>
              <p className="text-muted-foreground">
                Full timeline of your latest check-ins, journals, sessions, and app activity.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => void loadActivity(true)}
              disabled={isRefreshing}
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </motion.div>

        <Card className="p-5 shadow-lg">
          {isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2, 3, 4].map((index) => (
                <div key={index} className="flex items-center gap-3 p-2">
                  <Skeleton className="w-9 h-9 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : mapped.length === 0 ? (
            <div className="text-center py-12">
              <Activity className="w-14 h-14 text-muted-foreground/40 mx-auto mb-3" />
              <h2 className="text-lg font-semibold mb-1">No activity yet</h2>
              <p className="text-muted-foreground text-sm">
                Start a mood check-in, journal entry, or session to see your activity history here.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {currentPageItems.map((entry, index) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(index * 0.02, 0.25) }}
                  className="flex items-center gap-3 p-3 rounded-lg border border-transparent hover:border-border hover:bg-muted/40 transition-colors"
                >
                  <FluentEmoji emoji={entry.emoji} size={28} className="shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{entry.text}</p>
                    <p className="text-xs text-muted-foreground">{entry.relativeTime}</p>
                  </div>
                </motion.div>
              ))}

              {mapped.length > 0 && (
                <div className="flex flex-col gap-3 pt-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-muted-foreground whitespace-nowrap">Items per page</p>
                      <Select value={pageSizeOption} onValueChange={handlePageSizeOptionChange}>
                        <SelectTrigger className="w-28 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="25">25</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="custom">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                      {pageSizeOption === "custom" && (
                        <>
                          <Input
                            type="number"
                            min={1}
                            max={200}
                            value={customPageSizeInput}
                            onChange={(e) => setCustomPageSizeInput(e.target.value)}
                            className="w-20 h-8"
                          />
                          <Button variant="outline" size="sm" onClick={handleApplyCustomPageSize}>
                            Apply
                          </Button>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Page size: {pageSize}
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <p className="text-xs text-muted-foreground">
                    Showing {startIndex + 1}-{endIndex} of {mapped.length}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                      >
                        Previous
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        Page {currentPage} of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
  );
}
