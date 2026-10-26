import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

type Auth = { user: { id: string } | null; isLoading: boolean };

const { track, authState } = vi.hoisted(() => ({
  track: vi.fn(() => Promise.resolve()),
  authState: { current: { user: { id: 'user-a' }, isLoading: false } as Auth },
}));

vi.mock('@/app/utils/resourceTracking', () => ({ trackResourceInteraction: track }));
vi.mock('@/app/contexts/AuthContext', () => ({ useAuth: () => authState.current }));

import { SafetyResourceCard } from './SafetyResourceCard';

const resource = {
  id: 'web_lifeline',
  type: 'crisis_line' as const,
  name: 'Lifeline',
  description: 'Support line',
  url: 'https://example.org/lifeline',
  availability: '24/7',
  region: 'PK',
};

const views = () => track.mock.calls.filter((c) => (c as unknown[])[3] === 'view');

describe('SafetyResourceCard tracking identity', () => {
  beforeEach(() => {
    track.mockClear();
    authState.current = { user: { id: 'user-a' }, isLoading: false };
  });

  it('passes the signed-in user id and still opens the resource', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    render(<SafetyResourceCard resource={resource} safetyState="normal" />);

    expect(track).toHaveBeenCalledWith('web_lifeline', 'Lifeline', 'crisis_line', 'view', undefined, 'normal', 'user-a');

    fireEvent.click(screen.getByRole('button', { name: /Visit Website/i }));
    expect(track).toHaveBeenLastCalledWith('web_lifeline', 'Lifeline', 'crisis_line', 'visit', undefined, 'normal', 'user-a');
    expect(open).toHaveBeenCalledWith('https://example.org/lifeline', '_blank', 'noopener,noreferrer');
    open.mockRestore();
  });

  it('waits for auth to resolve before recording the view, then records it once for that account', () => {
    authState.current = { user: null, isLoading: true };
    const { rerender } = render(<SafetyResourceCard resource={resource} />);
    expect(views()).toHaveLength(0);

    authState.current = { user: { id: 'user-a' }, isLoading: false };
    rerender(<SafetyResourceCard resource={resource} />);
    expect(views()).toHaveLength(1);
    expect(views()[0][6]).toBe('user-a');
  });

  it('does not log a second view, or move the view, when the account changes on the same display', () => {
    const { rerender } = render(<SafetyResourceCard resource={resource} />);
    authState.current = { user: { id: 'user-b' }, isLoading: false };
    rerender(<SafetyResourceCard resource={resource} />);
    expect(views()).toHaveLength(1);
    expect(views()[0][6]).toBe('user-a');
  });

  it('records a view for a newly shown resource', () => {
    const { rerender } = render(<SafetyResourceCard resource={resource} />);
    rerender(<SafetyResourceCard resource={{ ...resource, id: 'web_other', name: 'Other' }} />);
    expect(views()).toHaveLength(2);
  });

  it('passes null once auth has resolved as signed out', () => {
    authState.current = { user: null, isLoading: false };
    render(<SafetyResourceCard resource={resource} />);
    expect(track).toHaveBeenCalledWith('web_lifeline', 'Lifeline', 'crisis_line', 'view', undefined, undefined, null);
  });
});
