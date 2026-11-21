jest.mock('../../lib/prisma', () => ({ __esModule: true, default: {} }));

import {
  ConversationError,
  decodeCursor,
  defaultConversationTitle,
  encodeCursor,
  toPreviewExcerpt,
} from './conversations.service';
import { CONVERSATION_COMPANION_KEYS } from './conversations.schema';

describe('conversations.service helpers', () => {
  it('round-trips a cursor', () => {
    const at = new Date('2026-11-20T08:30:00.123Z');
    const id = '12345678-1234-4234-8234-123456789abc';
    expect(decodeCursor(encodeCursor(at, id))).toEqual({ at, id });
  });

  it.each([
    'garbage',
    Buffer.from('{"t":"nope","id":"12345678-1234-4234-8234-123456789abc"}').toString('base64url'),
    Buffer.from('{"t":"2026-11-20T00:00:00Z","id":"not-a-uuid"}').toString('base64url'),
    Buffer.from('[]').toString('base64url'),
  ])('rejects invalid cursor %p with INVALID_CURSOR', (raw) => {
    expect(() => decodeCursor(raw)).toThrow(ConversationError);
    try {
      decodeCursor(raw);
    } catch (error) {
      expect((error as ConversationError).code).toBe('INVALID_CURSOR');
      expect((error as ConversationError).statusCode).toBe(400);
    }
  });

  it('builds a single-line preview capped at 120 characters', () => {
    expect(toPreviewExcerpt(null)).toBe('');
    expect(toPreviewExcerpt('  hello \n\n there ')).toBe('hello there');
    const long = toPreviewExcerpt('word '.repeat(60));
    expect(long.length).toBeLessThanOrEqual(120);
    expect(long.endsWith('…')).toBe(true);
  });

  it('accepts exactly the seven canonical registry ids, unchanged', () => {
    expect([...CONVERSATION_COMPANION_KEYS].sort()).toEqual(
      ['Alex', 'Bianca', 'Damian', 'Jordan Taylor', 'Maya Chen', 'Sara Mitchell', 'Sasha'].sort()
    );
  });

  it('titles new conversations with the member-facing display name', () => {
    expect(defaultConversationTitle('Alex')).toBe('New chat with Frankie');
    expect(defaultConversationTitle('Jordan Taylor')).toBe('New chat with Andre');
    expect(defaultConversationTitle('Maya Chen')).toBe('New chat with Tessa');
    expect(defaultConversationTitle('Sara Mitchell')).toBe('New chat with Romy');
    expect(defaultConversationTitle('Bianca')).toBe('New chat with Bianca');
  });
});
