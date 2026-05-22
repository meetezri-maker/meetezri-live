const mockPrisma = {
  safety_plans: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

import {
  clearWellnessPlanForUser,
  getWellnessPlanForUser,
  upsertWellnessPlanForUser,
} from './wellness-plan.service';

const userId = '00000000-0000-4000-8000-000000000001';
const planId = '00000000-0000-4000-8000-000000000099';

describe('wellness-plan.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns empty plan when none exists', async () => {
    mockPrisma.safety_plans.findFirst.mockResolvedValue(null);
    const plan = await getWellnessPlanForUser(userId);
    expect(plan.id).toBeNull();
    expect(plan.user_id).toBe(userId);
    expect(plan.warning_signs).toEqual([]);
  });

  it('creates a plan on first upsert', async () => {
    mockPrisma.safety_plans.findFirst.mockResolvedValue(null);
    mockPrisma.safety_plans.create.mockResolvedValue({
      id: planId,
      user_id: userId,
      warning_signs: ['tired'],
      coping_strategies: [],
      social_distractions: [],
      trusted_contacts: [],
      professional_support: { reasons_to_live: ['family'] },
      environment_safety: [],
      last_updated: new Date('2026-05-22T12:00:00.000Z'),
    });

    const plan = await upsertWellnessPlanForUser(userId, {
      warning_signs: ['tired'],
      coping_strategies: [],
      social_distractions: [],
      trusted_contacts: [],
      reasons_to_live: ['family'],
      environment_safety: [],
    });

    expect(mockPrisma.safety_plans.create).toHaveBeenCalled();
    expect(plan.id).toBe(planId);
    expect(plan.warning_signs).toEqual(['tired']);
    expect(plan.professional_support?.reasons_to_live).toEqual(['family']);
  });

  it('clears all sections', async () => {
    mockPrisma.safety_plans.findFirst.mockResolvedValue({ id: planId });
    mockPrisma.safety_plans.update.mockResolvedValue({
      id: planId,
      user_id: userId,
      warning_signs: [],
      coping_strategies: [],
      social_distractions: [],
      trusted_contacts: [],
      professional_support: { reasons_to_live: [] },
      environment_safety: [],
      last_updated: new Date(),
    });

    const plan = await clearWellnessPlanForUser(userId);
    expect(plan.warning_signs).toEqual([]);
    expect(plan.environment_safety).toEqual([]);
  });
});
