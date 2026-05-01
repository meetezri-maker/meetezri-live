import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AdminLayoutNew } from '@/app/components/AdminLayoutNew';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import {
  MessageSquare,
  Search,
  Calendar,
  User,
  Brain,
  Download,
  Flag,
  AlertTriangle,
  Clock,
  X,
  Info,
  Save,
  Trash2,
  Loader2,
} from 'lucide-react';
import { AdminPaginationBar } from '@/app/components/admin/AdminPaginationBar';

interface Message {
  id: string;
  speaker: 'user' | 'ai';
  text: string;
  timestamp: string;
  sentiment?: 'positive' | 'neutral' | 'negative' | 'crisis';
}

type RowSentiment = 'positive' | 'neutral' | 'concerning' | 'crisis';

interface Transcript {
  id: string;
  userId: string;
  userName: string;
  userEmail?: string;
  avatarId: string;
  avatarName: string;
  sessionDate: string;
  sessionDuration: number;
  messages: Message[];
  topics: string[];
  summary?: string;
  sentiment: RowSentiment;
  isFlagged: boolean;
  isEscalated: boolean;
  isReviewed: boolean;
  adminNotes: string;
  crisisIndicators: string[];
  reviewedAt?: string;
  messageCount: number;
}

function mapApiSessionToTranscript(session: any): Transcript {
  const config = session.config || {};
  const isReviewed = !!(config.reviewed_at || config.status === 'reviewed');
  const isEscalated = config.status === 'escalated';
  const rawSent = (config.sentiment || 'neutral') as string;
  let sentiment: RowSentiment = 'neutral';
  if (rawSent === 'positive') sentiment = 'positive';
  else if (rawSent === 'crisis') sentiment = 'crisis';
  else if (rawSent === 'negative' || rawSent === 'concerning') sentiment = 'concerning';
  else if (rawSent === 'neutral') sentiment = 'neutral';

  const topics = Array.isArray(config.topics) ? config.topics : [];
  const flaggedIssues = Array.isArray(config.flagged_issues) ? config.flagged_issues : [];
  const crisisIndicators =
    sentiment === 'crisis'
      ? flaggedIssues.length > 0
        ? flaggedIssues
        : ['Crisis-related session']
      : flaggedIssues;

  return {
    id: session.id,
    userId: session.user_id,
    userName: session.profiles?.full_name || 'Unknown user',
    userEmail: session.profiles?.email,
    avatarId: typeof config.avatar_id === 'string' ? config.avatar_id : '',
    avatarName:
      (typeof config.ai_name === 'string' && config.ai_name) ||
      (typeof config.avatar === 'string' && config.avatar) ||
      'AI Assistant',
    sessionDate: session.started_at || session.created_at,
    sessionDuration: session.duration_minutes ?? 0,
    messages: [],
    topics,
    summary: typeof config.summary === 'string' ? config.summary : undefined,
    sentiment,
    isFlagged: !!config.admin_flagged,
    isEscalated,
    isReviewed,
    adminNotes: typeof config.review_notes === 'string' ? config.review_notes : '',
    crisisIndicators,
    reviewedAt: typeof config.reviewed_at === 'string' ? config.reviewed_at : undefined,
    messageCount: session._count?.session_messages ?? 0,
  };
}

const TOPIC_RULES: { topic: string; keywords: string[] }[] = [
  { topic: 'anxiety', keywords: ['anxiety', 'anxious', 'panic', 'panicking', 'worry', 'worried', 'overthinking'] },
  { topic: 'stress', keywords: ['stress', 'stressed', 'overwhelmed', 'pressure', 'burnout'] },
  { topic: 'sleep', keywords: ['sleep', 'insomnia', 'nightmare', 'tired', 'fatigue', 'rest'] },
  { topic: 'depression', keywords: ['depressed', 'depression', 'hopeless', 'empty', 'sad', 'numb'] },
  { topic: 'work', keywords: ['work', 'job', 'boss', 'colleague', 'meeting', 'deadline'] },
  { topic: 'relationships', keywords: ['relationship', 'partner', 'wife', 'husband', 'boyfriend', 'girlfriend', 'family'] },
  { topic: 'self-esteem', keywords: ['confidence', 'self-esteem', 'worth', 'good enough', 'imposter'] },
  { topic: 'grief', keywords: ['grief', 'loss', 'passed away', 'funeral', 'bereaved'] },
  { topic: 'crisis', keywords: ['suicidal', 'self-harm', 'kill myself', 'end it', 'hurt myself'] },
];

function normalizeTextForTopics(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^a-z0-9\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function deriveTopicsAndSummary(messages: Message[]): { topics: string[]; summary: string } {
  const userText = normalizeTextForTopics(messages.filter((m) => m.speaker === 'user').map((m) => m.text).join(' '));
  const allText = normalizeTextForTopics(messages.map((m) => m.text).join(' '));

  const scores = new Map<string, number>();
  for (const rule of TOPIC_RULES) {
    let count = 0;
    for (const k of rule.keywords) {
      const kk = normalizeTextForTopics(k);
      if (!kk) continue;
      const re = new RegExp(`\\b${kk.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\\\$&')}\\b`, 'g');
      const hits = (allText.match(re) || []).length;
      count += hits;
    }
    if (count > 0) scores.set(rule.topic, count);
  }

  const topics = [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([t]) => t);

  // fallback keywords if rules matched nothing
  if (topics.length === 0) {
    const stop = new Set([
      'the','a','an','and','or','but','to','of','in','on','for','with','at','by','from','as','is','are','was','were','be','been','being',
      'i','me','my','mine','you','your','yours','we','our','ours','they','their','them','he','she','it','this','that','these','those',
      'just','really','very','so','not','no','yes','yeah','ok','okay','like','feel','feels','feeling','felt','think','thinking','know',
    ]);
    const freq = new Map<string, number>();
    for (const w of userText.split(' ')) {
      if (!w || w.length < 4) continue;
      if (stop.has(w)) continue;
      freq.set(w, (freq.get(w) ?? 0) + 1);
    }
    topics.push(
      ...[...freq.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([w]) => w)
    );
  }

  const firstUser = messages.find((m) => m.speaker === 'user')?.text?.trim() || '';
  const firstAi = messages.find((m) => m.speaker === 'ai')?.text?.trim() || '';
  const base = firstUser || firstAi || '';
  const summaryBase = base.length > 180 ? `${base.slice(0, 177)}…` : base;
  const summary =
    topics.length > 0
      ? `Topics: ${topics.slice(0, 4).join(', ')}. ${summaryBase}`.trim()
      : summaryBase || 'Session transcript available.';

  return { topics: [...new Set(topics.map((t) => t.trim()).filter(Boolean))].slice(0, 6), summary };
}

function buildAccurateSummary(messages: Message[], topics: string[]): string {
  const userMsgs = messages
    .filter((m) => m.speaker === 'user')
    .map((m) => (m.text || '').trim())
    .filter(Boolean);
  const aiMsgs = messages
    .filter((m) => m.speaker === 'ai')
    .map((m) => (m.text || '').trim())
    .filter(Boolean);

  // Prefer user messages for accuracy (what the person actually said).
  const first = userMsgs[0] || aiMsgs[0] || '';
  const last = userMsgs[userMsgs.length - 1] || '';

  const pick = (s: string) => {
    const trimmed = s.replace(/\s+/g, ' ').trim();
    return trimmed.length > 220 ? `${trimmed.slice(0, 217)}…` : trimmed;
  };

  const baseParts: string[] = [];
  if (first) baseParts.push(pick(first));
  if (last && last !== first) baseParts.push(pick(last));

  const base = baseParts.filter(Boolean).join(' • ');
  if (!base) return 'Transcript stored, but no readable text was found.';

  // Keep topics but do not over-claim: only list top few inferred topics.
  const top = topics.slice(0, 4);
  return top.length ? `Summary (from user messages): ${base}. Topics: ${top.join(', ')}.` : `Summary (from user messages): ${base}.`;
}

function csvEscapeCell(value: string | number | boolean): string {
  const s = String(value ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function mapDbMessagesToMessages(rows: any[]): Message[] {
  return rows.map((m) => {
    const role = (m.role || '').toLowerCase();
    const speaker: 'user' | 'ai' = role === 'user' || role === 'human' ? 'user' : 'ai';
    const ts = m.created_at ? new Date(m.created_at).toLocaleTimeString() : '';
    return {
      id: m.id,
      speaker,
      text: m.content || '',
      timestamp: ts,
    };
  });
}

export function ConversationTranscripts() {
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [dbTotal, setDbTotal] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [transcriptModal, setTranscriptModal] = useState<Transcript | null>(null);
  const [detailsModal, setDetailsModal] = useState<Transcript | null>(null);
  const [messagesBySession, setMessagesBySession] = useState<Record<string, Message[]>>({});
  const [transcriptLoadingId, setTranscriptLoadingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSentiment, setFilterSentiment] = useState<string>('all');
  const [filterFlagged, setFilterFlagged] = useState<boolean | null>(null);
  const [savingAdminNotes, setSavingAdminNotes] = useState(false);
  const [exportingList, setExportingList] = useState(false);
  const [listPage, setListPage] = useState(1);
  const [listPageSize, setListPageSize] = useState(10);
  const [derivingForSession, setDerivingForSession] = useState<Record<string, boolean>>({});

  /** Loads all ended sessions in pages (API allows up to 5k per page). */
  const fetchSessions = useCallback(async () => {
    const PAGE_SIZE = 500;
    const MAX_PAGES = 200;
    try {
      setLoadError(null);
      setIsLoading(true);
      const all: unknown[] = [];
      for (let page = 1; page <= MAX_PAGES; page += 1) {
        const data = await api.admin.getSessionRecordings({ limit: PAGE_SIZE, page });
        const isWrapped = !Array.isArray(data) && typeof data === 'object' && data !== null;
        const batch = isWrapped
          ? (data as { items: unknown[]; total: number }).items ?? []
          : (data as unknown[]);
        // Capture the authoritative DB total from the first page response.
        if (page === 1 && isWrapped) {
          const t = (data as { items: unknown[]; total: number }).total;
          if (typeof t === 'number') setDbTotal(t);
        }
        all.push(...batch);
        if (batch.length < PAGE_SIZE) break;
      }
      const mapped = (all as any[]).map(mapApiSessionToTranscript);
      setTranscripts(mapped);
      // Fall back to loaded count if backend total wasn't available.
      setDbTotal((prev) => prev ?? mapped.length);
    } catch (e) {
      console.error(e);
      setLoadError('Failed to load session transcripts.');
      setTranscripts([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSessions();
  }, [fetchSessions]);

  const mergeSessionUpdate = (id: string, updated: any) => {
    setTranscripts((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const sessionLike = {
          ...updated,
          user_id: updated.user_id ?? t.userId,
          profiles: updated.profiles ?? { full_name: t.userName, email: t.userEmail },
          _count: updated._count ?? { session_messages: t.messageCount },
          started_at: updated.started_at ?? t.sessionDate,
          duration_minutes: updated.duration_minutes ?? t.sessionDuration,
        };
        return mapApiSessionToTranscript(sessionLike);
      })
    );
    setTranscriptModal((tm) => {
      if (tm?.id !== id) return tm;
      const sessionLike = {
        ...updated,
        user_id: updated.user_id ?? tm.userId,
        profiles: updated.profiles ?? { full_name: tm.userName, email: tm.userEmail },
        _count: updated._count ?? { session_messages: tm.messageCount },
        started_at: updated.started_at ?? tm.sessionDate,
        duration_minutes: updated.duration_minutes ?? tm.sessionDuration,
      };
      return mapApiSessionToTranscript(sessionLike);
    });
    setDetailsModal((dm) => {
      if (dm?.id !== id) return dm;
      const sessionLike = {
        ...updated,
        user_id: updated.user_id ?? dm.userId,
        profiles: updated.profiles ?? { full_name: dm.userName, email: dm.userEmail },
        _count: updated._count ?? { session_messages: dm.messageCount },
        started_at: updated.started_at ?? dm.sessionDate,
        duration_minutes: updated.duration_minutes ?? dm.sessionDuration,
      };
      return mapApiSessionToTranscript(sessionLike);
    });
  };

  const ensureDerivedTopicsAndSummary = useCallback(
    async (t: Transcript, msgs: Message[]) => {
      if ((t.topics?.length ?? 0) > 0 && t.summary?.trim()) return;
      if (!msgs || msgs.length === 0) return;

      setDerivingForSession((prev) => ({ ...prev, [t.id]: true }));
      const derivedTopics = deriveTopicsAndSummary(msgs).topics;
      const derivedSummary = buildAccurateSummary(msgs, derivedTopics);
      const derived = { topics: derivedTopics, summary: derivedSummary };
      if (derived.topics.length === 0 && !derived.summary?.trim()) {
        setDerivingForSession((prev) => ({ ...prev, [t.id]: false }));
        return;
      }

      try {
        const updated = await api.admin.updateSessionRecording(t.id, {
          topics: derived.topics,
          summary: derived.summary,
        });
        mergeSessionUpdate(t.id, updated);
      } catch (e) {
        // ok: show locally if save fails (e.g. perms)
        setTranscripts((prev) =>
          prev.map((x) =>
            x.id === t.id
              ? {
                  ...x,
                  topics: derived.topics.length ? derived.topics : x.topics,
                  summary: derived.summary || x.summary,
                }
              : x
          )
        );
        setTranscriptModal((tm) =>
          tm?.id === t.id
            ? {
                ...tm,
                topics: derived.topics.length ? derived.topics : tm.topics,
                summary: derived.summary || tm.summary,
              }
            : tm
        );
        setDetailsModal((dm) =>
          dm?.id === t.id
            ? {
                ...dm,
                topics: derived.topics.length ? derived.topics : dm.topics,
                summary: derived.summary || dm.summary,
              }
            : dm
        );
      }
      setDerivingForSession((prev) => ({ ...prev, [t.id]: false }));
    },
    [mergeSessionUpdate]
  );

  const loadMessagesFor = async (t: Transcript) => {
    // If already cached, we may still need derived topics/summary.
    const cached = messagesBySession[t.id];
    if (cached && cached.length > 0) {
      await ensureDerivedTopicsAndSummary(t, cached);
      return;
    }
    if (transcriptLoadingId === t.id) return;

    setTranscriptLoadingId(t.id);
    try {
      const rows = await api.admin.getSessionRecordingTranscript(t.id);
      const msgs = mapDbMessagesToMessages(rows as any[]);
      setMessagesBySession((prev) => ({ ...prev, [t.id]: msgs }));
      await ensureDerivedTopicsAndSummary(t, msgs);
    } catch (e) {
      console.error(e);
    } finally {
      setTranscriptLoadingId(null);
    }
  };

  const openTranscriptModal = (t: Transcript) => {
    setTranscriptModal(t);
    void loadMessagesFor(t);
  };

  const openDetailsModal = (t: Transcript) => {
    setDetailsModal(t);
    if (t.messageCount === 0) return;
    void loadMessagesFor(t);
  };

  const stats = {
    total: dbTotal ?? transcripts.length,
    flagged: transcripts.filter((t) => t.isFlagged).length,
    crisis: transcripts.filter((t) => t.sentiment === 'crisis').length,
  };

  const filteredTranscripts = useMemo(() => {
    return transcripts.filter((transcript) => {
      const matchesSearch =
        transcript.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        transcript.avatarName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        transcript.topics.some((x) => x.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesSentiment =
        filterSentiment === 'all' ||
        transcript.sentiment === filterSentiment ||
        (filterSentiment === 'concerning' && transcript.sentiment === 'concerning');

      const matchesFlagged = filterFlagged === null || transcript.isFlagged === filterFlagged;

      return matchesSearch && matchesSentiment && matchesFlagged;
    });
  }, [transcripts, searchQuery, filterSentiment, filterFlagged]);

  useEffect(() => {
    setListPage(1);
  }, [searchQuery, filterSentiment, filterFlagged]);

  useEffect(() => {
    const tp = Math.max(1, Math.ceil(filteredTranscripts.length / listPageSize) || 1);
    setListPage((p) => (p > tp ? tp : p));
  }, [filteredTranscripts.length, listPageSize]);

  const transcriptListTotalPages = Math.max(
    1,
    Math.ceil(filteredTranscripts.length / listPageSize) || 1
  );
  const transcriptSafePage = Math.min(
    Math.max(1, listPage),
    transcriptListTotalPages
  );
  const paginatedTranscripts = filteredTranscripts.slice(
    (transcriptSafePage - 1) * listPageSize,
    transcriptSafePage * listPageSize
  );

  /** CSV of filtered rows (metadata). Per-session full transcript: use row Download. Batch AI-assisted export planned. */
  const handleExportListCsv = () => {
    const rows = filteredTranscripts;
    if (rows.length === 0) {
      toast.info("No sessions to export");
      return;
    }
    setExportingList(true);
    try {
      const header = [
        "session_id",
        "user",
        "email",
        "avatar",
        "started",
        "duration_min",
        "messages",
        "sentiment",
        "flagged",
        "topics",
        "admin_notes_preview",
      ];
      const lines = [header.join(",")];
      for (const t of rows) {
        lines.push(
          [
            csvEscapeCell(t.id),
            csvEscapeCell(t.userName),
            csvEscapeCell(t.userEmail ?? ""),
            csvEscapeCell(t.avatarName),
            csvEscapeCell(t.sessionDate),
            csvEscapeCell(t.sessionDuration),
            csvEscapeCell(t.messageCount),
            csvEscapeCell(t.sentiment),
            csvEscapeCell(t.isFlagged ? "yes" : "no"),
            csvEscapeCell(t.topics.join("; ")),
            csvEscapeCell(t.adminNotes.replace(/\s+/g, " ").slice(0, 500)),
          ].join(",")
        );
      }
      const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `conversation_sessions_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Exported ${rows.length} session row(s)`);
    } finally {
      setExportingList(false);
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return 'text-green-600 bg-green-100';
      case 'neutral':
        return 'text-blue-600 bg-blue-100';
      case 'concerning':
        return 'text-yellow-600 bg-yellow-100';
      case 'crisis':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const handleToggleFlag = async (id: string, current: boolean) => {
    // Optimistic UI: flip immediately, persist in background, revert on failure.
    const next = !current;

    setTranscripts((prev) => prev.map((t) => (t.id === id ? { ...t, isFlagged: next } : t)));
    setTranscriptModal((tm) => (tm?.id === id ? { ...tm, isFlagged: next } : tm));
    setDetailsModal((dm) => (dm?.id === id ? { ...dm, isFlagged: next } : dm));

    try {
      const updated = await api.admin.updateSessionRecording(id, { admin_flagged: next });
      mergeSessionUpdate(id, updated);
    } catch (e) {
      console.error(e);
      // Revert
      setTranscripts((prev) => prev.map((t) => (t.id === id ? { ...t, isFlagged: current } : t)));
      setTranscriptModal((tm) => (tm?.id === id ? { ...tm, isFlagged: current } : tm));
      setDetailsModal((dm) => (dm?.id === id ? { ...dm, isFlagged: current } : dm));
      toast.error("Could not update flag. Check your connection.");
    }
  };

  const handleToggleEscalated = async (id: string, current: boolean) => {
    // Optimistic UI: flip immediately, persist in background, revert on failure.
    const next = !current;
    const nextStatus = next ? 'escalated' : 'completed';

    setTranscripts((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, isEscalated: next, isFlagged: next ? true : t.isFlagged } : t
      )
    );
    setTranscriptModal((tm) =>
      tm?.id === id ? { ...tm, isEscalated: next, isFlagged: next ? true : tm.isFlagged } : tm
    );
    setDetailsModal((dm) =>
      dm?.id === id ? { ...dm, isEscalated: next, isFlagged: next ? true : dm.isFlagged } : dm
    );

    try {
      const updated = await api.admin.updateSessionRecording(id, { status: nextStatus });
      mergeSessionUpdate(id, updated);
    } catch (e) {
      console.error(e);
      // Revert
      setTranscripts((prev) => prev.map((t) => (t.id === id ? { ...t, isEscalated: current } : t)));
      setTranscriptModal((tm) => (tm?.id === id ? { ...tm, isEscalated: current } : tm));
      setDetailsModal((dm) => (dm?.id === id ? { ...dm, isEscalated: current } : dm));
      toast.error("Could not update escalation. Check your connection.");
    }
  };

  const persistAdminNotes = async (id: string, notes: string) => {
    const updated = await api.admin.updateSessionRecording(id, { review_notes: notes });
    mergeSessionUpdate(id, updated);
  };

  const handleSaveAdminNotes = async () => {
    if (!transcriptModal) return;
    setSavingAdminNotes(true);
    try {
      await persistAdminNotes(transcriptModal.id, transcriptModal.adminNotes);
      toast.success('Admin note saved');
    } catch (e) {
      console.error(e);
      toast.error('Could not save admin note');
    } finally {
      setSavingAdminNotes(false);
    }
  };

  const handleRemoveAdminNote = async () => {
    if (!transcriptModal) return;
    const hasContent = transcriptModal.adminNotes.trim().length > 0;
    if (!hasContent) {
      toast.info('No note to remove');
      return;
    }
    if (!window.confirm('Remove this admin note from this session?')) return;
    setSavingAdminNotes(true);
    try {
      await persistAdminNotes(transcriptModal.id, '');
      toast.success('Admin note removed');
    } catch (e) {
      console.error(e);
      toast.error('Could not remove admin note');
    } finally {
      setSavingAdminNotes(false);
    }
  };

  const handleExport = (transcript: Transcript, messages: Message[]) => {
    const content = `
SESSION TRANSCRIPT
==================

Session ID: ${transcript.id}
User: ${transcript.userName} (${transcript.userId})
AI Avatar: ${transcript.avatarName}
Date: ${transcript.sessionDate}
Duration: ${transcript.sessionDuration} minutes
Sentiment: ${transcript.sentiment}
Flagged: ${transcript.isFlagged ? 'Yes' : 'No'}

TOPICS DISCUSSED
================
${transcript.topics.join(', ')}

${transcript.crisisIndicators.length > 0
        ? `
CRISIS INDICATORS
=================
${transcript.crisisIndicators.join('\n')}
`
        : ''
      }

CONVERSATION
============

${messages.map((msg) => `
[${msg.timestamp}] ${msg.speaker === 'user' ? transcript.userName : transcript.avatarName}${msg.sentiment ? ` (${msg.sentiment})` : ''}
${msg.text}
`).join('\n')}

${transcript.adminNotes
        ? `
ADMIN NOTES
===========
${transcript.adminNotes}
`
        : ''
      }

---
Exported on: ${new Date().toLocaleString()}
Ezri Mental Health Platform - Admin Dashboard
`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript_${transcript.id}_${transcript.userName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <AdminLayoutNew>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-600" />
        </div>
      </AdminLayoutNew>
    );
  }

  return (
    <AdminLayoutNew>
      <div className="p-8">
        <div className="mb-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Conversation Transcripts</h1>
                <p className="text-gray-600">
                  Review and monitor user–AI therapy sessions. All ended sessions are loaded in batches (not capped at 100).
                  Full message export per session uses each card&apos;s download; batch AI-assisted exports can be added later.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleExportListCsv()}
              disabled={exportingList || filteredTranscripts.length === 0}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-900 shadow-sm hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-50"
            >
              {exportingList ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Export list (CSV)
            </button>
          </div>

          {loadError && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{loadError}</div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <MessageSquare className="w-8 h-8 text-blue-600" />
                <span className="text-2xl font-bold text-gray-900">{stats.total.toLocaleString()}</span>
              </div>
              <p className="text-sm text-gray-600">Total Sessions</p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <Flag className="w-8 h-8 text-yellow-600" />
                <span className="text-2xl font-bold text-gray-900">{stats.flagged.toLocaleString()}</span>
              </div>
              <p className="text-sm text-gray-600">Flagged Sessions</p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <AlertTriangle className="w-8 h-8 text-red-600" />
                <span className="text-2xl font-bold text-gray-900">{stats.crisis.toLocaleString()}</span>
              </div>
              <p className="text-sm text-gray-600">Crisis Sessions</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2 relative">
              <Search className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by user, avatar, or topic..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-xl pl-12 pr-4 py-3 focus:outline-none focus:border-purple-500 transition-all"
              />
            </div>

            <select
              value={filterSentiment}
              onChange={(e) => setFilterSentiment(e.target.value)}
              className="bg-white border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:border-purple-500 transition-all"
            >
              <option value="all">All Sentiments</option>
              <option value="positive">Positive</option>
              <option value="neutral">Neutral</option>
              <option value="concerning">Concerning</option>
              <option value="crisis">Crisis</option>
            </select>

            <select
              value={filterFlagged === null ? 'all' : filterFlagged ? 'flagged' : 'not-flagged'}
              onChange={(e) => setFilterFlagged(e.target.value === 'all' ? null : e.target.value === 'flagged')}
              className="bg-white border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:border-purple-500 transition-all"
            >
              <option value="all">All Sessions</option>
              <option value="flagged">Flagged Only</option>
              <option value="not-flagged">Not Flagged</option>
            </select>
          </div>
        </div>

        <div className="space-y-4">
          {paginatedTranscripts.map((transcript, index) => (
            <motion.div
              key={transcript.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`bg-white rounded-2xl border-2 p-6 shadow-lg transition-all hover:shadow-xl ${
                transcript.sentiment === 'crisis'
                  ? 'border-red-200 bg-red-50/30'
                  : transcript.sentiment === 'concerning'
                    ? 'border-yellow-200'
                    : 'border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <h3 className="text-lg font-bold text-gray-900">{transcript.userName}</h3>
                    {transcript.isFlagged && (
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-bold rounded-full flex items-center gap-1">
                        <Flag className="w-3 h-3" />
                        Flagged
                      </span>
                    )}
                    {transcript.isEscalated && (
                      <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Escalated
                      </span>
                    )}
                    <span className={`px-2 py-1 text-xs font-bold rounded-full ${getSentimentColor(transcript.sentiment)}`}>
                      {transcript.sentiment.charAt(0).toUpperCase() + transcript.sentiment.slice(1)}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-gray-600 mb-3 flex-wrap">
                    <div className="flex items-center gap-1">
                      <Brain className="w-4 h-4" />
                      <span>{transcript.avatarName}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span>{new Date(transcript.sessionDate).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      <span>{transcript.sessionDuration} min</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MessageSquare className="w-4 h-4" />
                      <span>{transcript.messageCount} messages</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-3">
                    {transcript.topics.map((topic) => (
                      <span key={topic} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                        {topic}
                      </span>
                    ))}
                  </div>

                  {transcript.crisisIndicators.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                        <span className="text-sm font-semibold text-red-800">Crisis indicators</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {transcript.crisisIndicators.map((indicator) => (
                          <span key={indicator} className="px-2 py-1 bg-red-200 text-red-800 text-xs font-medium rounded">
                            {indicator}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {transcript.adminNotes && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <p className="text-xs font-semibold text-gray-700 mb-1">Admin notes</p>
                      <p className="text-sm text-gray-600 line-clamp-2">{transcript.adminNotes}</p>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => openDetailsModal(transcript)}
                    className="p-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all"
                    title="Session details"
                  >
                    <Info className="w-5 h-5" />
                  </motion.button>

                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => openTranscriptModal(transcript)}
                    className="p-2 rounded-lg bg-purple-100 text-purple-600 hover:bg-purple-200 transition-all"
                    title="Open transcript"
                  >
                    <MessageSquare className="w-5 h-5" />
                  </motion.button>

                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleToggleFlag(transcript.id, transcript.isFlagged);
                    }}
                    className={`p-2 rounded-lg transition-all ${
                      transcript.isFlagged ? 'bg-yellow-100 text-yellow-600 hover:bg-yellow-200' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                    }`}
                    title={transcript.isFlagged ? 'Unflag' : 'Flag for review'}
                  >
                    <Flag className="w-5 h-5" />
                  </motion.button>

                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleToggleEscalated(transcript.id, transcript.isEscalated);
                    }}
                    className={`p-2 rounded-lg transition-all ${
                      transcript.isEscalated
                        ? 'bg-red-100 text-red-600 hover:bg-red-200'
                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                    }`}
                    title={transcript.isEscalated ? 'De-escalate' : 'Escalate'}
                  >
                    <AlertTriangle className="w-5 h-5" />
                  </motion.button>

                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={async (e) => {
                      e.stopPropagation();
                      const t = transcript;
                      let msgs = messagesBySession[t.id];
                      if (!msgs) {
                        try {
                          const rows = await api.admin.getSessionRecordingTranscript(t.id);
                          msgs = mapDbMessagesToMessages(rows as any[]);
                          setMessagesBySession((prev) => ({ ...prev, [t.id]: msgs }));
                        } catch {
                          return;
                        }
                      }
                      handleExport(t, msgs || []);
                    }}
                    className="p-2 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200 transition-all"
                    title="Export"
                  >
                    <Download className="w-5 h-5" />
                  </motion.button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {filteredTranscripts.length > 0 && (
          <AdminPaginationBar
            total={filteredTranscripts.length}
            page={listPage}
            pageSize={listPageSize}
            onPageChange={setListPage}
            onPageSizeChange={setListPageSize}
            selectId="conversation-transcripts-page-size"
          />
        )}

        {filteredTranscripts.length === 0 && (
          <div className="text-center py-16">
            <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">No transcripts found</h3>
            <p className="text-gray-600">Try adjusting filters or complete sessions with stored messages.</p>
          </div>
        )}

        {/* Details modal (info) */}
        <AnimatePresence>
          {detailsModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
              onClick={() => setDetailsModal(null)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl p-6 max-w-lg w-full my-8 shadow-xl"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Info className="w-6 h-6 text-slate-600" />
                    <h3 className="text-xl font-bold text-gray-900">Session details</h3>
                  </div>
                  <button type="button" onClick={() => setDetailsModal(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <dl className="space-y-3 text-sm">
                  <div>
                    <dt className="text-gray-500">Session ID</dt>
                    <dd className="font-mono text-xs break-all text-gray-900">{detailsModal.id}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">User</dt>
                    <dd className="text-gray-900">{detailsModal.userName}</dd>
                  </div>
                  {detailsModal.userEmail && (
                    <div>
                      <dt className="text-gray-500">Email</dt>
                      <dd className="text-gray-900">{detailsModal.userEmail}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-gray-500">AI / avatar</dt>
                    <dd className="text-gray-900">{detailsModal.avatarName}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Started</dt>
                    <dd className="text-gray-900">{new Date(detailsModal.sessionDate).toLocaleString()}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Duration</dt>
                    <dd className="text-gray-900">{detailsModal.sessionDuration} minutes</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Messages stored</dt>
                    <dd className="text-gray-900">{detailsModal.messageCount}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Flagged</dt>
                    <dd className="text-gray-900">{detailsModal.isFlagged ? 'Yes' : 'No'}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Summary</dt>
                    <dd className="text-gray-900">
                      {detailsModal.messageCount === 0
                        ? 'No transcript stored'
                        : derivingForSession[detailsModal.id]
                          ? 'Loading…'
                          : detailsModal.summary?.trim().length
                            ? detailsModal.summary
                            : 'Not generated yet'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Topics</dt>
                    <dd className="text-gray-900">
                      {detailsModal.messageCount === 0
                        ? 'No transcript stored'
                        : derivingForSession[detailsModal.id]
                          ? 'Loading…'
                          : detailsModal.topics.length
                            ? detailsModal.topics.join(', ')
                            : 'Not generated yet'}
                    </dd>
                  </div>
                </dl>
                <button
                  type="button"
                  onClick={() => setDetailsModal(null)}
                  className="mt-6 w-full px-4 py-3 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium"
                >
                  Close
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Full transcript modal */}
        <AnimatePresence>
          {transcriptModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
              onClick={() => setTranscriptModal(null)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl p-6 max-w-4xl w-full my-8 max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">Session transcript</h3>
                    <div className="flex items-center gap-4 text-sm text-gray-600 flex-wrap">
                      <div className="flex items-center gap-1">
                        <User className="w-4 h-4" />
                        <span>{transcriptModal.userName}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Brain className="w-4 h-4" />
                        <span>{transcriptModal.avatarName}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>{new Date(transcriptModal.sessionDate).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <button type="button" onClick={() => setTranscriptModal(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {transcriptModal.sentiment === 'crisis' && (
                  <div className="bg-red-50 border-2 border-red-500 rounded-xl p-4 mb-6">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-6 h-6 text-red-600 mt-0.5" />
                      <div>
                        <h4 className="text-lg font-bold text-red-900 mb-2">Crisis session</h4>
                        <p className="text-sm text-red-800">This session is marked with crisis sentiment. Follow your organization&apos;s protocol.</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mb-6">
                  <h4 className="text-lg font-bold text-gray-900 mb-4">Conversation</h4>
                  {transcriptLoadingId === transcriptModal.id && (
                    <p className="text-sm text-gray-500">Loading messages…</p>
                  )}
                  {!transcriptLoadingId && (messagesBySession[transcriptModal.id]?.length ?? 0) === 0 && (
                    <p className="text-sm text-gray-500">No messages were stored for this session (transcript may be empty).</p>
                  )}
                  <div className="space-y-4">
                    {(messagesBySession[transcriptModal.id] || []).map((message) => (
                      <div key={message.id} className={`flex gap-3 ${message.speaker === 'user' ? 'flex-row-reverse' : ''}`}>
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                            message.speaker === 'ai' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'
                          }`}
                        >
                          {message.speaker === 'ai' ? <Brain className="w-5 h-5" /> : <User className="w-5 h-5" />}
                        </div>

                        <div className={`flex-1 ${message.speaker === 'user' ? 'text-right' : ''}`}>
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-xs font-semibold text-gray-700">
                              {message.speaker === 'ai' ? transcriptModal.avatarName : transcriptModal.userName}
                            </span>
                            <span className="text-xs text-gray-500">{message.timestamp}</span>
                            {message.sentiment && (
                              <span className={`text-xs px-2 py-0.5 rounded-full ${getSentimentColor(message.sentiment)}`}>{message.sentiment}</span>
                            )}
                          </div>
                          <div
                            className={`inline-block px-4 py-3 rounded-2xl ${
                              message.speaker === 'ai' ? 'bg-purple-50 text-gray-900' : 'bg-blue-50 text-gray-900'
                            }`}
                          >
                            <p className="text-sm leading-relaxed">{message.text}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mb-6">
                  <h4 className="text-sm font-bold text-gray-700 mb-2">Topics</h4>
                  <div className="flex flex-wrap gap-2">
                    {transcriptModal.topics.map((topic) => (
                      <span key={topic} className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-full font-medium">
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mb-6">
                  <h4 className="text-sm font-bold text-gray-700 mb-2">Admin notes</h4>
                  <p className="text-xs text-gray-500 mb-2">
                    Draft is kept locally until you save. Use <strong>Save note</strong> to store it on the session, or{" "}
                    <strong>Remove note</strong> to delete the saved note.
                  </p>
                  <textarea
                    value={transcriptModal.adminNotes}
                    onChange={(e) => {
                      const v = e.target.value;
                      setTranscriptModal({ ...transcriptModal, adminNotes: v });
                      setTranscripts((prev) =>
                        prev.map((t) => (t.id === transcriptModal.id ? { ...t, adminNotes: v } : t))
                      );
                    }}
                    rows={4}
                    className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-purple-500"
                    placeholder="Add an internal note for your team…"
                  />
                  <div className="flex flex-wrap gap-2 mt-3">
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      disabled={savingAdminNotes}
                      onClick={() => void handleSaveAdminNotes()}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-50 disabled:pointer-events-none"
                    >
                      {savingAdminNotes ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      Save note
                    </motion.button>
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      disabled={savingAdminNotes || !transcriptModal.adminNotes.trim()}
                      onClick={() => void handleRemoveAdminNote()}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 bg-red-50 text-red-800 text-sm font-medium hover:bg-red-100 disabled:opacity-50 disabled:pointer-events-none"
                    >
                      <Trash2 className="w-4 h-4" />
                      Remove note
                    </motion.button>
                  </div>
                </div>

                <div className="flex gap-3 flex-wrap">
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      const msgs = messagesBySession[transcriptModal.id] || [];
                      handleExport(transcriptModal, msgs);
                    }}
                    className="flex-1 min-w-[200px] px-4 py-3 rounded-xl bg-blue-600 text-white font-medium flex items-center justify-center gap-2"
                  >
                    <Download className="w-5 h-5" />
                    Export transcript
                  </motion.button>

                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setTranscriptModal(null)}
                    className="px-4 py-3 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium"
                  >
                    Close
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AdminLayoutNew>
  );
}
