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
    expect(achievementsSrc).toContain("'Update Personal Goal'");
    expect(achievementsSrc).toContain("'Save Personal Goal'");
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
    // The detail Edit control defers to openEditAchievement via the transition.
    expect(achievementsSrc).toContain('openEditAchievement(a)');
    expect(achievementsSrc).toContain('const openEditAchievement =');
    expect(achievementsSrc).toContain("setActiveAddTab('personal_achievements')");
  });

  it('editing updates the SAME achievement id via the existing update method (not create)', () => {
    expect(achievementsSrc).toMatch(/if \(editingAchievementId\)\s*\{[\s\S]*api\.customAchievements\.update\(editingAchievementId/);
    expect(achievementsSrc).toContain("'Update Personal Achievement'");
    expect(achievementsSrc).toContain("'Save Personal Achievement'");
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
    expect(achievementsSrc).toContain('renderGoalCard(item.data, index)');
    expect(achievementsSrc).toContain('renderAchievementCard(item.data, index)');
  });

  it('uses stable collision-proof keys per item type', () => {
    expect(achievementsSrc).toContain('key={`goal:${g.id}`}');
    expect(achievementsSrc).toContain('key={`achievement:${achievement.id}`}');
  });

  it('shows a filter-specific empty state, gated by a successful (ready) load', () => {
    expect(achievementsSrc).toContain('data-testid="gamification-empty-state"');
    expect(achievementsSrc).toContain('combinedEmptyMessage');
    expect(achievementsSrc).toContain('No personal goals yet.');
    expect(achievementsSrc).toContain('No achievements found.');
    expect(achievementsSrc).toContain('No goals or achievements found.');
    // Empty state is only reachable in the ready branch (not loading, not error).
    expect(achievementsSrc).toContain("useState<'loading' | 'ready' | 'error'>('loading')");
    expect(achievementsSrc).not.toContain('initialLoadDone');
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
    // The Edit control defers to the existing openEditGoal / openEditAchievement.
    expect(achievementsSrc).toContain('() => openEditGoal(raw)');
    expect(achievementsSrc).toContain('() => openEditAchievement(a)');
  });

  it('routes the Edit control through the deferred transition (no stacked modals)', () => {
    expect(achievementsSrc).toContain('startEditFromDetail(');
    // setDetailItem(null) inside the transition triggers the close animation.
    expect(achievementsSrc).toMatch(/setEditTransition\('closing-detail-for-edit'\);\s*\n\s*setDetailItem\(null\)/);
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

describe('Loading / empty / error states (this task)', () => {
  it('models a distinct loading → ready/error lifecycle for personal data', () => {
    expect(achievementsSrc).toContain("const [loadStatus, setLoadStatus] = useState<'loading' | 'ready' | 'error'>('loading')");
    expect(achievementsSrc).toContain('const loadPersonalData');
  });

  it('loads goals and custom achievements in parallel, decoupled from points', () => {
    // Personal data uses its own Promise.all; points is fetched separately.
    expect(achievementsSrc).toMatch(/Promise\.all\(\[\s*api\.goals\.list\(\),\s*api\.customAchievements\.list\(\),?\s*\]\)/);
    expect(achievementsSrc).toMatch(/void loadPersonalData\(\);\s*\n\s*void reloadPoints\(\);/);
  });

  it('guards against a duplicate initial load (incl. StrictMode double effect)', () => {
    expect(achievementsSrc).toContain('initialLoadStartedRef');
    expect(achievementsSrc).toMatch(/if \(initialLoadStartedRef\.current\) return;/);
  });

  it('shows a loading indicator with accessible text while loading', () => {
    expect(achievementsSrc).toContain('data-testid="gamification-loading"');
    expect(achievementsSrc).toContain('Loading your goals and achievements…');
    expect(achievementsSrc).toContain('data-testid="gamification-skeleton"');
    expect(achievementsSrc).toMatch(/role="status" aria-live="polite"/);
  });

  it('never shows the empty state while loading (loading branch precedes it)', () => {
    // The empty state lives in the else branch, after loading + error are handled.
    expect(achievementsSrc).toMatch(/loadStatus === 'loading' && combinedItems\.length === 0 \?/);
  });

  it('shows an error state with a Retry that re-runs loadPersonalData', () => {
    expect(achievementsSrc).toContain('data-testid="gamification-error-state"');
    expect(achievementsSrc).toContain('data-testid="gamification-retry"');
    expect(achievementsSrc).toMatch(/onClick=\{\(\) => void loadPersonalData\(\)\}/);
  });

  it('adds dev-only timing instrumentation, not noisy production logging', () => {
    expect(achievementsSrc).toContain('import.meta.env.DEV');
    expect(achievementsSrc).toMatch(/console\.debug\(`\[Achievements\] personal data loaded/);
  });
});

describe('Detail → Edit transition (this task)', () => {
  it('models an explicit idle / closing-detail-for-edit / editing transition', () => {
    expect(achievementsSrc).toContain("useState<'idle' | 'closing-detail-for-edit' | 'editing'>('idle')");
  });

  it('preserves the selected item and defers opening the edit form', () => {
    expect(achievementsSrc).toContain('const startEditFromDetail');
    expect(achievementsSrc).toContain('pendingEditRef.current = openEdit');
    expect(achievementsSrc).toMatch(/setEditTransition\('closing-detail-for-edit'\)/);
  });

  it('opens the edit modal only after the detail close animation completes', () => {
    expect(achievementsSrc).toContain('AnimatePresence onExitComplete={handleDetailExitComplete}');
    expect(achievementsSrc).toContain('const handleDetailExitComplete');
    expect(achievementsSrc).toMatch(/editTransition === 'closing-detail-for-edit' && pendingEditRef\.current/);
    expect(achievementsSrc).toMatch(/setEditTransition\('editing'\)/);
    // The detail overlay must have an exit animation for onExitComplete to fire.
    expect(achievementsSrc).toContain('exit={{ opacity: 0 }}');
  });

  it('prevents repeated Edit clicks during the transition', () => {
    expect(achievementsSrc).toMatch(/if \(editTransition !== 'idle'\) return;/);
    expect(achievementsSrc).toContain("disabled={editTransition !== 'idle'}");
  });

  it('resets the transition to idle when the edit modal closes', () => {
    expect(achievementsSrc).toMatch(/setEditTransition\('idle'\)/);
  });
});

describe('Update submission pending state (this task)', () => {
  it('uses SEPARATE scoped pending flags for goal and achievement paths', () => {
    expect(achievementsSrc).toContain('const [goalSubmitting, setGoalSubmitting]');
    expect(achievementsSrc).toContain('const [achievementSubmitting, setAchievementSubmitting]');
  });

  it('prevents duplicate submissions on both paths', () => {
    expect(achievementsSrc).toMatch(/if \(goalSubmitting\) return;/);
    expect(achievementsSrc).toMatch(/if \(achievementSubmitting\) return;/);
  });

  it('resets pending through a finally path so it cannot get stuck', () => {
    expect(achievementsSrc).toMatch(/finally \{[\s\S]*setGoalSubmitting\(false\)/);
    expect(achievementsSrc).toMatch(/finally \{[\s\S]*setAchievementSubmitting\(false\)/);
  });

  it('shows Updating… + spinner + aria-busy and disables the buttons', () => {
    expect(achievementsSrc).toContain("'Updating…'");
    expect(achievementsSrc).toContain('data-testid="goal-submit-button"');
    expect(achievementsSrc).toContain('data-testid="achievement-submit-button"');
    expect(achievementsSrc).toContain('aria-busy={goalSubmitting}');
    expect(achievementsSrc).toContain('aria-busy={achievementSubmitting}');
    expect(achievementsSrc).toMatch(/disabled=\{goalSubmitting\}/);
    expect(achievementsSrc).toMatch(/disabled=\{achievementSubmitting\}/);
  });

  it('surfaces the real error message and keeps the form open on failure', () => {
    // Real message from the thrown Error; no early return before finally.
    expect(achievementsSrc).toMatch(/error instanceof Error && error\.message/);
  });

  it('shows a success toast and refreshes data on success', () => {
    expect(achievementsSrc).toContain("toast.success(wasEditing ? 'Personal goal updated.'");
    expect(achievementsSrc).toContain("toast.success(wasEditing ? 'Personal achievement updated.'");
  });

  it('disables conflicting modal actions (Close) while a submit is in flight', () => {
    expect(achievementsSrc).toContain('disabled={goalSubmitting || achievementSubmitting}');
  });
});

describe('Modal focus management (accessibility, this task)', () => {
  it('moves focus into the detail workspace and the edit modal when they open', () => {
    expect(achievementsSrc).toContain('detailPanelRef');
    expect(achievementsSrc).toContain('createPanelRef');
    expect(achievementsSrc).toMatch(/if \(detailItem\) detailPanelRef\.current\?\.focus\(\)/);
    expect(achievementsSrc).toMatch(/if \(showCreateModal\) createPanelRef\.current\?\.focus\(\)/);
  });
});

describe('Goal cards match Achievement cards (this task)', () => {
  it('renders a goal icon through the SAME shared iconMap helper', () => {
    expect(achievementsSrc).toMatch(/const renderGoalCard[\s\S]{0,400}getIcon\(display\.icon\)/);
    expect(achievementsSrc).toContain('const display = goalRowToDisplay(raw)');
    // One shared map/helper only — no second icon mapping was introduced.
    expect(achievementsSrc.match(/const iconMap/g) ?? []).toHaveLength(1);
    expect(achievementsSrc.match(/const getIcon =/g) ?? []).toHaveLength(1);
  });

  it('uses the same emblem + card style tokens as the achievement card', () => {
    const goalBlock = achievementsSrc.slice(
      achievementsSrc.indexOf('const renderGoalCard'),
      achievementsSrc.indexOf('const renderAchievementCard')
    );
    for (const token of [
      'achievementsBadgeCard',
      'achievementsBadgeEmblemUnlocked',
      'achievementsBadgeEmblemLocked',
      'achievementsBadgeIconUnlocked',
      'h-[4.5rem] w-[4.5rem]',
      'flex flex-1 flex-col items-center gap-3 p-5 text-center',
    ]) {
      expect(goalBlock).toContain(token);
    }
  });

  it('keeps the card clickable via a real button (not a clickable div)', () => {
    const goalBlock = achievementsSrc.slice(
      achievementsSrc.indexOf('const renderGoalCard'),
      achievementsSrc.indexOf('const renderAchievementCard')
    );
    expect(goalBlock).toContain('onClick={() => openGoalDetail(raw)}');
    expect(goalBlock).toContain('data-testid="goal-card"');
    expect(goalBlock).not.toContain('role="button"');
  });
});

describe('Progress Report entry point (this task)', () => {
  it('links to the Progress Report route from the page header', () => {
    expect(achievementsSrc).toContain('data-testid="view-progress-report-link"');
    expect(achievementsSrc).toContain('/app/settings/achievements/progress-report');
    expect(achievementsSrc).toContain('View Progress Report');
  });

  it('keeps the existing creation action visible alongside it', () => {
    expect(achievementsSrc).toContain('Add personal milestone');
    expect(achievementsSrc).toMatch(/setShowCreateModal\(true\)/);
  });
});

describe('Tracking configuration lock after completion (this task)', () => {
  it('derives the lock from completed + rewarded state for both item types', () => {
    expect(achievementsSrc).toContain('const [editingGoalLocked, setEditingGoalLocked]');
    expect(achievementsSrc).toContain('const [editingAchievementLocked, setEditingAchievementLocked]');
    expect(achievementsSrc).toContain("String(raw.status) === 'completed' && Boolean(raw.reward_awarded)");
    expect(achievementsSrc).toContain('Boolean(a.unlocked) && Boolean(a.rewardAwarded)');
  });

  it('disables every tracking control on a locked GOAL form', () => {
    expect(achievementsSrc).toMatch(/id="pg-tracking"[\s\S]{0,200}disabled=\{editingGoalLocked\}/);
    expect(achievementsSrc).toMatch(/id="pg-target-value"[\s\S]{0,300}disabled=\{editingGoalLocked\}/);
    expect(achievementsSrc).toMatch(/id="pg-duration-unit"[\s\S]{0,200}disabled=\{editingGoalLocked\}/);
    expect(achievementsSrc).toMatch(/id="pg-amount-unit"[\s\S]{0,200}disabled=\{editingGoalLocked\}/);
    expect(achievementsSrc).toMatch(/id="pg-custom-unit"[\s\S]{0,300}disabled=\{editingGoalLocked\}/);
  });

  it('disables every tracking control on a locked ACHIEVEMENT form', () => {
    expect(achievementsSrc).toMatch(/id="pa-tracking"[\s\S]{0,200}disabled=\{editingAchievementLocked\}/);
    expect(achievementsSrc).toMatch(/id="pa-duration-unit"[\s\S]{0,200}disabled=\{editingAchievementLocked\}/);
    expect(achievementsSrc).toMatch(/id="pa-amount-unit"[\s\S]{0,200}disabled=\{editingAchievementLocked\}/);
    expect(achievementsSrc).toMatch(/id="pa-custom-unit"[\s\S]{0,300}disabled=\{editingAchievementLocked\}/);
    // The achievement target input is disabled too.
    expect(achievementsSrc).toMatch(/setAchTargetValue\(e\.target\.value\)[\s\S]{0,200}disabled=\{editingAchievementLocked\}/);
  });

  it('shows the informational notice only when locked, using the design system', () => {
    expect(achievementsSrc).toContain('data-testid="goal-tracking-locked-notice"');
    expect(achievementsSrc).toContain('data-testid="achievement-tracking-locked-notice"');
    expect(achievementsSrc).toContain('Tracking is locked because this item has already been completed and rewarded.');
    expect(achievementsSrc).toContain('modalInsetPanel');
    // Notices are gated on the lock flags (not shown for incomplete items).
    expect(achievementsSrc).toMatch(/editingGoalLocked \? \(/);
    expect(achievementsSrc).toMatch(/editingAchievementLocked \? \(/);
  });

  it('omits tracking fields from the update payloads when locked', () => {
    expect(achievementsSrc).toContain('tracking_type: editingGoalLocked ? undefined : goalTrackingType');
    expect(achievementsSrc).toMatch(/target_value: editingGoalLocked \? undefined/);
    expect(achievementsSrc).toMatch(/tracking_unit: editingGoalLocked \? undefined/);
    expect(achievementsSrc).toMatch(/editingAchievementLocked\s*\?\s*\{\}/);
  });

  it('skips tracking validation + change-confirmation when locked', () => {
    expect(achievementsSrc).toMatch(/!editingGoalLocked && isNumeric && !\(targetValue > 0\)/);
    expect(achievementsSrc).toMatch(/editingGoalId &&\s*\n\s*!editingGoalLocked &&/);
    expect(achievementsSrc).toMatch(/!editingAchievementLocked && isNumeric && !\(target > 0\)/);
  });
});
