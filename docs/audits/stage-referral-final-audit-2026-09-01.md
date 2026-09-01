# Referral Final Audit — 2026-09-01 (post-10-этапов)

**Автор:** Cursor (read-only диагностика)  
**Скоуп:** Stages **202.21 → 202.30** (Phase B FinTech, Leader UX, Region admin, Money audit, Snapshot/insurance, Glossary, Engagement perf ×2, i18n polish, me/rank perf)  
**Бaseline:** [`stage-referral-health-2026-09-01.md`](./stage-referral-health-2026-09-01.md) (3 P0 + 9 P1 + 11 P2)  
**Метод:** grep + чтение SSOT / routes / migrations / FannRent `pg_proc` + indexes. **Код не менялся.**

---

## TL;DR

| Ось | Status | Кратко |
|-----|--------|--------|
| 1. SSOT discipline | ⚠️ | Pool/split/cap/snapshot/qualified-host/region/insurance — целы; dual «партнёр» metrics остаётся; ADR-reference naming drift |
| 2. Write-path | ⚠️ | **3 P0 закрыты** (202.24); fraud-queue / emergency-actions без audit — carryover P1 |
| 3. i18n | ⚠️ | Community THB + ProfileTabSettings RU **закрыты** (202.29b); admin user page + rank bucket hint RU — открыты |
| 4. Design system | ✅ | Нет `.module.css` / `Badge warning` / emoji-lock в referral Stage 202.22 |
| 5. Performance | ✅ | Engagement/rank/cap hot spots → RPC + cache; legacy Node fallbacks остаются (warn-once) |
| 6. Dead code / docs | ⚠️ | Legacy reducers **активны** (fallback); `SYSTEM_MAP` drift по новым routes |
| 7. Race / consistency | ⚠️ | Cap atomic RPC OK; rank 600s vs leaderboard 300s staleness; region LWW |
| 8. Integration | ⚠️ | Unit/regression по этапам есть; **нет** сквозного referral e2e |
| 9. Production readiness | ⚠️ | FannRent migrations applied; runbooks 4/6; monitoring partial |

**P0 findings:** 0 (было 3 — закрыты)  
**P1 findings:** 8 (было 9 — 6 закрыты, 5 новых/carryover)  
**P2 findings:** 12  

**Вердикт для media demo через ~30 дней:** **CONDITIONAL GO** — RU-first soft-launch и демо калькулятора/leaderboard/engagement **можно**; EN admin + quest money + public leader page — **нет**.

---

## Re-audit P0/P1 (от первого audit)

### Закрыты реально (✅)

| # | Finding (2026-09-01) | Stage | Evidence |
|---|----------------------|-------|----------|
| P0 | `PATCH /api/v2/admin/payouts/[id]` без audit | 202.24 | `recordAdminAudit` + `readIdempotencyKeyFromRequest` в `app/api/v2/admin/payouts/[id]/route.js` |
| P0 | `PATCH .../partner-payout-profiles/[id]` verify без audit | 202.24 | `recordAdminAudit` в `partner-payout-profiles/[id]/route.js` |
| P0 | `PATCH .../wallet/payouts` без audit | 202.24 | `recordAdminAudit` ×2 paths в `wallet/payouts/route.js` |
| P1 | Snapshot → live policy для старых броней | 202.25 | `resolveFintechPolicyForBooking`: pre-cutover frozen canon + post-cutover `FinSnapshotMissingError` (`fintech-snapshot.service.js:55-70`) |
| P1 | Insurance 0.005 hardcode в waterfall | 202.25 | `computeInsuranceReserveThb(platformGrossRevenueThb, policy)` в `fintech-waterfall.js` |
| P1 | `/engagement` без server cache | 202.27 | `unstable_cache` 60s + `Cache-Control: private, max-age=60` в `engagement/route.js` |
| P1 | `sumReferralEarnedThb` Node reduce | 202.27 | RPC `referral_earned_thb_total` + legacy fallback (`qualified-host-metrics.js`) |
| P1 | Cap/monthly guest spend Node reduce | 202.27b | RPC `referral_program_monthly_guest_spend_thb` + legacy (`referral-program-cap.service.js`) |
| P1 | THB literal в community i18n | 202.29b | `leader-quests.js` EN/ZH/TH без `THB`; tier gap via `ReferralLedgerAmount` |
| P1 | Hardcoded RU в ReferralProfileTabSettings | 202.29b | `stage1143_campaign*` keys; grep кириллицы пуст (`ReferralProfileTabSettings.jsx`) |
| P1 | `loadQualifiedHostSets` full bookings scan | 202.27b | RPC `qualified_host_first_completed_booking` (MIN timestamp, not COUNT) |
| P1 | `me/rank` full ledger scan | 202.30 | RPC `referral_user_rank_for_period` mirrors `referral_ledger_leaderboard_for_period` |

### Закрыты частично / на бумаге (⚠️)

| # | Finding | Status | Why |
|---|---------|--------|-----|
| P1 | Dual partner definitions (PARTNER role vs qualified host) | ⚠️ | Glossary 202.26 + tooltips — **copy** disambiguated; **числа** по-прежнему из разных SSOT — UX confusion возможен |
| P1 | Cap RPC fallback non-atomic | ⚠️ | Primary `referral_program_cap_reserve` atomic на FannRent; fallback read+allow при missing RPC — warn log |
| P1 | Bookings without snapshot | ⚠️ | Fail-closed post-cutover + freeze ops; **inventory/backfill** — ops runbook, не автоматический cron |

### Carryover P1 (не закрыты 10 этапами)

| # | Finding | File hint | Rec |
|---|---------|-----------|-----|
| P1 | Admin user detail page — hardcoded RU | `app/admin/users/[id]/page.js` (KYC card, gamification labels) | Stage i18n admin user |
| P1 | `SYSTEM_MAP` не знает engagement / local-leader / me-rank | `docs/SYSTEM_MAP.md` (grep empty) | Docs-only Stage |
| P1 | Fraud-queue resolve без `recordAdminAudit` | `app/api/v2/admin/referral/fraud-queue/[id]/route.js` | Extend 202.24 pattern |
| P1 | Emergency-actions без audit | `app/api/v2/admin/.../emergency-actions/route.js` | Same |
| P1 | Region admin self-assign не запрещён | `local-leader-region.service.js` (no `userId !== adminId`) | Optional guard |

### Новые P1 от 10 этапов

| # | Finding | File | Rec |
|---|---------|------|-----|
| P1 | **`next_rank_bucket_hint` hardcoded RU** после 202.30 refactor | `lib/referral/compute-user-monthly-rank.js:41` (`До N-го места`) | i18n key + `t()` in route or pass language |
| P1 | **Нет integration/e2e** referral flow (invite → booking → accrual → rank) | no `tests/e2e/*referral*` flow | Stage 202.31 candidate |
| P1 | **202.24 tests — payload helpers only**, не wiring routes | `__tests__/stage-202-24-money-write-audit.test.js` | Add route grep/contract tests like 202.27 |

### Новые P0 от 10 этапов

**Нет.** Финансовые формулы / payout split не менялись; новые RPC — read-only aggregates.

---

## Axis 1: SSOT discipline

### ✅ What's correct

- **Pool 45% / split 42/10/5/43 / cap 1M** — reads через `SystemConfigService.getFintechConfig()` / snapshot resolve; grep `0.42`/`1000000` в новых stage-файлах — **не найдено**.
- **Snapshot SSOT (202.25):** `attachFintechSnapshotToBooking` idempotent; post-cutover fail-closed; pre-cutover `getFrozenPolicyConfig()`; `recordCriticalSignal('FIN_SNAPSHOT_MISSING_FOR_NEW_BOOKING')` в `referral-calculation.js`.
- **Qualified host (202.22 + 202.27b):** единый `qualified-host-metrics.js`; RPC `first_completed_at` (не count); callers: `local-leader-metrics.service.js` → `/engagement`.
- **Region write (202.23):** DB write только `local-leader-region.service.js` via `/api/v2/admin/local-leader/assignment`; audit + idempotency on route.
- **Insurance (202.25):** `readInsuranceFundPercent` / `computeInsuranceReserveThb`; defaults 0.5% in `fintech-config-defaults.js`.
- **Audit payloads (202.24):** `lib/admin/money-write-audit.js` SSOT for 4 money actions.
- **Glossary (202.26):** 4 axes `l1_invites` / `withdraw_tier` / `network_earnings` / `community_qualified`.
- **Rank/leaderboard (202.30):** `referral_user_rank_for_period` filters = `referral_ledger_leaderboard_for_period` (`earned`, `earned_at` half-open); `ROW_NUMBER()` not `RANK()`; cache 600s preserved.

### ⚠️ Findings

- **[P1] Dual partner metrics** — unchanged product semantics; glossary mitigates but не устраняет (`referral-tier-sync.service.js` vs `qualified-host-metrics.js`).
- **[P2] ADR-reference 45/12/43** in `fintech-waterfall.js` — historical smoke targets, not live payout.
- **[P2] Mode string `ambassador_3_45_12_43`** — telemetry naming drift (`referral-guest-pool-payout-split.js`).
- **[P2] Shadow L2/L3 services** patch `booking.metadata.fintech_snapshot` directly (not `attachFintechSnapshotToBooking`) — intentional shadow fields; document-only risk if confused with payment snapshot.
- **[P2] Payment initiate** may embed `fintech_snapshot` in metadata update (`payment/initiate/route.js`) — parallel to attach helper; both idempotent on existing config.

### ❌ Critical

- Нет live financial drift P0 в проверенном срезе.

---

## Axis 2: Write-path

### ✅ What's correct

- **202.21:** Marketing ≠ FinTech dual-write closed (`stage202-21-fintech-write-path.test.js`).
- **202.24:** 3 P0 endpoints — audit + idempotency (verified grep).
- **202.23:** Region assignment — RBAC via `requireAdminStaff`, idempotency, audit in service.
- Disputes action — эталон audit + idempotency (unchanged).

### ⚠️ Findings

- **[P1] Fraud-queue / emergency-actions** — still no `recordAdminAudit` (carryover).
- **[P1] Idempotency optional** on some admin paths — key read but duplicate intercept only when header present.
- **[P2] `/api/admin/users` PATCH** — legacy route without full audit matrix (carryover).
- **[P2] Region concurrent assign** — last-write-wins on JSON metadata; both writes audited.

### ❌ Critical

- **0** — P0 money writes from first audit **closed**.

---

## Axis 3: i18n — после 202.29b

### ✅ What's correct

- Community slices ×4: `local-leader-tier.js`, `leader-quests.js`, `leader-roadmap.js` — merged via `profile-app.js`.
- **No `THB` literal** in community slices (test `stage-202-29b-community-i18n-currency.test.js`).
- Quest rewards + tier earned gap — `ReferralLedgerAmount` (Stage 188 pattern).
- **ReferralProfileTabSettings** campaign block — i18n ×4 (`stage1143_campaign*`).
- **202.26:** `PartnerMetricsTooltip` + glossary on tier strip, LocalLeaderTier, analytics.

### ⚠️ Findings

- **[P1] `next_rank_bucket_hint`** — hardcoded RU in `compute-user-monthly-rank.js` (regression vs i18n goal).
- **[P1] Admin user page** — majority RU literals (`app/admin/users/[id]/page.js`) — carryover; LocalLeaderRegionCard i18n OK.
- **[P2] PublicLeaderboard.jsx** — hardcoded RU (`Топ-10 амбассадоров`, errors).
- **[P2] ReferralTeamMetricsStrip** — RU fallbacks in `t?.() || '...'` strings.
- **[P2] Public leaderboard `next_rank_hint`** — RU in `leaderboard/public/route.js:59`.

### ❌ Critical

- None for RU-first soft-launch.

---

## Axis 4: Design system consistency

### ✅ What's correct

- No `components/referral/**/*.module.css`.
- No `variant="warning"` in referral components (grep).
- TierRoadmap / Quests / LocalLeaderTier — `Card`, `rounded-2xl`, lucide icons.
- Admin LocalLeaderRegionCard uses shared Card patterns.

### ⚠️ Findings

- **[P2] `window.confirm`** in LocalLeaderRegionCard (mobile ergonomics).
- **[P2] `/profile/referral` scroll density** — calculator + wallet + tiers + engagement stack.

### ❌ Critical

- None.

---

## Axis 5: Performance — после 202.27 / 202.27b / 202.30

### ✅ What's correct

| Endpoint / path | Before | After |
|-----------------|--------|-------|
| `/engagement` earned sum | Node reduce | RPC `referral_earned_thb_total` + 60s cache |
| Qualified host bookings | Full row fetch | RPC `qualified_host_first_completed_booking` |
| Cap fallback spend read | Node reduce | RPC `referral_program_monthly_guest_spend_thb` |
| `/me/rank` | Full month ledger in Node | RPC `referral_user_rank_for_period` |
| Public leaderboard | RPC + cache 300s | unchanged |
| Cap gate | `referral_program_cap_reserve` atomic | unchanged |

**FannRent indexes (verified):** `idx_referral_ledger_analytics_core`, `idx_referral_ledger_referrer_status`, `idx_bookings_partner_completed` (Stage 136 migration in repo).

**Legacy reducers** (`computeUserMonthlyRankLegacy`, `sumReferralEarnedThbLegacyReduce`, etc.) — **not dead**; warn-once fallback if RPC missing.

### ⚠️ Findings

- **[P2] Calculator `force-dynamic`** — no HTTP cache (carryover).
- **[P2] No `next/dynamic`** for engagement blocks on profile page.
- **[P2] Rank cache 600s vs leaderboard 300s** — user may see rank badge stale up to 10 min vs public board 5 min (acceptable for soft-launch).

### ❌ Critical

- None at current traffic.

---

## Axis 6: Dead code / orphan / docs drift

### ✅ What's correct

- All 10 stages have **unit/contract tests** (see Production readiness).
- `referral-fintech-admin-sync.js` — active strip helper (202.21).
- Stage 202.22/202.23 components wired + tests.

### ⚠️ Findings

- **[P1] `docs/SYSTEM_MAP.md`** — no entries for `/api/v2/referral/me/engagement`, `/me/rank`, `/admin/local-leader/*` (grep empty).
- **[P2] `docs/specs/stage-202-*-prompt.md`** — history prompts, not SSOT (OK).
- **[P2] Parallel UX surfaces** — `ReferralAmbassadorLevels` on landing, not on `/profile/referral`.

### ❌ Critical

- No orphan unauthenticated money endpoint found.

---

## Axis 7: Race conditions / consistency

### ✅ What's correct

- Ledger upsert unique key; cap FOR UPDATE when RPC present.
- Payout PAID CAS on `updated_at`.
- MLM consent write-once.
- Snapshot attach never overwrites payment snapshot.
- Self-referral blocked on track.

### ⚠️ Findings

- **[P1] Cap fallback path** non-atomic if `referral_program_cap_reserve` missing on env.
- **[P2] Leaderboard vs rank staleness** — different TTLs; not event-driven invalidation.
- **[P2] Region assign LWW** — tier may lag until next `/engagement` fetch (client staleTime 5 min + server 60s).
- **[P2] Quest `condition_met` without claim** — display-only rewards (product gap, not race).
- **[P2] Tie-break rank** — SQL uses `referrer_id ASC`; legacy Node used unordered scan order (minor divergence on exact tie).

### ❌ Critical

- Double-pay ledger / double PAID **not confirmed** with existing constraints.

---

## Special: Integration tests

### Status: ⚠️ **Missing**

| Flow | Unit pieces | E2E |
|------|-------------|-----|
| Invite → booking → L1 accrual → rank | SSOT services exist | **No** dedicated Playwright flow |
| Admin region → tier visibility | API + service tests | **No** |
| Paid → snapshot → accrual → cap → payout → audit | Partial smoke / financial smoke | **No** full chain in one test |
| Payment → engagement refresh | Separate caches | **No** cross-system test |

**Severity:** P1 — recommend **Stage 202.31: referral integration smoke** (staging Supabase, `[E2E_TEST_DATA]`).

---

## Edge cases (explicitly NOT covered — known gaps)

| Item | Severity | Notes |
|------|----------|-------|
| Quest claim flow (real promo payout) | P2 product | UI shows rewards; no claim money path |
| Live L3 whitelisted leaders | P2 / Q4 | Gate L2; legal + whitelist pending |
| Public leader page `/leader/[id]` | P2 / Q4 | Not built |
| Verified-by badge | P2 / Q4 | Strategy only |
| Stories feed | P2 / Q4 | Not built |
| Push on `first_booking_pending` | P2 / Q4 | Not built |
| RUB carryover / retail FX edge cases | P2 | Known backlog; partial fixes in 201.05 |
| Batch-remittance UI `/admin/finances` | P2 | Carryover |
| Admin user page full i18n | P1 | RU literals |

---

## Production readiness

### Migrations applied (FannRent `vtzzcdsjwudkaloxhvnw`) — ✅ verified 2026-09-01

| Migration | Status |
|-----------|--------|
| `stage202_21_strip_fintech_keys_from_general` | ✅ |
| `stage202_25_insurance_fund_percent` | ✅ |
| `stage202_27_referral_earned_thb_total_rpc` | ✅ |
| `stage202_27b_qualified_host_first_completed_booking_rpc` | ✅ |
| `stage202_27b_referral_program_monthly_guest_spend_rpc` | ✅ |
| `stage202_30_referral_user_rank_for_period_rpc` | ✅ |
| `referral_ledger_leaderboard_for_period` (Stage 74.2) | ✅ |
| `referral_program_cap_reserve` | ✅ |
| Index `idx_referral_ledger_analytics_core` | ✅ |
| Index `idx_referral_ledger_referrer_status` | ✅ |

### Runbooks

| Runbook | Status |
|---------|--------|
| `stage202-25-snapshot-freeze-runbook.md` | ✅ |
| `stage202-27-engagement-perf-runbook.md` | ✅ |
| `stage202-27b-hot-spots-perf-runbook.md` | ✅ |
| `stage202-30-me-rank-perf-runbook.md` | ✅ |
| General referral freeze/inventory ops | ⚠️ partial (script `inventory-bookings-without-snapshot.mjs` in 202.25 runbook) |

### Tests (unit / contract)

| Stage | Test file | Status |
|-------|-----------|--------|
| 202.21 | `stage202-21-fintech-write-path.test.js` | ✅ |
| 202.22 | `stage202-22-leader-engagement.test.js`, `leader-quests.test.js` | ✅ |
| 202.23 | `local-leader-region.test.js` | ✅ |
| 202.24 | `stage-202-24-money-write-audit.test.js` | ✅ (payloads) |
| 202.25 | `stage-202-25-snapshot-coverage.test.js` | ✅ |
| 202.26 | `stage-202-26-partner-glossary.test.js` | ✅ |
| 202.27 | `stage-202-27-engagement-perf.test.js` | ✅ |
| 202.27b | `stage-202-27b-hot-spots-perf.test.js` | ✅ |
| 202.29b | `stage-202-29b-community-i18n-currency.test.js` | ✅ |
| 202.30 | `stage-202-30-me-rank-perf.test.js` | ✅ |
| 131.A6.1 rank UI | `stage131-a6-1-user-rank.test.js` | ✅ |

**Cross-stage regression:** tests assert contracts independently; **no** single integration harness.

### Monitoring / alerts

- `FIN_SNAPSHOT_MISSING_FOR_NEW_BOOKING` → `recordCriticalSignal` ✅
- Snapshot inventory N>0 → ops script, **no** automated alert wired in code audit
- Cache hit/miss metrics — **not** implemented for referral routes

### Docs

| Doc | Status |
|-----|--------|
| `TECHNICAL_MANIFESTO.md` | ✅ deltas for 202.21–202.30 |
| `HISTORY.md` | ✅ all 10 stages logged |
| `SYSTEM_MAP.md` | ⚠️ drift (engagement, rank, local-leader admin) |
| ADR-131 / 131A | ⚠️ reference naming 45/12/43 vs live 42/10/5/43 |

---

## Media demo readiness (~30 days)

### ✅ Можем показать

- `/profile/referral` — calculator, balance, withdraw tiers, **engagement** (tier + quests + roadmap)
- Calculator waterfall on ~35K THB — Pool / Owner split from live FinTech SSOT
- Public leaderboard `/leaderboard` (cached)
- `/admin/finances` — FinTech panel (Phase A/B)
- Region assign on `/admin/users/[id]` via LocalLeaderRegionCard
- **RU / EN / ZH / TH** on referral cabinet (community + campaign settings)
- Rank badge in hero (when rank ≠ null && total ≥ 5)

### ❌ Не можем / не готовы показать

- Live L3 for whitelisted leaders
- Public leader page `/leader/[id]`
- Stories feed, push notifications
- **Quest claim with real money**
- Verified-by badge
- Fully i18n admin user page (EN/TH/ZH)
- Batch-remittance UI

**Messaging for media:** «Product core + economics SSOT ready for soft-launch; gamification quests are progress tracking, payouts separate; L3/public leader Q4.»

---

## Recommended Stage 202.31+ (prioritized)

1. **Stage 202.31 — Referral integration smoke (P1, ~1–2 days)**  
   Staging E2E: track → booking COMPLETED → ledger earned → `/engagement` + `/me/rank` parity. Catches cross-stage regressions.

2. **Stage 202.32 — Docs passport sync (P1, ~0.5 day)**  
   `SYSTEM_MAP.md`: engagement, rank, local-leader admin, RPC table. Low risk.

3. **Stage 202.33 — Rank hint + public leaderboard i18n (P1, ~0.5 day)**  
   `next_rank_bucket_hint`, `PublicLeaderboard.jsx`, leaderboard `next_rank_hint` — remove hardcoded RU.

4. **Stage 202.34 — Admin fraud/emergency audit (P1, ~1 day)**  
   Extend 202.24 pattern to fraud-queue + emergency-actions.

5. **Stage 202.35 — Admin user page i18n (P1, ~1–2 days)**  
   `/admin/users/[id]` — not blocking RU demo, blocking EN admin UX.

6. **Stage 202.36 — Quest claim flow (P2 product, ADR required)**  
   Real promo budget payout; money path — owner sign-off.

7. **Later backlog**  
   Region self-assign guard; CAS on metadata; `next/dynamic` engagement; Verified-by; `/leader/[id]`; RUB carryover audit.

---

## Negative findings (проверено — OK)

- No hardcoded `0.42/0.10/0.05/0.43` in live payout math.
- No hardcoded cap `1000000` in gate logic.
- No Marketing→FinTech dual-write post-202.21.
- No `local_leader_region_id` write outside `local-leader-region.service.js` (UI uses API; page only updates local React state).
- Fraud-gate does **not** define qualified host.
- No `.module.css` / Badge warning / emoji locks in 202.22 referral UI.
- Ledger unique upsert + cap atomic RPC on FannRent.
- Self-referral blocked; MLM consent write-once.
- Public leaderboard + me/rank use SQL aggregates (not full-table Node scan on hot path).
- Community copy: promo budget ≠ pool; tier path ≠ withdraw % / L1–L2–L3.
- All 6 perf RPCs present on FannRent (verified `pg_proc`).
- First audit **3 P0** closed in code (not just HISTORY.md).

---

## Uniqueness check (post-10-этапов)

| Element | Code | Copy | Risk |
|---------|------|------|------|
| L1/L2/L3 financial | SSOT payout | Calculator + analytics | Low |
| Community 5 levels | 202.22 read-only | Glossary 202.26 | Low–Medium |
| Withdraw 60/75/85 | tier-sync | Profile ladder | Medium (adjacent UI) |
| Pool 45 / 42/10/5/43 | FinTech live | Admin panel | Low |
| Cap 1M | cap RPC + fallback | Admin | Low on FannRent |
| Dual «partner» count | Two SSOTs | Tooltips help | **Medium** — still confusing |
| fintech_snapshot | 202.25 fail-closed | Runbook | Low if migrations applied |
| Quest rewards | Display only | Disclaimer OK | Medium support noise |

---

## Definition of Done (this audit)

- [x] 7 осей + integration + production + media demo проверены
- [x] Re-audit 3 P0 + 9 P1 из первого audit
- [x] Deliverable: `docs/audits/stage-referral-final-audit-2026-09-01.md`
- [x] Findings с severity + file hints + recommendations
- [x] Stage 202.31+ prioritized list
- [x] Negative findings
- [x] **Без кода / миграций / фиксов**

---

*Следующий шаг для owner: Stage **202.31** integration smoke на staging + **202.32** SYSTEM_MAP sync перед media outreach.*
