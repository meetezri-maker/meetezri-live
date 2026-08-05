import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProtectedRoute } from '@/app/components/ProtectedRoute';
import { ExpertReviewConsole } from './ExpertReviewConsole';
import { api, type ExpertReviewConversation } from '@/lib/api';

const toastSuccess = vi.fn();
const toastError = vi.fn();
let authState: Record<string, unknown>;

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

vi.mock('@/app/components/AdminLayoutNew', () => ({
  AdminLayoutNew: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/app/contexts/AuthContext', () => ({
  useAuth: () => authState,
}));

vi.mock('@/lib/api', () => {
  class ApiError extends Error {
    readonly status: number;
    readonly code?: string;
    readonly body: Record<string, unknown>;

    constructor(message: string, status: number, body: Record<string, unknown> = {}) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.body = body;
      this.code = typeof body.code === 'string' ? body.code : undefined;
    }
  }

  return {
    ApiError,
    api: {
      requestAccountActivation: vi.fn(),
      admin: {
        getExpertReviewConversations: vi.fn(),
        getExpertReviewConversation: vi.fn(),
        saveExpertReviewConversation: vi.fn(),
      },
    },
  };
});

const pendingConversation: ExpertReviewConversation = {
  id: '11111111-1111-4111-8111-111111111111',
  userid: 'hidden-user-id',
  session_id: 'session-pending',
  user_query: 'I am anxious before my appointment and need a grounding plan.',
  brain_output: 'Take a breath and try a short grounding exercise before you go.',
  created_at: '2026-08-05T08:00:00.000Z',
  expert_analysis: null,
  expert_rephrased: null,
  is_reviewed: false,
};

const reviewedConversation: ExpertReviewConversation = {
  id: '22222222-2222-4222-8222-222222222222',
  userid: 'hidden-reviewed-user-id',
  session_id: 'session-reviewed',
  user_query: 'I need help reframing a stressful work conversation.',
  brain_output: 'You can write down what happened and what you need next.',
  created_at: '2026-08-04T08:00:00.000Z',
  expert_analysis: 'Existing expert analysis for this reviewed conversation.',
  expert_rephrased: 'Existing expert rephrased response for this reviewed conversation.',
  is_reviewed: true,
};

const pendingWithEmbedding = {
  ...pendingConversation,
  query_embedding: [0.1, 0.2, 0.3],
} as ExpertReviewConversation & { query_embedding: number[] };

function listResponse(items: ExpertReviewConversation[], total = items.length) {
  return { items, page: 1, limit: 25, total };
}

function setupListMock() {
  vi.mocked(api.admin.getExpertReviewConversations).mockImplementation(async (params) => {
    if (params?.page === 2) return { items: [reviewedConversation], page: 2, limit: 25, total: 50 };
    if (params?.reviewed === true) return listResponse([reviewedConversation]);
    if (params?.reviewed === false) return listResponse([pendingWithEmbedding]);
    return listResponse([pendingConversation, reviewedConversation]);
  });
}

function renderConsole() {
  return render(<ExpertReviewConsole />);
}

function renderProtected(role: string) {
  authState = {
    user: { id: 'admin-user', email_confirmed_at: '2026-08-05T00:00:00Z' },
    profile: {
      role,
      onboarding_completed: true,
      signup_type: 'plan',
      subscription_plan: 'core',
      email_verified: true,
    },
    profileStatus: 'ready',
    isLoading: false,
    hasRole: (roles: string[]) => roles.includes(role),
    signOut: vi.fn(),
    refreshProfile: vi.fn(),
  };

  return render(
    <MemoryRouter initialEntries={['/admin/expert-reviews']}>
      <Routes>
        <Route
          path="/admin/expert-reviews"
          element={
            <ProtectedRoute allowedRoles={['super_admin', 'org_admin']}>
              <div>Expert review page</div>
            </ProtectedRoute>
          }
        />
        <Route path="/error/permission-denied" element={<div>Permission denied</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ExpertReviewConsole', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState = {};
    setupListMock();
    vi.mocked(api.admin.getExpertReviewConversation).mockResolvedValue(reviewedConversation);
    vi.mocked(api.admin.saveExpertReviewConversation).mockResolvedValue({
      ...pendingConversation,
      expert_analysis: 'A valid expert analysis explaining the response issue.',
      expert_rephrased: 'A valid expert rephrased response that corrects the answer.',
      is_reviewed: true,
    });
  });

  it('loads the page and shows pending records by default', async () => {
    renderConsole();

    expect(screen.getByLabelText('Loading expert reviews')).toBeInTheDocument();
    expect(await screen.findByText('Expert Reviews')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /anxious before my appointment/i })).toBeInTheDocument();
    expect(api.admin.getExpertReviewConversations).toHaveBeenCalledWith({ page: 1, limit: 25, reviewed: false });
  });

  it('loads reviewed records when the reviewed filter is selected', async () => {
    renderConsole();
    await screen.findByRole('heading', { name: /anxious before my appointment/i });

    await userEvent.click(screen.getByRole('button', { name: 'Reviewed' }));

    expect(await screen.findByRole('heading', { name: /reframing a stressful work conversation/i })).toBeInTheDocument();
    expect(api.admin.getExpertReviewConversations).toHaveBeenLastCalledWith({ page: 1, limit: 25, reviewed: true });
  });

  it('loads all records when the all filter is selected', async () => {
    renderConsole();
    await screen.findByRole('heading', { name: /anxious before my appointment/i });

    await userEvent.click(screen.getByRole('button', { name: 'All' }));

    expect(await screen.findByRole('heading', { name: /reframing a stressful work conversation/i })).toBeInTheDocument();
    expect(api.admin.getExpertReviewConversations).toHaveBeenLastCalledWith({ page: 1, limit: 25, reviewed: undefined });
  });

  it('uses backend pagination', async () => {
    vi.mocked(api.admin.getExpertReviewConversations).mockResolvedValueOnce({ items: [pendingConversation], page: 1, limit: 25, total: 50 });
    renderConsole();
    await screen.findByRole('heading', { name: /anxious before my appointment/i });

    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));

    await waitFor(() => expect(api.admin.getExpertReviewConversations).toHaveBeenLastCalledWith({ page: 2, limit: 25, reviewed: false }));
  });

  it('shows an empty state for an empty pending queue', async () => {
    vi.mocked(api.admin.getExpertReviewConversations).mockResolvedValueOnce(listResponse([]));
    renderConsole();

    expect(await screen.findByText('No pending expert reviews')).toBeInTheDocument();
  });

  it('shows an empty state for an empty reviewed list', async () => {
    vi.mocked(api.admin.getExpertReviewConversations)
      .mockResolvedValueOnce(listResponse([pendingConversation]))
      .mockResolvedValueOnce(listResponse([]));
    renderConsole();
    await screen.findByRole('heading', { name: /anxious before my appointment/i });

    await userEvent.click(screen.getByRole('button', { name: 'Reviewed' }));

    expect(await screen.findByText('No reviewed conversations')).toBeInTheDocument();
  });

  it('shows a safe API error and retries', async () => {
    vi.mocked(api.admin.getExpertReviewConversations)
      .mockRejectedValueOnce(new Error('internal database detail'))
      .mockResolvedValueOnce(listResponse([pendingConversation]));

    renderConsole();
    expect(await screen.findByText('Expert Reviews unavailable')).toBeInTheDocument();
    expect(screen.queryByText('internal database detail')).not.toBeInTheDocument();

    await userEvent.click(screen.getAllByRole('button', { name: 'Retry' })[1]);

    expect(await screen.findByRole('heading', { name: /anxious before my appointment/i })).toBeInTheDocument();
  });

  it('opens a conversation and displays original fields as read-only text', async () => {
    renderConsole();
    await screen.findByRole('heading', { name: /anxious before my appointment/i });

    await userEvent.click(screen.getByRole('button', { name: 'Review' }));

    expect((await screen.findAllByText('User message')).length).toBeGreaterThan(0);
    expect(screen.getByText(reviewedConversation.user_query)).toBeInTheDocument();
    expect(screen.getByText(reviewedConversation.brain_output)).toBeInTheDocument();
    expect(screen.getByText(/Session session-reviewed/i)).toBeInTheDocument();
  });

  it('prepopulates existing review values', async () => {
    renderConsole();
    await screen.findByRole('heading', { name: /anxious before my appointment/i });

    await userEvent.click(screen.getByRole('button', { name: 'Review' }));

    expect(await screen.findByDisplayValue(reviewedConversation.expert_analysis!)).toBeInTheDocument();
    expect(screen.getByDisplayValue(reviewedConversation.expert_rephrased!)).toBeInTheDocument();
  });

  it('blocks invalid saves with matching validation', async () => {
    vi.mocked(api.admin.getExpertReviewConversation).mockResolvedValueOnce(pendingConversation);
    renderConsole();
    await screen.findByRole('heading', { name: /anxious before my appointment/i });

    await userEvent.click(screen.getByRole('button', { name: 'Review' }));
    expect(await screen.findByText('Expert analysis is required.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save review' })).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/Expert analysis/i), 'too tiny');
    await userEvent.type(screen.getByLabelText(/Expert rephrased response/i), 'short');

    expect(screen.getByText('Expert analysis must be at least 10 characters.')).toBeInTheDocument();
    expect(screen.getByText('Expert rephrased response must be at least 10 characters.')).toBeInTheDocument();
    expect(api.admin.saveExpertReviewConversation).not.toHaveBeenCalled();
  });

  it('saves a valid review and shows the reviewed badge afterward', async () => {
    vi.mocked(api.admin.getExpertReviewConversation).mockResolvedValueOnce(pendingConversation);
    renderConsole();
    await screen.findByRole('heading', { name: /anxious before my appointment/i });

    await userEvent.click(screen.getByRole('button', { name: 'Review' }));
    await userEvent.type(await screen.findByLabelText(/Expert analysis/i), 'A valid expert analysis for this conversation.');
    await userEvent.type(screen.getByLabelText(/Expert rephrased response/i), 'A valid expert response that is more complete.');
    await userEvent.click(screen.getByRole('button', { name: 'Save review' }));

    await waitFor(() => expect(api.admin.saveExpertReviewConversation).toHaveBeenCalledWith(pendingConversation.id, {
      expert_analysis: 'A valid expert analysis for this conversation.',
      expert_rephrased: 'A valid expert response that is more complete.',
    }));
    expect(toastSuccess).toHaveBeenCalledWith('Expert review saved');
    expect(screen.getAllByText('Reviewed').length).toBeGreaterThan(0);
  });

  it('shows a safe failed save toast', async () => {
    vi.mocked(api.admin.getExpertReviewConversation).mockResolvedValueOnce(pendingConversation);
    vi.mocked(api.admin.saveExpertReviewConversation).mockRejectedValueOnce(new Error('supabase exploded'));
    renderConsole();
    await screen.findByRole('heading', { name: /anxious before my appointment/i });

    await userEvent.click(screen.getByRole('button', { name: 'Review' }));
    await userEvent.type(await screen.findByLabelText(/Expert analysis/i), 'A valid expert analysis for this conversation.');
    await userEvent.type(screen.getByLabelText(/Expert rephrased response/i), 'A valid expert response that is more complete.');
    await userEvent.click(screen.getByRole('button', { name: 'Save review' }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Could not save the expert review. Please try again.'));
  });

  it('does not expect or render query_embedding', async () => {
    renderConsole();

    expect(await screen.findByRole('heading', { name: /anxious before my appointment/i })).toBeInTheDocument();
    expect(screen.queryByText('query_embedding')).not.toBeInTheDocument();
    expect(screen.queryByText('0.1')).not.toBeInTheDocument();
  });

  it('keeps unauthorized admin roles out of the route', () => {
    renderProtected('team_admin');

    expect(screen.getByText('Permission denied')).toBeInTheDocument();
    expect(screen.queryByText('Expert review page')).not.toBeInTheDocument();
  });
});