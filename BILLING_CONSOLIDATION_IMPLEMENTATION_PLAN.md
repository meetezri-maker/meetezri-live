# Billing Service Consolidation — Validated Implementation Plan (v4, finalized)

**Status: Planning only.** No application code, schema, migration, import, service, or test file has been changed to produce this revision. No production data was modified. This document is the only artifact written.

**Supersedes:** v3 (2026-07-23, pre-preflight), and the first v4 draft (2026-07-23, post-preflight).
**Inputs:** the v3 plan, `BILLING_PHASE1_PREFLIGHT_REPORT.md`, the first v4 draft, the four Gate-1 approval conditions, and further read-only repository/database analysis performed for this finalization (which found a fifth trial writer, sized the trial invariant violation exactly, and resolved the admin-override and self-heal semantics from repository evidence — see §2, §8A, §10, §4A).

**This revision incorporates the four Gate-1 approval conditions** (see the "Gate-1 incorporations" changelog at the end for a section-by-section map):
1. The allowance/entitlement ledger is now a **hard Stripe live-mode release blocker**, not a future suggestion (§0, §6, §14 D5b, §16, §17, Open Decisions).
2. `/users/me` self-heal now has an **exact eligibility rule** and an explicit correctness hierarchy, plus a defined fix to the `handleSubscriptionDeleted` trigger defect (§10).
3. Duplicate trial-row prevention is a **distinct invariant with its own in-scope workstream** — not informational (§8A, §2, §12, §17).
4. Admin plan-override credit semantics are **defined, with a recommendation and separation of state-mutation from balance-mutation** (§4A, §14 D10).

**Confirmed environment context (treated as resolved fact throughout, not as open questions):**
- The connected Supabase project **is the production database**.
- **Stripe test mode is intentional** — the product is in alpha.
- The subscription records belong to **real alpha users**; they are not disposable staging data.
- Stripe moves to **live mode after alpha**.
- Historical duplicates and over-granted credits must therefore be handled **conservatively**.

**Hard release blocker (stated once here, enforced throughout):**

> **Stripe live mode must not be enabled until the dedicated allowance/entitlement ledger (§6 Option C) is implemented, migrated, tested, and verified.** This is a formal release gate (§17 Gate 9), not a recommendation. The confirmed historical over-crediting (§7, §8) and the fact that the renewal grant path has never executed in production (§13) mean idempotent, auditable entitlement records are a precondition for handling real money — see §6 and §16.

---

## 0. Executive Summary

v3 was right that the billing surface needs consolidating, and right to gate the schema change behind a read-only preflight. That gate did its job. What it revealed is that **service duplication was the smallest of the problems in this area.**

v3's model was: one canonical service, two functions to migrate, three call sites, and a unique constraint that would almost certainly apply cleanly. Phase 1 falsified the last part and this revision's repository analysis falsified the scale of the first three. The actual situation:

- **13 production writers** touch `subscriptions` or the credit balance, not the 3 v3 enumerated (§2).
- **Seven separate implementations** of "grant plan minutes" exist — **five automated stacking** and two *overwriting* — not the three Phase 1 identified, nor the five this revision originally counted (§4). The fifth stacking implementation (**A4b**, inlined in `handleSubscriptionUpdated`) was found only during Step 4 verification; see §4.1 for why every earlier sweep missed it.
- The **canonical** `linkSubscriptionToUser()` does not read `session.subscription` at all; it delegates to a customer-wide reconciliation. The behaviour v3 §7 assumed it was preserving does not exist and must be built (§3).
- **12 duplicated `stripe_sub_id` values across 30 rows and 9 real alpha users** block the constraint, and those duplicates **caused confirmed duplicate credit grants** (§7, §8).

v4 keeps the work in four categories so each can be approved, sequenced, and rolled back independently. The finalization **promotes duplicate-trial-row work out of "adjacent" (D) and into the in-scope cleanup+prevention categories (A/B)**, per Gate-1 condition 3:

| Category | What it covers | Sections |
|---|---|---|
| **A. Defect prevention** (code, forward-looking) | Unsafe concurrent writers; five allowance implementations; incorrect customer-wide subscription selection during checkout linking; non-atomic row+grant writes; **the trial-row check-then-write race** | §3, §4, §5, §8A, §10 |
| **B. Historical data cleanup** (data, backward-looking) | The 12 duplicated `stripe_sub_id` IDs / 30 rows / 18 surplus / 9 users; **the 53 surplus active trial rows / 31 users**; the credit over-grants the first set produced | §8, §8A |
| **C. Service consolidation** (the original v3 scope) | Legacy → canonical redirection, thin wrapper, debug script | §1, §2, §11 |
| **D. Adjacent billing integrity** (explicitly *not* absorbed) | Stale `active` rows, admin-created paid rows with no Stripe ID, Stripe↔local drift, webhook never having run, admin-override credit semantics | §14, §4A |

Four things this finalization settles, each from repository evidence rather than assumption:

- **Trial invariant (§8A):** all 53 surplus trial rows are `active` (only 1 canceled trial exists), so the violated rule is exactly *"at most one active trial row per user."* 21 users legitimately hold an active trial **and** an active paid row, so the enforcing index must be scoped to trials only. This is now an in-scope invariant with its own dry-run, survivor rule, archive, and gate.
- **Self-heal eligibility (§10):** the trigger is redefined from "plan reads trial and a Stripe customer exists" to "local billing state is genuinely incomplete." `handleSubscriptionDeleted` writing `plan_type:'trial'` is the direct cause of the permanent-resync loop and is redundant with existing read-time fallback (`getSubscription`, `subscription.service.ts:62-66`) — the fix is to stop writing it.
- **Admin override (§4A):** recommend **Policy D — explicit admin choice, defaulting to plan-only** — and separate subscription-state mutation from credit-balance mutation, routing any admin credit change through a **separate audited adjustment function**, not the shared stacking helper.
- **Live-mode ledger (§6):** the deferral is now a hard blocker, with defined idempotency-key dimensions.

**The single most important structural change from v3** is that the unique constraint and the historical cleanup are now designed to land **inside one transaction** (§9). PostgreSQL DDL is transactional, and this table is 296 kB, so `BEGIN; archive; delete surplus; ADD CONSTRAINT; COMMIT;` executes in milliseconds and leaves **no window** in which cleaned data sits unprotected while the still-live defect could re-duplicate it. This removes the need for a maintenance window, a temporary partial index, or a writer freeze, all of which v3's ordering would have required once the data turned out to be dirty.

**What has not changed:** the canonical service choice (§1), the thin-wrapper rollback strategy (§11), the `DbClient`-style transaction-client pattern (§4), and the NULL-semantics reasoning behind the unique constraint (§7). All four were re-verified against the repository for this revision and all four hold.

---

## 1. Canonical Service — Confirmed, With One Correction

**`apps/api/src/modules/billing/services/subscription.service.ts` remains the canonical billing implementation.**

The Phase 1 report surfaced a real problem with this file — its `linkSubscriptionToUser()` is behaviourally *worse* than the legacy one for checkout linking (§3). That is a reason to rebuild one function, not to move the canonical designation. The evidence for the choice, re-verified for v4:

- **It already owns the entire billing route surface.** `billing/index.ts:1-14` re-exports every public billing function from this file, and `billing.controller.ts` imports exclusively from `./index`. Every route in `billing.routes.ts` already runs on it. Moving canonical status to `billing.service.ts` would mean redirecting *all* routes rather than three call sites — strictly more risk.
- **It is the only implementation with correct Stripe-integrated cancellation** (`subscription.service.ts:283-318`, sets `cancel_at_period_end: true` via `stripe.subscriptions.update` at :298). The legacy `cancelSubscription` (`billing.service.ts:403-420`) never contacts Stripe — it flips a local row to `canceled` and returns. It has zero production callers, so this is not a live bug, but it disqualifies the legacy file as a target without a rewrite.
- **Sibling services already depend on it**: `payg.service.ts:6`, `admin-billing-overview.service.ts:1`.
- **It owns the module's caching layer** — `userSubscriptionCache` (:15), `userBillingHistoryCache` (:19), `clearUserBillingCaches` (:23).
- **It is the only file that calls the shared allowance helper** (`subscription.service.ts:494`). Every other grant path uses a private copy (§4).
- Its `getAllSubscriptions` caps page size at `Math.min(limit, 500)` (:352) versus the legacy `Math.min(limit, 100)` (`billing.service.ts:523`) — a deliberate, more capable implementation.

**Why the broken `linkSubscriptionToUser()` does not overturn this:** the defect is confined to one 15-line function that delegates where it should have resolved. Every *other* dimension favours the canonical file, and §3 rebuilds that function properly. Choosing the legacy file instead would trade one broken function for a broken cancellation path, a lower pagination cap, no cache ownership, a private allowance copy, and a full route migration. The correction is to the function, not the designation.

---

## 2. Complete Writer Map

v3 listed three call sites. That was the *import-migration* scope, and as that it was accurate. It was not a map of everything that writes subscription state, and the duplicate incident is a concurrency problem, so the full map is required. **This section is new in v4.** Items marked 🆕 were not identified in the Phase 1 report either.

### 2.1 Writers that create or modify `subscriptions` rows

| # | Writer | Location | Current behaviour | Risk | Target behaviour | Disposition |
|---|---|---|---|---|---|---|
| **W1** 🆕 | Trial creation on signup | `user.service.ts:886-901` | `findFirst({user_id, plan_type:'trial'})` then `create` if absent. No transaction, no constraint. | **Medium.** Racy by the same check-then-write shape. Has produced **53 surplus active trial rows across 31 users** (verified). Not blocked by the `stripe_sub_id` constraint — these rows are NULL. | Converge on the single-trial deterministic upsert helper (§8A.4); protected by the partial unique index (§8A.3). | **Fixed in-scope** (§8A). |
| **W2** | Legacy `linkSubscriptionToUser` | `billing.service.ts:306-350` | Correctly retrieves `session.subscription` and resolves plan from it. Then `findFirst` → early-return-or-`create`, then private allowance grant (:349). Non-atomic. | **High.** Live on the checkout-return path via `user.controller.ts:347`. One of the confirmed duplicate producers. | Deleted; call site redirected to canonical. | **Removed** (thin wrapper, §11). |
| **W3** | Canonical `linkSubscriptionToUser` | `subscription.service.ts:210-225` | Retrieves the Checkout Session, writes `stripe_customer_id`, then delegates wholesale to `syncSubscriptionWithStripe`. **Never reads `session.subscription`.** | **High.** Resolves the plan from a customer-wide list — the behaviour §12's tests forbid. Produces wrong-plan rows when a customer has leftovers. | Rebuilt per §3. | **Rebuilt.** |
| **W4** | Canonical `syncSubscriptionWithStripe` | `subscription.service.ts:393-498` | `stripe.subscriptions.list({customer, status:'all', limit:5})` → first match in `['active','trialing','incomplete','past_due']` → `findFirst` by `stripe_sub_id` → update / update-pending / `create` (:468/:473/:478) → shared allowance grant (:494). Non-atomic. | **High.** The confirmed source of the mixed-plan duplicate groups. | Stays as customer-wide *reconciliation only*; made atomic; no longer reachable from checkout linking. | **Remains, narrowed** (§3, §5). |
| **W4b** | Legacy `syncSubscriptionWithStripe` | `billing.service.ts:716-820` | Same shape as W4 (`create`/`update` at :791/:796/:801) with a private allowance grant at :815. | **High.** Reached from both `/users/me` self-heal paths. | Deleted. | **Removed** (thin wrapper, §11). |
| **W5** | `/users/me` cache-hit self-heal | `user.service.ts:1014-1020` | When cached plan reads `trial` **and** `stripe_customer_id` is set, calls W4b then deletes the profile cache entry. | **High.** Concurrency amplifier — see §10. | Per §10 recommendation. | **Guarded + redirected.** |
| **W6** | `/users/me` cold-load self-heal | `user.service.ts:1111-1120` | Same trigger on the DB-load path; calls W4b then re-reads the subscription. | **High.** Same amplifier. | Per §10 recommendation. | **Guarded + redirected.** |
| **W7** | Webhook `checkout.session.completed` | `billing.webhook.ts:354-437` | `findFirst` by `stripe_sub_id` → update / update-pending / `create` (:391/:403/:416) → private allowance grant (:436). Non-atomic. Guarded per-event by `stripe_webhook_events`. | **High** once webhooks are actually delivered. **Has never run** — the ledger table is empty (§13). | Consolidated onto the shared helper; made atomic. | **Remains, consolidated.** |
| **W8** ✏️ | Webhook `customer.subscription.updated` | `billing.webhook.ts:440-505` | `findFirst` by `stripe_sub_id` → `update` only. Never creates. **CORRECTED: it DOES grant** — on the `planChanged` branch it stacks the full new-plan allowance inline (implementation A4b, §4.1). The original "No grant" entry was wrong. | **Low** for row duplication (update-only). **Medium** for entitlement: the grant is non-atomic with the row update and repeats for every distinct event that flips the plan. | Grant consolidated onto the shared helper (Step 4b); made atomic in §5. | **Remains, consolidated.** |
| **W9** | Webhook `customer.subscription.deleted` | `billing.webhook.ts:507-521` | `findFirst` → `update` to `status:'canceled'`, **`plan_type:'trial'`**. | **Medium.** Setting `plan_type` to `trial` while `stripe_customer_id` remains set makes every canceled subscriber permanently satisfy the old self-heal trigger — see §10. | **Stop writing `plan_type:'trial'`** on cancel; retain the real plan and rely on `status='canceled'` (redundant with read-time fallback at `subscription.service.ts:62-66`). | **Fixed in-scope** (§10.3). |
| **W10** | Webhook `invoice.payment_succeeded` | `billing.webhook.ts:523-580` | Skips `subscription_create`; on `subscription_cycle` updates dates then **inlines** an allowance stack (:563-578). | **Medium.** Renewal grants are idempotent only via the per-event webhook ledger. | Consolidated onto the shared helper. | **Remains, consolidated.** |
| **W11** 🆕 | Admin plan override | `admin.service.ts:1132-1179` | `findFirst` active → `update` else `create` (:1150/:1160), setting `end_date: null` for paid plans; then **overwrites** `profiles.credits`/`credits_seconds` to the plan allowance (:1172-1179). | **Medium.** Creates paid rows with **no `stripe_sub_id`**, and is the only path that *replaces* rather than stacks credits. | Unchanged in this migration. | **Remains.** See §14 (D2). |
| **W12** | `createCheckoutSession` pending row | `subscription.service.ts:143` | Creates the `incomplete` placeholder with NULL `stripe_sub_id` that `pendingCandidate` later claims. | **Low.** NULL id, exempt from the constraint. | Unchanged. | **Remains.** |
| **W13** | `createSubscription` (canonical / legacy) | `subscription.service.ts:88-111`, `billing.service.ts:115-190` | Update-or-create paths for manual/admin creation. | **Low.** Not on the checkout path. | Legacy copy removed with the wrapper. | **Remains / removed.** |
| **W14** 🆕 | `createCheckoutSession` **trial branch** | `subscription.service.ts:79-133` | On `plan_type:'trial'`, `findFirst({user_id})` (**any** row, no plan/status filter) → `update` to trial else `create`, then **overwrites** `profiles.credits`/`credits_seconds` to the trial allowance. Reached from `POST /billing` via `createSubscriptionHandler`. | **Medium.** A second racy trial writer, and it can flip *any* row (including a paid one) to trial. Overwrites credits (a sixth grant behaviour, resetting not stacking). One of the trial-duplication sources. | Converge on the single-trial deterministic upsert helper (§8A.4); credit reset routed through the audited path per §4A. | **Fixed in-scope** (§8A). |

### 2.2 Evidence this map is complete

`grep -rn "subscriptions\.(create|update|upsert|updateMany|createMany|delete|deleteMany)"` across `apps/api/src` returns exactly the locations above plus test doubles in `billing.webhook.test.ts`. No other module writes the table. **This finalization added W14**, a trial writer the first v4 draft missed — bringing the total to **14 writers**. (The synthetic "default trial" objects returned by `billing.controller.ts:41,211` when no subscription exists are **response shaping, not DB writes** — verified — and are excluded.)

### 2.3 What this changes about the v3 scope table

v3 §2's three-row table remains **correct as the import-migration scope** — those are still the only three production imports of `billing.service.ts`, re-verified (`user.controller.ts:4,347`; `user.service.ts:6,1016,1113`). What v4 adds is that fixing those three imports does not by itself fix the concurrency defect, because W1, W7, W10, W11 and W14 are unsafe writers that no import redirection touches.

### 2.4 The two invariant families, and which writers each

Two distinct duplication defects share one root shape (check-then-write, no constraint):

- **Non-null `stripe_sub_id` duplication** — produced by W2, W4, W4b via W5/W6. Fixed by the unique constraint (§7) + atomicity (§5) + the checkout rebuild (§3), cleaned by §8.
- **Active-trial duplication** — produced by W1 and W14. **Invisible to the `stripe_sub_id` constraint** (trial rows are NULL). Fixed by the partial unique index + single-trial upsert (§8A), cleaned by §8A. This is Gate-1 condition 3, now first-class.

---

## 3. Rebuilding Checkout-Specific Linking

### 3.1 The problem, precisely

```ts
// subscription.service.ts:210-225 — current canonical implementation
export async function linkSubscriptionToUser(userId: string, sessionId: string) {
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (!session.customer) return;
  await prisma.profiles.update({ where: { id: userId }, data: { stripe_customer_id: session.customer } });
  await syncSubscriptionWithStripe(userId);   // ← customer-wide list; ignores session.subscription
  clearUserBillingCaches(userId);
}
```

`session.subscription` is never read. The plan is resolved downstream by `stripe.subscriptions.list({ customer, status: 'all', limit: 5 })` (`:401-405`) taking the first entry matching `['active','trialing','incomplete','past_due']` (`:409-410`). For a customer with a leftover `incomplete` or an earlier subscription, that first match is **not necessarily the one this checkout just created** — which is exactly how duplicate groups 1–3 ended up containing conflicting `core`/`pro` plan types for a single Stripe subscription ID.

### 3.2 Intended responsibility of `linkSubscriptionToUser(userId, checkoutSessionId)`

The public function keeps its signature and becomes a thin entry point over a private helper that performs, in this order:

1. **Retrieve the exact Stripe Checkout Session** by the supplied `checkoutSessionId`.
2. **Validate the session/customer relationship** — the session must carry a `customer`; reject/return `missing_customer` otherwise. Persist `stripe_customer_id` on the profile only after this check.
3. **Read `session.subscription`.** If absent or unresolvable, return `missing_subscription` and write nothing — this is a one-time-payment or incomplete session, not a subscription link.
4. **Retrieve that exact Stripe subscription** by ID, with `expand: ['items.data.price']`. Never `subscriptions.list`.
5. **Determine the purchased plan from that subscription**, using this hierarchy — **amended in Step 5** to add level 3 and to state the exclusion explicitly:

   1. `items.data[0].price.id` matched against `STRIPE_PRICE_IDS.core` / `.pro`
   2. `subscription.metadata.planType`
   3. `session.metadata.planType`
   4. otherwise return `plan_unresolved` and write nothing

   Level 3 was added because `handleCheckoutSessionCompleted` already resolves the plan from `session.metadata.planType`; without it the two checkout paths could disagree on the plan for the same subscription. Only `core` and `pro` may resolve — a metadata value of `trial` is rejected, since accepting it would silently downgrade a paying user.

   **The local row's `plan_type` is explicitly NOT a fallback.** It is the state being synchronized, not an authoritative source; using it would let a wrong stored plan perpetuate itself, which is the class of defect this migration exists to remove.
6. **Create or reconcile the local subscription row**, inside a transaction (§5).
7. **Grant the allowance exactly once**, in that same transaction, through the single shared helper (§4).
8. **Invalidate caches** — `clearUserBillingCaches(userId)` and `invalidateUserProfileCache(userId)` — **after commit** (§5, §6).
9. **Return a meaningful result classification** (§15).

### 3.3 Structure

```
subscription.service.ts

  export linkSubscriptionToUser(userId, checkoutSessionId)
          ↓
  private linkSubscriptionFromCheckoutSession(userId, checkoutSessionId)
          ↓
  ── outside any transaction ──────────────────────────────
  1. stripe.checkout.sessions.retrieve(checkoutSessionId)
  2. validate session.customer
  3. read session.subscription                    → missing_subscription
  4. stripe.subscriptions.retrieve(thatId, {expand:['items.data.price']})
  5. resolve plan from that subscription's price  → plan_unresolved
  ── prisma.$transaction(async (tx) => { ─────────────────
  6. create-or-reconcile the row, keyed on stripe_sub_id
  7. grant allowance via the shared DbClient-aware helper
  ── }) commit ───────────────────────────────────────────
  8. clearUserBillingCaches + invalidateUserProfileCache   (after commit only)
  9. return { result, ... }
```

`getOrCreateStripeCustomer` in the same file is already a non-exported helper, so the private-helper convention matches the file's existing style.

### 3.4 `syncSubscriptionWithStripe()` stays separate

It remains its own export with its own customer-wide reconciliation logic, used for **recovery and synchronisation only** — never as the implementation of checkout linking. The two functions answer different questions: *"which subscription did this specific checkout create"* (anchored to a session, transaction-scoped) versus *"what is this customer's subscription state right now"* (a broad sweep with no specific anchor). Collapsing them is what produced the current defect. It will still be made atomic per §5, since it also creates rows and grants allowances.

**Regression risk to state plainly:** this is a behaviour change to a live conversion path, not a refactor. Today a user whose checkout session is stale but whose customer has an active subscription still gets linked (via the customer-wide sweep). After this change, that case returns `missing_subscription` from the link path and is instead handled by reconciliation. The §12 baseline tests must capture today's behaviour first so this difference is visible and deliberate rather than discovered in production.

---

## 4. Consolidating the Allowance-Grant Implementations

### 4.1 There are six, not five

Phase 1 found three. This revision's analysis found five. **Repository verification during Step 4 found a sixth** — `A4b`, a second inlined stacking block on the plan-change path — which every earlier count missed.

Terminology used throughout this section, because the distinction drives what may be consolidated:

- **Automated stacking implementation** — adds plan minutes on top of the remaining balance, on an automated (Stripe- or checkout-driven) path. These are the consolidation target.
- **Overwrite/reset implementation** — replaces the balance with a fixed value. Different entitlement behaviour; deliberately NOT consolidated.

| # | Implementation | Location | Class | Semantics | Callers |
|---|---|---|---|---|---|
| **A1** | `addSubscriptionAllowanceMinutes` (shared) | `credit-balance.service.ts:35-55` | automated stacking | Stacks: reads `credits`/`credits_seconds`, adds `minutes*60`, writes both. | `subscription.service.ts:494` — **the only one** |
| **A2** | `addSubscriptionAllowance` (private) | `billing.service.ts:26-~46` | automated stacking | Byte-for-byte identical to A1. | `billing.service.ts:349`, `:815` |
| **A3** | `addSubscriptionAllowance` (private) | `billing.webhook.ts:88-109` | automated stacking | Byte-for-byte identical to A1. | `billing.webhook.ts:436` |
| **A4** 🆕 | **Inlined**, no helper at all | `billing.webhook.ts:563-578` | automated stacking | Same stacking intent written inline inside `handleInvoicePaymentSucceeded`. **Not** byte-identical to A1 — see §4.1a. | renewal path (W10) |
| **A4b** 🆕🆕 | **Inlined**, no helper at all | `billing.webhook.ts:468-490` | automated stacking | Same stacking intent written inline inside `handleSubscriptionUpdated`, on the `planChanged` branch. Stacks the **full new-plan allowance, not a delta** — including on a downgrade. Same arithmetic as A4. | plan-change path (W8) |
| **A5** 🆕 | Direct credit overwrite | `admin.service.ts:1172-1179` | overwrite/reset | **Replaces** `credits`/`credits_seconds` with the plan allowance — does not stack. | admin plan override (W11) |
| **A6** | Direct credit overwrite | `subscription.service.ts:100-106`, `:123-129` | overwrite/reset | **Replaces** the balance with the trial allowance. | trial branch of `createCheckoutSession` (W14) |

**Why A4b was missed until Step 4.** W8 (`customer.subscription.updated`) is recorded in §2.1 as *"`findFirst` by `stripe_sub_id` → `update` only. Never creates. No grant."* — **the "No grant" is wrong.** The writer map was built by grepping `subscriptions.(create|update|…)`, which correctly classified W8's *subscription-row* behaviour as update-only and low-risk, but that grep could not see a `profiles.credits` mutation nested inside the same handler. A4 was found because §4 was searching for allowance code specifically; A4b sits ~90 lines above it in the same file, behind a `planChanged` guard, and was not reached by either sweep. The lesson for the remaining steps: enumerate credit-balance writers by grepping `profiles.*credits`, not by grepping subscription-row writers.

Both `billing.service.ts:7` and `billing.webhook.ts:7` **import `addSubscriptionAllowanceMinutes` and then never call it.** The import is dead in both files.

### 4.1a Arithmetic: A4 and A4b are equivalent to A1, but not identical

Both inline blocks write `credits: existingMinutes + planCredits`, whereas A1 derives `credits: ceil(newSeconds / 60)`. `credits_seconds` is computed identically by all three.

Since `ceil(newSeconds / 60) === ceil(existingSeconds / 60) + planCredits`, the two agree **iff `credits === ceil(credits_seconds / 60)`** — the repository invariant maintained by `deductCreditsSeconds` (`sessions.service.ts:128`, `credits = CEIL(credits_seconds / 60.0)`), by A1 itself, by both inline blocks, and by every overwrite path. All nine users in the Phase 1 preflight satisfy it exactly (e.g. `830 / 49800`, `1409 / 84525`, `628 / 37637`).

One code path would violate it — the legacy trial branch at `billing.service.ts:98-101`/`:118-121` writes `credits` without `credits_seconds` — but it has **zero production callers** (`billing.controller.ts` imports `createCheckoutSession` from `./index`, i.e. the canonical implementation; `user.controller.ts` and `user.service.ts` call only `linkSubscriptionToUser` and `syncSubscriptionWithStripe`). It is removed with the §11 wrapper conversion regardless.

Conclusion: **equivalent on every reachable state, not literally identical.** Both directions are pinned by test in `credit-balance.service.test.ts`.

### 4.2 Target signature and client type

**The repository already contains an exported transaction-client type, and it already uses the exact optional-trailing-parameter shape this helper needs.** `gamification/points.service.ts:16`:

```ts
/** Accepts either the base client or an interactive-transaction client. */
export type PrismaClientLike = Prisma.TransactionClient | typeof prisma;
```

used as `client: PrismaClientLike = prisma` at `points.service.ts:64`, `:80`, `:90`. `sessions.service.ts:17` declares an equivalent but **non-exported** `DbClient` with a *required first* parameter. Two declarations of the same type, neither in a shared location.

**Recommendation:** move the type to `apps/api/src/lib/prisma.ts` — which already exports the singleton every module imports — and re-export it from both existing sites so nothing breaks:

```ts
// apps/api/src/lib/prisma.ts (addition)
export type PrismaClientLike = Prisma.TransactionClient | typeof prisma;
```

Billing importing `PrismaClientLike` from `gamification/points.service` would be a bad dependency direction; duplicating it a third time is what got us five allowance implementations. `lib/prisma.ts` is the only location every module already depends on.

**Target signature**, following the `points.service.ts` precedent (optional, trailing, defaulted — so all existing callers are source-compatible):

```ts
export async function addSubscriptionAllowanceMinutes(
  userId: string,
  minutesToAdd: number,
  client: PrismaClientLike = prisma
): Promise<void>
```

The body changes only in that `prisma.profiles.findUnique` / `prisma.profiles.update` become `client.profiles.findUnique` / `client.profiles.update`.

### 4.3 Consolidation actions

| Action | Target | Note |
|---|---|---|
| Extract `PrismaClientLike` to `lib/prisma.ts` | new export | Re-export from `sessions.service.ts` and `points.service.ts` to avoid touching their call sites. |
| Add the `client` parameter to A1 | `credit-balance.service.ts:35` | Default preserves every current caller. |
| Delete A2 | `billing.service.ts:26` | Falls out of the §11 wrapper conversion; both call sites (`:349`, `:815`) disappear with the legacy functions. |
| Delete A3, route `:436` to A1 | `billing.webhook.ts:88` | The dead import at `:7` becomes live. |
| Delete A4, route the renewal grant to A1 | `billing.webhook.ts:563-578` | Equivalent under the §4.1a invariant. Retain the `if (planCredits <= 0) return;` — it returns from the whole handler and therefore also skips the renewal email; A1's internal guard does not. |
| Delete A4b, route the plan-change grant to A1 | `billing.webhook.ts:468-490` | **Step 4b.** Equivalent under the §4.1a invariant. The `planCredits > 0` check here is a nested `if`, **not** an early return — a zero-allowance plan must still fall through to the `subscriptions.update` below. A1's internal guard preserves this exactly. |
| **Leave A5 alone**, document it | `admin.service.ts:1172` | Overwrite/reset, not stacking. Plausibly *intended* for an admin override. Changing it is a product decision, not a consolidation one. Flagged in §14 (D2) and listed as Open Decision 3. |
| **Leave A6 alone**, document it | `subscription.service.ts:100`, `:123` | Overwrite/reset, not stacking. Trial credit assignment is addressed by §8A/§4A, not by this consolidation. |

After Steps 4 and 4b, **exactly one automated stacking implementation exists** (A1), it is transaction-capable, and every automated grant path — checkout linking, customer reconciliation, webhook checkout completion, renewal, and webhook plan change — routes through it. The two overwrite/reset implementations (A5, A6) remain intentionally separate because their entitlement behaviour is *replace*, not *stack*.

---

## 5. Atomicity

### 5.1 The invariant

Whenever a new subscription entitlement is created, these two writes commit together or not at all:

```
create-or-link the subscriptions row
      +
grant the plan allowance to profiles
```

Implemented as `prisma.$transaction(async (tx) => { ... })` with the row write and `addSubscriptionAllowanceMinutes(userId, minutes, tx)` both inside.

### 5.2 Boundaries

- **Stripe reads happen before the transaction opens.** Holding a database transaction across a network round-trip to Stripe extends lock duration for no correctness benefit. All four Stripe calls in §3.2 steps 1–5 complete first.
- **Cache invalidation happens after commit, never inside.** Invalidating inside the transaction would publish a state that a rollback then un-publishes.
- **Precedent:** `payg.service.ts:174-200` already does exactly this shape in the billing module — `prisma.$transaction(async (tx) => { tx.payment_transactions.create(...); tx.profiles.update(...) })` for credit purchases. `billing.webhook.ts:312` and `billing.service.ts:858` use it too. This is established practice here, not a new pattern.

### 5.3 Defined behaviour for every case

| Case | Behaviour | Classification (§15) |
|---|---|---|
| **Successful first link** | Row created and allowance granted in one commit. Caches invalidated after. | `linked` |
| **Already-linked subscription** | A row matching this `stripe_sub_id` exists. Reconcile mutable fields (status, period dates, amount). **Do not grant again.** | `already_linked` |
| **Concurrent duplicate requests** | The unique constraint (§7) arbitrates. Exactly one transaction commits a new row; the others raise `P2002` and take the recovery path below. Exactly one allowance is granted, by construction. | one `linked`, N−1 `unique_conflict_recovered` |
| **Prisma `P2002` on `stripe_sub_id`** | Catch, re-read the winning row by `stripe_sub_id`, verify it exists and its `user_id` matches, return without creating or granting. Because the winner's write was atomic, the winner's allowance is already committed — this is guaranteed structurally, not by inspection. Follows the established `points.service.ts:52-58` pattern of treating P2002 as an idempotent no-op. | `unique_conflict_recovered` |
| **Transaction rollback** (allowance throws mid-transaction) | Neither write persists. No orphan row, no partial credit. Caches are *not* invalidated. The error propagates to the caller. A subsequent retry performs the full operation cleanly. | `failed` (`db_error`) |
| **Stripe retrieval failure** | No transaction is ever opened. Nothing is written. Error surfaces with a category, not a raw message. | `failed` (`stripe_error`) |
| **Invalid or missing `session.subscription`** | Return before opening a transaction. No row, no grant, no cache invalidation. Mirrors today's early-return in both implementations. | `missing_subscription` |
| **Plan resolution failure** (price matches no known plan and no usable metadata) | Return before opening a transaction. Write nothing — **do not** fall back to `trial`, which would silently downgrade a paying user. | `plan_unresolved` |

### 5.4 What atomicity does not solve

It makes the *forward* path safe. It does not retroactively determine whether a row created before this ships had its allowance completed — there is no column or ledger recording that, and a profile's `credits` balance is not a usable proxy (it is a running total mixed with trial grants, renewals, PAYG purchases, and session deductions). That is the subject of §6, and it is the reason the historical cleanup in §8 does not attempt to recompute anyone's balance.

---

## 6. Idempotency Marker Decision — Reopened

v3 recommended **against** a durable marker, reasoning that no evidence of under-crediting existed. That reasoning is still literally true and is now beside the point: Phase 1 found confirmed **over**-crediting. User `bf112c04` holds `credits = 830` against a correct entitlement of `30 + 400 = 430` — two `pro` grants for one Stripe subscription, matching to the minute with zero consumption. The decision is reopened here with that evidence.

### Option A — No new marker

Rely on the unique `stripe_sub_id` constraint + the atomic transaction + row existence.

| Dimension | Assessment |
|---|---|
| Idempotency strength | **Strong for checkout linking.** The constraint makes two rows for one Stripe subscription impossible, and the transaction binds the grant to row creation, so "one row ⇒ one grant" holds by construction. |
| Migration complexity | **None.** No schema change. |
| Historical repair usefulness | **None.** Cannot determine whether any pre-existing row was granted. |
| Auditability | **Poor.** No record of which grant was made, when, or why. |
| Future renewal support | **Weak.** Renewals (W10) grant repeatedly against the *same* row, so row existence cannot gate them. They are currently protected only by the per-event `stripe_webhook_events` ledger — real, but it guards *event replay*, not *two different events describing the same billing period*. |
| Rollback risk | **Lowest.** Nothing to roll back. |

### Option B — Subscription-level marker (`subscriptions.allowance_granted_at`)

| Dimension | Assessment |
|---|---|
| Idempotency strength | **Marginal over Option A.** For first-link it adds nothing the constraint doesn't already provide. |
| Migration complexity | Low — one nullable column. But **backfill is undecidable**: existing rows cannot be classified as granted or not. |
| Historical repair usefulness | **Low, and misleading.** A column that is NULL for every pre-existing row conveys "unknown", not "not granted" — inviting exactly the wrong repair. |
| Auditability | Weak — one timestamp, no amount, no reason. |
| Future renewal support | **Structurally wrong.** A renewal grants again against the same row, so the column must be overwritten each cycle, destroying the previous value and providing no cross-cycle idempotency. |
| Rollback risk | Low, but the column becomes permanent de-facto API surface. |

### Option C — Dedicated allowance / entitlement ledger

A table with **one idempotent row per entitlement-granting event**, inserted inside the same transaction as the grant; a `P2002` on insert means "already granted" and the grant is skipped. This is the model the live-mode blocker (§0, §16, §17 Gate 9) requires.

**Likely idempotency-key dimensions** (defined here, **not** implemented in this task):

```
user_id
+ stripe_subscription_id      (which subscription the entitlement belongs to)
+ stripe_invoice_id / billing_event_id   (which billing event produced it — distinguishes cycles)
+ entitlement_type            (initial_paid | renewal | plan_change | promotional | future)
```

The `stripe_invoice_id` / billing-event dimension is what makes the key cover **recurring** grants: initial paid entitlement, subscription renewal, and plan changes each carry a distinct invoice/event id, so re-delivery or replay of any one of them is a no-op while a genuinely new billing period is a genuinely new row. Amount granted, `period_start`/`period_end`, and `granted_at` are recorded as payload for auditability. (Exact column names and types are an implementation detail for the ledger's own migration, gated at §17 Gate 9.)

| Dimension | Assessment |
|---|---|
| Idempotency strength | **Strongest, and the only option that covers renewals, plan changes, and future billing events** — each is a distinct key. |
| Migration complexity | Moderate: one new table, one composite unique index, one insert inside the existing transaction. |
| Historical repair usefulness | **Same as A and B for existing rows** — the ledger starts empty. Its value is forward-looking, plus a clean seam for a *deliberate*, separately-approved backfill later. |
| Auditability | **Strongest.** Every grant carries user, subscription, billing event, type, amount, and period — precisely what was missing when Phase 1 had to reconstruct over-granting by arithmetic. |
| Future renewal / plan-change support | **Full.** |
| Rollback risk | Low — additive; an unused table is inert. |
| Repository precedent | **Already implemented and working here.** `point_transactions` has unique index `point_transactions_user_source_item_key (user_id, source_type, source_item_id)` (verified in production), and `points.service.ts:37-59` inserts, catches `P2002`, and returns `inserted: false` — an idempotent no-op. That is Option C, in this codebase, in production, today. |

### Recommendation

**Adopt Option A for the current consolidation scope. Make Option C a hard Stripe live-mode release blocker. Reject Option B outright.**

- **Option A fully closes the confirmed defect.** Every duplicate in production came from concurrent checkout linking, and the constraint plus the atomic transaction make that specific failure impossible. Shipping a schema change is not required to fix what actually broke *during alpha*.
- **Option B should not be built at all.** It cannot express renewals, and its backfill is undecidable, so it would ship a column that is wrong for the recurring case and uninterpretable for the historical one.
- **Option C is required before live mode — as a blocker, not a suggestion.** The renewal gap it closes is currently mitigated only by the per-event webhook ledger (which guards *event replay*, not two events describing the same period), and the renewal path **has never executed in production** (`stripe_webhook_events` is empty, §13). During alpha, in test mode, building it now — ahead of the cleanup that unblocks everything else — is the wrong order. But the moment real money flows, idempotent auditable entitlement records are a precondition, not an enhancement.

> **HARD RELEASE BLOCKER (restated for this section): Stripe live mode must not be enabled until the Option C ledger is implemented, migrated, tested, and verified.** Enforced at §17 Gate 9; carried in the risk table (§16, live-mode readiness row); tracked in §14 as **D5b**. This is a formal gate — a live-mode cutover that has not passed it is out of policy.

This keeps v3's principle intact — do not add schema unless the repository proves it is required — while stating plainly that the repository *has* proven it will be required, at a defined boundary. **No schema change is proposed or made in this task.**

---

## 4A. Admin Plan-Override Credit Semantics

**Gate-1 condition 4. No admin code is modified in this task — this defines intended semantics for approval.**

### 4A.1 What the code does today

`applyUserSubscriptionPlan(userId, subscription)` (`admin.service.ts:1113-1191`, called from `createUserByAdmin` and the admin plan-change flow) does two coupled things in sequence, with no transaction:

1. **Mutates subscription state** — `findFirst` newest active (else newest any) → `update` its `plan_type`/`status`/`end_date`, else `create` a row. Sets `end_date: null` for paid plans (the signature behind the 44 stray paid rows, §14 D2).
2. **Overwrites credits** — `profiles.credits`/`credits_seconds` are **replaced** with the target plan allowance (`:1172-1179`), and `signup_type` is set. This is allowance implementation **A5** (§4.1) — the only *replace-not-stack* grant path.

Two concrete hazards, from the code:
- It **destroys remaining balance**. An admin moving a user core→pro overwrites `credits_seconds` to `400*60`, discarding whatever the user had left — including minutes they paid for or already partially consumed. `purchased_credits*` are left untouched, so the blended balance becomes internally inconsistent.
- It is **silent and unaudited**. No `audit_logs` row, no record of the previous balance, no actor attribution beyond the surrounding request.

### 4A.2 Policy options

| Policy | Behaviour | User impact | Predictability | Auditability | Abuse risk | Rollback | Consistency w/ Stripe flow | Behaviour when credits already consumed |
|---|---|---|---|---|---|---|---|---|
| **A — Plan metadata only** | Change plan/status; **do not touch credits** | None to balance | High | High (state change only) | Low | Trivial (revert plan) | Stripe changes also don't reset balance on upgrade (`invoice.payment_succeeded` *stacks*, `billing.webhook.ts:555-578`) — **A matches this** | No effect — balance preserved |
| **B — Reset to target allowance** (current) | Replace balance with plan allowance | **Can remove paid/consumed minutes** | Low (destroys state) | Poor (no record of prior) | **High** (silent grants) | Hard (prior balance lost) | **Inconsistent** — Stripe upgrades stack, this resets | Overwrites; consumed minutes "refunded" or remaining minutes destroyed depending on direction |
| **C — Grant the difference** | Add/remove only `target − current` entitlement | Moderate; preserves consumption | Medium | Medium | Medium | Medium (recompute) | Partial — closer to stacking but still auto-touches balance | Ambiguous against a blended balance (§5.4) |
| **D — Explicit admin choice** | Admin selects `change_plan_only` \| `reset_allowance` \| `grant_allowance`; default `change_plan_only` | Admin-controlled, visible | **Highest** (intent explicit) | **Highest** (choice recorded) | Low (intent logged) | Clean (choice + prior recorded) | Configurable to match Stripe | Admin decides per case |

### 4A.3 Recommendation

**Adopt Policy D, defaulting to Policy A (plan-only) when no credit action is specified. Separate subscription-state mutation from credit-balance mutation.**

- **Decouple the two writes.** `applyUserSubscriptionPlan` should mutate subscription state and *not* touch credits by default. Any credit change is a separate, explicit action.
- **Do not route admin credit changes through the shared stacking helper** (`addSubscriptionAllowanceMinutes`). That helper's contract is "stack plan minutes on the normal billing path." Admin intent can be set/reset/grant-difference, which is a different contract. Instead, add a **separate audited admin-adjustment function** (e.g. `adminAdjustCredits(actorId, userId, { mode, amount, reason })`) whose job is exactly one balance mutation with a recorded reason.
- **Required audit metadata**, written to the existing `audit_logs` table (`actor_id`, `action`, `jsonb details`, verified present): actor, target user, action (`plan_change` / `credit_adjust`), previous plan, new plan, previous `credits`/`credits_seconds`, new values, mode, reason, timestamp.
- **Idempotency:** state mutation is naturally idempotent (setting `plan=pro` twice is one state). `reset_allowance` is idempotent. `grant_allowance` (difference or fixed amount) is **not** idempotent and should be keyed by an admin-supplied operation id if repeat-safety is needed — an implementation detail flagged, not built.
- **Rollback:** because the prior plan and prior balance are captured in `audit_logs`, any override is reversible from its own audit row — which Policy B today makes impossible.

### 4A.4 Scope and disposition

- **This is NOT in the current consolidation implementation scope.** No admin code is touched by the consolidation migration; W11/W14's credit-reset behaviour is left exactly as-is until this policy is approved.
- It **is** Open Decision 3 (product-owner) and adjacent item **D10** (§14).
- The consolidation does **not** silently "fix" A5 by routing it through the shared helper — doing so would change admin behaviour as an undocumented side effect, which is the class of change this whole plan exists to stop. Tests for upgrade / downgrade / same-plan override / partial-consumption cases are specified in §12.9 so the policy, once chosen, ships with coverage.

---

## 7. Unique Constraint on `subscriptions.stripe_sub_id`

### 7.1 Preflight status: executed, FAILED

Run 2026-07-23 against production. **12 duplicated values, 30 rows, 18 surplus rows, 9 users, 0 cross-user.** Full detail in `BILLING_PHASE1_PREFLIGHT_REPORT.md`.

### 7.2 What survives from v3 §5 unchanged

**PostgreSQL and Prisma both permit multiple NULLs under a unique constraint.** PostgreSQL treats each NULL as distinct for uniqueness purposes (standard SQL null semantics), and Prisma's `@unique` on a nullable scalar maps to that same constraint without altering null handling. The **256 NULL `stripe_sub_id` rows are unaffected** — trial rows (W1), pending checkout placeholders (W12), and admin-created rows (W11) all remain valid. Only two or more rows sharing a *non-null* value violate it. Re-verified for v4; no revision needed.

One v3 statement *was* falsified and is corrected here: v3 said all trial rows carry NULL. Row `cffbd6f0-e668-4bb1-90bd-0b3fc36e028d` is `plan_type = 'trial'` with `stripe_sub_id = sub_1TCOZRBt…`. Harmless — the value is not duplicated — but the claim was wrong.

### 7.3 Constraint mechanics

- Target: `@unique` on `subscriptions.stripe_sub_id`, emitting `CREATE UNIQUE INDEX subscriptions_stripe_sub_id_key ON public.subscriptions (stripe_sub_id)`.
- The table is **296 kB / 401 rows**. A plain (non-`CONCURRENTLY`) index build takes milliseconds. **This matters**: `CREATE INDEX CONCURRENTLY` cannot run inside a transaction, and §9's chosen sequence depends on the constraint being added transactionally. At this table size the concurrent build buys nothing and costs the atomicity guarantee.
- No existing unique index on this column (verified: only `subscriptions_pkey`, plus four non-unique indexes).
- Rollback is `DROP INDEX` / `DROP CONSTRAINT` — non-destructive.

### 7.4 Re-run gate

The preflight query is re-run as the final statement **inside** the cleanup transaction (§9) and must return zero rows before the `ADD CONSTRAINT` in that same transaction. If it returns anything, the transaction rolls back and nothing changed.

---

## 8. Historical Cleanup Workstream

**Separate workstream. Nothing here executes during this planning task, and nothing here executes without its own approval gate (§16, Gate 2 and Gate 4).**

Scope: **12 duplicated `stripe_sub_id` values · 30 rows in duplicate groups · 18 surplus rows · 9 affected users.**

### 8.1 Survivor selection

Deterministic, applied per duplicate group, in this order:

**Rule 1 — Plan correctness from Stripe, where Stripe still has the answer.** For the 5 groups whose subscription still resolves (`sub_1TFWXYBt…`, `sub_1TPN9yBt…`, `sub_1TLqESBt…`, `sub_1TFaVWBt…`, `sub_1TRE54Bt…`), retrieve the live subscription and derive the correct `plan_type` from `items.data[0].price.id`. This is authoritative. Where the surviving row's plan disagrees, correct that field on the survivor.

**Rule 2 — Oldest `created_at` wins.** Among rows in a group, keep the one with the smallest `created_at`. This is the original race winner, and `created_at` is **database-generated** (`timezone('utc', now())`, schema default) and therefore monotonic and trustworthy.

**Rule 3 — `updated_at` is never a tiebreaker.** It is written application-side from `new Date()` (`subscription.service.ts:463`), and **7 production rows have `updated_at` earlier than `created_at`** — 5 of them inside duplicate groups. It is not a reliable ordering signal for exactly the rows being cleaned.

**Rule 4 — Status correctness is applied to the survivor, not used to select it.** Groups 1–3 contain both `active` and `incomplete` rows, and groups 1–3 contain *conflicting plan types* (`core` and `pro`) for one Stripe subscription. Selecting by status would sometimes pick a younger row and contradict Rule 2. Instead: select by Rules 1–2, then correct the survivor's `status` from live Stripe where available, and leave it untouched where Stripe returns 404.

**Rule 5 — Never merge across users.** All 12 groups are single-user, so this rule should never fire. It is asserted as a hard precondition anyway: if any group is found spanning users at execution time, the cleanup aborts entirely rather than proceeding on the remaining groups.

**The 7 groups Stripe no longer has** (`resource_missing`) fall through to Rules 2–4 on local data alone. Their surviving rows keep whatever `plan_type` and `status` the oldest row carries, and are **not** guessed at.

### 8.2 Archival

Surplus rows are **archived, then removed** — never deleted outright. 18 rows against a 296 kB table; the cost is nil and it preserves the ability to answer "what did this alpha user actually have" during a later billing dispute or the live-mode transition.

A dedicated archive table is recommended over the existing generic `audit_logs` (which is `action` + `jsonb details`, 2 rows, and not shaped for full row snapshots). The archive must preserve:

| Field | Purpose |
|---|---|
| Complete original row | Every column of the removed `subscriptions` record, verbatim |
| `cleanup_batch_id` | Groups all rows removed by one execution; makes the whole batch reversible as a unit |
| `reason` | Why this row was removed (e.g. `duplicate_stripe_sub_id`) |
| `survivor_subscription_id` | The row that was kept for this group — the reversal key |
| `archived_at` | Execution timestamp |
| Review metadata | Who approved, which dry-run report this execution corresponds to, and the Stripe state observed for the group at execution time |

Creating this table is a schema change and is therefore **out of scope for this task** — it is proposed here and built only after Gate 2.

### 8.3 Credit over-grants

**Default: forgive and document. Do not reclaim. Do not recompute balances.**

Cleanup **must not touch `profiles.credits` or `credits_seconds` at all.** These are real alpha users. Choosing among the three options:

- *Forgive silently* — leaves no record. When Stripe moves to live mode and real balances start mattering, nobody will be able to reconstruct which balances were inflated or by how much. Rejected.
- *Reclaim only unused excess* — technically feasible (the per-user delta is computable from the duplicate groups), but it degrades the account of an alpha user who did nothing wrong, in exchange for minutes that cost the business nothing in test mode. It also requires deciding what "unused" means against a single blended balance that mixes trial grants, plan grants, PAYG purchases, and session deductions — a determination the current data model cannot support (§5.4). Rejected.
- **Forgive and document — chosen.** The dry-run report records the exact per-user over-grant (computable: `sum(plan credits for each surplus row)`), and that record is retained with the archive batch. Balances are left exactly as they are. If the product owner later decides a correction is warranted — most plausibly at the live-mode transition — the data to execute it precisely will exist. This keeps a data-integrity migration from silently adjusting customer balances, which is the failure mode most likely to generate a support incident.

Any actual balance correction is a **separate, separately-approved policy decision** (Open Decision 1).

### 8.4 Cleanup verification

**Dry-run first, as a distinct approved artifact (Gate 2).** The dry-run is read-only and must emit:

1. Every affected row — all 30, with full column values.
2. Every selected survivor — 12 rows, with the rule that selected each and the Stripe state consulted.
3. Every row that would be archived — 18 rows, with its `survivor_subscription_id`.
4. Per-user credit over-grant amounts — **reported, not applied**.
5. An explicit assertion that no group spans multiple users.
6. Row-count reconciliation: `401 total → 383 expected`, `145 non-null stripe ids → 127 expected`, `127 distinct → 127 unchanged`.

**Post-execution verification**, all inside or immediately after the same transaction:

1. The §7.1 preflight query returns **zero rows**.
2. `COUNT(*) = 383`; `COUNT(stripe_sub_id) = 127`; `COUNT(DISTINCT stripe_sub_id) = 127`.
3. Archive table contains exactly 18 rows for this `cleanup_batch_id`.
4. Every archived row's `survivor_subscription_id` resolves to a row still present in `subscriptions`.
5. No archived row's `user_id` differs from its survivor's `user_id`.
6. `SELECT COUNT(*) FROM profiles WHERE credits IS DISTINCT FROM <pre-cleanup snapshot>` returns **0** — credit balances provably unchanged.
7. The unique constraint exists and is valid.

---

## 8A. Duplicate Trial-Row Workstream

**Gate-1 condition 3. This is a distinct invariant, in-scope for the consolidation, and required before the consolidation can be called complete — not informational.** It parallels §8 but targets a different defect family (§2.4): active-trial duplication, which the `stripe_sub_id` constraint cannot see because trial rows are NULL.

### 8A.1 The intended business rule, from repository evidence

Established from the code, not assumed:

- **`getSubscription` is newest-row-wins** (`subscription.service.ts:40-53`): it returns the single most-recent non-`incomplete` row by `created_at DESC`. The data model already treats subscriptions as a history where the latest row is "current." There is **no** enforced single-active-row model to preserve.
- **Trial rows are all `active`**: production has 200 `active` trial rows and exactly 1 `canceled`. So the observed violation is specifically of active-trial uniqueness.
- **Trial and paid coexist legitimately**: **21 users hold an active trial row alongside an active paid row** (verified). A user who upgrades keeps a stale active trial row underneath the newer paid row, and `getSubscription` correctly surfaces the paid one.

**Chosen invariant:**

> **A user may have at most one `active` trial subscription row.** Historical `canceled`/expired trial rows remain allowed (they are legitimate history and are read-time-filtered anyway). A paid row coexisting with a single active trial row remains allowed.

This matches the newest-row-wins read model, does not disturb trial→paid transitions, and does not delete history.

### 8A.2 Sizing

| Metric | Value (verified read-only) |
|---|---|
| Active trial rows | 200 |
| Canceled trial rows | 1 |
| Users with **>1 active trial row** | **31** |
| **Surplus active trial rows** | **53** |
| Users with active trial **and** active paid | 21 (must be preserved) |

### 8A.3 Prevention options

| Option | Mechanism | Compatibility | Cleanup complexity | History | Transitions | Rollback | Canceled/expired trials |
|---|---|---|---|---|---|---|---|
| **A — Partial unique index** | `CREATE UNIQUE INDEX ... ON subscriptions (user_id) WHERE plan_type='trial' AND status='active'` | High — invisible to paid rows and to canceled trials | Requires pre-clean (like §8) | Preserved | Trial→paid unaffected (paid row not covered) | `DROP INDEX`, non-destructive | **Allowed** — index scoped to `status='active'` |
| **B — Deterministic upsert into one trial row** | Trial writers converge on `findFirst active trial → update else create` in a transaction | High | Same | Preserved | Fine | Revert code | Allowed, but relies on code discipline alone |
| **C — Remove trial rows from `subscriptions`; derive trial state elsewhere** | Trial becomes a profile flag / `signup_type` | **Low** — `getSubscription`, W1, W14, admin analytics (`admin.service.ts:2712,2847`), and notification targeting all read trial rows from `subscriptions` | Very high | Rewrites history model | Invasive | Hard | n/a |

### 8A.4 Recommendation

**Option A as the correctness guarantee, implemented alongside Option B as the write shape.** The partial unique index is the database-level invariant (mirroring how §7's constraint is the guarantee for `stripe_sub_id`); the trial writers (W1, W14) converge on a single deterministic "ensure exactly one active trial" upsert helper so the common path doesn't rely on catching `P2002`. Option C is rejected for this scope — too many readers depend on trial rows living in `subscriptions`; it is noted as possible far-future modelling work only.

- The index: `subscriptions_one_active_trial_per_user` — `UNIQUE (user_id) WHERE plan_type = 'trial' AND status = 'active'`. Partial, so it constrains **only** active trials; paid rows and historical canceled trials are untouched.
- The helper: a single non-exported `ensureSingleActiveTrial(userId, tx)` that W1 and W14 both call, replacing their independent `findFirst`-then-write. Credit setting for the trial path routes through the audited adjustment path per §4A, not an ad-hoc overwrite.

### 8A.5 Cleanup — dry-run, survivor rule, archive, verification

Same conservative shape as §8, and **fused into the same cleanup transaction** (§9) so trial dedup and its index land atomically alongside the `stripe_sub_id` work.

- **Survivor rule:** per user, keep the **oldest** `active` trial row by database-generated `created_at` (the original race winner). `updated_at` is **not** a tiebreaker (§8 Rule 3 — 7 rows have `updated_at < created_at`). Prefer a survivor with a non-null `end_date` only as a secondary tiebreaker among equal `created_at` (none observed). **Never** delete a paid row in this workstream — it operates on trial rows only.
- **Archive:** the 53 surplus rows go to the same archive table and `cleanup_batch_id` as §8, with `reason = 'duplicate_active_trial'` and `survivor_subscription_id` set.
- **Credit balances:** **untouched** — trial grants are capped at 30 min and forgiving them is the §8.3 policy applied here too. No balance is recomputed.
- **Dry-run must emit:** all rows in each multi-active-trial group (per the 31 users); the selected survivor per user with its rule; the 53 rows to be archived; an assertion that no paid row is in scope; row-count reconciliation (`201 trial rows → 148 expected`, active-trial-per-user max `→ 1`).
- **Post-execution verification (inside the transaction):** zero users with >1 active trial row; the partial index exists and is valid; archive holds exactly 53 rows for this batch with `reason='duplicate_active_trial'`; every survivor still present; credit balances provably unchanged; **the 21 trial+paid coexistence users still have both rows.**

### 8A.6 Disposition

**In-scope for the consolidation, and a completion criterion.** The consolidation is not "done" until the trial invariant holds and its index is live. It is Gate 3b in §17 (the same transaction as Gate 3) and is tested per §12.6/§12.10.

---

## 9. Sequencing: Cleanup vs. Constraint vs. Defect Prevention

v3 placed the constraint at step 3, before the atomicity work. That was defensible when the data was assumed clean. It is not defensible now: cleaning data while the defect that dirtied it is still live means the cleanup can race it.

### Strategy A — Prevention first, then clean, then constrain

1. Deploy defect prevention (§3, §4, §5) → 2. Clean historical duplicates → 3. Add unique constraint.

| Dimension | Assessment |
|---|---|
| Re-duplication risk during cleanup | **Reduced but not eliminated.** The atomic transaction does not stop two concurrent transactions from each inserting a row for the same `stripe_sub_id` — only the unique index does. Between steps 2 and 3 the data is clean and unprotected. |
| Deployment complexity | Low — one deploy, one data migration, one schema migration. |
| Downtime | None. |
| Rollback | Clean at every step. |
| Compatibility with existing writers | Good — W1, W11, W12 continue to write NULLs, unaffected. |

### Strategy B — Freeze writers, clean, constrain, then deploy

1. Temporarily disable unsafe writers → 2. Clean → 3. Add constraint → 4. Deploy consolidated implementation.

| Dimension | Assessment |
|---|---|
| Re-duplication risk during cleanup | **Eliminated** — nothing is writing. |
| Deployment complexity | **High.** Requires a feature flag or a deploy purely to disable the self-heal paths, then another to re-enable. Two extra deploys for a 30-row cleanup. |
| Downtime | **Partial functional downtime.** Freezing W2/W5/W6 means users completing checkout during the window do not get linked and see a stale plan. On a conversion path, during alpha, that is a worse customer outcome than the problem being fixed. |
| Rollback | More moving parts; the freeze itself needs reverting. |
| Compatibility | Poor — deliberately breaks live behaviour. |

### Chosen sequence — Strategy A, with cleanup and constraint fused into one transaction

**PostgreSQL DDL is transactional.** The gap Strategy A leaves between "clean" and "protected" can be closed to zero by doing both in one transaction:

```
BEGIN;
  -- 1. snapshot affected profile credit balances (for the "unchanged" assertion)
  -- 2. INSERT surplus rows INTO the archive table
  --      (a) 18 stripe_sub_id-duplicate rows   reason = 'duplicate_stripe_sub_id'
  --      (b) 53 active-trial-duplicate rows     reason = 'duplicate_active_trial'
  -- 3. DELETE those surplus rows FROM subscriptions
  -- 4. UPDATE stripe-dup survivors' plan_type/status where Stripe was authoritative
  -- 5. re-run BOTH preflights — stripe_sub_id dup query AND active-trial-per-user query — each must return zero, else ROLLBACK
  -- 6. ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_stripe_sub_id_key UNIQUE (stripe_sub_id);
  -- 7. CREATE UNIQUE INDEX subscriptions_one_active_trial_per_user ON subscriptions (user_id) WHERE plan_type='trial' AND status='active';
COMMIT;
```

Both the `stripe_sub_id` cleanup (§8) and the active-trial cleanup (§8A) land in **this one transaction**, along with both index objects. If any assertion fails, the whole thing rolls back and production is untouched. At 401 rows / 296 kB the entire transaction completes in milliseconds, so the `ACCESS EXCLUSIVE` locks taken by the two index builds are held briefly enough to be invisible — which is *why* the non-concurrent builds in §7.3 and §8A.4 are correct rather than limitations.

This yields Strategy A's low complexity and zero downtime **with** Strategy B's zero re-duplication risk, and needs no writer freeze, no feature flag, and no maintenance window.

**Terminology note on "partial index":** the *trial* invariant genuinely requires a partial unique index (§8A.4) — `WHERE plan_type='trial' AND status='active'` — because it must constrain only active trials. That is different from the `stripe_sub_id` case, where a partial `WHERE stripe_sub_id IS NOT NULL` index would be pointless (NULLs are already exempt from a plain unique constraint, §7.2). So: plain unique constraint for `stripe_sub_id`, genuine partial unique index for active trials. Both are additive and non-destructive to roll back.

**Defect prevention still ships first**, before the cleanup transaction, for two reasons: it stops new duplicates accumulating while the cleanup is being reviewed and approved (a period measured in days, not minutes), and it means the cleanup transaction runs against a system that will not immediately re-dirty the table if the constraint were ever dropped.

**Final order:** defect prevention — including the trial single-active upsert (§8A.4) — deployed and verified → cleanup dry-run for **both** families, approved → cleanup + both indexes (one transaction) → post-cleanup verification → caller migration → wrapper. Expanded step-by-step in §17.

---

## 10. `/users/me` Self-Healing

### 10.1 Current behaviour and why it is the amplifier

Both paths fire on the same condition — local plan reads `trial` **and** `stripe_customer_id` is set:

- `user.service.ts:1014-1020` (cache-hit): calls `syncSubscriptionWithStripe`, then deletes the profile cache entry.
- `user.service.ts:1111-1120` (cold-load): calls `syncSubscriptionWithStripe`, then re-reads the subscription.

That condition describes exactly the post-checkout redirect. A frontend issuing more than one `/users/me` while the success page mounts fires multiple customer-wide Stripe reconciliations concurrently — while `linkSubscriptionToUser` is running against the same subscription. Three writers, and the March duplicate groups have three rows each, created 0.003–1.25 s apart.

**A second problem compounds it** — `handleSubscriptionDeleted` labels canceled subscribers as `trial` while retaining `stripe_customer_id`, which makes the old trigger fire forever. That defect and its fix are §10.3; its interaction with the eligibility rule is §10.4.

### 10.2 Correctness hierarchy — stated explicitly (Gate-1 condition 2)

The four mechanisms are **not** interchangeable, and none of the mitigations below is a correctness mechanism. In precedence order:

```
Database unique constraint (§7) + partial unique index (§8A)
        = the correctness guarantee — the ONLY cross-instance guarantee

Atomic transaction (§5)
        = subscription-row ↔ allowance consistency (all-or-nothing)

In-process single-flight
        = duplicate-request REDUCTION only — per-instance, not cluster-wide, NOT a guarantee

Cooldown
        = Stripe API / latency load REDUCTION only — not a correctness mechanism
```

This ordering must not be blurred. In particular, **in-process single-flight is not presented as a cross-instance correctness mechanism**: the API runs one process per instance, so two instances can still each start a sync. What makes concurrent syncs safe is the database constraint arbitrating the write; single-flight and cooldown only remove load and lock contention. If single-flight were the whole fix, a second instance would reopen the exact race that produced the duplicates.

### 10.3 The `handleSubscriptionDeleted` trigger defect — and its fix

`handleSubscriptionDeleted` (`billing.webhook.ts:507-521`) sets `plan_type: 'trial'` on cancellation while leaving `status: 'canceled'` and `stripe_customer_id` in place. Under the *old* trigger ("plan reads trial and a customer exists"), every canceled subscriber therefore satisfies self-heal **permanently** — every `/users/me` makes a customer-wide Stripe call, forever.

**The fix has two independent parts, both in-scope:**

1. **Stop writing `plan_type: 'trial'` on cancellation** (W9). It is not just harmful, it is **redundant**: `getSubscription` already treats a canceled-and-past-`end_date` row as no-subscription and falls back to trial *at read time* (`subscription.service.ts:62-66`). Overwriting the stored `plan_type` to `trial` destroys the information that the user *was* a paid subscriber (needed to tell a churned customer from a genuine trial user) while adding nothing the read path doesn't already do. Change W9 to set `status: 'canceled'` and **retain the real `plan_type`**.
2. **Redefine the self-heal eligibility rule** (below) so that even a still-mislabeled row cannot trigger perpetual resync.

### 10.4 Exact self-heal eligibility rule

Self-heal must run **only when local billing state is genuinely incomplete or missing** relative to a Stripe customer that exists — never merely because `plan_type` reads `trial`.

**Eligible (reconcile) when ALL hold:**
- `stripe_customer_id` is set, **and**
- the user has **no** local subscription row that is already linked to a live Stripe subscription (i.e. no row with a non-null `stripe_sub_id` in an active/trialing/past_due status), **and**
- one of these genuinely-incomplete signals is present:
  - a Stripe customer exists but **no local paid subscription** exists, **or**
  - a local subscription is `incomplete`/`incomplete_expired` **and within a bounded recovery window** (e.g. created within the last N minutes — a checkout that was interrupted before linking completed), **or**
  - an explicit reconciliation-needed marker is present (if/when one is introduced).

**Ineligible (do nothing) when ANY hold:**
- The user has a local row already linked to a Stripe subscription (`stripe_sub_id` non-null, active/trialing) — **already linked, nothing to heal.**
- A **confirmed canceled** subscription (Stripe says canceled, or the local row is `status='canceled'`) — churned, not incomplete. Explicitly covers the repeated-reconciliation-after-cancellation loop.
- A **valid trial user** — trial with no `stripe_customer_id`, or trial within its window and no Stripe linkage pending.
- A **valid active paid subscription** already present locally.
- A normal profile read with **no billing inconsistency**.

The distinguishing predicate is *"is there an unlinked-but-should-be-linked state,"* not *"does the plan say trial."* This makes a canceled subscriber ineligible **regardless** of whether part 1's W9 fix has propagated to their row, so the two fixes are belt-and-suspenders rather than co-dependent.

### 10.5 Guard mechanics

- **Single-flight key:** `userId`. An in-process `Map<userId, Promise>` of in-flight syncs; concurrent callers await the existing promise. Reduction only (see hierarchy).
- **Cooldown scope:** per `userId`, keyed on last-attempt timestamp; skip re-attempt within a short window (e.g. 60s) when the previous attempt changed nothing. Reduction only. This is the second line (after the eligibility rule) against the canceled-subscriber loop.
- **Non-blocking:** yes. The cache-hit path (`:1014`) currently *awaits* the Stripe round-trip before returning a cached profile — a cache hit slower than a miss. It must return the cached value and trigger any eligible sync out-of-band. The cold-load path may still reconcile inline only when eligibility indicates a genuinely-incomplete recovery the user is actively waiting on (interrupted checkout), and even then behind the single-flight.
- **Logging:** every self-heal decision emits an eligibility outcome — `reconcile_eligible` (with the signal that qualified it), `skip_already_linked`, `skip_canceled`, `skip_valid_trial`, `skip_valid_paid`, `skip_cooldown` — under the §15 fields, so the trigger's behaviour is observable and the canceled-loop cannot silently regress.
- **Failure behaviour:** unchanged from today's swallow-and-fall-back-to-local-state (`try/catch` returning the DB/cached value). A sync failure must never fail the `/users/me` read.

### 10.6 Future improvement — kept out of this migration

Moving reconciliation to a **dedicated endpoint or a queued background flow** remains the right long-term shape and is recorded as post-consolidation work (§14, D6). It is not done now: each is a new surface with its own scheduling/auth/failure semantics, landing mid-migration. Hidden writes inside a read endpoint are a genuine smell; the narrow, temporary justification for keeping a guarded version is that self-heal is currently the *only* recovery path for failed checkout linking, because **the webhook has never run** (§13). Once §11.3's checklist passes with real deliveries, the self-heal becomes redundant and should be **removed**, not merely guarded.

---

## 11. Legacy Service Strategy and Webhook Readiness

### 11.1 Thin compatibility wrapper (carried forward from v3, unchanged)

Convert `billing.service.ts` into a thin, `@deprecated`-marked wrapper: `linkSubscriptionToUser` and `syncSubscriptionWithStripe` re-exported from their canonical homes, every other export re-exported from `./index`. Rollback becomes a two-line import revert rather than a file restoration. Deletion is a candidate at the **next** release, not this one.

This also removes allowance implementation A2 (§4.1) as a side effect.

### 11.2 Debug script

`scripts/debug-billing-subs.ts:2` imports `getAllSubscriptions` from the legacy path. Update to canonical. Behavioural difference to note so it is not mistaken for a regression: legacy caps page size at `Math.min(limit, 100)` (`billing.service.ts:523`), canonical at `Math.min(limit, 500)` (`subscription.service.ts:352`). Harmless for a debug script.

### 11.3 Webhook readiness verification checklist

**`stripe_webhook_events` contains zero rows.** `completeStripeWebhookProcessing` (`billing.webhook.ts:74-82`) *marks* rows `completed` rather than deleting them, so an empty table means **no Stripe webhook has ever been successfully processed against this database.** Every webhook writer (W7–W10) is therefore unexercised code in this environment, and its per-event idempotency guard has zero production evidence behind it.

**Nothing below is to be configured or triggered now.** This is the verification checklist for the step gated at §17 Gate 6.

| # | Check | How | Repository state |
|---|---|---|---|
| 1 | Webhook endpoint is configured in the Stripe test dashboard for this environment | Stripe dashboard → Developers → Webhooks; confirm a destination pointing at this API's `/billing/webhook` | Not verifiable from the repo |
| 2 | Endpoint is reachable from Stripe | Send a test event from the dashboard; expect `200` and a `stripe_webhook_events` row | Route registered: `billing.routes.ts:17-23` |
| 3 | Raw body is preserved for signature verification | `fastify-raw-body` registered `app.ts:144-145` with `field: 'rawBody'`; route opts `config: { rawBody: true }` (`billing.routes.ts:20`) | ✅ Wired correctly |
| 4 | Signature verification works | `stripe.webhooks.constructEvent(rawBody, sig, secret)` at `billing.webhook.ts:134`; returns 400 on failure, 500 when `STRIPE_WEBHOOK_SECRET` is unset (`:114`) | ✅ Implemented; covered by `billing.webhook.test.ts:84,106,126,244` |
| 5 | `STRIPE_WEBHOOK_SECRET` is set in the deployed environment and matches the configured endpoint | Environment check | Present in `apps/api/.env`; deployed value unverified |
| 6 | Events persist | After a test event, `stripe_webhook_events` has a row with `status='completed'` and a `processed_at` | Table exists, **empty** |
| 7 | Idempotency holds | Replay the same event id; expect `{received:true, duplicate:true}` and no second write | Implemented `:34-72`; tested `:149` |
| 8 | Concurrent-delivery claim behaves | Two simultaneous deliveries of one event → one processes, one gets `503` for Stripe to retry | Implemented `:65`; tested `:185` |
| 9 | Stale-claim reclaim works | A `processing` row older than the stale threshold is reclaimable | Implemented `:59-63`; tested `:461` |
| 10 | `checkout.session.completed` creates/links correctly **and grants exactly once** | Complete a test-mode checkout; assert one row, one grant, via the shared helper post-§4 | Implemented `:354-437`; tested `:263,:314` |
| 11 | `customer.subscription.updated` updates without creating | Trigger a plan change in test mode | Implemented `:440-505` |
| 12 | `customer.subscription.deleted` cancels correctly | Cancel in test mode; **confirm the §10.3 W9 fix — retains real `plan_type`, sets `status:'canceled'`** | Implemented `:507-521`; **untested** |
| 13 | `invoice.payment_succeeded` renews without double-granting | Advance a test clock through a cycle; assert one renewal grant | Implemented `:523-580`; tested `:371` |
| 14 | Handler failure returns 500 so Stripe retries | Fault injection | Implemented; tested `:419` |

Items 1, 2, 5, 6 are environment/configuration facts that cannot be settled from the repository and are the substance of the §17 Gate 6 verification.

---

## 12. Testing Plan

Framework is Jest with `prisma` mocked at module level and `$transaction` stubbed as `mockImplementation(async (fn) => fn(mockPrisma))` — the pattern already used in `sessions.service.test.ts:311`, `completion.service.test.ts:47`, `goals.checkin.test.ts:54`, and `billing.webhook.test.ts:60`. New tests follow it.

Current billing coverage is **one file**, `billing.webhook.test.ts` (14 cases). There is no test for `subscription.service.ts`, `billing.service.ts`, or `credit-balance.service.ts`.

### 12.1 Baseline tests — written and run FIRST, against current behaviour

These lock in today's behaviour before anything changes, and two of them are expected to **document defects rather than assert correctness** — labelled as such so they are not mistaken for endorsements.

- Guest checkout → signup linking, current canonical path. **Documents** that the plan is currently resolved from a customer-wide list (the §3 defect).
- Sequential duplicate calls with the same `sessionId` — current `existingByStripeId` behaviour.
- `/users/me` reconciliation on both cache-hit (`:1016`) and cold-load (`:1113`) paths.
- Existing `billing.webhook.test.ts`, unmodified, as a guardrail that nothing reachable from `billing.routes.ts` moves.

### 12.2 Unit tests

| Test | Asserts |
|---|---|
| Exact `session.subscription` selection | With a Checkout Session whose `subscription` is `sub_B`, on a customer that also has `sub_A` (active, different price), the link path retrieves `sub_B` and **never calls `stripe.subscriptions.list`** |
| Plan resolution from the exact subscription | `items.data[0].price.id` → `core`/`pro`; `metadata.planType` fallback exercised |
| Shared allowance helper with the Prisma singleton | `addSubscriptionAllowanceMinutes(u, 200)` with no client argument uses the default and stacks correctly |
| Shared allowance helper with a transaction client | `addSubscriptionAllowanceMinutes(u, 200, tx)` issues its reads and writes through `tx`, not the singleton |
| Missing `session.subscription` | Returns `missing_subscription`; **no** `$transaction` opened, no row, no grant, no cache invalidation |
| Already-linked subscription | Reconciles mutable fields; asserts the allowance helper is **not** called |
| Invalid plan mapping | Unknown price and no usable metadata → `plan_unresolved`; asserts no write and **no silent `trial` fallback** |
| Cache invalidation after commit only | `clearUserBillingCaches` and `invalidateUserProfileCache` are called after a successful commit and **not called** when the transaction throws |

### 12.3 Transaction tests

| Test | Asserts |
|---|---|
| Both writes commit | One `subscriptions` row created **and** one allowance granted, in one `$transaction` callback |
| Allowance failure rolls back row creation | Force the grant to throw mid-transaction → no row persists, no credit change, error propagates |
| Row-creation failure grants nothing | Force the row write to throw → allowance helper never invoked |
| Retry after rollback succeeds exactly once | A clean retry creates the row **and** grants the allowance, once — not twice |

### 12.4 Concurrency tests

```ts
await Promise.all([
  linkSubscriptionToUser(userId, sessionId),
  linkSubscriptionToUser(userId, sessionId),
  linkSubscriptionToUser(userId, sessionId),
]);
```

Expected: exactly **one** `subscriptions` row; exactly **one** allowance grant (asserted as a credit delta equal to one plan's worth, not two or three — the specific check that would have caught the `bf112c04` over-grant); deterministic classifications (one `linked`, two `unique_conflict_recovered`); no unhandled rejection reaches any caller.

**This test requires the unique constraint to be present** to be a genuine test of the database guarantee rather than an artifact of mock timing. It therefore runs against a real test database, not the module-level mock — the one place in this suite where that is non-negotiable.

### 12.5 P2002 tests

Deterministic unit-level simulation: make the row `create` throw `new Prisma.PrismaClientKnownRequestError(..., { code: 'P2002' })`.

- The loser loads the winning row by `stripe_sub_id` and returns it.
- **No second allowance grant** — the helper is asserted not called.
- **No plan overwrite** — the loser does not rewrite the winner's `plan_type` with its own resolution.
- Emits `unique_conflict_recovered`.

### 12.6 Cleanup tests (both families)

Run against a seeded fixture reproducing the production shape (a 3-row stripe-dup group, a 2-row group, one group with conflicting plan types, one group absent from Stripe; **plus** a multi-active-trial user and a trial+paid coexistence user).

- **stripe_sub_id family:** survivor selection deterministic per §8.1 — including that `updated_at < created_at` does **not** win a row; archive rows created with `survivor_subscription_id`; cross-user group aborts; no credit mutation; post-cleanup duplicate query returns zero; counts reconcile per §8.4.
- **trial family (§8A):** oldest active trial survives per user; the 53-row shape archives with `reason='duplicate_active_trial'`; **a paid row is never selected for removal**; **the trial+paid coexistence user keeps both rows**; post-cleanup active-trial-per-user max is 1; the partial unique index is valid; balances unchanged.

### 12.7 Webhook tests

Extending `billing.webhook.test.ts`:

- Repeated delivery of the same event id → single processing (exists at `:149`; keep).
- `checkout.session.completed` → one row, one grant, **through the shared helper** (asserts A3 is gone).
- `customer.subscription.updated` → update only, never create.
- `customer.subscription.deleted` → cancels **and retains the real `plan_type`** (asserts the §10.3 W9 fix: no longer overwrites to `trial`), sets `status:'canceled'`. **New** — currently untested.
- `invoice.payment_succeeded` on `subscription_cycle` → renewal grant **through the shared helper** (asserts A4 is gone); on `subscription_create` → no grant.

### 12.8 Trial-invariant tests (§8A)

- **Concurrency:** `Promise.all` of three concurrent trial-creation calls (W1 shape) for one user → exactly one active trial row; the losers resolve cleanly against the partial unique index (`P2002` → idempotent no-op). Requires the partial index present (real test DB, as §12.4).
- **Coexistence:** creating a paid row for a user who already has an active trial does **not** violate the index and does **not** remove the trial.
- **Upsert helper:** `ensureSingleActiveTrial` called twice yields one row, not two.
- **W14 path:** the `createCheckoutSession` trial branch no longer flips an unrelated paid row to trial.

### 12.9 Admin-override tests (§4A — written when the policy is approved)

Placeholder cases so the chosen policy ships with coverage: **upgrade** (core→pro), **downgrade** (pro→core), **same-plan override** (idempotent, no balance change under Policy A default), and **partial credit consumption** (a user who has spent some minutes is not silently reset). Plus: an `audit_logs` row is written with actor, prior plan, prior balance, and reason; subscription-state mutation and credit mutation are separately assertable.

### 12.10 Self-heal eligibility tests (§10.4)

- **Eligible:** Stripe customer + no linked local row + interrupted-checkout `incomplete` within window → `reconcile_eligible`, sync runs once.
- **Ineligible — already linked:** local row with non-null `stripe_sub_id` active → `skip_already_linked`, **no** Stripe call.
- **Ineligible — canceled:** `status='canceled'` (and separately, a row mislabeled `trial` by pre-fix W9) → `skip_canceled`, no Stripe call, **on repeated `/users/me` calls** (the loop regression test).
- **Ineligible — valid trial / valid paid:** no sync.
- **Single-flight:** concurrent `/users/me` for one eligible user → one Stripe reconciliation, not three.
- **Cooldown:** a second eligible attempt within the window that would change nothing → `skip_cooldown`.
- **Non-blocking:** the cache-hit path returns the cached profile without awaiting the Stripe round-trip.

### 12.11 Regression tests

Guest checkout · paid checkout · trial signup (W1) · `/users/me` both paths · all billing endpoints reachable from `billing.routes.ts` · cancellation (canonical Stripe-integrated path) · cache behaviour · `scripts/debug-billing-subs.ts` runs against the canonical import · the thin wrapper's re-exports resolve and every previously-exported symbol is still exported.

---

## 13. What the Empty Webhook Ledger Means for This Plan

Called out separately because it affects how several sections should be read.

`stripe_webhook_events` is empty, and completed events are *marked*, not deleted. Consequences:

1. **The webhook is exonerated as a cause of the historical duplicates** — it has never run. The confirmed racers are W2, W5, and W6.
2. **W7–W10 are unexercised in production.** Their idempotency guard is well-implemented and unit-tested, but has never been exercised against real Stripe delivery, including retries and out-of-order arrival.
3. **The `/users/me` self-heal is currently the only recovery mechanism** for failed checkout linking. That is why §10 guards rather than removes it.
4. **Renewals have never executed.** This is the decisive input to §6's decision to build the allowance ledger *before live mode* rather than now — it would currently be infrastructure for a code path with zero production executions. It does **not** weaken the live-mode blocker (§17 Gate 9): the moment webhooks are live and money is real, that code path executes and idempotent entitlement records become a precondition.

---

## 14. Adjacent Billing Integrity Work

Items **not** part of the consolidation's core defect/cleanup work, each its own ticket with its own classification. Note that the finalization **moved D3 (trial duplication) out of this table into in-scope §8A**, and **promoted D5b (ledger) to a hard live-mode blocker** — so this list is no longer purely "adjacent."

| ID | Finding | Evidence | Classification | Reasoning |
|---|---|---|---|---|
| **D1** | **259 of 380 `active` rows have a past `end_date`** (113 trial, 94 pro, 52 core) | Phase 1 Finding 3 | **Required before Stripe live mode** | Nothing expires subscription rows. `status = 'active'` is not currently a trustworthy signal anywhere in the product. Larger by row count than everything else found. It does not block consolidation — the constraint and atomicity work are indifferent to it — but shipping live billing on top of a status field that means nothing is not acceptable. |
| **D2** | **44 active paid rows with no `stripe_sub_id`** | Phase 1 Finding 4; cause identified in v4 | **Follow-up after consolidation** | Cause found: **28 of the 35 `pro` rows have `end_date IS NULL`, and zero of the 136 Stripe-linked active paid rows do.** `admin.service.ts:1156` is the only writer that sets `end_date: null` for a paid plan. These are overwhelmingly **admin plan overrides (W11)**, legitimate behaviour. Follow-up: decide whether admin-granted plans should be distinguishable from Stripe-backed ones — coupled with the §4A admin-semantics decision. |
| **D3** | **53 surplus active trial rows across 31 users** | New in v4 (§2.1 W1/W14) | **➜ PROMOTED to in-scope — §8A** | Reclassified per Gate-1 condition 3. No longer "follow-up": it is a distinct invariant (one active trial per user) with its own dry-run, survivor rule, archive, partial index, and tests, landing in the **same cleanup transaction** (§9). Completion criterion for the consolidation. |
| **D4** | **Stripe↔local status drift** — 4 of 5 resolvable duplicated subs are `canceled` in Stripe, `active` locally | Phase 1 Finding 3 | **Required before Stripe live mode** | Partly a symptom of D1 and of the webhook never running (D5). Once webhooks are verified, the fixed `customer.subscription.deleted` (W9, §10.3) closes most of it going forward; existing drift needs a one-time reconciliation sweep. |
| **D5** | **Webhook has never processed an event** | Phase 1 Finding 8; §13 | **Required before consolidation is complete** | Promoted into the critical path as §17 Gate 6. Not because consolidation depends on it, but because §10's decision to *keep* the guarded self-heal is justified by the webhook being unproven — and that cannot be revisited until it is proven. |
| **D5b** | **No idempotent, auditable entitlement records** (renewal grants guarded only by event replay) | §6; §13 | **🔴 HARD BLOCKER before Stripe live mode** | The Option C allowance/entitlement ledger (§6). **Live mode must not be enabled until it is implemented, migrated, tested, and verified** — §17 Gate 9. This is the formal live-mode release blocker per Gate-1 condition 1, not a follow-up. |
| **D6** | **Reconciliation hidden inside a read endpoint** | §10 | **Follow-up after consolidation** | Extract to a dedicated endpoint or queued background flow (§10.6). Guarded now (§10.4–10.5); extracted once webhooks are verified and the self-heal becomes redundant. |
| **D7** | **One `trial` row carries a `stripe_sub_id`** | Phase 1 Finding 5 | **Informational only** | Single row, value not duplicated, does not block the constraint. Recorded because it falsified a v3 assumption. |
| **D8** | **7 rows with `updated_at < created_at`** | Phase 1 Finding 6 | **Informational only** | Application-clock vs database-clock skew under a race. Its one practical consequence — `updated_at` unusable as a cleanup tiebreaker — is handled in §8.1 Rule 3 and §8A.5. |
| **D9** | **53 users hold more than one subscription row**; worst case 24 rows / 20 simultaneously active | Phase 1 Finding 7 | **Follow-up after consolidation** | No constraint prevents unbounded concurrent `active` *paid* rows per user (the active-*trial* case is now handled by §8A). The worst-case account is almost certainly QA, but that is not a basis for deleting an alpha user's rows — modelling work, not cleanup. |
| **D10** | **Admin override replaces rather than stacks credits** (A5), and is unaudited | New in v4 (§4.1, §4A) | **Defined in §4A; pending Open Decision 3** | No longer merely informational: §4A defines the intended semantics (**Policy D, default plan-only**, separate audited adjustment function). Not fixed by the consolidation — the admin code is untouched until the policy is approved. |

---

## 15. Observability and Rollout

### 15.1 Instrumented paths

Structured logging is added in the **same step** as the code it instruments, so the §12 suites exercise code that already logs and runtime verification has data from the first execution:

`linkSubscriptionToUser` · `linkSubscriptionFromCheckoutSession` · `syncSubscriptionWithStripe` · **`/users/me` self-heal eligibility decisions** (§10.4) · webhook subscription writers (W7–W10) · allowance grants (A1) · **trial single-active upsert** (§8A) · P2002 recovery · cleanup execution.

### 15.2 Fields

`userId` · `checkoutSessionId` · `stripeCustomerId` · `stripeSubscriptionId` · `localSubscriptionId` · `plan` · `sourceWriter` (which of W1–W14) · `result` · `allowanceMinutes` · `allowanceGranted` (boolean) · `transactionOutcome` (`committed` | `rolled_back` | `not_opened`) · `reconcileEligibility` (§10.5 outcome, on self-heal paths) · `executionDurationMs` · `errorCategory`.

**Never logged:** email, name, payment details, card metadata, raw Stripe objects, raw error messages, or any customer-sensitive payload. `errorCategory` is a fixed vocabulary (`stripe_error`, `db_error`, `db_conflict`, `validation_error`), not a message.

`sourceWriter` is new in v4 and makes the writer map (§2) observable — when something writes a subscription row unexpectedly, this identifies which of the 14 did it. `reconcileEligibility` makes the §10.4 self-heal rule observable, so a regression of the canceled-subscriber loop shows up as a rising `skip_canceled`/`reconcile_eligible` ratio rather than silently.

### 15.3 Result classifications

| Classification | Meaning |
|---|---|
| `linked` | New row created and allowance granted in this call — normal first-time path |
| `already_linked` | Existing row matched by `stripe_sub_id`; fields reconciled, no new grant — normal idempotent retry |
| `unique_conflict_recovered` | Lost the `P2002` race, located the winner, returned cleanly. **Not emitted until the unique constraint on `subscriptions.stripe_sub_id` exists** — see the Step 5 note below |
| `ownership_conflict` 🆕 | The `stripe_sub_id` is already linked to a **different** `user_id`. Nothing is written and no allowance is granted — ownership is never silently reassigned. Carries `errorCategory: 'db_conflict'`. **Added in Step 5** |
| `missing_customer` | Checkout Session carried no `customer` |
| `missing_subscription` | Session had no resolvable `subscription` — not a subscription checkout, or an unsupported reference shape |
| `plan_unresolved` | Price matched no known plan and neither metadata source gave a usable paid-plan fallback; no row and no grant written (the `stripe_customer_id` persist at §3.2 step 2 has already happened by design) |
| `failed` | Any other failure, with `errorCategory` |

**Step 5 amendment — why `ownership_conflict` was added.** §5.3 described verifying that a matched row's `user_id` matches the caller, but defined no outcome for a mismatch, so the case had no expressible result. Folding it into `failed`/`db_conflict` would have made a genuine data-integrity event indistinguishable from ordinary conflicts in the §15.4 rollback triggers; folding it into `already_linked` would have reported it as a normal idempotent retry. It is therefore a first-class classification.

**Step 5 note — `unique_conflict_recovered` is currently unreachable.** No unique constraint on `subscriptions.stripe_sub_id` exists yet (`schema.prisma` has only the PK and four non-unique indexes), so no `P2002` can be raised on that column and no recovery path is implemented. Step 5 delivers **application-level sequential idempotency only**: the row lookup and the grant share one transaction, so a *sequential* re-call sees the committed row and returns `already_linked`. **Concurrent correctness is not achieved and is not claimed** — two simultaneous callers can still both miss the lookup. That is deferred to the approved constraint migration, at which point this classification becomes reachable and the recovery path is implemented.

`allowance_repaired` from v3 is **removed**. It existed to describe repairing a row whose grant status was unknown — a determination the data model cannot support (§5.4) and which §6 has now decided not to build. A classification that can never be legitimately emitted is worse than no classification.

### 15.4 Success metrics and rollback triggers

**Healthy after rollout:**
- `linked` + `already_linked` account for essentially all checkout-link outcomes.
- `unique_conflict_recovered` is non-zero only under genuine concurrency and always resolves without error — its presence is *proof the constraint is working*, not a problem.
- Zero `plan_unresolved` on paths where a known price was used.
- Credit delta per successful link equals exactly one plan allowance.
- `transactionOutcome: rolled_back` is rare and always paired with an `errorCategory`.

**Rollback triggers — revert the import redirection immediately if any occurs:**
- Any `linked` classification emitted twice for one `stripeSubscriptionId`.
- Any user's credit delta exceeding one plan allowance for a single checkout.
- `plan_unresolved` on a checkout that previously linked successfully — indicates the §3 plan-resolution change regressed a working case.
- Sustained `failed`/`stripe_error` above pre-migration baseline.
- Any `P2002` that does **not** resolve to a `unique_conflict_recovered`.

Rollback is the two-line import revert (§11.1). **The constraint and the cleanup are not rolled back with it** — they are correct independently of which service implementation is live, and dropping the constraint would reopen the defect.

### 15.5 Retention

Temporary logging stays for **one full release cycle**, reviewed at the same checkpoint as the wrapper. Reduce to error-level only when: the `linked`/`already_linked`/`unique_conflict_recovered` distribution matches expectations, `failed` is at or below baseline, no rollback trigger has fired, and the webhook checklist (§11.3) has passed with real deliveries.

**The wrapper may be removed** when all of the above hold **and** no import of `billing.service.ts` remains in the codebase **and** at least one full release has elapsed. Wrapper removal is a separate release, never bundled with this one.

---

## 16. Risk Assessment

| Dimension | Before remediation | After v4 implementation | Residual |
|---|---|---|---|
| **Historical data** | 🔴 **High** — 12 duplicated ids, 30 rows, 18 surplus, 9 users; constraint cannot be added | 🟢 **Low** — cleaned and archived inside one transaction with the constraint; re-duplication structurally impossible | Archive must be retained; reversal depends on it |
| **Alpha-user impact** | 🟠 **Medium** — 9 real alpha users hold inconsistent rows; test mode limits financial exposure but not experience | 🟢 **Low** — no balances changed, no rows lost (archived), no user-visible change | Users keep over-granted minutes by design (§8.3) |
| **Duplicate credit grants** | 🔴 **High, confirmed** — `bf112c04` holds 830 vs 430 entitled, arithmetically exact | 🟢 **Low** — constraint + atomic transaction make double-granting impossible on the checkout path | Renewal path (W10) still relies on the per-event ledger — the §6 Option C gap, deferred to live mode |
| **Cleanup execution** | 🟠 **Medium** — cleaning while the defect is live risks racing it | 🟢 **Low** — prevention ships first; cleanup and constraint share one transaction; any failed assertion rolls back everything | Dry-run must be approved and re-verified immediately before execution |
| **Concurrency (checkout / `stripe_sub_id`)** | 🔴 **High** — 14 writers, no constraint, no transactions, check-then-write throughout | 🟢 **Low** on the checkout path | W11 (admin) keeps the unsafe shape but is a constraint-exempt NULL writer, deferred to §4A |
| **Trial-row duplication** | 🟠 **Medium** — 53 surplus active trial rows, 31 users; W1+W14 racy; invisible to the `stripe_sub_id` constraint | 🟢 **Low** — partial unique index + single-active upsert (§8A); cleaned in the same transaction | Trial grants are capped at 30 min, so even the pre-fix exposure was bounded |
| **Admin override semantics** | 🟠 **Medium** — silent credit overwrite, unaudited, can destroy paid/consumed balance (A5) | 🟠 **Medium — unchanged by this migration** | Deliberately untouched pending §4A / Open Decision 3; documented, not silently altered |
| **Webhook** | 🟠 **Medium-High** — never executed; four unexercised writers on the money path | 🟡 **Medium** — consolidated onto the shared helper and made atomic, but verification is environmental | Cannot fall below Medium until §17 Gate 6 passes with real deliveries |
| **Migration (code)** | 🟡 **Medium** — larger than v3 assumed: one function rebuilt, four allowance implementations removed, a type extracted, self-heal reworked, trial writers converged | 🟢 **Low-Medium** | The §3 rebuild and §10 eligibility change are genuine behaviour changes on live paths — §12.1 baseline tests exist to make them visible |
| **Rollback** | 🟢 **Low** | 🟢 **Low** — two-line import revert; constraint, indexes, and cleanup deliberately not reverted with it | Once the constraints are live, reverting to legacy code that lacks P2002 handling would surface raw errors — so revert the *imports*, not the constraints |
| **Stripe live-mode readiness** | 🔴 **High** — D1 (259 stale rows), D4 (drift), D5 (webhook unproven), **no renewal idempotency (D5b)** | 🟠 **Medium — and gated** | **This migration does not make the system live-mode ready.** D1, D4, and the **§6 Option C ledger are hard prerequisites (§17 Gate 9). Live mode must not be enabled until the ledger is implemented, migrated, tested, and verified** — this row is the risk-table home of that blocker |

**Overall: 🔴 High before remediation → 🟢 Low-Medium after**, with the honest qualifier that "after" covers the checkout-linking and trial paths thoroughly and the renewal/live-mode path only partially, by deliberate scoping — and that the **live-mode readiness row stays gated on the D5b ledger blocker**.

---

## 17. Final Implementation Sequence

Sixteen steps, nine approval gates. Every step states its files/objects, whether it can write, how to roll it back, and what evidence is required before proceeding. Changes from the first v4 draft: the trial single-active fix joins defect prevention (step 6b) and the trial cleanup joins the fused transaction (Gate 3b); the W9 cancel fix joins step 6; and a terminal **Gate 9 — live-mode ledger blocker** is added.

| # | Step | Files / DB objects | Mode | Rollback | Evidence required to proceed |
|---|---|---|---|---|---|
| **1** | **Gate 1 — v4 plan approval** (this finalization) | This document | Read-only | n/a | Explicit approval of the four Gate-1 conditions: §6/§17-Gate-9 (ledger live-mode blocker), §10 (self-heal eligibility + W9 fix), §8A (trial invariant in-scope), §4A (admin Policy D). Plus §8.3, §9. |
| **2** | Baseline tests against current behaviour | new `subscription.service.test.ts`, `credit-balance.service.test.ts`; existing `billing.webhook.test.ts` untouched | Write (tests only) | Delete test files | All baseline tests green; defect-documenting tests explicitly labelled |
| **3** | Extract `PrismaClientLike` to `lib/prisma.ts`; re-export from `sessions.service.ts`, `points.service.ts` | `lib/prisma.ts`, `sessions/sessions.service.ts:17`, `gamification/points.service.ts:16` | Write (code) | Revert commit | Full type-check and existing suites green; zero call-site changes required |
| **4** | Add `client: PrismaClientLike = prisma` to `addSubscriptionAllowanceMinutes`; delete A2/A3/A4 and route their call sites to it | `billing/credit-balance.service.ts:35`, `billing.webhook.ts:88,436,563-578`, `billing.service.ts:26,349,815` | Write (code) | Revert commit | §12.2 helper tests green (singleton **and** tx client); `billing.webhook.test.ts` green; grep confirms one stacking implementation remains |
| **5** | Build `linkSubscriptionFromCheckoutSession()` + atomic transaction + structured logging | `billing/services/subscription.service.ts` | Write (code) | Revert commit | §12.2/12.3/12.5 green; §12.4 concurrency test written, expected to fail until Gate 3b — recorded as expected |
| **6** | Make `syncSubscriptionWithStripe` atomic; implement §10.4 self-heal eligibility + single-flight + cooldown + non-blocking on both `/users/me` paths; **fix W9** (stop writing `plan_type:'trial'` on cancel) | `subscription.service.ts:393-498`, `users/user.service.ts:1014-1020,1111-1120`, `billing.webhook.ts:507-521` | Write (code) | Revert commit | §12.10 eligibility tests green; §12.7 W9 test green; single-flight collapses concurrent calls to one Stripe round-trip |
| **6b** | Add `ensureSingleActiveTrial` helper; converge W1 + W14 on it; route their trial credit-set through the audited path stub | `users/user.service.ts:886-901`, `billing/services/subscription.service.ts:79-133` | Write (code) | Revert commit | §12.8 trial concurrency/coexistence tests green (against the partial index, added at Gate 3b — until then the P2002-path test is marked expected-pending) |
| **7** | **Deploy defect prevention** (steps 3–6b). Imports **not** yet redirected | above | Write (deploy) | Redeploy previous build | Monitored 24h: no rollback trigger (§15.4); `stripe_webhook_events`, duplicate counts, and active-trial-per-user counts unchanged |
| **8** | **Gate 2 — cleanup dry-run approval** for **both families** | Read-only script; `subscriptions`, `profiles`, Stripe GETs | **Read-only** | n/a | §8.4 dry-run (stripe_sub_id) **and** §8A.5 dry-run (trial) produced; both survivor lists approved; per-user over-grant amounts acknowledged under §8.3 |
| **9** | **Gate 3 / 3b — cleanup + both indexes, ONE transaction.** Archive table created first, then the §9 fused transaction (stripe-dup rows + trial-dup rows + unique constraint + partial trial index) | new archive table; `subscriptions` (18+53 deletes, ≤12 updates); `subscriptions_stripe_sub_id_key`; `subscriptions_one_active_trial_per_user` | **Write** | `ROLLBACK` on any failed assertion; post-commit, restore from archive by `cleanup_batch_id` and `DROP` both index objects | Both dry-runs re-run immediately beforehand and byte-identical to approved; **all** §8.4 and §8A.5 post-checks pass inside the transaction |
| **10** | **Gate 4 — post-cleanup verification** | `subscriptions`, archive, `profiles` | **Read-only** | n/a | Both preflights return 0; counts reconcile (383/127/127 and active-trial-per-user ≤1); archive holds 18+53; **balances provably unchanged**; the 21 trial+paid coexistence users intact; §12.4 + §12.8 pass against the real indexes |
| **11** | Redirect the three call sites; update the debug script; convert `billing.service.ts` to the thin wrapper | `users/user.controller.ts:4,347`, `users/user.service.ts:6,1016,1113`, `scripts/debug-billing-subs.ts:2`, `billing/billing.service.ts` | Write (code) | **Two-line import revert** — constraints and cleanup deliberately *not* reverted | Full regression suite (§12.11) green including unmodified `billing.webhook.test.ts` |
| **12** | **Gate 5 — full regression + deploy + monitored alpha verification** | All of the above | Write (deploy) | Import revert per step 11 | Suite green; then test-mode Stripe: single guest checkout → one `linked`; rapid retried checkout → `already_linked`/`unique_conflict_recovered`, never `linked` twice; **canceled-subscriber `/users/me` emits `skip_canceled`, no re-sync** |
| **13** | **Gate 6 — webhook readiness verification** (§11.3) | Stripe test dashboard; `stripe_webhook_events` | Verify only | n/a | All 14 checklist items pass; `stripe_webhook_events` holds real completed rows for the first time |
| **14** | **Gate 7 — one-release checkpoint.** Reduce logging; remove the wrapper in a **later** release | `billing.service.ts`, logging call sites | Write (code) | Revert commit | §15.5 conditions met; zero imports of `billing.service.ts` remain |
| **15** | **Gate 8 — admin-override policy** (§4A, when approved): implement Policy D, separate audited `adminAdjustCredits` | `admin/admin.service.ts:1113-1191` | Write (code) | Revert commit | Open Decision 3 resolved; §12.9 upgrade/downgrade/same-plan/partial-consumption tests green; `audit_logs` row written per override |
| **16** | **🔴 Gate 9 — Stripe live-mode ledger BLOCKER** (§6 Option C) | new entitlement-ledger table + composite unique index; grant call sites | Write (schema + code) | Drop table (inert) / revert commit | **Live mode MUST NOT be enabled until this passes.** Ledger implemented, migrated, tested (idempotent initial/renewal/plan-change grants), and verified in test mode with real webhook deliveries |

**Approval gates, consolidated:** (1) v4 plan · (2) cleanup dry-run, both families · (3/3b) cleanup + both indexes execution · (4) post-cleanup verification · (5) full regression + deployment · (6) webhook verification · (7) wrapper removal · (8) admin-override policy · **(9) live-mode entitlement-ledger blocker.**

**Read-only steps:** 1, 8, 10. **Code-only steps:** 2–6b, 11, 14, 15. **Production-data write:** step 9 only (behind Gates 2 and its own execution gate). **Live mode is gated behind step 16 and cannot proceed without it.**

---

## Changelog — Gate-1 incorporations (first v4 draft → finalized v4)

The four approval conditions, and where each is integrated (not appended):

| Condition | What changed | Sections touched | New repository evidence |
|---|---|---|---|
| **1 — Ledger as hard live-mode blocker** | Option C reframed from "mandate before live mode" to a **formal release gate**. Idempotency-key dimensions defined (`user + stripe_subscription + stripe_invoice/billing_event + entitlement_type`). Added as **D5b**, risk-table live-mode row, and **§17 Gate 9** ("live mode MUST NOT be enabled until…"). | §0 (header blocker), §6, §14 D5b, §16, §17 Gate 9, Open Decisions | — (design change; key dims from the `point_transactions` precedent) |
| **2 — Exact self-heal eligibility** | §10 rebuilt: explicit **correctness hierarchy** (constraint = guarantee; single-flight/cooldown = reduction only, per-instance, *not* correctness); **exact eligible/ineligible rule** keyed on "genuinely incomplete linkage," not `plan==trial`; **W9 fix** (stop writing `plan_type:'trial'` on cancel — redundant with read-time fallback at `subscription.service.ts:62-66`). Eligibility outcomes logged. | §10.2–10.6, §2 W9, §12.10, §12.7, §15, §17 step 6 | `getSubscription` already does read-time canceled→trial fallback (`subscription.service.ts:40-66`), making the W9 write both harmful and redundant |
| **3 — Trial-duplication as a distinct invariant** | Promoted D3 from "informational/follow-up" to **in-scope §8A**: business rule ("≤1 active trial per user") derived from evidence; **partial unique index** + single-active upsert; cleanup dry-run, survivor rule, archive, verification; joins the fused transaction (§9). | §0, §2.4/W1/W14, §8A (new), §9, §12.6/12.8, §17 step 6b + Gate 3b | **All 53 surplus trial rows are `active`** (1 canceled total); **21 users hold active trial + active paid** (coexistence must be preserved); **fifth trial writer W14** found at `createCheckoutSession` (`subscription.service.ts:79-133`); `getSubscription` is newest-row-wins |
| **4 — Admin override semantics** | New **§4A**: four policies compared; recommend **Policy D (explicit choice, default plan-only)**; **separate state-mutation from credit-mutation**; route credit changes through a **separate audited `adminAdjustCredits`**, not the shared helper; audit metadata to `audit_logs`. D10 upgraded from informational. | §4A (new), §2 W11/W14, §14 D2/D10, §12.9, §16, §17 Gate 8, Open Decisions 2–3 | `applyUserSubscriptionPlan` (`admin.service.ts:1113-1191`) overwrites credits unaudited; `audit_logs` table exists (`action`+`jsonb details`); admin path is the confirmed cause of the 44 stray paid rows (D2) |

### Additional evidence discovered during finalization

- **W14 — a fifth trial writer**, `createCheckoutSession` trial branch (`subscription.service.ts:79-133`), `findFirst({user_id})`-then-write on *any* row, overwriting trial credits. Missed by both Phase 1 and the first v4 draft. Total writers: **14**.
- **A distinct trial credit-*reset*** in W14 (separate from the five subscription-plan grant paths A1–A5 in §4, because it sets rather than stacks trial credits) — reinforcing §4A's argument that credit mutation should be a separate, deliberate operation, and handled by §8A's audited path.
- **Trial invariant sized exactly:** 31 users / 53 surplus / all active / 21 coexistence — enabling a concrete partial-index design rather than a hand-wave.
- **`audit_logs` shape confirmed** (`id, org_id, actor_id, action, details jsonb, created_at`; 2 rows) — a usable home for §4A admin audit records.

---

## Changelog — Step 4 / Step 4b (implementation-phase corrections)

Recorded here because these are corrections to the plan's own inventory, discovered while executing it. **Documentation only — no section of the plan's strategy changed.**

| # | Discovery | Section corrected |
|---|---|---|
| 1 | **A4b — a sixth allowance implementation / fifth automated stacking implementation.** Inlined plan-change grant inside `handleSubscriptionUpdated` (`billing.webhook.ts`, `planChanged` branch). Stacks the full new-plan allowance, including on a downgrade. Missed by Phase 1, by the first v4 draft, and by this finalization; found during Step 4 repository verification. | §0, §4.1, §4.3 |
| 2 | **§2.1 W8 was factually wrong.** It stated `customer.subscription.updated` performs "No grant". It does grant — A4b. Root cause: the writer map was enumerated by grepping subscription-row writes, which cannot see a `profiles.credits` mutation nested in the same handler. | §2.1 (W8), §4.1 |
| 3 | **A4/A4b are equivalent to A1 but not byte-identical.** The inline blocks write `credits: existingMinutes + planCredits`; A1 writes `ceil(newSeconds / 60)`. Equal iff `credits === ceil(credits_seconds / 60)` — an invariant every live writer maintains and all nine preflight users satisfy. §4.3's "Behaviour-identical" note for A4 was imprecise. | §4.1a (new), §4.3 |
| 4 | **Two early-return asymmetries that a naive consolidation would have broken.** `handleInvoicePaymentSucceeded` uses `if (planCredits <= 0) return;` — a handler-level return that also skips the renewal email. `handleSubscriptionUpdated` uses a nested `if (planCredits > 0)` that must still fall through to the row update. Both preserved. | §4.3 |
| 5 | **A6 added to the inventory** — the trial credit reset in `createCheckoutSession` was described in prose (finalization notes) but absent from the §4.1 table. Classified as overwrite/reset, left separate. | §4.1, §4.3 |

**Post-Step-4b state:** exactly one automated stacking implementation (A1, transaction-capable) serves all five automated grant paths. Two overwrite/reset implementations (A5 admin, A6 trial) remain intentionally separate pending §4A and §8A.

---

## Changelog — Step 5 (implementation-phase corrections)

**Documentation-only corrections to the plan's own contract, made while executing §3 and §5.**

| # | Correction | Section |
|---|---|---|
| 1 | **Plan-resolution hierarchy amended from two levels to three**, with `session.metadata.planType` added at level 3. Without it, checkout linking and `handleCheckoutSessionCompleted` — which already resolves from session metadata — could disagree on the plan for one subscription. The local row's `plan_type` is explicitly excluded as a fallback. | §3.2 step 5 |
| 2 | **`ownership_conflict` added as an eighth classification.** §5.3 required verifying the matched row's `user_id` but defined no outcome for a mismatch, leaving the case inexpressible. | §15.3 |
| 3 | **`unique_conflict_recovered` documented as currently unreachable.** No unique constraint on `stripe_sub_id` exists, so Step 5 delivers sequential idempotency only. Concurrent correctness is explicitly deferred, not claimed. | §15.3 |
| 4 | **Atomicity scope is five paths, not one.** §5 was written around checkout linking; Step 4b established that `handleSubscriptionUpdated` also grants, and `syncSubscriptionWithStripe`, `handleCheckoutSessionCompleted` and `handleInvoicePaymentSucceeded` each pair a row mutation with a grant. All five are now transactional. | §5, §2.1 |
| 5 | **Profile-cache invalidation deferred to the caller.** §3.2 step 8 specifies `invalidateUserProfileCache`, but that lives in `user.service.ts`, which already imports `billing.service` — calling it from `subscription.service.ts` would create an import cycle. The canonical function clears billing caches only; profile-cache invalidation belongs to the caller at import-redirection time. | §3.2 step 8 |

---

## Changelog — Step 9 / 9A (production cleanup executed)

**The §8 / §8A cleanup and the §7 unique constraints were executed against production on
2026-07-27.** Full operational record: `apps/api/scripts/STEP9-CLEANUP-EXECUTION-REPORT.md`.

**Corrected paid-row invariant.** Steps 8 / 8B and the risk table described the cleanup as
leaving paid rows unchanged. That was inaccurate: the `stripe_sub_id` dedup **removes duplicate
paid rows by design**, so the raw paid-row count dropped from 200 → 185. The correct invariant,
which supersedes every "paid rows unchanged" phrasing in §8, §8A, §16 and the Gate-4 row of §17,
is:

> **No unique paid subscription or paid entitlement is lost.**

Enforced by two regression assertions now in `scripts/billing-cleanup-dry-run.ts`
(`distinct_paid_stripe_subscriptions_unchanged`,
`every_removed_paid_row_has_same_user_survivor_same_stripe_id`) and section 8 of
`scripts/verify-billing-subscription-cleanup.sql`; both pass on the committed production state.

**Actual final values** (replace the projected 383/… figures used pre-execution):

| Metric | Value |
|---|---|
| Total subscription rows | **333** |
| Paid rows | **185** |
| Distinct paid Stripe subscriptions | **126** (unchanged) |
| Distinct Stripe IDs | **127** (unchanged) |
| Archive rows | **71** |
| Deleted rows | **68** (53 duplicate active trials + 15 duplicate Stripe rows) |
| Cleared stale Stripe links | **3** |
| Cleanup batch ID | `4ab04577-1e5c-400e-9015-7c0679e06e82` |
| Both unique indexes | valid + enforcing |

**Applied outside `prisma migrate deploy`.** Production `_prisma_migrations` is out of sync with
the repo (last finished entry is April 2026, though later schema exists), so the migration ran
as a direct atomic `BEGIN; … ; COMMIT;`. Reconciling `_prisma_migrations` is deferred follow-up,
not part of this work.

---

## Changelog — v3 → v4

### What changed, and which Phase 1 finding caused it

| # | Change | Caused by |
|---|---|---|
| 1 | Executive summary rewritten to separate four categories: defect prevention, historical cleanup, service consolidation, adjacent integrity work (§0) | Preflight FAIL — the problem is broader than service duplication |
| 2 | **New §2: complete writer map (14 writers).** v3 listed 3 call sites (correct as import scope, insufficient as a concurrency map). Adds W1 (trial signup), W11 (admin override), and — in finalization — W14 (`createCheckoutSession` trial branch), **none identified by v3 or Phase 1** | Root-cause analysis; v4 repository analysis |
| 3 | **§3 rewritten from "preserve" to "rebuild".** v3 §7 described a checkout/reconciliation separation as existing; it does not | Phase 1 Blocker 2 |
| 4 | **§4 expanded from three allowance implementations to five** — and to **seven** during Step 4 (see the Step 4/4b changelog above). Phase 1 found A1–A3; v4 adds **A4** (inlined at `billing.webhook.ts:563-578`) and **A5** (admin overwrite at `admin.service.ts:1172`); Step 4 adds **A4b** (inlined plan-change stack) and **A6** (trial overwrite) | Phase 1 Blocker 1, extended by v4 analysis and Step 4 verification |
| 5 | **Client type resolved from repository evidence, not left open.** v3 Open Decision 3 asked whether to duplicate `DbClient`. Answer: `PrismaClientLike` already exists and is exported (`points.service.ts:16`) with the exact optional-defaulted shape needed; extract to `lib/prisma.ts` | v4 analysis — resolves a v3 open decision |
| 6 | **§5 defines all eight outcome cases explicitly**, including two v3 lacked: `missing_customer` and `plan_unresolved` (with an explicit prohibition on falling back to `trial`) | Required by the §3 rebuild |
| 7 | **§6 marker decision reopened and re-answered.** v3 said "no marker, no evidence of under-crediting". v4: evidence is of **over**-crediting; Option B rejected as structurally unable to express renewals; Option C recommended but deferred to live mode; Option A adopted now | Phase 1 Finding 2 |
| 8 | **§8: full historical cleanup workstream** — survivor rules, archival schema, credit policy, dry-run and post-checks. v3 deferred this entirely to an unwritten document | Preflight FAIL |
| 9 | **§9: sequencing inverted and then fused.** v3 put the constraint at step 3, ahead of atomicity. v4 ships prevention first and executes cleanup + constraint in **one transaction**, eliminating the unprotected window without a writer freeze | Phase 1 Recommended Cleanup Strategy step 2 |
| 10 | **§10: `/users/me` self-heal analysed and guarded** (single-flight, non-blocking, cooldown), plus the newly identified permanent-resync loop for canceled subscribers | Phase 1 Root Cause; v4 analysis of W9 |
| 11 | **§11.3: 14-item webhook readiness checklist** | Phase 1 Finding 8 |
| 12 | **§12: testing expanded** to unit / transaction / concurrency / P2002 / cleanup / webhook / regression, on the repo's established Jest+`$transaction` mock pattern. Baseline tests now explicitly include two that **document defects** | Blockers 1 and 2 |
| 13 | **§14: new "Adjacent Billing Integrity Work"** — 10 items classified. **D2's cause identified**: the 44 rows are admin overrides (28/35 `pro` have `end_date IS NULL`; 0/136 Stripe-linked do) | Phase 1 Findings 3–7; v4 analysis resolves Finding 4 |
| 14 | **§15: `allowance_repaired` classification removed**; `sourceWriter`, `transactionOutcome`, `stripeCustomerId`, `localSubscriptionId` added; rollback triggers defined | §6 decision makes `allowance_repaired` unemittable |
| 15 | **§16: risk table restructured** to before / after / residual, with live-mode readiness called out as **not** achieved by this migration | Required by the preflight outcome |
| 16 | **§17 sequence with per-step mode / rollback / evidence** (finalized to 16 steps, 9 gates) | Required by the cleanup workstream |

### v3 assumptions that remain valid

1. **`subscription.service.ts` is the correct canonical service** — re-verified on five independent grounds (§1).
2. **The import-migration scope is exactly three call sites** — re-verified at `user.controller.ts:4,347` and `user.service.ts:6,1016,1113`.
3. **The thin-wrapper rollback strategy** — unchanged (§11.1).
4. **NULL semantics under a unique constraint** — re-verified; the 256 NULL rows are unaffected (§7.2).
5. **`addSubscriptionAllowanceMinutes` cannot join a transaction as written** — confirmed (`credit-balance.service.ts:35`, singleton at `:2`).
6. **The transaction-client pattern is the right fix** — confirmed, with a *better* in-repo precedent than the one v3 cited (`points.service.ts` over `sessions.service.ts`).
7. **Stripe reads belong outside the transaction** — unchanged (§5.2).
8. **The debug script pagination difference (100 vs 500)** — re-verified at `billing.service.ts:523` and `subscription.service.ts:352`.
9. **Billing should call `invalidateUserProfileCache` directly** — confirmed; `subscription.service.ts` currently never calls it.

### v3 assumptions rejected

| Rejected assumption | Why |
|---|---|
| "The preflight will most likely come back clean" | 12 duplicated values, 30 rows, 9 users |
| "§7's checkout/reconciliation separation is carried forward, unchanged — approved" | The separation does not exist; canonical `linkSubscriptionToUser` delegates to a customer-wide list |
| "Extending `addSubscriptionAllowanceMinutes` makes allowance-granting atomic" | It would have made **one of five** implementations atomic |
| "No evidence of existing under-credited rows ⇒ no marker needed" | True but irrelevant; the evidence is of **over**-crediting |
| "Two functions, three call sites" as the concurrency scope | 14 writers touch subscription state (v4 draft found 13; finalization added W14) |
| "The constraint can be added before the atomicity work" | Only safe against clean data |
| "Whether to duplicate `DbClient` is an open decision" | Resolved from repository evidence — `PrismaClientLike` exists |
| "All `trial`/`incomplete` rows have NULL `stripe_sub_id`" | One trial row carries `sub_1TCOZRBt…` |
| "The webhook is a live writer to design around" | It has never executed in this environment |

---

## Open Decisions

The finalization **closed two of the first draft's four open decisions** from the Gate-1 conditions (trial-duplication scope → now in-scope §8A; ledger timing → now a hard blocker §17 Gate 9). What genuinely remains for product-owner / engineering-lead judgement:

**1. Credit over-grant policy — product owner.** *(unchanged)*
Recommend **forgive and document**: leave all balances untouched, record exact per-user over-grants with the archive batch. The alternative (reclaim unused excess) degrades alpha-user accounts for minutes that cost nothing in test mode. *Decision required because §8.3 forbids the cleanup from touching balances — reclamation, if wanted, is separate work.*

**2. Admin override credit semantics (§4A, §14 D10) — product owner.** *(now a real, framed decision — not "confirm it's intended")*
Recommend **Policy D: explicit admin choice, defaulting to plan-only**, with subscription-state mutation separated from credit mutation and any credit change routed through a **separate audited `adminAdjustCredits` function** — not the shared stacking helper. The current behaviour (Policy B: silent overwrite, unaudited, can destroy paid/consumed balance) is left untouched until this is decided. *Decision required because it changes an admin-facing behaviour and defines new audited surface; it is §17 Gate 8, off the consolidation critical path.*

**3. Admin-override policy timing — engineering lead.**
Whether Gate 8 (admin Policy D) ships **within** this consolidation release or as an immediate follow-up. Recommend follow-up: it is independent of the checkout/trial defect and its own tests (§12.9) can land separately. *Decision required only to sequence it.*

> **Resolved by this finalization (no longer open):**
> - *Trial-duplication scope* — now **in-scope** (§8A), per Gate-1 condition 3. Not a decision anymore.
> - *Allowance-ledger timing* — now a **hard live-mode blocker** (§6, §17 Gate 9), per Gate-1 condition 1. Not deferred-by-judgement anymore; it is gated.
> - *`DbClient`/`PrismaClientLike` location* — resolved from evidence (extract to `lib/prisma.ts`, §4.2).
> - *Self-heal disposition* — resolved: guard with an exact eligibility rule + fix W9 (§10), not remove (yet).

---

## Implementation Readiness Verdict

### ✅ Ready for cleanup dry-run planning.

Unchanged from the first v4 draft, and the finalization did not surface a new blocker — it tightened scope and hardened gates. The four Gate-1 conditions are now integrated into the plan's sequence and risk model, not appended: the ledger is a formal live-mode gate, the self-heal has an exact eligibility rule and a defined W9 fix, trial-duplication is a first-class in-scope invariant with its own dry-run and index, and admin semantics are defined with a recommendation and a separation of concerns.

**Next authorized action: Gate 1 sign-off** on the remaining Open Decisions above (over-grant policy; admin Policy D and its timing) plus acknowledgement of the now-firm items (ledger blocker, trial scope, self-heal fix).

On sign-off, the next authorized work is **step 2 — baseline tests**, code-only, no production data. The first production write is **step 9 (Gate 3/3b)**, behind the dry-run gate. **Stripe live mode remains gated behind step 16 (Gate 9) and must not be enabled before it.**

No genuine new blocker was found, so the verdict holds at **ready for cleanup dry-run planning** — not "ready for implementation" (that needs Gate 1 sign-off), and not "not ready" (nothing discovered forces a stop).

---

## Stop Condition

This planning task ends here. Not done and not to be done without explicit approval: modifying production data, executing cleanup, creating migrations, changing schema, editing implementation files, updating tests, redirecting imports, configuring Stripe, or beginning any implementation.

**Confirmation: no application code, schema, migration, import, service, or test file was modified to produce this finalization, and no production or Stripe data was written.** The read-only queries run for this revision executed inside `BEGIN TRANSACTION READ ONLY`; the only Stripe calls were `GET` retrieves in the prior phase. This document is the only artifact changed.
