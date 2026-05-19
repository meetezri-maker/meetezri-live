import { Button } from "../../components/ui/button";
import { motion, AnimatePresence } from "motion/react";
import { RichTextEditor } from "../../components/RichTextEditor";
import { JournalExportModal } from "../../components/modals";
import {
  BookOpen,
  Plus,
  Search,
  Calendar,
  Heart,
  Sparkles,
  Lock,
  Edit,
  Trash2,
  X,
  Filter,
  Download,
  Loader2,
  MoreVertical,
  ChevronRight,
  Tag,
  Clock,
  ChevronDown,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { pickSolaceCinematicImage } from "@/lib/solace/solaceCinematicPool";
import { SolaceHeroAtmosphere } from "@/app/solace/SolaceHeroAtmosphere";
import { TalkItOutBottomDock } from "@/app/pages/app/talk-it-out/TalkItOutBottomDock";
import { useState, useEffect, useMemo } from "react";
import { api } from "../../../lib/api";
import { htmlToPlainText, truncatePreview } from "../../../lib/htmlPlainText";
import { useAuth } from "../../contexts/AuthContext";
import { Skeleton } from "../../components/ui/skeleton";
import { toast } from "sonner";
import { FluentEmoji } from "@/components/ui/FluentEmoji";
import { cn } from "../../components/ui/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";

const JOURNAL_LIST_PAGE_OPTIONS = [10, 20, 50] as const;

interface JournalEntry {
  id: string;
  title: string | null;
  content: string | null;
  mood_tags: string[];
  is_private: boolean | null;
  location: string | null;
  created_at: string;
  updated_at: string;
  date?: string;
  preview?: string;
  mood?: string;
  favorite?: boolean;
}

const JOURNAL_MOODS = [
  { value: "happy", emoji: "😊", label: "Happy" },
  { value: "calm", emoji: "😌", label: "Calm" },
  { value: "anxious", emoji: "😰", label: "Anxious" },
  { value: "sad", emoji: "😢", label: "Sad" },
  { value: "excited", emoji: "🤩", label: "Excited" },
  { value: "angry", emoji: "😡", label: "Angry" },
  { value: "grateful", emoji: "🥰", label: "Grateful" },
] as const;

const MOOD_TAG_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  grateful: { bg: "bg-emerald-500/20", text: "text-emerald-400", border: "border-emerald-500/30" },
  happy: { bg: "bg-amber-500/20", text: "text-amber-400", border: "border-amber-500/30" },
  calm: { bg: "bg-sky-500/20", text: "text-sky-400", border: "border-sky-500/30" },
  anxious: { bg: "bg-orange-500/20", text: "text-orange-400", border: "border-orange-500/30" },
  sad: { bg: "bg-blue-500/20", text: "text-blue-400", border: "border-blue-500/30" },
  excited: { bg: "bg-pink-500/20", text: "text-pink-400", border: "border-pink-500/30" },
  angry: { bg: "bg-red-500/20", text: "text-red-400", border: "border-red-500/30" },
};

function getMoodTagStyle(mood: string) {
  const key = mood.toLowerCase();
  return MOOD_TAG_STYLES[key] || { bg: "bg-purple-500/20", text: "text-purple-400", border: "border-purple-500/30" };
}

function getMoodLabel(moodTag: string): string {
  const found = JOURNAL_MOODS.find(m => 
    m.value.toLowerCase() === moodTag.toLowerCase() || 
    m.emoji === moodTag ||
    m.label.toLowerCase() === moodTag.toLowerCase()
  );
  return found?.label || moodTag.charAt(0).toUpperCase() + moodTag.slice(1).toLowerCase();
}

function getReadingTime(content: string | null): number {
  if (!content) return 1;
  const text = htmlToPlainText(content);
  const words = text.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
}

function formatEntryTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
}

function formatDateGroup(dateStr: string): { label: string; subLabel: string } {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const full = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const isToday = date.toDateString() === today.toDateString();
  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (isToday) {
    return { label: "Today", subLabel: full };
  }
  if (isYesterday) {
    return { label: "Yesterday", subLabel: full };
  }
  return { label: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }), subLabel: full };
}

function getMoodBalanceLabel(positive: number, neutral: number, difficult: number): string {
  const t = positive + neutral + difficult;
  if (t === 0) return "Quiet week";
  if (positive >= neutral && positive >= difficult) return "Mostly Positive";
  if (difficult >= positive && difficult >= neutral) return "Mostly Difficult";
  if (neutral >= positive && neutral >= difficult) return "Mostly Neutral";
  return "Balanced";
}

interface MoodSemicircleProps {
  positive: number;
  neutral: number;
  difficult: number;
  centerEmoji?: string | null;
}

function MoodSemicircle({ positive, neutral, difficult, centerEmoji }: MoodSemicircleProps) {
  const t = positive + neutral + difficult;
  const cx = 50;
  const cy = 52;
  const r = 36;
  if (t === 0) {
    return (
      <svg viewBox="0 0 100 58" className="mx-auto h-[72px] w-[148px]" aria-hidden>
        <path
          d="M 14 52 A 36 36 0 0 1 86 52"
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="9"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  const segs: { v: number; color: string }[] = [
    { v: positive, color: "rgba(167, 139, 250, 0.9)" },
    { v: neutral, color: "rgba(148, 163, 184, 0.65)" },
    { v: difficult, color: "rgba(251, 146, 60, 0.85)" },
  ];
  let angle = Math.PI;
  const paths: JSX.Element[] = [];
  segs.forEach((seg, i) => {
    if (seg.v <= 0) return;
    const sweep = (Math.PI * seg.v) / t;
    const a0 = angle;
    const a1 = angle - sweep;
    const x0 = cx + r * Math.cos(a0);
    const y0 = cy - r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy - r * Math.sin(a1);
    const largeArc = sweep > Math.PI ? 1 : 0;
    const d = `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
    paths.push(<path key={i} d={d} fill="none" stroke={seg.color} strokeWidth="9" strokeLinecap="round" />);
    angle = a1;
  });
  return (
    <div className="relative mx-auto h-[76px] w-[152px]">
      <svg
        viewBox="0 0 100 58"
        className="h-full w-full drop-shadow-[0_0_24px_rgba(139,92,246,0.15)]"
        role="img"
        aria-label="Mood balance from your entries"
      >
        <path
          d="M 14 52 A 36 36 0 0 1 86 52"
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="9"
          strokeLinecap="round"
        />
        {paths}
      </svg>
      {centerEmoji && t > 0 ? (
        <div className="pointer-events-none absolute inset-0 flex items-end justify-center pb-[2px]">
          <span className="text-[1.35rem] leading-none drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]" aria-hidden>
            {centerEmoji}
          </span>
        </div>
      ) : null}
    </div>
  );
}

interface JournalHeroBackdropProps {
  className?: string;
}

/** One full-bleed landscape (locked reference). Moon / lantern warmth via light only — no inset stock photo. */
function JournalHeroBackdrop({ className }: JournalHeroBackdropProps) {
  return (
    <div
      className={cn(
        "relative min-h-[220px] w-full overflow-hidden md:min-h-[300px] lg:min-h-[min(100%,320px)]",
        className
      )}
    >
      <img
        src={pickSolaceCinematicImage("journal-hero")}
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-cover object-[center_38%]"
      />
      <SolaceHeroAtmosphere className="rounded-none" />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_52%_at_70%_8%,rgba(248,250,252,0.22)_0%,transparent_52%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_55%_44%_at_52%_94%,rgba(251,211,141,0.15)_0%,transparent_54%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_42%_38%_at_18%_72%,rgba(139,92,246,0.11)_0%,transparent_58%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#050814]/93 via-[#070a12]/42 to-transparent"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#070a12]/88 via-[#070a12]/18 to-transparent md:from-[#070a12]/68 md:via-transparent"
        aria-hidden
      />
    </div>
  );
}

interface JournalInsightsRailProps {
  moodStats: { positive: number; neutral: number; difficult: number };
  streak: number;
  weeklyActivity: { day: string; active: boolean }[];
  topTags: { tag: string; count: number }[];
  journalEntryCount: number;
  hasMoodTagOnAnyEntry: boolean;
  onViewAllTags?: () => void;
}

function JournalInsightsRail({
  moodStats,
  streak,
  weeklyActivity,
  topTags,
  journalEntryCount,
  hasMoodTagOnAnyEntry,
  onViewAllTags,
}: JournalInsightsRailProps) {
  const balanceLabel = getMoodBalanceLabel(moodStats.positive, moodStats.neutral, moodStats.difficult);
  const maxTag = topTags[0]?.count || 1;
  const { positive, neutral, difficult } = moodStats;
  const maxM = Math.max(positive, neutral, difficult);
  let dominantEmoji: string | null = null;
  if (journalEntryCount > 0 && maxM > 0) {
    if (positive >= neutral && positive >= difficult) dominantEmoji = "😊";
    else if (difficult >= positive && difficult >= neutral) dominantEmoji = "😰";
    else dominantEmoji = "😐";
  }

  const moodEmpty =
    journalEntryCount === 0
      ? "Your journal mood pattern will appear as you write."
      : !hasMoodTagOnAnyEntry
        ? "Your journal mood pattern will appear as you write."
        : null;

  let streakLine = "A gentle rhythm — one entry at a time.";
  if (journalEntryCount === 0 && streak === 0) {
    streakLine = "Your writing rhythm will build over time.";
  } else if (streak > 0) {
    streakLine = "Keep it going!";
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[1.25rem] border border-white/[0.07] bg-[#0c0c14]/92 p-5 shadow-[0_0_44px_-18px_rgba(139,92,246,0.28)] backdrop-blur-md">
        <h3 className="text-[15px] font-semibold tracking-tight text-zinc-100">How I&apos;m feeling</h3>
        {moodEmpty ? (
          <p className="mt-2 text-[13px] leading-relaxed text-zinc-500">{moodEmpty}</p>
        ) : (
          <p className="mt-2 text-[13px] leading-relaxed text-zinc-500">From the moods you&apos;ve tagged in entries.</p>
        )}
        <div className="relative mt-5 flex flex-col items-center">
          <MoodSemicircle
            positive={moodStats.positive}
            neutral={moodStats.neutral}
            difficult={moodStats.difficult}
            centerEmoji={dominantEmoji}
          />
          <div className="-mt-1 text-center">
            <p className="text-[15px] font-medium text-zinc-100">{balanceLabel}</p>
            <p className="mt-0.5 text-[11px] text-zinc-500">Across your entries</p>
          </div>
        </div>
        <div className="mt-5 flex items-stretch justify-between gap-2 border-t border-white/[0.06] pt-4 text-center">
          <div className="flex-1 rounded-lg bg-white/[0.03] py-2">
            <div className="flex items-center justify-center gap-1 text-base" aria-hidden>
              <span>😊</span>
              <span className="text-sm font-semibold tabular-nums text-violet-100">{moodStats.positive}</span>
            </div>
            <p className="mt-1 text-[10px] uppercase tracking-wider text-zinc-500">Positive</p>
          </div>
          <div className="flex-1 rounded-lg bg-white/[0.03] py-2">
            <div className="flex items-center justify-center gap-1 text-base" aria-hidden>
              <span>😐</span>
              <span className="text-sm font-semibold tabular-nums text-zinc-200">{moodStats.neutral}</span>
            </div>
            <p className="mt-1 text-[10px] uppercase tracking-wider text-zinc-500">Neutral</p>
          </div>
          <div className="flex-1 rounded-lg bg-white/[0.03] py-2">
            <div className="flex items-center justify-center gap-1 text-base" aria-hidden>
              <span>😰</span>
              <span className="text-sm font-semibold tabular-nums text-orange-100/90">{moodStats.difficult}</span>
            </div>
            <p className="mt-1 text-[10px] uppercase tracking-wider text-zinc-500">Difficult</p>
          </div>
        </div>
      </div>

      <div className="rounded-[1.25rem] border border-white/[0.07] bg-[#0c0c14]/92 p-5 shadow-[0_0_36px_-16px_rgba(217,70,239,0.22)] backdrop-blur-md">
        <h3 className="text-[15px] font-semibold tracking-tight text-zinc-100">Journal Streak</h3>
        <div className="mt-3 flex items-baseline gap-1.5">
          <span className="text-3xl font-semibold tabular-nums tracking-tight text-violet-200/95">{streak}</span>
          <span className="text-sm text-zinc-500">days</span>
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-zinc-500">{streakLine}</p>
        <div className="relative mt-5 flex items-center justify-between px-0.5">
          <div
            className="pointer-events-none absolute left-2 right-2 top-[9px] h-px bg-gradient-to-r from-transparent via-violet-500/25 to-transparent"
            aria-hidden
          />
          {weeklyActivity.map((day, i) => (
            <div key={`${day.day}-${i}`} className="relative z-[1] flex flex-col items-center gap-2">
              <div
                className={cn(
                  "h-2.5 w-2.5 rounded-full transition-shadow",
                  day.active
                    ? "bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-[0_0_12px_rgba(139,92,246,0.85)]"
                    : "bg-white/[0.1]"
                )}
              />
              <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">{day.day}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[1.25rem] border border-white/[0.07] bg-[#0c0c14]/92 p-5 backdrop-blur-md">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-[15px] font-semibold tracking-tight text-zinc-100">Top Tags</h3>
            <p className="mt-1 text-[13px] leading-relaxed text-zinc-500">Moods you write about most</p>
          </div>
          {topTags.length > 0 && onViewAllTags ? (
            <button
              type="button"
              onClick={onViewAllTags}
              className="shrink-0 text-[12px] font-medium text-violet-300/90 underline-offset-4 transition hover:text-violet-200"
            >
              View all
            </button>
          ) : null}
        </div>
        <div className="mt-4 space-y-3.5">
          {topTags.length === 0 ? (
            <p className="text-[13px] leading-relaxed text-zinc-500">Tags will appear as your journal grows.</p>
          ) : (
            topTags.map(({ tag, count }) => {
              const width = Math.max(12, (count / maxTag) * 100);
              const style = getMoodTagStyle(tag);
              return (
                <div key={tag} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-[13px]">
                    <span className="truncate text-zinc-400">#{tag.replace(/\s+/g, "-")}</span>
                    <span className="shrink-0 tabular-nums text-zinc-500">{count}</span>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className={cn("h-full rounded-full bg-gradient-to-r from-violet-500/70 to-fuchsia-500/45", style.bg)}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

interface JournalPaginationProps {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions: readonly number[];
  selectId: string;
}

function JournalPagination({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions,
  selectId,
}: JournalPaginationProps) {
  if (total <= 0) return null;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const from = (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, total);

  return (
    <div className="mt-8 rounded-2xl border border-white/[0.06] bg-[#0f0f1a]/60 px-4 py-4 backdrop-blur-sm">
      <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <label htmlFor={selectId} className="sr-only">
            Entries per page
          </label>
          <select
            id={selectId}
            value={pageSize}
            onChange={(e) => {
              onPageSizeChange(Number(e.target.value));
              onPageChange(1);
            }}
            className="min-h-11 w-full cursor-pointer rounded-xl border border-white/[0.1] bg-[#0B0B15]/80 px-3 py-2.5 text-sm text-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] focus:outline-none focus:ring-2 focus:ring-violet-500/30 sm:w-auto"
          >
            {pageSizeOptions.map((n) => (
              <option key={n} value={n} className="bg-[#0B0B15]">
                {n} per page
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center justify-center gap-3 sm:justify-end">
          <button
            type="button"
            aria-label="Previous page"
            onClick={() => onPageChange(Math.max(1, safePage - 1))}
            disabled={safePage <= 1}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-slate-200 transition hover:border-violet-500/30 hover:bg-violet-500/10 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <ChevronRight className="h-4 w-4 rotate-180" />
          </button>
          <span className="min-w-[10rem] text-center text-sm tabular-nums text-slate-400">
            {from}–{to} of {total}
          </span>
          <button
            type="button"
            aria-label="Next page"
            onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
            disabled={safePage >= totalPages}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-slate-200 transition hover:border-violet-500/30 hover:bg-violet-500/10 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function groupEntriesByDate(entries: JournalEntry[]): Map<string, JournalEntry[]> {
  const groups = new Map<string, JournalEntry[]>();
  
  entries.forEach(entry => {
    const date = new Date(entry.created_at);
    const dateKey = date.toDateString();
    
    if (!groups.has(dateKey)) {
      groups.set(dateKey, []);
    }
    groups.get(dateKey)!.push(entry);
  });

  return groups;
}

export function Journal() {
  const { session, profile, user } = useAuth();
  const navigate = useNavigate();
  
  if (profile?.subscription_plan === 'trial') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="max-w-md rounded-3xl border border-white/[0.08] bg-[#0f0f1a]/80 p-8 text-center shadow-[0_0_48px_-16px_rgba(139,92,246,0.35)] backdrop-blur-md">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-500/15 to-fuchsia-500/10">
            <Lock className="h-9 w-9 text-violet-300" />
          </div>
          <h2 className="mb-3 text-2xl font-semibold tracking-tight text-slate-100">Journaling is a Core Feature</h2>
          <p className="mb-8 text-sm leading-relaxed text-slate-400">
            Upgrade to Core or Pro to unlock unlimited journaling, mood tracking, and more.
          </p>
          <Button
            onClick={() => navigate('/app/billing')}
            className="min-h-11 bg-gradient-to-r from-violet-600 to-fuchsia-600 px-8 text-white shadow-[0_0_24px_rgba(139,92,246,0.35)] hover:from-violet-500 hover:to-fuchsia-500"
          >
            View plans
          </Button>
        </div>
      </div>
    );
  }

  const [showNewEntry, setShowNewEntry] = useState(false);
  const [newEntryTitle, setNewEntryTitle] = useState("");
  const [newEntryContent, setNewEntryContent] = useState("");
  const [selectedMood, setSelectedMood] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showExportModal, setShowExportModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "favorites" | "tagged" | "calendar">("all");
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filterMood, setFilterMood] = useState<string>("");
  const [filterFavorites, setFilterFavorites] = useState(false);
  const [filterDateRange, setFilterDateRange] = useState<"all" | "week" | "month" | "year">("all");
  const [draftMood, setDraftMood] = useState<string>("");
  const [draftFavorites, setDraftFavorites] = useState(false);
  const [draftDateRange, setDraftDateRange] = useState<"all" | "week" | "month" | "year">("all");
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingFavoriteId, setTogglingFavoriteId] = useState<string | null>(null);
  const [showSaveFeedbackModal, setShowSaveFeedbackModal] = useState(false);
  const [saveFeedbackMessage, setSaveFeedbackMessage] = useState("");
  const [journalListPage, setJournalListPage] = useState(1);
  const [journalListPageSize, setJournalListPageSize] = useState(10);

  const getTextBasedSaveMessage = (
    contentHtml: string,
    moodEmoji: string,
    isEdit: boolean
  ): string => {
    const actionPrefix = isEdit ? "Entry updated." : "Entry saved.";
    const text = htmlToPlainText(contentHtml || "").toLowerCase();

    const positiveWords = ["grateful", "happy", "joy", "peace", "good", "better", "hopeful", "relaxed", "calm"];
    const anxiousWords = ["anxious", "overwhelmed", "worry", "stressed", "panic", "nervous"];
    const sadnessWords = ["sad", "down", "alone", "hurt", "cry", "tired", "empty"];
    const angerWords = ["angry", "frustrated", "mad", "upset", "annoyed", "irritated"];
    const growthWords = ["learned", "improved", "progress", "trying", "started", "focus", "discipline"];

    const hasAny = (words: string[]) => words.some((word) => text.includes(word));

    let contextMessage = "Thanks for checking in with yourself today. Keep writing one step at a time.";

    if (hasAny(growthWords)) {
      contextMessage = "You are noticing your progress, and that is meaningful. Keep building on this momentum.";
    } else if (hasAny(positiveWords)) {
      contextMessage = "This entry carries positive energy. Hold onto what is working for you today.";
    } else if (hasAny(anxiousWords)) {
      contextMessage = "This sounds like a heavy moment. Take a slow breath, and be kind to yourself.";
    } else if (hasAny(sadnessWords)) {
      contextMessage = "Thank you for putting these feelings into words. Naming them is a strong step forward.";
    } else if (hasAny(angerWords)) {
      contextMessage = "You expressed intense emotions clearly. A short pause can help create space before reacting.";
    } else if (text.trim().length > 0) {
      contextMessage = "You took time to reflect, and that matters. Keep listening to what your thoughts are telling you.";
    }

    if (!text.trim()) {
      const moodFallback: Record<string, string> = {
        "😊": "Love that happy energy - keep it going.",
        "😌": "Calm and steady - great space to be in.",
        "😰": "You showed up for yourself today. That matters.",
        "😢": "Thank you for sharing this. You are not alone.",
        "🤩": "That excitement is powerful - lean into it.",
        "😡": "Strong feelings are valid. Thanks for expressing them.",
      };
      contextMessage = moodFallback[moodEmoji] ?? contextMessage;
    }

    return `${actionPrefix} ${contextMessage}`;
  };

  const fetchEntries = async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      setLoadError(null);
      const data = await api.journal.getAll();
      
      const formattedEntries = data.map((entry: any) => {
        let moodDisplay = '😐';
        if (entry.mood_tags && entry.mood_tags.length > 0) {
          const rawMood = entry.mood_tags[0];
          const moodObj = JOURNAL_MOODS.find(m => 
            m.emoji === rawMood || 
            m.value.toLowerCase() === rawMood.toLowerCase()
          );
          moodDisplay = moodObj ? moodObj.emoji : rawMood;
        }

        return {
          ...entry,
          date: new Date(entry.created_at).toLocaleString('en-US', {
            dateStyle: 'long',
            timeStyle: 'medium'
          }),
          preview: entry.content
            ? truncatePreview(htmlToPlainText(entry.content), 100)
            : "",
          mood: moodDisplay,
          favorite: entry.is_favorite || false
        };
      });

      setEntries(formattedEntries);
    } catch (error) {
      console.error("Failed to fetch journal entries", error);
      setLoadError("We couldn’t reach your journal just now. Your words are still safe — try again in a moment.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleFavorite = async (entryId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setTogglingFavoriteId(entryId);
      await api.journal.toggleFavorite(entryId);
      setEntries(prev => prev.map(entry => 
        entry.id === entryId ? { ...entry, favorite: !entry.favorite } : entry
      ));
    } catch (error) {
      console.error("Failed to toggle favorite", error);
    } finally {
      setTogglingFavoriteId(null);
    }
  };

  useEffect(() => {
    void fetchEntries();
  }, [user?.id]);

  useEffect(() => {
    if (showFilterModal) {
      setDraftMood(filterMood);
      setDraftDateRange(filterDateRange);
      setDraftFavorites(filterFavorites);
    }
  }, [showFilterModal]);

  const handleSaveEntry = async () => {
    if (!session) return;
    
    try {
      setIsSaving(true);
      const moodAtSave = selectedMood;
      const isEdit = Boolean(editingEntry);
      const contentAtSave = newEntryContent;
      const entryData = {
        title: newEntryTitle,
        content: newEntryContent,
        mood_tags: selectedMood ? [selectedMood] : [],
        is_private: true
      };

      if (editingEntry) {
        await api.journal.update(editingEntry, entryData);
      } else {
        await api.journal.create(entryData);
      }

      await fetchEntries();
      
      setShowNewEntry(false);
      setNewEntryTitle("");
      setNewEntryContent("");
      setSelectedMood("");
      setEditingEntry(null);
      setSaveFeedbackMessage(getTextBasedSaveMessage(contentAtSave, moodAtSave, isEdit));
      setShowSaveFeedbackModal(true);
    } catch (error) {
      console.error("Failed to save journal entry", error);
      toast.error("Failed to save entry. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditEntry = (entryId: string) => {
    const entry = entries.find(e => e.id === entryId);
    if (entry) {
      setNewEntryTitle(entry.title || "");
      setNewEntryContent(entry.content || "");
      
      let moodToSelect = "";
      if (entry.mood_tags && entry.mood_tags.length > 0) {
        const rawMood = entry.mood_tags[0];
        const moodObj = JOURNAL_MOODS.find(m => 
          m.emoji === rawMood || 
          m.value.toLowerCase() === rawMood.toLowerCase()
        );
        moodToSelect = moodObj ? moodObj.emoji : rawMood;
      }
      setSelectedMood(moodToSelect);
      
      setEditingEntry(entryId);
      setShowNewEntry(true);
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (confirm("Are you sure you want to delete this journal entry?")) {
      try {
        setDeletingId(entryId);
        await api.journal.delete(entryId);
        setEntries(entries.filter(e => e.id !== entryId));
      } catch (error) {
        console.error("Failed to delete journal entry", error);
        alert("Failed to delete entry.");
      } finally {
        setDeletingId(null);
      }
    }
  };

  const filteredEntries = useMemo(
    () =>
      entries.filter((entry) => {
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          const titleMatch = entry.title?.toLowerCase().includes(query);
          const contentMatch = entry.content?.toLowerCase().includes(query);
          if (!titleMatch && !contentMatch) return false;
        }

        if (activeTab === "favorites" && !entry.favorite) return false;
        if (activeTab === "tagged" && (!entry.mood_tags || entry.mood_tags.length === 0)) return false;

        if (filterMood) {
          const moodValue = JOURNAL_MOODS.find((m) => m.emoji === filterMood)?.value;
          const entryMood = entry.mood_tags?.[0];

          if (!entryMood) return false;

          const isMatch =
            entryMood === filterMood ||
            (moodValue && entryMood.toLowerCase() === moodValue.toLowerCase());

          if (!isMatch) return false;
        }

        if (filterDateRange !== "all") {
          const entryDate = new Date(entry.created_at);
          const now = new Date();
          const diffTime = Math.abs(now.getTime() - entryDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          if (filterDateRange === "week" && diffDays > 7) return false;
          if (filterDateRange === "month" && diffDays > 30) return false;
          if (filterDateRange === "year" && diffDays > 365) return false;
        }

        if (filterFavorites && !entry.favorite) return false;

        return true;
      }),
    [entries, searchQuery, filterMood, filterDateRange, filterFavorites, activeTab]
  );

  const journalTotalPages = Math.max(1, Math.ceil(filteredEntries.length / journalListPageSize));
  const journalSafePage = Math.min(Math.max(1, journalListPage), journalTotalPages);
  const paginatedJournalEntries = useMemo(() => {
    const start = (journalSafePage - 1) * journalListPageSize;
    return filteredEntries.slice(start, start + journalListPageSize);
  }, [filteredEntries, journalSafePage, journalListPageSize]);

  const groupedEntries = useMemo(() => {
    return groupEntriesByDate(paginatedJournalEntries);
  }, [paginatedJournalEntries]);

  useEffect(() => {
    setJournalListPage(1);
  }, [searchQuery, filterMood, filterDateRange, filterFavorites, activeTab]);

  useEffect(() => {
    setJournalListPage((prev) => (prev > journalTotalPages ? journalTotalPages : prev));
  }, [journalTotalPages]);

  const totalEntries = entries.length;
  
  const calculateStreak = () => {
    if (entries.length === 0) return 0;
    
    const sortedEntries = [...entries].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const lastEntryDate = new Date(sortedEntries[0].created_at);
    lastEntryDate.setHours(0, 0, 0, 0);
    
    if (lastEntryDate.getTime() === today.getTime()) {
      streak = 1;
    } else if ((today.getTime() - lastEntryDate.getTime()) > (1000 * 60 * 60 * 24)) {
      return 0;
    }

    let currentDate = lastEntryDate;
    
    for (let i = 1; i < sortedEntries.length; i++) {
      const entryDate = new Date(sortedEntries[i].created_at);
      entryDate.setHours(0, 0, 0, 0);
      
      const diffTime = currentDate.getTime() - entryDate.getTime();
      const diffDays = diffTime / (1000 * 60 * 60 * 24);
      
      if (diffDays === 1) {
        streak++;
        currentDate = entryDate;
      } else if (diffDays === 0) {
        continue;
      } else {
        break;
      }
    }
    
    return streak;
  };

  const streak = calculateStreak();

  const moodStats = useMemo(() => {
    const stats = { positive: 0, neutral: 0, difficult: 0 };
    const positiveLabels = ["happy", "calm", "excited", "grateful"];
    const difficultLabels = ["anxious", "sad", "angry"];

    entries.forEach(entry => {
      const mood = entry.mood_tags?.[0]?.toLowerCase();
      if (!mood) {
        stats.neutral++;
      } else if (positiveLabels.some(p => mood.includes(p))) {
        stats.positive++;
      } else if (difficultLabels.some(d => mood.includes(d))) {
        stats.difficult++;
      } else {
        stats.neutral++;
      }
    });

    return stats;
  }, [entries]);

  const topTags = useMemo(() => {
    const tagCounts = new Map<string, number>();
    
    entries.forEach(entry => {
      entry.mood_tags?.forEach(tag => {
        const normalized = tag.toLowerCase();
        tagCounts.set(normalized, (tagCounts.get(normalized) || 0) + 1);
      });
    });

    return Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag, count]) => ({ tag, count }));
  }, [entries]);

  const hasMoodTagOnAnyEntry = useMemo(
    () => entries.some((e) => Array.isArray(e.mood_tags) && e.mood_tags.length > 0),
    [entries]
  );

  const weeklyActivity = useMemo(() => {
    const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    const activity = days.map((day, i) => {
      const date = new Date();
      const diff = (date.getDay() + 6) % 7 - i;
      date.setDate(date.getDate() - diff);
      date.setHours(0, 0, 0, 0);
      
      const hasEntry = entries.some(entry => {
        const entryDate = new Date(entry.created_at);
        entryDate.setHours(0, 0, 0, 0);
        return entryDate.getTime() === date.getTime();
      });

      return { day, active: hasEntry };
    });

    return activity;
  }, [entries]);

  const featuredEntry = useMemo(() => {
    if (entries.length === 0) return null;
    const favorites = entries.filter(e => e.favorite);
    if (favorites.length > 0) {
      return favorites.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0];
    }
    return entries[0];
  }, [entries]);

  const showFetchFailure = Boolean(loadError && entries.length === 0);

  return (
    <>
      <div className="relative min-h-[calc(100dvh-5rem)] overflow-x-hidden pb-28 text-[var(--solace-text)] lg:pb-14 solace-canvas-bg">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[min(44vh,380px)] bg-[radial-gradient(ellipse_90%_100%_at_50%_0%,rgba(92,106,172,0.14)_0%,transparent_72%)]"
          aria-hidden
        />
        <div className="relative z-[1] mx-auto max-w-[1680px] px-4 py-8 sm:px-5 sm:py-10 lg:px-8">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-x-10 xl:gap-x-12">
            <div className="min-w-0 space-y-8 sm:space-y-10 lg:space-y-[2.75rem]">
            {loadError && entries.length > 0 ? (
              <div
                className="mb-6 flex flex-col gap-3 rounded-2xl border border-amber-500/15 bg-amber-500/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between"
                role="status"
              >
                <p className="text-sm leading-relaxed text-amber-100/85">{loadError}</p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void fetchEntries()}
                  className="shrink-0 border-amber-500/25 bg-amber-500/10 text-amber-50 hover:bg-amber-500/15"
                >
                  Try again
                </Button>
              </div>
            ) : null}

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8 lg:mb-10">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex gap-4">
                  <div
                    className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-500/20 to-fuchsia-500/15 shadow-[0_0_28px_rgba(217,70,239,0.25)]"
                    aria-hidden
                  >
                    <BookOpen className="h-6 w-6 text-violet-200" />
                    <span className="pointer-events-none absolute inset-0 rounded-2xl shadow-[inset_0_0_20px_rgba(255,255,255,0.06)]" />
                  </div>
                  <div className="min-w-0 space-y-1.5">
                    <h1 className="text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">My Journal</h1>
                    <p className="max-w-md text-sm leading-relaxed text-slate-400">
                      Your private space for thoughts and reflections
                    </p>
                  </div>
                </div>
                <div className="flex w-full flex-col gap-2 self-stretch sm:max-w-none sm:flex-row sm:justify-end lg:w-auto">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowExportModal(true)}
                    className="order-2 min-h-11 w-full border-white/[0.12] bg-white/[0.04] text-slate-200 shadow-none backdrop-blur-sm hover:border-violet-500/35 hover:bg-violet-500/10 hover:text-white sm:order-1 sm:w-auto"
                  >
                    <Download className="mr-2 h-4 w-4 shrink-0 opacity-80" />
                    Export
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      setEditingEntry(null);
                      setNewEntryTitle("");
                      setNewEntryContent("");
                      setSelectedMood("");
                      setShowNewEntry(true);
                    }}
                    className="order-1 min-h-11 w-full bg-gradient-to-r from-violet-600/95 to-fuchsia-600/90 text-white shadow-[0_0_32px_rgba(139,92,246,0.35)] hover:from-violet-500 hover:to-fuchsia-500 sm:order-2 sm:w-auto"
                  >
                    <Plus className="mr-2 h-4 w-4 shrink-0" />
                    New Entry
                  </Button>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="mb-2 sm:mb-4 lg:mb-6"
            >
              {isLoading && entries.length === 0 ? (
                <div className="overflow-hidden rounded-[1.35rem] border border-white/[0.08] bg-[#0c0c14]/85 shadow-[0_24px_80px_-40px_rgba(0,0,0,0.85)] ring-1 ring-inset ring-white/[0.04]">
                  <div className="grid grid-cols-1 md:grid-cols-[minmax(0,40%)_1fr]">
                    <Skeleton className="min-h-[220px] w-full rounded-none bg-gradient-to-br from-violet-950/30 via-[#0a0f1c] to-[#050814] md:min-h-[280px]" />
                    <div className="flex flex-col justify-center gap-4 p-6 sm:p-7">
                      <Skeleton className="h-6 w-36 rounded-full bg-white/[0.06]" />
                      <Skeleton className="h-8 w-full max-w-md rounded-lg bg-white/[0.07]" />
                      <Skeleton className="h-4 w-full max-w-lg rounded-md bg-white/[0.05]" />
                      <Skeleton className="h-4 w-2/3 max-w-md rounded-md bg-white/[0.05]" />
                      <div className="flex gap-3 pt-2">
                        <Skeleton className="h-9 w-40 rounded-lg bg-white/[0.06]" />
                        <Skeleton className="h-9 w-28 rounded-lg bg-white/[0.05]" />
                      </div>
                    </div>
                  </div>
                </div>
              ) : featuredEntry ? (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="overflow-hidden rounded-[1.35rem] border border-white/[0.08] bg-[#0a0a12]/90 shadow-[0_28px_90px_-48px_rgba(0,0,0,0.92),0_0_48px_-24px_rgba(139,92,246,0.28)] ring-1 ring-inset ring-white/[0.045]"
                >
                  <div className="grid grid-cols-1 md:grid-cols-[minmax(0,40%)_1fr]">
                    <JournalHeroBackdrop />

                    <div className="flex flex-1 flex-col justify-between gap-6 p-6 sm:p-7">
                      <div className="space-y-4">
                        {featuredEntry.mood_tags?.[0] ? (
                          <span
                            className={cn(
                              "inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
                              getMoodTagStyle(featuredEntry.mood_tags[0]).bg,
                              getMoodTagStyle(featuredEntry.mood_tags[0]).text,
                              getMoodTagStyle(featuredEntry.mood_tags[0]).border
                            )}
                          >
                            <FluentEmoji emoji={featuredEntry.mood || "😐"} size={14} />
                            {getMoodLabel(featuredEntry.mood_tags[0])}
                          </span>
                        ) : null}
                        <h2 className="text-balance text-xl font-semibold leading-snug tracking-tight text-zinc-50 sm:text-2xl">
                          {featuredEntry.title || "Untitled reflection"}
                        </h2>
                        {featuredEntry.preview ? (
                          <p className="max-w-xl text-sm leading-relaxed text-zinc-400 line-clamp-3 sm:line-clamp-2">
                            {featuredEntry.preview}
                          </p>
                        ) : null}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-zinc-500">
                          <span className="inline-flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 shrink-0 opacity-70" />
                            {new Date(featuredEntry.created_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}{" "}
                            · {formatEntryTime(featuredEntry.created_at)}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 shrink-0 opacity-70" />
                            {getReadingTime(featuredEntry.content)} min read
                          </span>
                        </div>
                      </div>
                      <div className="flex md:justify-end">
                        <Button
                          type="button"
                          onClick={() => handleEditEntry(featuredEntry.id)}
                          className="min-h-11 w-full border border-violet-500/35 bg-zinc-950/60 text-violet-100 shadow-[0_0_24px_rgba(139,92,246,0.18)] hover:bg-violet-950/50 md:w-auto"
                        >
                          Open
                          <ChevronRight className="ml-1 h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="overflow-hidden rounded-[1.35rem] border border-white/[0.08] bg-[#0a0a12]/90 shadow-[0_28px_90px_-48px_rgba(0,0,0,0.92),0_0_40px_-20px_rgba(139,92,246,0.22)] ring-1 ring-inset ring-white/[0.045]"
                >
                  <div className="grid grid-cols-1 md:grid-cols-[minmax(0,40%)_1fr]">
                    <JournalHeroBackdrop />
                    <div className="flex flex-1 flex-col justify-center gap-5 p-6 sm:p-7">
                      <h2 className="text-balance text-xl font-semibold leading-snug tracking-tight text-zinc-50 sm:text-2xl">
                        Your first reflection starts here.
                      </h2>
                      <p className="max-w-lg text-sm leading-relaxed text-zinc-500">
                        This space stays private and unhurried. When you&apos;re ready, begin with a single line.
                      </p>
                      <div>
                        <Button
                          type="button"
                          onClick={() => {
                            setEditingEntry(null);
                            setNewEntryTitle("");
                            setNewEntryContent("");
                            setSelectedMood("");
                            setShowNewEntry(true);
                          }}
                          className="min-h-11 bg-gradient-to-r from-violet-600/95 to-fuchsia-600/90 px-8 text-white shadow-[0_0_32px_rgba(139,92,246,0.35)] hover:from-violet-500 hover:to-fuchsia-500"
                        >
                          <Plus className="mr-2 h-4 w-4 shrink-0" />
                          New Entry
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className="mb-8 border-b border-white/[0.06] pb-5"
            >
              <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {(
                    [
                      { id: "all", label: "All Entries", icon: BookOpen },
                      { id: "favorites", label: "Favorites", icon: Heart },
                      { id: "tagged", label: "Tagged", icon: Tag },
                      { id: "calendar", label: "Calendar", icon: Calendar },
                    ] as const
                  ).map((tab) => {
                    const Icon = tab.icon;
                    const active = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                          "relative flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-sm transition-colors min-h-11",
                          active
                            ? "text-violet-100"
                            : "text-slate-500 hover:text-slate-300"
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0 opacity-80" />
                        <span className="whitespace-nowrap">{tab.label}</span>
                        {active ? (
                          <span className="absolute inset-x-2 -bottom-1 h-px bg-gradient-to-r from-transparent via-violet-400 to-transparent shadow-[0_0_12px_rgba(167,139,250,0.9)]" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
                <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-end lg:w-auto lg:shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowFilterModal(true)}
                    className={cn(
                      "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border px-4 text-sm transition-colors sm:w-auto",
                      filterMood || filterDateRange !== "all" || filterFavorites
                        ? "border-violet-500/35 bg-violet-500/10 text-violet-100 shadow-[0_0_20px_rgba(139,92,246,0.12)]"
                        : "border-white/[0.08] bg-white/[0.03] text-slate-400 hover:border-violet-500/25 hover:text-slate-200"
                    )}
                  >
                    <Filter className="h-4 w-4 shrink-0 opacity-80" />
                    Filter
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
                  </button>
                  <div className="relative w-full sm:max-w-xs">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search entries…"
                      className="min-h-11 w-full rounded-xl border border-white/[0.08] bg-[#0B0B15]/60 py-2.5 pl-10 pr-4 text-sm text-slate-100 placeholder:text-slate-500 focus:border-violet-500/40 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                      aria-label="Search journal entries"
                    />
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.16 }}
            >
              {showFetchFailure ? (
                <div className="flex flex-col items-center rounded-3xl border border-white/[0.08] bg-[#0f0f1a]/80 px-6 py-16 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-violet-500/20 bg-violet-500/10">
                    <BookOpen className="h-8 w-8 text-violet-300/90" />
                  </div>
                  <h3 className="mb-2 text-lg font-medium text-slate-100">This moment is out of reach</h3>
                  <p className="mb-8 max-w-sm text-sm leading-relaxed text-slate-400">{loadError}</p>
                  <Button
                    type="button"
                    onClick={() => void fetchEntries()}
                    className="min-h-11 bg-gradient-to-r from-violet-600 to-fuchsia-600 px-8 text-white shadow-[0_0_28px_rgba(139,92,246,0.3)] hover:from-violet-500 hover:to-fuchsia-500"
                  >
                    Try again
                  </Button>
                </div>
              ) : isLoading && entries.length === 0 ? (
                <div className="relative space-y-5 pl-1 sm:pl-2">
                  <div
                    className="pointer-events-none absolute bottom-12 left-[11px] top-3 hidden w-px bg-gradient-to-b from-violet-500/22 via-white/[0.06] to-transparent sm:block"
                    aria-hidden
                  />
                  {[1, 2, 3].map((i) => (
                    <Skeleton
                      key={i}
                      className="ml-0 min-h-[118px] rounded-[1.15rem] border border-white/[0.06] bg-[#0c0c14]/75 shadow-[0_12px_40px_-28px_rgba(0,0,0,0.75)] sm:ml-10"
                    />
                  ))}
                </div>
              ) : filteredEntries.length === 0 && entries.length > 0 ? (
                <div className="flex flex-col items-center rounded-[1.35rem] border border-white/[0.08] bg-[#0c0c14]/55 px-6 py-16 text-center">
                  <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-500/15 bg-violet-500/10">
                    <Search className="h-7 w-7 text-violet-300/80" />
                  </div>
                  <h3 className="mb-2 text-lg font-medium text-zinc-100">Nothing matches right now</h3>
                  <p className="max-w-sm text-sm leading-relaxed text-zinc-500">
                    Try softening a filter, clearing search, or choosing another tab — your entries are still here.
                  </p>
                </div>
              ) : filteredEntries.length === 0 && !isLoading ? (
                <div className="rounded-[1.15rem] border border-dashed border-white/[0.08] bg-[#0c0c14]/40 px-5 py-10 text-center">
                  <p className="text-sm leading-relaxed text-zinc-500">
                    Entries you add will appear here along this timeline.
                  </p>
                </div>
              ) : (
                <div className="relative pl-1 sm:pl-2">
                  <div
                    className="pointer-events-none absolute bottom-16 left-[11px] top-3 hidden w-px bg-gradient-to-b from-violet-500/25 via-white/[0.07] to-transparent sm:block"
                    aria-hidden
                  />

                  <div className="space-y-12 sm:space-y-14">
                    {Array.from(groupedEntries.entries()).map(([dateKey, dateEntries]) => {
                      const { label, subLabel } = formatDateGroup(dateEntries[0].created_at);

                      return (
                        <div key={dateKey} className="relative">
                          <div className="mb-6 flex items-start gap-4 sm:gap-5">
                            <div className="relative z-10 mt-1.5 flex h-3 w-3 shrink-0 items-center justify-center sm:ml-[5px]">
                              <span className="h-3 w-3 rounded-full bg-[#0B0B15] shadow-[0_0_14px_rgba(167,139,250,0.75)] ring-2 ring-violet-400/70" />
                            </div>
                            <div className="min-w-0 pt-0.5">
                              <p className="text-sm font-medium tracking-wide text-zinc-100">
                                {label}
                                {subLabel ? (
                                  <span className="font-normal text-zinc-500"> — {subLabel}</span>
                                ) : null}
                              </p>
                            </div>
                          </div>

                          <div className="relative z-10 space-y-4 sm:pl-10">
                            {dateEntries.map((entry, idx) => (
                              <motion.div
                                key={entry.id}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.04 }}
                                className="relative"
                              >
                                <div
                                  role="button"
                                  tabIndex={0}
                                  onClick={() => handleEditEntry(entry.id)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault();
                                      handleEditEntry(entry.id);
                                    }
                                  }}
                                  className={cn(
                                    "group cursor-pointer rounded-[1.15rem] border border-white/[0.07] bg-[#0c0c14]/88 p-4 text-left shadow-[0_18px_50px_-38px_rgba(0,0,0,0.88)] outline-none backdrop-blur-sm transition-all duration-300 sm:p-5",
                                    "hover:border-violet-500/28 hover:shadow-[0_0_36px_-12px_rgba(139,92,246,0.24)] focus-visible:ring-2 focus-visible:ring-violet-400/35",
                                    entry.favorite && "border-violet-500/20 shadow-[0_0_28px_-14px_rgba(139,92,246,0.2)]"
                                  )}
                                >
                                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                                    <div className="flex min-w-0 flex-1 gap-4">
                                      <div className="shrink-0 pt-0.5">
                                        <FluentEmoji emoji={entry.mood || "😐"} size={36} />
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <h3 className="text-base font-medium leading-snug tracking-tight text-zinc-100 transition-colors group-hover:text-violet-100">
                                          {entry.title || "Untitled reflection"}
                                        </h3>
                                        {entry.preview ? (
                                          <p className="mt-2 text-sm leading-relaxed text-zinc-400 line-clamp-3">
                                            {entry.preview}
                                          </p>
                                        ) : null}
                                      </div>
                                    </div>

                                    <div className="flex shrink-0 flex-row items-center justify-between gap-3 border-t border-white/[0.06] pt-3 sm:w-44 sm:flex-col sm:items-end sm:border-t-0 sm:pt-0">
                                      <span className="text-xs tabular-nums text-slate-500">
                                        {formatEntryTime(entry.created_at)}
                                      </span>
                                      {entry.mood_tags?.[0] ? (
                                        <span
                                          className={cn(
                                            "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium sm:order-none",
                                            getMoodTagStyle(entry.mood_tags[0]).bg,
                                            getMoodTagStyle(entry.mood_tags[0]).text,
                                            getMoodTagStyle(entry.mood_tags[0]).border
                                          )}
                                        >
                                          {getMoodLabel(entry.mood_tags[0])}
                                        </span>
                                      ) : null}
                                      <div className="flex items-center gap-1">
                                        <button
                                          type="button"
                                          onClick={(e) => handleToggleFavorite(entry.id, e)}
                                          disabled={togglingFavoriteId === entry.id}
                                          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-slate-400 transition hover:bg-white/[0.05] hover:text-fuchsia-200"
                                          aria-label={entry.favorite ? "Remove from favorites" : "Add to favorites"}
                                        >
                                          {togglingFavoriteId === entry.id ? (
                                            <Loader2 className="h-4 w-4 animate-spin text-fuchsia-300" />
                                          ) : (
                                            <Heart
                                              className={cn(
                                                "h-4 w-4 transition-colors",
                                                entry.favorite
                                                  ? "fill-fuchsia-500 text-fuchsia-400"
                                                  : "text-slate-500 group-hover:text-slate-300"
                                              )}
                                            />
                                          )}
                                        </button>
                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                            <button
                                              type="button"
                                              onClick={(e) => e.stopPropagation()}
                                              onPointerDown={(e) => e.stopPropagation()}
                                              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-zinc-400 opacity-100 transition hover:bg-white/[0.05] sm:opacity-0 sm:group-hover:opacity-100"
                                              aria-label="Entry actions"
                                            >
                                              <MoreVertical className="h-4 w-4" />
                                            </button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent
                                            align="end"
                                            className="border border-white/[0.08] bg-[#14141f] text-slate-100"
                                          >
                                            <DropdownMenuItem
                                              onClick={() => handleEditEntry(entry.id)}
                                              className="focus:bg-white/[0.06] focus:text-slate-50"
                                            >
                                              <Edit className="mr-2 h-4 w-4" />
                                              Edit
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                              onClick={() => handleDeleteEntry(entry.id)}
                                              disabled={deletingId === entry.id}
                                              className="text-red-300 focus:bg-red-950/40 focus:text-red-100"
                                            >
                                              {deletingId === entry.id ? (
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                              ) : (
                                                <Trash2 className="mr-2 h-4 w-4" />
                                              )}
                                              Delete
                                            </DropdownMenuItem>
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {filteredEntries.length > 0 ? (
                    <div className="mt-12 flex items-center justify-center gap-3 py-4 text-sm text-slate-500">
                      <div className="h-px w-14 bg-gradient-to-r from-transparent to-white/10" />
                      <span className="inline-flex items-center gap-2 text-slate-500">
                        <Sparkles className="h-3.5 w-3.5 text-violet-400/70" />
                        You&apos;ve reached the end
                        <Sparkles className="h-3.5 w-3.5 text-fuchsia-400/70" />
                      </span>
                      <div className="h-px w-14 bg-gradient-to-l from-transparent to-white/10" />
                    </div>
                  ) : null}

                  {journalTotalPages > 1 ? (
                    <JournalPagination
                      total={filteredEntries.length}
                      page={journalListPage}
                      pageSize={journalListPageSize}
                      onPageChange={setJournalListPage}
                      onPageSizeChange={setJournalListPageSize}
                      selectId="journal-entries-page-size"
                      pageSizeOptions={JOURNAL_LIST_PAGE_OPTIONS}
                    />
                  ) : null}
                </div>
              )}
            </motion.div>

            <div className="mt-10 lg:hidden">
              <JournalInsightsRail
                moodStats={moodStats}
                streak={streak}
                weeklyActivity={weeklyActivity}
                topTags={topTags}
                journalEntryCount={entries.length}
                hasMoodTagOnAnyEntry={hasMoodTagOnAnyEntry}
                onViewAllTags={topTags.length > 0 ? () => setActiveTab("tagged") : undefined}
              />
            </div>
          </div>

          <aside className="hidden min-w-0 lg:block">
            <motion.div
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.18 }}
              className="lg:sticky lg:top-6"
            >
              <JournalInsightsRail
                moodStats={moodStats}
                streak={streak}
                weeklyActivity={weeklyActivity}
                topTags={topTags}
                journalEntryCount={entries.length}
                hasMoodTagOnAnyEntry={hasMoodTagOnAnyEntry}
                onViewAllTags={topTags.length > 0 ? () => setActiveTab("tagged") : undefined}
              />
            </motion.div>
          </aside>
        </div>

        <div className="relative mt-10 w-full sm:mt-12 lg:mt-12">
          <div
            className="pointer-events-none absolute inset-x-0 -top-10 h-[3.25rem] bg-[linear-gradient(180deg,transparent_0%,rgba(6,10,18,0.35)_72%,rgba(6,10,18,0.58)_100%)]"
            aria-hidden
          />
          <div className="relative">
            <TalkItOutBottomDock
              density="compact"
              getSupportSlot={
                <Button
                  asChild
                  className="min-h-[44px] rounded-full bg-gradient-to-r from-violet-600/90 to-indigo-600/90 px-6 text-[13px] text-white shadow-[0_0_28px_rgba(76,29,149,0.35)] hover:from-violet-500 hover:to-indigo-500"
                >
                  <Link to="/app/emergency-resources">Get Support</Link>
                </Button>
              }
            />
          </div>
        </div>
      </div>
      </div>

      {/* New Entry Modal */}
      <AnimatePresence>
        {showNewEntry && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowNewEntry(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-4 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-2xl z-50"
            >
              <div className="bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-slate-100">
                      {editingEntry ? 'Edit Entry' : 'New Entry'}
                    </h2>
                    <button
                      onClick={() => setShowNewEntry(false)}
                      className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-5">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Title (Optional)</label>
                      <input
                        type="text"
                        value={newEntryTitle}
                        onChange={(e) => setNewEntryTitle(e.target.value)}
                        placeholder="Give your entry a title..."
                        className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">How are you feeling?</label>
                      <div className="flex gap-2 flex-wrap">
                        {JOURNAL_MOODS.map((mood) => (
                          <button
                            key={mood.value}
                            onClick={() => setSelectedMood(mood.emoji)}
                            className={cn(
                              "flex items-center gap-2 px-3 py-2 rounded-xl border transition-all",
                              selectedMood === mood.emoji
                                ? "bg-purple-600/20 border-purple-500/50 text-purple-300"
                                : "bg-slate-800/30 border-slate-700/30 text-slate-400 hover:bg-slate-700/30 hover:text-slate-300"
                            )}
                          >
                            <FluentEmoji emoji={mood.emoji} size={20} />
                            <span className="text-sm">{mood.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Write your thoughts...</label>
                      <RichTextEditor
                        value={newEntryContent}
                        onChange={(e) => setNewEntryContent(e)}
                        placeholder="Start writing... Let your thoughts flow freely."
                        className="w-full bg-slate-800/30 border-slate-700/50 rounded-xl focus-within:border-purple-500/50"
                        hideMoodSelector={true}
                      />
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Lock className="w-3.5 h-3.5" />
                      <span>Your journal is private and secure</span>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <Button
                        onClick={() => setShowNewEntry(false)}
                        variant="outline"
                        className="flex-1 bg-slate-800/50 border-slate-700/50 hover:bg-slate-700/50 text-slate-300"
                      >
                        Cancel
                      </Button>
                      <Button 
                        onClick={handleSaveEntry} 
                        className="flex-1 bg-purple-600 hover:bg-purple-700 text-white" 
                        disabled={isSaving}
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          "Save Entry"
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Save Feedback Modal */}
      <AnimatePresence>
        {showSaveFeedbackModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSaveFeedbackModal(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="fixed inset-4 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md z-[70]"
            >
              <div className="bg-slate-900 border border-purple-500/30 rounded-2xl shadow-2xl p-6">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-100">Reflection Saved</h3>
                  </div>
                  <button
                    onClick={() => setShowSaveFeedbackModal(false)}
                    className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-sm text-slate-400 leading-relaxed mb-5">{saveFeedbackMessage}</p>
                <Button
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                  onClick={() => setShowSaveFeedbackModal(false)}
                >
                  Continue
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Filter Modal */}
      <AnimatePresence>
        {showFilterModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowFilterModal(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="fixed inset-4 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md z-50"
            >
              <div className="bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <Filter className="w-5 h-5 text-purple-400" />
                    <h2 className="text-lg font-semibold text-slate-100">Filter Entries</h2>
                  </div>
                  <button
                    onClick={() => setShowFilterModal(false)}
                    className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Filter by Mood */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-300 mb-3">Filter by Mood</label>
                  <div className="flex gap-2 flex-wrap">
                    {JOURNAL_MOODS.map((mood) => (
                      <button
                        key={mood.value}
                        onClick={() => setDraftMood(draftMood === mood.emoji ? "" : mood.emoji)}
                        className={cn(
                          "p-2.5 rounded-xl border transition-all",
                          draftMood === mood.emoji
                            ? "bg-purple-600/20 border-purple-500/50"
                            : "bg-slate-800/30 border-slate-700/30 hover:bg-slate-700/30"
                        )}
                      >
                        <FluentEmoji emoji={mood.emoji} size={24} />
                      </button>
                    ))}
                  </div>
                  {draftMood && (
                    <button
                      onClick={() => setDraftMood("")}
                      className="text-xs text-purple-400 mt-2 hover:text-purple-300"
                    >
                      Clear mood filter
                    </button>
                  )}
                </div>

                {/* Filter by Date Range */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-300 mb-3">Filter by Date</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: "all", label: "All Time" },
                      { value: "week", label: "Past Week" },
                      { value: "month", label: "Past Month" },
                      { value: "year", label: "Past Year" },
                    ].map((range) => (
                      <button
                        key={range.value}
                        onClick={() => setDraftDateRange(range.value as typeof draftDateRange)}
                        className={cn(
                          "px-4 py-2.5 rounded-xl border text-sm font-medium transition-all",
                          draftDateRange === range.value
                            ? "bg-purple-600/20 border-purple-500/50 text-purple-300"
                            : "bg-slate-800/30 border-slate-700/30 text-slate-400 hover:bg-slate-700/30"
                        )}
                      >
                        {range.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Filter by Favorites */}
                <div className="mb-6">
                  <button
                    onClick={() => setDraftFavorites(!draftFavorites)}
                    className={cn(
                      "w-full px-4 py-3 rounded-xl border flex items-center justify-between transition-all",
                      draftFavorites
                        ? "bg-pink-600/20 border-pink-500/50"
                        : "bg-slate-800/30 border-slate-700/30 hover:bg-slate-700/30"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Heart className={cn(
                        "w-4 h-4",
                        draftFavorites ? "text-pink-400 fill-pink-400" : "text-slate-400"
                      )} />
                      <span className={cn(
                        "text-sm font-medium",
                        draftFavorites ? "text-pink-300" : "text-slate-400"
                      )}>
                        Show Favorites Only
                      </span>
                    </div>
                    <div className={cn(
                      "w-10 h-5 rounded-full transition-colors relative",
                      draftFavorites ? "bg-pink-500" : "bg-slate-600"
                    )}>
                      <div className={cn(
                        "absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform",
                        draftFavorites ? "translate-x-5" : "translate-x-0.5"
                      )} />
                    </div>
                  </button>
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center gap-3 pt-4 border-t border-slate-700/50">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDraftMood("");
                      setDraftDateRange("all");
                      setDraftFavorites(false);
                    }}
                    className="flex-1 bg-slate-800/50 border-slate-700/50 hover:bg-slate-700/50 text-slate-300"
                  >
                    Clear All
                  </Button>
                  <Button
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                    onClick={() => {
                      setFilterMood(draftMood);
                      setFilterDateRange(draftDateRange);
                      setFilterFavorites(draftFavorites);
                      setShowFilterModal(false);
                    }}
                  >
                    Apply Filters
                  </Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Export Modal */}
      <JournalExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        entries={entries}
      />
    </>
  );
}
