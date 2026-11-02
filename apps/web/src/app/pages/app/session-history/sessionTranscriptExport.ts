/**
 * Session transcript export (Talk It Out History: row download icon and popup button), as TXT
 * here and as PDF in sessionTranscriptPdf.ts — both from `buildSessionTranscriptDocument`.
 *
 * Built only from stored data: the session row (GET /sessions/:id) and its messages
 * (GET /sessions/:id/transcript). It never asks for a summary to be generated.
 * Only user and assistant messages are written, word for word, with their recorded times.
 */
import { format } from 'date-fns';

export interface TranscriptExportSession {
  id: string;
  title?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  config?: { summary?: unknown; summary_source?: unknown } | null;
}

export interface TranscriptExportMessage {
  role?: string | null;
  content?: string | null;
  created_at?: string | null;
}

export interface TranscriptExportInput {
  session: TranscriptExportSession;
  messages: TranscriptExportMessage[];
  /** Name stored on the session itself (config.avatar), if any — never the user's current pick. */
  companionName?: string | null;
  exportedAt: Date;
  timeZone: string;
}

export type TranscriptExportResult =
  | { kind: 'ok'; text: string; messageCount: number; fileName: string }
  | { kind: 'empty' };

/** The live session saves a bounded window of messages; say so without claiming any were lost. */
export const SAVED_MESSAGES_NOTE =
  'This export contains the messages saved for this session. Earlier messages from longer sessions may not be available.';

/** Message times come from `created_at`: when each message was recorded, not necessarily spoken. */
export const RECORDED_TIMES_NOTE =
  'Times shown are when each message was recorded (saved), which may differ from when the words were spoken.';

const SPEAKERS: Record<string, string> ={ user: 'You', human: 'You', assistant: 'Solace' };

/** Titles the app stores or shows as placeholders rather than a real session name. */
const GENERIC_TITLES = /^(talking|instant talk|instant session|scheduled talk|scheduled session|new session)$/i;

/** Values written into `config.summary` as placeholders, not summaries (same rule as the page). */
const PLACEHOLDER_SUMMARY = /^(instant talk|scheduled talk|talking|new session)$/i;

function validDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDuration(totalSeconds: number): string {
  const s = Math.round(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts = [h ? `${h} h` : '', m ? `${m} min` : '', sec || (!h && !m) ? `${sec} s` : ''];
  return parts.filter(Boolean).join(' ');
}

function summaryBlock(config: TranscriptExportSession['config']): { heading: string; body: string } {
  const raw = typeof config?.summary === 'string' ? config.summary.trim() : '';
  if (!raw || PLACEHOLDER_SUMMARY.test(raw)) {
    return { heading: 'Saved Summary', body: 'No saved summary available.' };
  }
  const source = config?.summary_source;
  if (source === 'ai') return { heading: 'Saved Summary (AI-generated)', body: raw };
  if (source === 'heuristic') return { heading: 'Saved Summary (automatically generated)', body: raw };
  return { heading: 'Saved Summary', body: raw };
}

/** File name stem shared by TXT and PDF, e.g. `solace-session-<id>-2026-10-27-transcript`. */
export function transcriptFileStem(sessionId: string, date: Date): string {
  const safeId = sessionId.replace(/[^A-Za-z0-9-]/g, '').slice(0, 64) || 'session';
  return `solace-session-${safeId}-${format(date, 'yyyy-MM-dd')}-transcript`;
}

export function transcriptExportFileName(sessionId: string, date: Date): string {
  return `${transcriptFileStem(sessionId, date)}.txt`;
}

/** The transcript as structured data; the TXT and the PDF are both written from it. */
export interface TranscriptDocument {
  /** Stored session title, or "Talk It Out session" for placeholder/missing titles. */
  title: string;
  sessionId: string;
  /** Companion name stored on the session itself, if any. */
  companion: string | null;
  started: Date | null;
  /** Recorded duration ("20 min", "0 s") or "Not recorded". */
  duration: string;
  exportedAt: Date;
  timeZone: string;
  summary: { heading: string; body: string };
  messages: Array<{
    speaker: 'You' | 'Solace';
    /** When the message was recorded (saved); null when not recorded or invalid. */
    at: Date | null;
    /** Recorded time as shown in both formats ("21:01:00", or with the date when the talk spans days). */
    time: string;
    /** Exactly as stored (line endings normalised to \n). */
    content: string;
  }>;
  /** File name stem (without extension). */
  fileStem: string;
}

export type TranscriptDocumentResult = { kind: 'ok'; doc: TranscriptDocument } | { kind: 'empty' };

export function buildSessionTranscriptDocument(input: TranscriptExportInput): TranscriptDocumentResult {
  const { session, companionName, exportedAt, timeZone } = input;

  // Conversation only; the API already returns messages oldest first (ties keep that order).
  const conversation = input.messages.filter(
    (m) => typeof m.role === 'string' && SPEAKERS[m.role.toLowerCase()] && typeof m.content === 'string' && m.content.trim()
  );
  if (conversation.length === 0) return { kind: 'empty' };

  const started = validDate(session.started_at);
  const ended = validDate(session.ended_at);
  const times = conversation.map((m) => validDate(m.created_at));

  // Show dates on message times when the conversation spans more than one local day.
  const days = new Set(
    [started, ...times].filter((d): d is Date => d !== null).map((d) => format(d, 'yyyy-MM-dd'))
  );
  const timeFormat = days.size > 1 ? 'yyyy-MM-dd HH:mm:ss' : 'HH:mm:ss';

  const title = session.title?.trim();
  const duration =
    started && ended && ended.getTime() >= started.getTime()
      ? formatDuration((ended.getTime() - started.getTime()) / 1000)
      : 'Not recorded';

  return {
    kind: 'ok',
    doc: {
      title: title && !GENERIC_TITLES.test(title) ? title : 'Talk It Out session',
      sessionId: session.id,
      companion: companionName?.trim() ? companionName.trim() : null,
      started,
      duration,
      exportedAt,
      timeZone,
      summary: summaryBlock(session.config),
      messages: conversation.map((m, i) => ({
        speaker: SPEAKERS[(m.role as string).toLowerCase()] as 'You' | 'Solace',
        at: times[i],
        time: times[i] ? format(times[i] as Date, timeFormat) : 'Time not recorded',
        content: (m.content as string).replace(/\r\n?/g, '\n'),
      })),
      fileStem: transcriptFileStem(session.id, started ?? exportedAt),
    },
  };
}

export function buildSessionTranscriptText(input: TranscriptExportInput): TranscriptExportResult {
  const result = buildSessionTranscriptDocument(input);
  if (result.kind === 'empty') return result;
  const { doc } = result;

  const lines: string[] = [
    'Solace | Session Transcript',
    '',
    `Session: ${doc.title}`,
    `Session ID: ${doc.sessionId}`,
    ...(doc.companion ? [`Companion: ${doc.companion}`] : []),
    `Started: ${doc.started ? format(doc.started, 'yyyy-MM-dd HH:mm') : 'Not recorded'}`,
    `Duration: ${doc.duration}`,
    `Exported: ${format(doc.exportedAt, 'yyyy-MM-dd HH:mm')}`,
    `Time zone: ${doc.timeZone}`,
    '',
    doc.summary.heading,
    doc.summary.body,
    '',
    'Conversation',
    SAVED_MESSAGES_NOTE,
    RECORDED_TIMES_NOTE,
  ];

  for (const m of doc.messages) {
    lines.push('', `[${m.time}] ${m.speaker}:`, m.content);
  }

  const text = `${lines.join('\n').replace(/\r\n?/g, '\n')}\n`;
  return {
    kind: 'ok',
    text,
    messageCount: doc.messages.length,
    fileName: `${doc.fileStem}.txt`,
  };
}
