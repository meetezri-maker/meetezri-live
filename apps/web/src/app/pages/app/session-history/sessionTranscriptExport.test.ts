import { describe, it, expect } from 'vitest';
import {
  RECORDED_TIMES_NOTE,
  SAVED_MESSAGES_NOTE,
  buildSessionTranscriptText,
  transcriptExportFileName,
  type TranscriptExportInput,
} from './sessionTranscriptExport';

const URDU = 'آج میں نے بہت سکون محسوس کیا۔';
// Local-time instants so formatting is the same in any test time zone.
const at = (d: number, h: number, m = 0, s = 0) => new Date(2026, 9, d, h, m, s).toISOString();

const input = (over: Partial<TranscriptExportInput> = {}): TranscriptExportInput => ({
  session: {
    id: 'a1b2c3d4-0000-4000-8000-000000000001',
    title: 'Evening check-in',
    started_at: at(27, 21, 0, 0),
    ended_at: at(27, 21, 25, 30),
    config: { summary: 'You talked about sleep and work stress.', summary_source: 'ai' },
  },
  messages: [
    { role: 'system', content: 'You are Solace. INTERNAL PROMPT', created_at: at(27, 21, 0, 0) },
    { role: 'user', content: 'Hello', created_at: at(27, 21, 0, 5) },
    { role: 'assistant', content: "Hi, I'm here.\n\nTake your time.", created_at: at(27, 21, 0, 9) },
    { role: 'tool', content: '{"secret":"x"}', created_at: at(27, 21, 0, 10) },
    { role: 'mystery', content: 'unknown role text', created_at: at(27, 21, 0, 11) },
    { role: 'user', content: `I said "fine, okay", but ${URDU}`, created_at: at(27, 21, 1, 0) },
  ],
  companionName: 'Maya',
  exportedAt: new Date(2026, 9, 28, 9, 30),
  timeZone: 'Asia/Karachi',
  ...over,
});

const textOf = (i: TranscriptExportInput) => {
  const r = buildSessionTranscriptText(i);
  if (r.kind !== 'ok') throw new Error('expected ok');
  return r;
};

describe('buildSessionTranscriptText', () => {
  it('writes the documented layout from stored data only', () => {
    const r = textOf(input());
    expect(r.text).toBe(
      [
        'Solace | Session Transcript',
        '',
        'Session: Evening check-in',
        'Session ID: a1b2c3d4-0000-4000-8000-000000000001',
        'Companion: Maya',
        'Started: 2026-10-27 21:00',
        'Duration: 25 min 30 s',
        'Exported: 2026-10-28 09:30',
        'Time zone: Asia/Karachi',
        '',
        'Saved Summary (AI-generated)',
        'You talked about sleep and work stress.',
        '',
        'Conversation',
        'This export contains the messages saved for this session. Earlier messages from longer sessions may not be available.',
        'Times shown are when each message was recorded (saved), which may differ from when the words were spoken.',
        '',
        '[21:00:05] You:',
        'Hello',
        '',
        '[21:00:09] Solace:',
        "Hi, I'm here.\n\nTake your time.",
        '',
        `[21:01:00] You:`,
        `I said "fine, okay", but ${URDU}`,
        '',
      ].join('\n')
    );
    expect(r.messageCount).toBe(3);
    expect(r.fileName).toBe('solace-session-a1b2c3d4-0000-4000-8000-000000000001-2026-10-27-transcript.txt');
  });

  it('never writes system, tool, unknown-role or internal content', () => {
    const { text } = textOf(input());
    expect(text).not.toMatch(/INTERNAL PROMPT|secret|unknown role text|mystery/);
  });

  it('labels summaries by stored provenance only', () => {
    const heading = (config: Record<string, unknown> | null) =>
      textOf(input({ session: { ...input().session, config } })).text.split('\n').slice(10, 12);
    expect(heading({ summary: 'Saved text', summary_source: 'heuristic' })).toEqual([
      'Saved Summary (automatically generated)', 'Saved text',
    ]);
    expect(heading({ summary: 'Saved text' })).toEqual(['Saved Summary', 'Saved text']);
    expect(heading({ summary: 'Instant talk' })).toEqual(['Saved Summary', 'No saved summary available.']);
    expect(heading({})).toEqual(['Saved Summary', 'No saved summary available.']);
    expect(heading(null)).toEqual(['Saved Summary', 'No saved summary available.']);
  });

  it('uses a neutral title for generic stored titles and omits an unknown companion', () => {
    for (const title of [null, '', 'Talking', 'Instant Session', 'Scheduled Talk']) {
      const { text } = textOf(input({ session: { ...input().session, title }, companionName: null }));
      expect(text).toContain('Session: Talk It Out session\n');
      expect(text).not.toContain('Companion:');
    }
  });

  it('distinguishes a recorded zero duration from a missing one', () => {
    const zero = textOf(input({ session: { ...input().session, ended_at: input().session.started_at } }));
    expect(zero.text).toContain('Duration: 0 s\n');
    const missing = textOf(input({ session: { ...input().session, ended_at: null } }));
    expect(missing.text).toContain('Duration: Not recorded\n');
    const noStart = textOf(input({ session: { ...input().session, started_at: 'not-a-date' } }));
    expect(noStart.text).toContain('Started: Not recorded\n');
    expect(noStart.text).toContain('Duration: Not recorded\n');
  });

  it('shows "Time not recorded" for missing or invalid message times and keeps order for equal times', () => {
    const { text } = textOf(
      input({
        messages: [
          { role: 'user', content: 'first', created_at: at(27, 21, 5) },
          { role: 'assistant', content: 'second', created_at: at(27, 21, 5) },
          { role: 'user', content: 'third', created_at: null },
          { role: 'assistant', content: 'fourth', created_at: 'garbage' },
        ],
      })
    );
    const conv = text.slice(text.indexOf('Conversation'));
    expect(conv.indexOf('first')).toBeLessThan(conv.indexOf('second'));
    expect(conv).toContain('[21:05:00] You:\nfirst');
    expect(conv).toContain('[21:05:00] Solace:\nsecond');
    expect(conv).toContain('[Time not recorded] You:\nthird');
    expect(conv).toContain('[Time not recorded] Solace:\nfourth');
  });

  it('adds dates to message times when the talk crosses midnight', () => {
    const { text } = textOf(
      input({
        session: { ...input().session, started_at: at(27, 23, 58), ended_at: at(28, 0, 3) },
        messages: [
          { role: 'user', content: 'before', created_at: at(27, 23, 59, 30) },
          { role: 'assistant', content: 'after', created_at: at(28, 0, 1, 0) },
        ],
      })
    );
    expect(text).toContain('[2026-10-27 23:59:30] You:\nbefore');
    expect(text).toContain('[2026-10-28 00:01:00] Solace:\nafter');
  });

  it('always notes saved-message scope and recorded times, without claiming truncation', () => {
    for (const count of [1, 120, 121]) {
      const messages = Array.from({ length: count }, (_, i) => ({
        role: i % 2 ? 'assistant' : 'user',
        content: `m${i}`,
        created_at: at(27, 21, Math.floor(i / 60), i % 60),
      }));
      const { text } = textOf(input({ messages }));
      expect(text).toContain(`\n${SAVED_MESSAGES_NOTE}\n`);
      expect(text).toContain(`\n${RECORDED_TIMES_NOTE}\n`);
      expect(text).not.toMatch(/truncat|were removed|missing messages|only the last/i);
    }
    expect(SAVED_MESSAGES_NOTE).toBe(
      'This export contains the messages saved for this session. Earlier messages from longer sessions may not be available.'
    );
    expect(RECORDED_TIMES_NOTE).toMatch(/recorded \(saved\)/);
  });

  it('reports an empty conversation instead of producing a file', () => {
    expect(buildSessionTranscriptText(input({ messages: [] }))).toEqual({ kind: 'empty' });
    expect(
      buildSessionTranscriptText(input({ messages: [{ role: 'system', content: 'x' }, { role: 'user', content: '   ' }] }))
    ).toEqual({ kind: 'empty' });
  });

  it('makes a filesystem-safe file name', () => {
    expect(transcriptExportFileName('../../etc/passwd?x', new Date(2026, 9, 27))).toBe(
      'solace-session-etcpasswdx-2026-10-27-transcript.txt'
    );
  });
});
