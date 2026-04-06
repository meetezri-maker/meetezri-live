import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AdminLayoutNew } from '@/app/components/AdminLayoutNew';
import { api } from '@/lib/api';
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
  Eye,
  EyeOff,
  X,
  Info,
  Inbox,
} from 'lucide-react';

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
  sentiment: RowSentiment;
  isFlagged: boolean;
  isReviewed: boolean;
  adminNotes: string;
  crisisIndicators: string[];
  reviewedAt?: string;
  messageCount: number;
}

function mapApiSessionToTranscript(session: any): Transcript {
  const config = session.config || {};
  const isReviewed = !!(config.reviewed_at || config.status === 'reviewed');
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
    sentiment,
    isFlagged: !!config.admin_flagged,
    isReviewed,
    adminNotes: typeof config.review_notes === 'string' ? config.review_notes : '',
    crisisIndicators,
    reviewedAt: typeof config.reviewed_at === 'string' ? config.reviewed_at : undefined,
    messageCount: session._count?.session_messages ?? 0,
  };
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
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [transcriptModal, setTranscriptModal] = useState<Transcript | null>(null);
  const [detailsModal, setDetailsModal] = useState<Transcript | null>(null);
  const [messagesBySession, setMessagesBySession] = useState<Record<string, Message[]>>({});
  const [transcriptLoadingId, setTranscriptLoadingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSentiment, setFilterSentiment] = useState<string>('all');
  const [filterFlagged, setFilterFlagged] = useState<boolean | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      setLoadError(null);
      setIsLoading(true);
      const data = await api.admin.getSessionRecordings({ limit: 100, page: 1 });
      setTranscripts((data as any[]).map(mapApiSessionToTranscript));
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

  const loadMessagesFor = async (t: Transcript) => {
    if (messagesBySession[t.id] || transcriptLoadingId === t.id) return;
    setTranscriptLoadingId(t.id);
    try {
      const rows = await api.admin.getSessionRecordingTranscript(t.id);
      const msgs = mapDbMessagesToMessages(rows as any[]);
      setMessagesBySession((prev) => ({ ...prev, [t.id]: msgs }));
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

  const stats = {
    total: transcripts.length,
    flagged: transcripts.filter((t) => t.isFlagged).length,
    crisis: transcripts.filter((t) => t.sentiment === 'crisis').length,
    needsReview: transcripts.filter((t) => t.isFlagged && !t.isReviewed).length,
  };

  const filteredTranscripts = transcripts.filter((transcript) => {
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

  const handleMarkReviewed = async (id: string) => {
    try {
      const updated = await api.admin.markSessionRecordingReviewed(id);
      mergeSessionUpdate(id, updated);
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleFlag = async (id: string, current: boolean) => {
    try {
      const updated = await api.admin.updateSessionRecording(id, { admin_flagged: !current });
      mergeSessionUpdate(id, updated);
    } catch (e) {
      console.error(e);
    }
  };

  const saveAdminNotes = async (id: string, notes: string) => {
    try {
      const updated = await api.admin.updateSessionRecording(id, { review_notes: notes });
      mergeSessionUpdate(id, updated);
    } catch (e) {
      console.error(e);
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
Reviewed: ${transcript.isReviewed ? 'Yes' : 'No'}

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
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Conversation Transcripts</h1>
              <p className="text-gray-600">Review and monitor user–AI therapy sessions (from stored session data)</p>
            </div>
          </div>

          {loadError && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{loadError}</div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <MessageSquare className="w-8 h-8 text-blue-600" />
                <span className="text-2xl font-bold text-gray-900">{stats.total}</span>
              </div>
              <p className="text-sm text-gray-600">Total Sessions</p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <Flag className="w-8 h-8 text-yellow-600" />
                <span className="text-2xl font-bold text-gray-900">{stats.flagged}</span>
              </div>
              <p className="text-sm text-gray-600">Flagged Sessions</p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <AlertTriangle className="w-8 h-8 text-red-600" />
                <span className="text-2xl font-bold text-gray-900">{stats.crisis}</span>
              </div>
              <p className="text-sm text-gray-600">Crisis Sessions</p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <Inbox className="w-8 h-8 text-purple-600" />
                <span className="text-2xl font-bold text-gray-900">{stats.needsReview}</span>
              </div>
              <p className="text-sm text-gray-600">Needs Review</p>
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
          {filteredTranscripts.map((transcript, index) => (
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
                    {!transcript.isReviewed && transcript.isFlagged && (
                      <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full">Needs Review</span>
                    )}
                    <span className={`px-2 py-1 text-xs font-bold rounded-full ${getSentimentColor(transcript.sentiment)}`}>
                      {transcript.sentiment.charAt(0).toUpperCase() + transcript.sentiment.slice(1)}
                    </span>
                    <span
                      className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600"
                      title={transcript.isReviewed ? 'Reviewed' : 'Not reviewed'}
                    >
                      {transcript.isReviewed ? (
                        <>
                          <Eye className="w-4 h-4 text-green-600" aria-hidden />
                          <span className="text-green-700">Reviewed</span>
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-4 h-4 text-gray-400" aria-hidden />
                          <span className="text-gray-500">Not reviewed</span>
                        </>
                      )}
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
                    onClick={() => setDetailsModal(transcript)}
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
                    <dt className="text-gray-500">Review</dt>
                    <dd className="flex items-center gap-2 text-gray-900">
                      {detailsModal.isReviewed ? (
                        <>
                          <Eye className="w-4 h-4 text-green-600" />
                          Reviewed
                          {detailsModal.reviewedAt && (
                            <span className="text-gray-500">· {new Date(detailsModal.reviewedAt).toLocaleString()}</span>
                          )}
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-4 h-4 text-gray-400" />
                          Not reviewed
                        </>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Flagged</dt>
                    <dd className="text-gray-900">{detailsModal.isFlagged ? 'Yes' : 'No'}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Topics</dt>
                    <dd className="text-gray-900">{detailsModal.topics.length ? detailsModal.topics.join(', ') : '—'}</dd>
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
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600">
                        {transcriptModal.isReviewed ? (
                          <>
                            <Eye className="w-4 h-4 text-green-600" />
                            Reviewed
                          </>
                        ) : (
                          <>
                            <EyeOff className="w-4 h-4 text-gray-400" />
                            Not reviewed
                          </>
                        )}
                      </span>
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
                  <textarea
                    value={transcriptModal.adminNotes}
                    onChange={(e) => {
                      const v = e.target.value;
                      setTranscriptModal({ ...transcriptModal, adminNotes: v });
                      setTranscripts((prev) =>
                        prev.map((t) => (t.id === transcriptModal.id ? { ...t, adminNotes: v } : t))
                      );
                    }}
                    onBlur={() => {
                      if (transcriptModal) void saveAdminNotes(transcriptModal.id, transcriptModal.adminNotes);
                    }}
                    rows={3}
                    className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-purple-500"
                    placeholder="Notes are saved when you leave this field…"
                  />
                </div>

                <div className="flex gap-3 flex-wrap">
                  {transcriptModal.isFlagged && !transcriptModal.isReviewed && (
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        void handleMarkReviewed(transcriptModal.id);
                      }}
                      className="flex-1 min-w-[200px] px-4 py-3 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white font-medium flex items-center justify-center gap-2"
                    >
                      <Eye className="w-5 h-5" />
                      Mark as reviewed
                    </motion.button>
                  )}

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
