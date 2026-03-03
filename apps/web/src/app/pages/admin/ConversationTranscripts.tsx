import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AdminLayoutNew } from '@/app/components/AdminLayoutNew';
import { 
  MessageSquare, 
  Search, 
  Filter, 
  Calendar,
  User,
  Brain,
  Download,
  Flag,
  AlertTriangle,
  ThumbsUp,
  ThumbsDown,
  Clock,
  Eye,
  X,
  FileText,
  TrendingUp,
  Heart
} from 'lucide-react';

interface Message {
  id: string;
  speaker: 'user' | 'ai';
  text: string;
  timestamp: string;
  sentiment?: 'positive' | 'neutral' | 'negative' | 'crisis';
}

interface Transcript {
  id: string;
  userId: string;
  userName: string;
  avatarId: string;
  avatarName: string;
  sessionDate: string;
  sessionDuration: number;
  messages: Message[];
  topics: string[];
  sentiment: 'positive' | 'neutral' | 'concerning' | 'crisis';
  isFlagged: boolean;
  isReviewed: boolean;
  adminNotes: string;
  crisisIndicators: string[];
}

export function ConversationTranscripts() {
  const [transcripts, setTranscripts] = useState<Transcript[]>([
    {
      id: 'session-001',
      userId: 'user-123',
      userName: 'Sarah Johnson',
      avatarId: 'maya',
      avatarName: 'Maya Chen',
      sessionDate: '2026-01-23T14:30:00',
      sessionDuration: 42,
      messages: [
        {
          id: 'msg-1',
          speaker: 'ai',
          text: "Hello Sarah! It's wonderful to see you again. How have you been feeling since our last session?",
          timestamp: '14:30:05',
          sentiment: 'positive'
        },
        {
          id: 'msg-2',
          speaker: 'user',
          text: "Hi Dr. Maya. I've been doing better actually. I've been practicing the breathing exercises you suggested and they really help when I feel anxious.",
          timestamp: '14:30:22',
          sentiment: 'positive'
        },
        {
          id: 'msg-3',
          speaker: 'ai',
          text: "That's fantastic! I'm so glad to hear the breathing exercises are working for you. Can you tell me more about when you use them most often?",
          timestamp: '14:30:35',
          sentiment: 'positive'
        },
        {
          id: 'msg-4',
          speaker: 'user',
          text: "Mostly before work meetings. I used to get really nervous, but now I do the box breathing for a few minutes and it calms me down.",
          timestamp: '14:30:58',
          sentiment: 'positive'
        },
        {
          id: 'msg-5',
          speaker: 'ai',
          text: "That's excellent self-awareness and application. You're developing strong coping mechanisms. How are things going with your sleep routine?",
          timestamp: '14:31:15',
          sentiment: 'neutral'
        }
      ],
      topics: ['anxiety management', 'breathing exercises', 'work stress', 'sleep'],
      sentiment: 'positive',
      isFlagged: false,
      isReviewed: true,
      adminNotes: 'Patient showing good progress with anxiety management techniques.',
      crisisIndicators: []
    },
    {
      id: 'session-002',
      userId: 'user-456',
      userName: 'Michael Chen',
      avatarId: 'alex',
      avatarName: 'Alex Rivera',
      sessionDate: '2026-01-23T16:00:00',
      sessionDuration: 38,
      messages: [
        {
          id: 'msg-6',
          speaker: 'ai',
          text: "Hello Michael, thank you for joining today. I noticed you marked your mood as 'struggling' today. Would you like to talk about what's going on?",
          timestamp: '16:00:08',
          sentiment: 'neutral'
        },
        {
          id: 'msg-7',
          speaker: 'user',
          text: "Yeah... I've been feeling really overwhelmed lately. Work has been intense and I feel like I can't keep up.",
          timestamp: '16:00:35',
          sentiment: 'negative'
        },
        {
          id: 'msg-8',
          speaker: 'ai',
          text: "I hear you, Michael. Feeling overwhelmed is a valid response to stress. Let's take a moment - can you describe what 'not keeping up' feels like for you?",
          timestamp: '16:00:48',
          sentiment: 'neutral'
        },
        {
          id: 'msg-9',
          speaker: 'user',
          text: "Like everyone is moving faster than me. My colleagues finish tasks quickly but I struggle. Sometimes I wonder if I'm even good enough for this job.",
          timestamp: '16:01:15',
          sentiment: 'negative'
        }
      ],
      topics: ['work stress', 'self-doubt', 'overwhelm', 'imposter syndrome'],
      sentiment: 'concerning',
      isFlagged: true,
      isReviewed: false,
      adminNotes: '',
      crisisIndicators: ['self-doubt', 'negative self-talk']
    },
    {
      id: 'session-003',
      userId: 'user-789',
      userName: 'Emily Rodriguez',
      avatarId: 'sarah',
      avatarName: 'Sarah Mitchell',
      sessionDate: '2026-01-22T10:15:00',
      sessionDuration: 55,
      messages: [
        {
          id: 'msg-10',
          speaker: 'ai',
          text: "Good morning Emily. How are you today?",
          timestamp: '10:15:03',
          sentiment: 'neutral'
        },
        {
          id: 'msg-11',
          speaker: 'user',
          text: "Not great, to be honest. I've been having really dark thoughts lately and it's scaring me.",
          timestamp: '10:15:25',
          sentiment: 'crisis'
        },
        {
          id: 'msg-12',
          speaker: 'ai',
          text: "Thank you for trusting me with this, Emily. Your safety is my top priority. Can you tell me more about these thoughts? Are you thinking about harming yourself?",
          timestamp: '10:15:42',
          sentiment: 'neutral'
        },
        {
          id: 'msg-13',
          speaker: 'user',
          text: "Sometimes, yes. I don't think I would actually do anything, but the thoughts are there and they won't go away.",
          timestamp: '10:16:08',
          sentiment: 'crisis'
        },
        {
          id: 'msg-14',
          speaker: 'ai',
          text: "I'm activating our crisis protocol right now. You're not alone, Emily. I need you to stay on this call with me, and we're going to connect you with immediate support. Can you do that for me?",
          timestamp: '10:16:22',
          sentiment: 'neutral'
        }
      ],
      topics: ['depression', 'suicidal ideation', 'crisis intervention'],
      sentiment: 'crisis',
      isFlagged: true,
      isReviewed: true,
      adminNotes: 'CRISIS PROTOCOL ACTIVATED. Emergency contact notified. User connected with crisis hotline. Follow-up required within 24 hours.',
      crisisIndicators: ['suicidal ideation', 'self-harm thoughts', 'crisis intervention activated']
    }
  ]);

  const [selectedTranscript, setSelectedTranscript] = useState<Transcript | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSentiment, setFilterSentiment] = useState<string>('all');
  const [filterFlagged, setFilterFlagged] = useState<boolean | null>(null);
  const [dateRange, setDateRange] = useState('all');

  const stats = {
    total: transcripts.length,
    flagged: transcripts.filter(t => t.isFlagged).length,
    crisis: transcripts.filter(t => t.sentiment === 'crisis').length,
    needsReview: transcripts.filter(t => t.isFlagged && !t.isReviewed).length
  };

  const filteredTranscripts = transcripts.filter(transcript => {
    const matchesSearch = 
      transcript.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      transcript.avatarName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      transcript.topics.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesSentiment = filterSentiment === 'all' || transcript.sentiment === filterSentiment;
    const matchesFlagged = filterFlagged === null || transcript.isFlagged === filterFlagged;
    
    return matchesSearch && matchesSentiment && matchesFlagged;
  });

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return 'text-green-600 bg-green-100';
      case 'neutral': return 'text-blue-600 bg-blue-100';
      case 'concerning': return 'text-yellow-600 bg-yellow-100';
      case 'crisis': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const handleMarkReviewed = (id: string) => {
    setTranscripts(transcripts.map(t =>
      t.id === id ? { ...t, isReviewed: true } : t
    ));
  };

  const handleToggleFlag = (id: string) => {
    setTranscripts(transcripts.map(t =>
      t.id === id ? { ...t, isFlagged: !t.isFlagged } : t
    ));
  };

  const handleExport = (transcript: Transcript) => {
    // Create transcript content
    const content = `
SESSION TRANSCRIPT
==================

Session ID: ${transcript.id}
User: ${transcript.userName} (${transcript.userId})
AI Avatar: ${transcript.avatarName} (${transcript.avatarId})
Date: ${transcript.sessionDate}
Duration: ${transcript.sessionDuration} minutes
Sentiment: ${transcript.sentiment}
Flagged: ${transcript.isFlagged ? 'Yes' : 'No'}
Reviewed: ${transcript.isReviewed ? 'Yes' : 'No'}

TOPICS DISCUSSED
================
${transcript.topics.join(', ')}

${transcript.crisisIndicators.length > 0 ? `
CRISIS INDICATORS
=================
${transcript.crisisIndicators.join('\n')}
` : ''}

CONVERSATION
============

${transcript.messages.map(msg => `
[${msg.timestamp}] ${msg.speaker === 'user' ? transcript.userName : transcript.avatarName}${msg.sentiment ? ` (${msg.sentiment})` : ''}
${msg.text}
`).join('\n')}

${transcript.adminNotes ? `
ADMIN NOTES
===========
${transcript.adminNotes}
` : ''}

---
Exported on: ${new Date().toLocaleString()}
Ezri Mental Health Platform - Admin Dashboard
`;

    // Create blob and download
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

  return (
    <AdminLayoutNew>
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Conversation Transcripts</h1>
              <p className="text-gray-600">Review and monitor user-AI therapy sessions</p>
            </div>
          </div>

          {/* Stats Cards */}
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
                <Eye className="w-8 h-8 text-purple-600" />
                <span className="text-2xl font-bold text-gray-900">{stats.needsReview}</span>
              </div>
              <p className="text-sm text-gray-600">Needs Review</p>
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
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

            {/* Sentiment Filter */}
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

            {/* Flagged Filter */}
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

        {/* Transcripts List */}
        <div className="space-y-4">
          {filteredTranscripts.map((transcript, index) => (
            <motion.div
              key={transcript.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`bg-white rounded-2xl border-2 p-6 shadow-lg transition-all cursor-pointer hover:shadow-xl ${
                transcript.sentiment === 'crisis'
                  ? 'border-red-200 bg-red-50/30'
                  : transcript.sentiment === 'concerning'
                  ? 'border-yellow-200'
                  : 'border-gray-200'
              }`}
              onClick={() => setSelectedTranscript(transcript)}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-bold text-gray-900">{transcript.userName}</h3>
                    {transcript.isFlagged && (
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-bold rounded-full flex items-center gap-1">
                        <Flag className="w-3 h-3" />
                        Flagged
                      </span>
                    )}
                    {!transcript.isReviewed && transcript.isFlagged && (
                      <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full">
                        Needs Review
                      </span>
                    )}
                    <span className={`px-2 py-1 text-xs font-bold rounded-full ${getSentimentColor(transcript.sentiment)}`}>
                      {transcript.sentiment.charAt(0).toUpperCase() + transcript.sentiment.slice(1)}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
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
                      <span>{transcript.messages.length} messages</span>
                    </div>
                  </div>

                  {/* Topics */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    {transcript.topics.map((topic) => (
                      <span key={topic} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                        {topic}
                      </span>
                    ))}
                  </div>

                  {/* Crisis Indicators */}
                  {transcript.crisisIndicators.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                        <span className="text-sm font-semibold text-red-800">Crisis Indicators Detected:</span>
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

                  {/* Admin Notes */}
                  {transcript.adminNotes && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <p className="text-xs font-semibold text-gray-700 mb-1">Admin Notes:</p>
                      <p className="text-sm text-gray-600">{transcript.adminNotes}</p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleFlag(transcript.id);
                    }}
                    className={`p-2 rounded-lg transition-all ${
                      transcript.isFlagged
                        ? 'bg-yellow-100 text-yellow-600 hover:bg-yellow-200'
                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                    }`}
                  >
                    <Flag className="w-5 h-5" />
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExport(transcript);
                    }}
                    className="p-2 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200 transition-all"
                  >
                    <Download className="w-5 h-5" />
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedTranscript(transcript);
                    }}
                    className="p-2 rounded-lg bg-purple-100 text-purple-600 hover:bg-purple-200 transition-all"
                  >
                    <Eye className="w-5 h-5" />
                  </motion.button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Empty State */}
        {filteredTranscripts.length === 0 && (
          <div className="text-center py-16">
            <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">No transcripts found</h3>
            <p className="text-gray-600">Try adjusting your filters or search query</p>
          </div>
        )}

        {/* Transcript Detail Modal */}
        <AnimatePresence>
          {selectedTranscript && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
              onClick={() => setSelectedTranscript(null)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl p-6 max-w-4xl w-full my-8 max-h-[90vh] overflow-y-auto"
              >
                {/* Modal Header */}
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">Session Transcript</h3>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <User className="w-4 h-4" />
                        <span>{selectedTranscript.userName}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Brain className="w-4 h-4" />
                        <span>{selectedTranscript.avatarName}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>{new Date(selectedTranscript.sessionDate).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedTranscript(null)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Crisis Alert */}
                {selectedTranscript.sentiment === 'crisis' && (
                  <div className="bg-red-50 border-2 border-red-500 rounded-xl p-4 mb-6">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-6 h-6 text-red-600 mt-0.5" />
                      <div>
                        <h4 className="text-lg font-bold text-red-900 mb-2">Crisis Session Alert</h4>
                        <p className="text-sm text-red-800 mb-3">
                          This session contains crisis indicators. Immediate action may be required.
                        </p>
                        {selectedTranscript.crisisIndicators.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {selectedTranscript.crisisIndicators.map((indicator) => (
                              <span key={indicator} className="px-3 py-1 bg-red-200 text-red-900 text-xs font-bold rounded-full">
                                {indicator}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Conversation */}
                <div className="mb-6">
                  <h4 className="text-lg font-bold text-gray-900 mb-4">Conversation</h4>
                  <div className="space-y-4">
                    {selectedTranscript.messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex gap-3 ${message.speaker === 'user' ? 'flex-row-reverse' : ''}`}
                      >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                          message.speaker === 'ai'
                            ? 'bg-purple-100 text-purple-600'
                            : 'bg-blue-100 text-blue-600'
                        }`}>
                          {message.speaker === 'ai' ? <Brain className="w-5 h-5" /> : <User className="w-5 h-5" />}
                        </div>

                        <div className={`flex-1 ${message.speaker === 'user' ? 'text-right' : ''}`}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold text-gray-700">
                              {message.speaker === 'ai' ? selectedTranscript.avatarName : selectedTranscript.userName}
                            </span>
                            <span className="text-xs text-gray-500">{message.timestamp}</span>
                            {message.sentiment && (
                              <span className={`text-xs px-2 py-0.5 rounded-full ${getSentimentColor(message.sentiment)}`}>
                                {message.sentiment}
                              </span>
                            )}
                          </div>
                          <div className={`inline-block px-4 py-3 rounded-2xl ${
                            message.speaker === 'ai'
                              ? 'bg-purple-50 text-gray-900'
                              : 'bg-blue-50 text-gray-900'
                          }`}>
                            <p className="text-sm leading-relaxed">{message.text}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Topics */}
                <div className="mb-6">
                  <h4 className="text-sm font-bold text-gray-700 mb-2">Topics Discussed:</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedTranscript.topics.map((topic) => (
                      <span key={topic} className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-full font-medium">
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Admin Notes */}
                <div className="mb-6">
                  <h4 className="text-sm font-bold text-gray-700 mb-2">Admin Notes:</h4>
                  <textarea
                    value={selectedTranscript.adminNotes}
                    onChange={(e) => {
                      const updated = { ...selectedTranscript, adminNotes: e.target.value };
                      setSelectedTranscript(updated);
                      setTranscripts(transcripts.map(t => t.id === updated.id ? updated : t));
                    }}
                    rows={3}
                    className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-purple-500"
                    placeholder="Add admin notes about this session..."
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  {selectedTranscript.isFlagged && !selectedTranscript.isReviewed && (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        handleMarkReviewed(selectedTranscript.id);
                        setSelectedTranscript({ ...selectedTranscript, isReviewed: true });
                      }}
                      className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white font-medium flex items-center justify-center gap-2"
                    >
                      <Eye className="w-5 h-5" />
                      Mark as Reviewed
                    </motion.button>
                  )}

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleExport(selectedTranscript)}
                    className="flex-1 px-4 py-3 rounded-xl bg-blue-600 text-white font-medium flex items-center justify-center gap-2"
                  >
                    <Download className="w-5 h-5" />
                    Export Transcript
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedTranscript(null)}
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