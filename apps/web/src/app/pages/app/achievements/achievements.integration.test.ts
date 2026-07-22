/**
 * Guard tests for the Task 2 backend integration. These assert on the source of
 * the Achievements page + API client to lock in that the legacy client-side
 * logic has been removed and the backend gamification endpoints are wired.
 *
 * They complement the backend service tests (Task 1), which cover the actual
 * award/completion/dedup/level behavior.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const achievementsSrc = readFileSync(path.resolve(here, '../Achievements.tsx'), 'utf8');
const apiSrc = readFileSync(path.resolve(here, '../../../../lib/api.ts'), 'utf8');

describe('Achievements page: legacy client logic removed', () => {
  it('no longer writes custom achievements to localStorage', () => {
    expect(achievementsSrc).not.toMatch(/localStorage\.setItem\(\s*customStorageKey/);
    expect(achievementsSrc).not.toMatch(/ezri_custom_achievements_/);
  });

  it('no longer reads a localStorage fallback cache', () => {
    expect(achievementsSrc).not.toMatch(/localStorage\.getItem\(\s*customStorageKey/);
  });

  it('no longer sums points on the client for the total', () => {
    // Old: achievements.filter(a => a.unlocked).reduce((sum, a) => sum + a.points, 0)
    expect(achievementsSrc).not.toMatch(/reduce\(\(sum, a\) => sum \+ a\.points/);
  });

  it('no longer computes the next reward milestone with a hardcoded 250 step', () => {
    expect(achievementsSrc).not.toMatch(/const step = 250;/);
  });

  it('does not create a linked goal on the fly during check-in', () => {
    // The dual-write on-the-fly goal creation used ensureMinText padding.
    expect(achievementsSrc).not.toMatch(/Could not create DB goal/);
  });

  it('no longer mirrors a Personal Goal into a custom_achievements record (Task 2.5)', () => {
    // The goal-creation path must not also write to custom_achievements.
    expect(achievementsSrc).not.toMatch(/Failed to save personal goal in custom achievements table/);
    expect(achievementsSrc).not.toMatch(/Failed to create linked goal in database/);
  });

  it('no longer exposes a free-form progress percentage input', () => {
    expect(achievementsSrc).not.toMatch(/Current Progress \(0/);
    expect(achievementsSrc).not.toMatch(/id="pg-progress"/);
  });
});

describe('Achievements page: backend gamification wired', () => {
  it('reads points + level from the backend', () => {
    expect(achievementsSrc).toContain('api.gamification.getPoints()');
    expect(achievementsSrc).toContain('backendPoints.level');
  });

  it('loads Personal Goals from their authoritative API (no mirror)', () => {
    expect(achievementsSrc).toContain('api.goals.list()');
    expect(achievementsSrc).toContain('goalRowToDisplay');
  });

  it('submits value/milestone check-ins to the backend for both item types', () => {
    expect(achievementsSrc).toContain('api.goals.addCheckIn(');
    expect(achievementsSrc).toContain('api.customAchievements.addCheckIn(');
  });

  it('surfaces backend errors from a check-in (e.g. duplicate per-day)', () => {
    expect(achievementsSrc).toMatch(/toast\.error\(message\)/);
  });
});

describe('Personal goals render in the main card grid + are editable (this fix)', () => {
  it('renders goal cards via goalCardView (reused Goal card)', () => {
    expect(achievementsSrc).toContain('data-testid="goal-card"');
    expect(achievementsSrc).toContain('goalCardView(raw)');
    expect(achievementsSrc).toContain('const renderGoalCard =');
  });

  it('keeps custom achievements in the achievements grid (unchanged)', () => {
    expect(achievementsSrc).toContain('...customAchievements');
  });

  it('removes the inline Edit button from goal cards (edit moved into the workspace)', () => {
    expect(achievementsSrc).not.toContain('data-testid="goal-edit-button"');
    expect(achievementsSrc).toContain('const openEditGoal =');
    // Clicking anywhere on the card opens the Detail Workspace (single interaction).
    expect(achievementsSrc).toContain('onClick={() => openGoalDetail(raw)}');
  });

  it('editing updates the SAME goal id via api.goals.update (not create)', () => {
    expect(achievementsSrc).toMatch(/if \(editingGoalId\)\s*\{[\s\S]*api\.goals\.update\(editingGoalId, payload\)/);
    expect(achievementsSrc).toContain("editingGoalId ? 'Update Personal Goal' : 'Save Personal Goal'");
  });

  it('refetches goals after save so grid + Daily Check-in both update', () => {
    // Both surfaces read from personalGoals, so a single reloadGoals refreshes both.
    expect(achievementsSrc).toMatch(/Promise\.all\(\[reloadGoals\(\), reloadPoints\(\)\]\)/);
  });

  it('goal card label and progress bar both use the single derived g.progressPct', () => {
    expect(achievementsSrc).toContain('{g.progressPct}%'); // label
    expect(achievementsSrc).toContain('width: `${g.progressPct}%`'); // bar
  });

  it('does not compute or award points on the client for goals', () => {
    // No client point math near the goal card/edit path.
    expect(achievementsSrc).not.toMatch(/\+\s*20\b.*points/i);
  });
});

describe('Custom achievements are editable; predefined stay read-only (this fix)', () => {
  it('removes the inline Edit button from achievement cards (edit moved into the workspace)', () => {
    expect(achievementsSrc).not.toContain('data-testid="achievement-edit-button"');
    expect(achievementsSrc).toContain('const customAchievementIds =');
    // The workspace Edit control is gated to the user's own custom achievements.
    expect(achievementsSrc).toContain('customAchievementIds.has(detailItem.id)');
  });

  it('wires Edit to openEditAchievement (pre-fills the existing form)', () => {
    expect(achievementsSrc).toContain('openEditAchievement(ach)');
    expect(achievementsSrc).toContain('const openEditAchievement =');
    expect(achievementsSrc).toContain("setActiveAddTab('personal_achievements')");
  });

  it('editing updates the SAME achievement id via the existing update method (not create)', () => {
    expect(achievementsSrc).toMatch(/if \(editingAchievementId\)\s*\{[\s\S]*api\.customAchievements\.update\(editingAchievementId/);
    expect(achievementsSrc).toContain("editingAchievementId ? 'Update Personal Achievement' : 'Save Personal Achievement'");
  });

  it('does NOT send progress on edit (preserves existing progress/completion/reward)', () => {
    // The edit payload block must not include a `progress:` field.
    const editBlock = achievementsSrc.slice(
      achievementsSrc.indexOf('api.customAchievements.update(editingAchievementId'),
      achievementsSrc.indexOf('api.customAchievements.update(editingAchievementId') + 400
    );
    expect(editBlock).not.toMatch(/\bprogress:/);
    expect(editBlock).not.toMatch(/\bunlocked:/);
    expect(editBlock).not.toMatch(/\bpoints:/);
  });

  it('clears achievement edit state when the modal closes', () => {
    expect(achievementsSrc).toContain('setEditingAchievementId(null)');
  });

  it('refetches after save so the card refreshes immediately', () => {
    expect(achievementsSrc).toMatch(/Promise\.all\(\[reloadCustomAchievements\(\), reloadPoints\(\)\]\)/);
  });
});

describe('API client: gamification endpoints exist', () => {
  it('exposes gamification.getPoints and listTransactions', () => {
    expect(apiSrc).toContain('/gamification/points');
    expect(apiSrc).toContain('/gamification/transactions');
  });

  it('exposes customAchievements.complete', () => {
    expect(apiSrc).toMatch(/custom-achievements\/\$\{encodeURIComponent\(id\)\}\/complete/);
  });
});

describe('Combined Goals & Achievements list + filters (final structure)', () => {
  it('default filter is All', () => {
    expect(achievementsSrc).toMatch(/useState<GamificationFilter>\('all'\)/);
  });

  it('renders ONE combined section (separate section headers removed)', () => {
    expect(achievementsSrc).toContain('data-testid="goals-achievements-section"');
    expect(achievementsSrc).toContain('Goals &amp; Achievements');
    expect(achievementsSrc).not.toContain('Your personal goals');
    expect(achievementsSrc).not.toContain('>Your achievements<');
  });

  it('has All / Goals / Achievements filter controls (accessible)', () => {
    expect(achievementsSrc).toContain('data-testid={`gamification-filter-${f.id}`}');
    expect(achievementsSrc).toContain('aria-pressed={active}');
    expect(achievementsSrc).toMatch(/\{ id: 'all', label: 'All' \}/);
    expect(achievementsSrc).toMatch(/\{ id: 'goals', label: 'Goals' \}/);
    expect(achievementsSrc).toMatch(/\{ id: 'achievements', label: 'Achievements' \}/);
  });

  it('builds the combined list via combineAndFilter and renders by itemType', () => {
    expect(achievementsSrc).toContain('combineAndFilter(');
    expect(achievementsSrc).toContain("item.itemType === 'goal'");
    expect(achievementsSrc).toContain('renderGoalCard(item.data)');
    expect(achievementsSrc).toContain('renderAchievementCard(item.data, index)');
  });

  it('uses stable collision-proof keys per item type', () => {
    expect(achievementsSrc).toContain('key={`goal:${g.id}`}');
    expect(achievementsSrc).toContain('key={`achievement:${achievement.id}`}');
  });

  it('shows a filter-specific empty state, gated by initial load', () => {
    expect(achievementsSrc).toContain('data-testid="gamification-empty-state"');
    expect(achievementsSrc).toContain('combinedEmptyMessage');
    expect(achievementsSrc).toContain('No personal goals yet.');
    expect(achievementsSrc).toContain('No achievements found.');
    expect(achievementsSrc).toContain('No goals or achievements found.');
    expect(achievementsSrc).toMatch(/initialLoadDone \? \(/);
  });

  it('removes the standalone Daily Check-in section (single check-in surface)', () => {
    expect(achievementsSrc).not.toContain('Daily goal check-in');
    expect(achievementsSrc).not.toContain('personalGoalsSynced');
    expect(achievementsSrc).not.toContain('personalTrackItems');
    // The only check-in UI now lives inside the Detail Workspace.
    expect(achievementsSrc).toContain('data-testid="detail-checkin"');
  });

  it('keeps both creation actions available (create goal / create achievement tabs)', () => {
    expect(achievementsSrc).toContain('addPersonalGoalFromTab');
    expect(achievementsSrc).toContain('addPersonalAchievementFromTab');
    expect(achievementsSrc).toContain('setShowCreateModal(true)');
  });
});

describe('Tracking-method system: units, question, confirmation (this task)', () => {
  it('asks the approved tracking question (never inferred from title)', () => {
    expect(achievementsSrc).toContain('How would you like to track your progress?');
  });

  it('offers a Duration unit dropdown (Minutes / Hours / Days)', () => {
    expect(achievementsSrc).toContain('id="pg-duration-unit"');
    expect(achievementsSrc).toContain('DURATION_UNITS.map');
  });

  it('offers an Amount unit dropdown with a Custom text field', () => {
    expect(achievementsSrc).toContain('id="pg-amount-unit"');
    expect(achievementsSrc).toContain('AMOUNT_UNITS.map');
    expect(achievementsSrc).toContain('id="pg-custom-unit"');
    expect(achievementsSrc).toMatch(/goalAmountCustom/);
  });

  it('shows tracking-specific fields only for the selected method', () => {
    // Numeric target/unit fields are gated behind non-manual tracking.
    expect(achievementsSrc).toMatch(/goalTrackingType !== 'manual_milestone' \?/);
    expect(achievementsSrc).toMatch(/goalTrackingType === 'duration' \?/);
    expect(achievementsSrc).toMatch(/goalTrackingType === 'amount' \?/);
  });

  it('confirms a tracking-method change on edit when check-ins exist', () => {
    expect(achievementsSrc).toContain('requiresTrackingChangeConfirmation(editingGoalOriginalTracking, goalTrackingType, editingGoalHasCheckIns)');
    expect(achievementsSrc).toMatch(/requiresTrackingChangeConfirmation\(\s*editingAchievementOriginalTracking/);
    expect(achievementsSrc).toMatch(/window\.confirm\('Changing the tracking method/);
  });

  it('strongly encourages a note on manual-milestone check-ins', () => {
    expect(achievementsSrc).toMatch(/note is strongly encouraged/i);
  });

  it('does not infer tracking method from the title text', () => {
    // No title-substring inference in the create handlers.
    expect(achievementsSrc).not.toMatch(/title.*\.includes\(.*(gym|run|read|save|meditat)/i);
  });
});

describe('Goal & Achievement detail modal + check-in history (this task)', () => {
  it('opens the detail modal from a goal card and an achievement card', () => {
    expect(achievementsSrc).toContain('onClick={() => openGoalDetail(raw)}');
    expect(achievementsSrc).toContain('onClick={() => openAchievementDetail(achievement)}');
    expect(achievementsSrc).toContain('const openGoalDetail =');
    expect(achievementsSrc).toContain('const openAchievementDetail =');
  });

  it('renders a detail modal built from the shared view-model', () => {
    expect(achievementsSrc).toContain('data-testid="detail-modal"');
    expect(achievementsSrc).toContain('buildGoalDetail(');
    expect(achievementsSrc).toContain('buildAchievementDetail(');
  });

  it('shows reward, completion, and additional-info sections', () => {
    expect(achievementsSrc).toContain('data-testid="detail-reward"');
    expect(achievementsSrc).toContain('data-testid="detail-completed-badge"');
    expect(achievementsSrc).toContain('data-testid="detail-additional"');
    expect(achievementsSrc).toContain('{view.rewardPoints} Points');
  });

  it('shows check-in history fetched from the backend with an empty state', () => {
    expect(achievementsSrc).toContain('data-testid="detail-history"');
    expect(achievementsSrc).toContain('No check-ins yet.');
    expect(achievementsSrc).toContain('api.goals.listCheckIns(detailItem.id)');
    expect(achievementsSrc).toContain('api.customAchievements.listCheckIns(detailItem.id)');
    expect(achievementsSrc).toContain('normalizeHistory(rows, detailItem.itemType)');
  });

  it('refetches history immediately after a check-in (no page refresh)', () => {
    expect(achievementsSrc).toMatch(/setDetailRefreshKey\(\(k\) => k \+ 1\)/);
    expect(achievementsSrc).toMatch(/\[detailItem, customAchievementIds, detailRefreshKey\]/);
  });

  it('protects the modal: no outside-click dismissal; Escape + Close only', () => {
    // The detail overlay has no onClick handler (outside click cannot dismiss).
    expect(achievementsSrc).toContain('/* Phase 5: outside-click / focus-loss must NOT dismiss. */');
    expect(achievementsSrc).toContain('data-testid="detail-close"');
    expect(achievementsSrc).toMatch(/if \(e\.key === 'Escape'\) setDetailItem\(null\)/);
  });
});

describe('Detail Workspace: in-modal Edit + Today\'s Check-In (this task)', () => {
  it('provides an Edit control inside the workspace that reuses the existing edit form', () => {
    expect(achievementsSrc).toContain('data-testid="detail-edit"');
    expect(achievementsSrc).toMatch(/openEditGoal\(goalRaw as Record<string, unknown>\)/);
    expect(achievementsSrc).toContain('openEditAchievement(ach)');
  });

  it('closes the workspace before opening the reused edit form (no stacked modals)', () => {
    expect(achievementsSrc).toMatch(/setDetailItem\(null\);\s*\n\s*if \(isGoal && goalRaw\) openEditGoal/);
  });

  it('renders Today\'s Check-In inside the workspace, gated to check-inable items', () => {
    expect(achievementsSrc).toContain('data-testid="detail-checkin"');
    expect(achievementsSrc).toContain("Today's Check-In");
    expect(achievementsSrc).toContain('const renderTodayCheckIn =');
    expect(achievementsSrc).toMatch(/view\.checkInable\s*\?\s*renderTodayCheckIn/);
  });

  it('reuses the existing tracking-aware field + validation + submit handler', () => {
    // All four tracking methods are handled by the SAME reused field renderer.
    expect(achievementsSrc).toMatch(/renderTodayCheckIn = \(item: Achievement\) => \{/);
    expect(achievementsSrc).toContain('renderCheckInValueField(item, inputState, patchFields, checkedToday)');
    expect(achievementsSrc).toContain('handleDailyGoalCheckIn(item.id)');
    expect(achievementsSrc).toContain('checkInInputReady(item, inputState)');
  });

  it('resolves the check-in source from goals + every custom achievement', () => {
    expect(achievementsSrc).toContain('const allTrackItems');
    expect(achievementsSrc).toContain('allTrackItems.find((a) => a.id === itemId)');
  });

  it('updates progress, reward, points, level, and history live after a check-in', () => {
    // The handler reloads the backend sources of truth + refetches history.
    expect(achievementsSrc).toMatch(/Promise\.all\(\[reloadGoals\(\), reloadCustomAchievements\(\), reloadPoints\(\)\]\)/);
    expect(achievementsSrc).toMatch(/setDetailRefreshKey\(\(k\) => k \+ 1\)/);
  });
});
