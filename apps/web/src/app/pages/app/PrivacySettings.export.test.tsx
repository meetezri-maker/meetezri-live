import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const { exportUserData, toast, auth, safety } = vi.hoisted(() => ({
  exportUserData: vi.fn(),
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
  // Stable objects: the page's effects depend on `profile`, so a new object per render would loop.
  auth: { profile: { id: 'user-a', privacy_settings: {} }, refreshProfile: vi.fn() },
  safety: { updateConsent: vi.fn() },
}));

vi.mock('@/lib/api', () => ({
  api: {
    exportUserData,
    getKnowledgeTwoFactorStatus: vi.fn().mockResolvedValue({ enabled: false }),
    updateProfile: vi.fn().mockResolvedValue({}),
    deleteAccount: vi.fn(),
  },
}));
vi.mock('@/lib/supabase', () => {
  const deep = (): unknown =>
    new Proxy(function () {}, {
      get: (_t, k) => (k === 'then' ? undefined : deep()),
      apply: () => Promise.resolve({ data: { session: null, sessions: [] }, error: null }),
    });
  return { supabase: deep() };
});
vi.mock('@/app/contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/app/contexts/SafetyContext', () => ({ useSafetyConsent: () => safety }));
vi.mock('sonner', () => ({ toast }));

import { PrivacySettings } from './PrivacySettings';
import { ACCOUNT_DATA_EXPORT_CARD_TEXT } from './privacy-settings/accountDataExportCsv';

const payload = {
  exportVersion: 1,
  generatedAt: '2026-10-27T09:30:00.000Z',
  profile: {
    account: { fullName: 'Ayesha Khan', email: 'ayesha@example.test', createdAt: '2026-01-02T03:04:05.000Z' },
    profile: { dateOfBirth: '1995-04-12', bio: '=1+2', phone: null },
    wellnessPreferences: { goals: ['sleep'], challenges: [] },
    privacySettings: { allowAnalytics: false },
    notificationPreferences: { pushEnabled: true },
    emergencyContacts: { consentToContact: true, contacts: [] },
    membership: { name: 'Grow', status: 'active', stripe_sub_id: 'sub_TEST456' },
  },
};

let downloads: Array<{ name: string; blob: Blob }> = [];
let lastUrlBlob: Blob | null = null;

const readBlob = (blob: Blob) =>
  new Promise<string>((resolve) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.readAsText(blob);
  });

beforeEach(() => {
  downloads = [];
  exportUserData.mockReset();
  Object.values(toast).forEach((fn) => fn.mockReset());
  if (!(Blob.prototype as { text?: unknown }).text) {
    // jsdom lacks Blob#text; browsers have it.
    (Blob.prototype as { text: () => Promise<string> }).text = function (this: Blob) {
      return readBlob(this);
    };
  }
  URL.createObjectURL = vi.fn((b: Blob) => {
    lastUrlBlob = b;
    return 'blob:test';
  }) as typeof URL.createObjectURL;
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    if (lastUrlBlob) downloads.push({ name: this.download, blob: lastUrlBlob });
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <PrivacySettings />
    </MemoryRouter>
  );

describe('Privacy Settings data export', () => {
  it('describes what the export contains, without promising journals or insights', () => {
    renderPage();
    expect(screen.getByText(ACCOUNT_DATA_EXPORT_CARD_TEXT)).toBeInTheDocument();
    expect(screen.queryByText(/all your data/i)).toBeNull();
    expect(screen.getByRole('button', { name: 'Export data' })).toBeInTheDocument();
  });

  it('downloads the allowlisted CSV under a Solace filename', async () => {
    exportUserData.mockResolvedValue({
      blob: new Blob([JSON.stringify(payload)], { type: 'application/json' }),
      filename: 'solace-account-data-2026-10-27.json',
      contentType: 'application/json; charset=utf-8',
    });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Export data' }));

    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(downloads[0].name).toMatch(/^solace-account-data-\d{4}-\d{2}-\d{2}\.csv$/);
    const text = await readBlob(downloads[0].blob);
    expect(text).toContain('Section,Field,Value\r\n');
    expect(text).toContain("Profile,About me,'=1+2\r\n");
    expect(text).toContain('Privacy settings,Allow analytics,false\r\n');
    expect(text).toContain('Membership,Membership,Grow\r\n');
    expect(text).not.toContain('sub_TEST456');
    expect(toast.success).toHaveBeenCalled();
  });

  it('shows an error and downloads nothing when the response is not the expected export', async () => {
    exportUserData.mockResolvedValue({
      blob: new Blob([JSON.stringify({ profile: { id: 'x', stripe_customer_id: 'cus_1' } })], { type: 'application/json' }),
      filename: null,
      contentType: 'application/json',
    });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Export data' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Failed to download your data. Please try again.'));
    expect(downloads).toHaveLength(0);
  });
});
