import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  ArrowLeft,
  BookOpen,
  Flame,
  Heart,
  Loader2,
  Moon,
  Plus,
  Sparkles,
  Star,
  TrendingUp,
  Trophy,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SolaceSelect } from "@/app/solace";
import { cn } from "@/lib/utils";
import {
  composeCommunitySharePost,
  fetchCommunityShareItems,
  type CommunityShareItem,
  type CommunityShareKind,
  type CommunityShareProfileStats,
} from "@/lib/communityShareItems";

const COMMUNITY_POST_CATEGORIES = [
  "General Discussion",
  "Wins & Progress",
  "Support & Advice",
  "Professional Insights",
  "Community Events",
] as const;

const KIND_META: Record<
  CommunityShareKind,
  { icon: LucideIcon; label: string; ring: string }
> = {
  mood: { icon: Heart, label: "Mood", ring: "ring-rose-400/30" },
  journal: { icon: BookOpen, label: "Journal", ring: "ring-sky-400/30" },
  wellness: { icon: Sparkles, label: "Wellness", ring: "ring-violet-400/30" },
  progress: { icon: TrendingUp, label: "Progress", ring: "ring-fuchsia-400/30" },
  achievement: { icon: Trophy, label: "Achievement", ring: "ring-amber-400/30" },
  habit: { icon: Flame, label: "Habits", ring: "ring-orange-400/30" },
  sleep: { icon: Moon, label: "Sleep", ring: "ring-indigo-400/30" },
  streak: { icon: Star, label: "Streak", ring: "ring-pink-400/30" },
};

interface CommunitySharePostModalProps {
  open: boolean;
  posting: boolean;
  profile: CommunityShareProfileStats | null | undefined;
  onClose: () => void;
  onSubmit: (payload: { content: string; category: string; userTags: string }) => void;
}

export function CommunitySharePostModal({
  open,
  posting,
  profile,
  onClose,
  onSubmit,
}: CommunitySharePostModalProps) {
  const [category, setCategory] = useState<string>("Wins & Progress");
  const [userTags, setUserTags] = useState("");
  const [optionalNote, setOptionalNote] = useState("");
  const [shareItems, setShareItems] = useState<CommunityShareItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const loadItems = useCallback(async () => {
    setLoadingItems(true);
    setLoadError(false);
    try {
      const items = await fetchCommunityShareItems(profile);
      setShareItems(items);
      setSelectedIds(items.length > 0 ? [items[0]!.id] : []);
    } catch {
      setShareItems([]);
      setSelectedIds([]);
      setLoadError(true);
    } finally {
      setLoadingItems(false);
    }
  }, [profile]);

  useEffect(() => {
    if (!open) return;
    setCategory("Wins & Progress");
    setUserTags("");
    setOptionalNote("");
    void loadItems();
  }, [open, loadItems]);

  const previewContent = useMemo(
    () => composeCommunitySharePost(shareItems, selectedIds, optionalNote),
    [shareItems, selectedIds, optionalNote],
  );

  const toggleItem = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleSubmit = () => {
    if (!previewContent.trim()) return;
    onSubmit({
      content: previewContent,
      category,
      userTags,
    });
  };

  if (!open) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#030308]/80 p-4 backdrop-blur-xl"
      onClick={() => !posting && onClose()}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
        className="max-h-[min(92vh,880px)] w-full max-w-2xl overflow-y-auto rounded-[28px] border border-white/10 bg-[#0e0e18]/95 p-6 shadow-[0_0_80px_-20px_rgba(139,92,246,0.45),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-2xl sm:p-8"
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-2xl font-semibold tracking-tight text-white">Share to Community</h3>
            <p className="mt-1 text-sm text-violet-200/55">
              Share streaks and milestones — mood patterns, journal, wellness, and achievements.
            </p>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-full border border-white/10 p-2 text-violet-200/70 transition-colors hover:bg-white/10 hover:text-white"
            onClick={() => !posting && onClose()}
            aria-label="Close"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
        </div>

        <div className="space-y-5">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-violet-300/70">
              Your scores & milestones
            </p>
            {loadingItems ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-fuchsia-300/80" aria-hidden />
                <span className="sr-only">Loading shareable items</span>
              </div>
            ) : loadError ? (
              <div className="rounded-2xl border border-dashed border-white/15 py-10 text-center text-sm text-violet-200/55">
                Could not load your data.{" "}
                <button
                  type="button"
                  className="font-medium text-fuchsia-200 underline underline-offset-2"
                  onClick={() => void loadItems()}
                >
                  Try again
                </button>
              </div>
            ) : shareItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/15 py-10 text-center text-sm text-violet-200/55">
                Nothing to share yet — build a few mood streaks, journal entries, or wellness sessions first.
              </div>
            ) : (
              <div className="max-h-[280px] space-y-2 overflow-y-auto pr-1">
                {shareItems.map((item) => {
                  const meta = KIND_META[item.kind];
                  const Icon = meta.icon;
                  const selected = selectedIds.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={posting}
                      onClick={() => toggleItem(item.id)}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition-all",
                        selected
                          ? "border-fuchsia-400/40 bg-fuchsia-500/10 ring-1 ring-fuchsia-400/25"
                          : "border-white/10 bg-black/25 hover:border-violet-400/25 hover:bg-white/[0.04]",
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/30",
                          meta.ring,
                          "ring-1",
                        )}
                      >
                        <Icon className="h-5 w-5 text-violet-100/90" aria-hidden />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-[#F7F3FF]">{item.title}</span>
                          <span className="text-[10px] font-medium uppercase tracking-wide text-violet-300/50">
                            {meta.label}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-violet-200/50">{item.subtitle}</p>
                      </div>
                      {item.scoreText ? (
                        <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs font-semibold tabular-nums text-fuchsia-100/90">
                          {item.scoreText}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {previewContent ? (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-violet-300/70">
                Post preview
              </p>
              <pre className="whitespace-pre-wrap rounded-2xl border border-white/10 bg-black/40 p-4 font-sans text-sm leading-relaxed text-[#F7F3FF]/90">
                {previewContent}
              </pre>
            </div>
          ) : null}

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-violet-200/70">
              Optional note (added below your selections)
            </label>
            <textarea
              value={optionalNote}
              onChange={(e) => setOptionalNote(e.target.value)}
              placeholder="Add a short message if you'd like…"
              rows={2}
              maxLength={280}
              disabled={posting}
              className="w-full resize-none rounded-2xl border border-white/10 bg-black/40 p-3 text-sm text-white placeholder:text-violet-300/35 backdrop-blur-sm focus:border-fuchsia-400/40 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/20 disabled:opacity-50"
            />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <label className="shrink-0 text-sm font-medium text-violet-100/80">Category:</label>
            <SolaceSelect
              value={category}
              onValueChange={setCategory}
              ariaLabel="Post category"
              variant="form"
              disabled={posting}
              triggerClassName="flex-1"
              options={COMMUNITY_POST_CATEGORIES.map((c) => ({ value: c, label: c }))}
            />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <label className="shrink-0 text-sm font-medium text-violet-100/80">Tags:</label>
            <input
              type="text"
              value={userTags}
              onChange={(e) => setUserTags(e.target.value)}
              placeholder="Add tags (comma-separated)"
              className="flex-1 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-violet-300/35 backdrop-blur-sm focus:border-fuchsia-400/40 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/20 disabled:opacity-50"
              disabled={posting}
            />
          </div>

          <motion.button
            whileHover={{ y: posting ? 0 : -1 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-500 px-6 py-4 text-lg font-semibold text-white shadow-[0_0_36px_rgba(192,38,211,0.35)] transition-shadow hover:shadow-[0_0_48px_rgba(192,38,211,0.5)] disabled:opacity-60"
            onClick={handleSubmit}
            disabled={posting || !previewContent.trim()}
            type="button"
          >
            {posting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
            Post
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}
