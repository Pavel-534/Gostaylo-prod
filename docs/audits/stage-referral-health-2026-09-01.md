# Referral System Health Audit — 2026-09-01

**Автор:** Cursor (read-only диагностика)  
**Скоуп:** referral / FinTech / Local Leader после Stages **202.21 / 202.22 / 202.23**  
**Вердикт:** **PARTIAL** — финансовое ядро в целом SSOT-ориентировано; главные риски — **admin write-path без audit**, **два определения «партнёра»**, **док/SYSTEM_MAP drift**, **THB-leak в community copy**  
**Метод:** grep + чтение SSOT-сервисов / admin routes / i18n / migrations. **Код не менялся.**

**Связанные документы:**
- `docs/ADR/131A-ambassador-3-1-multi-level.md`
- `docs/audits/stage-referral-economics-2026-08-29.md` (если есть локально)
- Stage 202.21 write-path / 202.22 engagement / 202.23 region admin
- `lib/config/fintech-config-defaults.js`, `lib/services/finance/fintech-waterfall.js`
- `lib/services/marketing/referral-payout.service.js`, `referral-program-cap.service.js`

---

## TL;DR

| Ось | Status | Кратко |
|-----|--------|--------|
| 1. SSOT discipline | ⚠️ | Live pool/split/cap читаются из FinTech; ADR-reference и mode-строки ещё «45/12/43»; insurance 0.5% захардкожен в preview feeBase |
| 2. Write-path | ❌ | Денежные / KYC admin-мутации без `recordAdminAudit` (payouts PAID/FAILED, payout-profile verify, wallet verified_for_payout) |
| 3. i18n | ⚠️ | 202.22/202.23 слайсы ×4 есть; THB в community copy; hardcoded RU в admin user page / referral settings |
| 4. Design system | ✅ | Нет `.module.css` / `Badge warning` / emoji-lock в referral UI Stage 202.22 |
| 5. Performance | ⚠️ | `/engagement` 5+ параллельных DB reads без HTTP-кэша; calculator `force-dynamic`; indexes частично есть |
| 6. Dead code / docs | ⚠️ | `SYSTEM_MAP` не знает 202.22/202.23; ADR-reference split 45/12/43; `referral-fintech-admin-sync` ещё жив как strip-helper |
| 7. Race / consistency | ⚠️ | Ledger upsert unique OK; cap RPC atomic OK; dual partner definitions (PARTNER role vs qualified host); region last-write-wins |

**P0 findings:** 3  
**P1 findings:** 9  
**P2 findings:** 11  

---

## Axis 1: SSOT discipline

### ✅ What's correct

- **Pool / reinvestment:** runtime читает `SystemConfigService.getFintechConfig()` → `referral_reinvestment_percent` из `system_fintech_settings` (bootstrap defaults в `fintech-config-defaults.js` = 45). Хардкода `* 0.45` в payout/waterfall path не найдено.
- **Split 42/10/5/43:** live split через `ambassador_guest_pool_*_percent` + `referral-guest-pool-payout-split.js` / `referral-payout.service.js`. Defaults/canon = 42/10/5/43 (`fintech-config-defaults.js`, `fintech-owner-canon.js`).
- **Cap 1M:** `referral-program-cap.service.js` читает `referralMonthlyProgramCapThb` из policy/snapshot; atomic RPC `referral_program_cap_reserve` с fallback. Нет `if (sum > 1000000)` в бизнес-логике.
- **fintech_snapshot:** `fintech-snapshot.service.js` — snapshot wins over live; attach idempotent (`ALREADY_CAPTURED`). Accrual path (`referral-calculation.js`) использует `resolveFintechPolicyForBooking`.
- **Region write:** единственный write `local_leader_region_id` — `local-leader-region.service.js` (admin). Readers: qualified-host-metrics / engagement.
- **Qualified host:** отдельный SSOT `lib/referral/qualified-host-metrics.js` (не fraud-gate).
- **Marketing ≠ FinTech write:** Stage 202.21 — marketing settings не dual-write’ит fintech (tests cover strip).

### ⚠️ Findings

- **[P1] Snapshot fallback на live policy** — `resolveFintechPolicyForBooking` при отсутствии snapshot возвращает **live** `getFintechConfig()`. Старые брони без snapshot при пересчёте/cap/shadow могут взять текущие % (не исторические).  
  - File: `lib/services/finance/fintech-snapshot.service.js:32-35`  
  - Rec: Stage — inventory bookings without snapshot; fail-closed или frozen defaults для pre-snapshot era.

- **[P1] Insurance 0.5% захардкожен в waterfall preview feeBase** — `platformGrossRevenueThb * 0.005`, не из config. Acquiring/USN/VAT идут из policy, insurance — нет.  
  - File: `lib/services/finance/fintech-waterfall.js:33-35`, `:80`  
  - Rec: читать insurance % из FinTech config / snapshot.

- **[P1] Два определения «прямого партнёра»** — L3 gate / withdraw tiers используют `ReferralTierSyncService.countDirectPartnersInvited` (**role === PARTNER**), community ladder — **qualified hosts** (activation / COMPLETED as host). Разные пороги «10» означают разное.  
  - Files: `referral-tier-sync.service.js:89-104`, `qualified-host-metrics.js`, L3 eligibility in `referral-payout.service.js`  
  - Rec: документировать dual SSOT в UI copy + ADR; не «чинить» silently.

- **[P2] ADR-131 reference targets всё ещё 45/12/43** — `buildReferenceTargets` / FX reference в waterfall для ADR smoke, не live. Риск путаницы при сверке калькулятора с ADR-doc.  
  - File: `fintech-waterfall.js:102-115`, `:170-183`  
  - Rec: пометить как `ADR131_HISTORICAL_REFERENCE` или обновить ADR smoke к 42/10/5/43 с отдельным golden file.

- **[P2] Mode string `ambassador_3_45_12_43`** — в guest-pool split mode остаётся старое имя при L2-without-L3.  
  - File: `referral-guest-pool-payout-split.js:33`  
  - Rec: rename → `ambassador_3_l2` (telemetry-safe).

### ❌ Critical

- Нет live drift P0 в смысле «хардкод 42% в payout вместо DB» — **не найдено**.  
  (P0 по оси 1 = 0; критичные дыры перенесены в write-path.)

---

## Axis 2: Write-path

### ✅ What's correct

- Admin API gate: `requireAdminStaff` + `admin-api-access.ts` fail-closed.
- Stage **202.23** `/api/v2/admin/local-leader/*` зарегистрирован в `ADMIN_API_EXTRA_RULES`, audit + Idempotency-Key на assignment.
- Disputes financial actions: `denyUnlessAdminFinancialRole` + idempotency + `recordAdminAudit` (`disputes/[id]/action`).
- Referral ledger admin mutations: audit present (`referral/ledger/[id]`).
- Payout PAID path: CAS on `updated_at` (AUDIT_03) — защита от race double-mark (но audit_logs — см. ниже).
- Self-referral на track: `REFERRAL_SELF_BY_ID` (`attribution.service.js:197-198`).
- MLM consent: write-once (`.is('referral_mlm_consent_at', null)`).

### ⚠️ Findings

- **[P1] Нет Idempotency-Key** на многих money-adjacent admin writes (payouts PAID, wallet verified_for_payout, partner-payout-profiles verify, fraud-queue resolve, emergency-actions). Disputes — эталон.  
  - Rec: Stage — Idempotency + audit template для money writes.

- **[P1] Fraud-queue resolve / emergency-actions** — RBAC есть, **`recordAdminAudit` нет** (emergency пишет `marked_by` в booking metadata only).  
  - Files: `app/api/v2/admin/referral/fraud-queue/[id]/route.js`, `.../emergency-actions/route.js`

- **[P1] Region admin self-assign не запрещён** — admin может назначить регион себе (операционный риск, не финансовый).  
  - File: `local-leader-region.service.js`  
  - Rec: optional guard `userId !== adminId` + override flag.

- **[P2] Concurrent region assign** — last-write-wins на `profiles.metadata` JSON; audit фиксирует before/after, но нет optimistic concurrency / CAS.

- **[P2] `/api/admin/users` PATCH** — role/commission/KYC без `recordAdminAudit` (есть узкий staff verification helper только для verification flags). Legacy `/api/admin/*` vs v2 audit consistency.

### ❌ Critical

- **[P0] `PATCH /api/v2/admin/payouts/[id]` (PAID/FAILED)** — ledger settle + status change, **без `recordAdminAudit`**. Есть `metadata.admin_marked_paid_by`, но это не SSOT audit explorer.  
  - File: `app/api/v2/admin/payouts/[id]/route.js`  
  - Risk: невидимые ручные выплаты в audit UI.

- **[P0] `PATCH /api/v2/admin/partner-payout-profiles/[id]` verify** — KYC payout unlock, **без audit**.  
  - File: `app/api/v2/admin/partner-payout-profiles/[id]/route.js`

- **[P0] `PATCH /api/v2/admin/wallet/payouts`** — `verified_for_payout` / clear referral withdrawal, **без audit**.  
  - File: `app/api/v2/admin/wallet/payouts/route.js:156+`  
  - Risk: разблокировка вывода без следа в `admin_audit_logs`.

---

## Axis 3: i18n completeness

### ✅ What's correct

- Stage 202.22 slices: `local-leader-tier.js`, `leader-quests.js`, `leader-roadmap.js` — RU/EN/ZH/TH; merge via `profile-app.js`.
- Stage 202.23: `admin-local-leader.js` + `leader-regions.js` + `register-admin-local-leader.js`.
- Quests disclaimer «из промо-бюджета, не из пула» — есть.
- Quests rewards в UI через `ReferralLedgerAmount` (не `+100 THB` в JSX).
- Community subtitle явно отделяет путь от % вывода и L1/L2/L3.
- Roadmap desc без денежных promises (тест Stage 202.22).

### ⚠️ Findings

- **[P1] THB leak в community i18n** — `localLeaderTier_missing_earned` и quests disclaimer содержат литерал **«THB»** во всех 4 языках (не валюта шапки).  
  - Files: `lib/translations/slices/local-leader-tier.js`, `leader-quests.js`  
  - Rec: `{amount}` через display formatter / `{brand}`-style currency token.

- **[P1] Hardcoded RU в user-facing referral settings** — toast/Label без `t()`.  
  - File: `components/referral/ReferralProfileTabSettings.jsx:106,151`

- **[P1] Admin user detail page** — почти весь UI на русском литералами (не 4 языка). Карточка Local Leader — i18n OK, страница вокруг — нет.  
  - File: `app/admin/users/[id]/page.js`  
  - Rec: не блокер soft-launch RU, но для EN/TH/ZH admin — Stage.

- **[P2] Смешение «хост/бронь» в helper-копирайте** — `ReferralTeamMetricsStrip` fallback: «завершённой бронью», «хостов»; tier ladder copy про «Новичок → Профи → Амбассадор» рядом с community path.  
  - Risk: размывание уникальной 3-осевой модели для пользователя.

- **[P2] `ReferralAmbassadorLevels` на публичном лендинге** — Level 1–3 naming рядом с financial L1/L2/L3; на `/profile/referral` не монтируется (хорошо), но публичный landing может путать.

### ❌ Critical

- Нет P0 «критичный экран без i18n на проде RU» для soft-launch. Soft-launch RU-first — приемлемо; P0 не ставим.

---

## Axis 4: Design system consistency

### ✅ What's correct

- Нет `components/referral/**/*.module.css`.
- Нет `variant="warning"` в components (grep).
- TierRoadmap: lucide `Lock` / `Sparkles` / `Wrench`, не emoji.
- LocalLeaderTier: Tailwind palette tokens (`bg-emerald-50` и т.д.), `Progress` shared.
- Quests/Roadmap: `Card` + `rounded-2xl` patterns согласованы с cabinet.

### ⚠️ Findings

- **[P2] Admin LocalLeaderRegionCard** — `window.confirm` вместо shared Dialog/bottom-sheet (mobile ergonomics).
- **[P2] Overview density** — `/profile/referral` stack: calculator + balances + withdraw tiers + engagement grid (3 cards) + activity — риск scroll fatigue (не баг DS).

### ❌ Critical

- Нет.

---

## Axis 5: Performance

### ✅ What's correct

- Public leaderboard: `unstable_cache` + revalidate (`leaderboard/public/route.js`).
- Rank endpoint: cached (`me/rank`).
- Engagement metrics: `Promise.all` (не последовательный N+1 по метрикам).
- Indexes: `idx_referral_relations_paginated (referrer_id, referred_at DESC)`, `idx_referral_ledger_analytics_core (referrer_id, status, earned_at DESC)`, `idx_bookings_partner_completed (partner_id)` (migrations stage133 / stage136).
- Cap: atomic RPC preferred.

### ⚠️ Findings

- **[P1] `GET /api/v2/referral/me/engagement` без HTTP/server cache** — каждый hit: relations + ledger host_activation + bookings COMPLETED + count host bookings + bookings via ref + sum earned + count invites. На soft-launch OK; при росте — дорого.  
  - Files: `engagement/route.js`, `local-leader-metrics.service.js`, `qualified-host-metrics.js`  
  - Client: `staleTime: 60_000` only.

- **[P1] `sumReferralEarnedThb` / monthly cap non-RPC path** — select всех matching rows в Node и reduce (не SQL `sum()`).  
  - Files: `qualified-host-metrics.js`, `referral-program-cap.service.js` fallback

- **[P2] Calculator `force-dynamic`** — нет Cache-Control; DB только за live config. Можно short TTL cache headers.

- **[P2] Нет `next/dynamic` для engagement блоков** — всё в overview bundle вместе с calculator.

- **[P2] Index `bookings(partner_id)` без `status`** — `countCompletedBookingsAsHost` фильтрует `status=COMPLETED`; composite `(partner_id, status)` был бы лучше.

- **[P2] Нет index на `metadata->>'local_leader_region_id'`** — OK пока region list не в SQL (admin single-user).

### ❌ Critical

- Нет N+1 P0 на hot path при текущем soft-launch трафике.

---

## Axis 6: Dead code / orphan / docs

### ✅ What's correct

- Stage 202.22/202.23 файлы wired (ProfilePage + admin user card + tests).
- `referral-fintech-admin-sync.js` всё ещё используется для **strip** legacy keys / tests — не dead.
- Нет orphan `.module.css` от 202.22.

### ⚠️ Findings

- **[P1] `docs/SYSTEM_MAP.md` не упоминает** `/api/v2/referral/me/engagement` и `/api/v2/admin/local-leader/*` — passport drift.  
  - Rec: Stage docs-only sync.

- **[P2] Mode/ADR naming drift** — `ambassador_3_45_12_43`, ADR reference 45/12/43 vs live 42/10/5/43.

- **[P2] `ReferralAmbassadorLevels` / `ReferralYourStatusCard`** — не на `/profile/referral` (status page / landing). Не dead, но параллельные UX-поверхности.

- **[P2] Spec prompts** в `docs/specs/stage-202-22-*.md` / `202-23-*.md` — полезны как history; не SSOT.

### ❌ Critical

- Нет orphan money endpoint без auth (в проверенном referral/admin срезе).

---

## Axis 7: Race conditions / consistency

### ✅ What's correct

- Ledger upsert conflict key: `booking_id,type,referral_type,referrer_id` (stage72_3) — защита от double insert L1/L2/L3 rows.
- Cap: `referral_program_cap_reserve` FOR UPDATE serialization when RPC deployed.
- Payout PAID: CAS `updated_at` + status IN (PENDING, PROCESSING).
- Self-referral blocked on track.
- Consent write-once.
- Snapshot attach never overwrites.

### ⚠️ Findings

- **[P1] Cap RPC fallback** — если RPC отсутствует, non-atomic read+allow (warn log). Soft-launch risk if migration not applied on env.  
  - File: `referral-program-cap.service.js:49-69`

- **[P1] Bookings without fintech_snapshot** — accrual/cap uses **live** policy (см. Axis 1). Consistency hole for historical bookings.

- **[P1] Dual partner metrics** — user может видеть «5 партнёров до Pro» (PARTNER role) и «0 qualified hosts» в community — выглядит как баг продукта, не race.

- **[P2] Region concurrent admins** — last-write-wins; audit both writes.

- **[P2] Leaderboard cache** — public board cached; short staleness OK; invalidation not event-driven.

- **[P2] Network depth** — `ledger_depth` clamp 1..32; product L3 gate separate; cycle A↔B partially mitigated by fraud graph / self checks — full DAG cycle prevention not audited end-to-end here.

- **[P2] Quest `condition_met` without claim** — UI показывает «до +reward»; денег нет → support noise (product, not race).

### ❌ Critical

- Double-pay ledger P0 **не подтверждён** при наличии unique constraint + upsert.  
- Double PAID payout P0 **смягчён CAS**; остаётся gap audit trail (Axis 2 P0).

---

## Recommended Stage 202.24+ (prioritized)

1. **Stage 202.24 — Admin money write audit + idempotency (P0, ~1–2 days)**  
   - Files: `app/api/v2/admin/payouts/[id]/route.js`, `partner-payout-profiles/[id]/route.js`, `wallet/payouts/route.js` (+ optional fraud-queue / emergency-actions)  
   - Add `recordAdminAudit` + `Idempotency-Key` pattern from disputes action.  
   - Risk: low to money formulas; high ops safety gain. **Не трогает split/pool.**

2. **Stage 202.25 — Snapshot coverage & insurance SSOT (P1, ~1–2 days)**  
   - Inventory bookings missing `fintech_snapshot`; decide fail-closed vs backfill frozen defaults.  
   - Move insurance % out of hardcoded `0.005` into config-driven feeBase.  
   - Risk: medium (historical accruals) — needs owner sign-off.

3. **Stage 202.26 — Partner metrics glossary + UI disambiguation (P1, ~1 day)**  
   - One glossary: withdraw partners (PARTNER role) vs qualified hosts vs L1 network.  
   - Fix helper copy («бронь/хост») → aggregator terms; place community vs withdraw cards with clearer labels.  
   - Risk: copy-only; protects unique 3-axis model.

4. **Stage 202.27 — Engagement perf pass (P1/P2, ~1 day)**  
   - SQL `sum()` for earned; short TTL cache for `/engagement`; composite index `(partner_id, status)` if advisor agrees.  
   - Optional `next/dynamic` for roadmap/quests.

5. **Stage 202.28 — Docs passport sync (P2, ~0.5 day)**  
   - `SYSTEM_MAP` + Manifesto already partially updated; add engagement + local-leader admin routes; rename ADR-reference constants / split mode string.

6. **Stage 202.29 — Community i18n currency polish (P1/P2, ~0.5 day)**  
   - Remove THB literals from community strings; wire display currency; fix `ReferralProfileTabSettings` hardcoded RU.

7. **Later (backlog, not foundation blockers)**  
   - Region self-assign guard; CAS on metadata region write; quest claim flow (money — **ADR required**); Verified-by / public leader page (product Stages).

---

## Negative findings (проверено, проблем не найдено)

- Нет хардкода `0.42/0.10/0.05/0.43` в live payout math (только defaults/canon/validation).
- Нет хардкода monthly cap `1000000` в gate-логике (только defaults).
- Нет dual-write Marketing→FinTech после 202.21 (tests assert).
- Нет записи `local_leader_region_id` вне admin region service.
- Fraud-gate **не** определяет qualified host.
- Нет `.module.css` / `Badge warning` / emoji locks в Stage 202.22 referral components.
- Ledger unique upsert key present for concurrent COMPLETED.
- Self-referral by same profile id blocked on track.
- MLM consent is write-once.
- Public leaderboard has server cache (not uncached full table dump in that route).
- Calculator formula still SSOT via `computeWaterfallPreview` + live config (UX floor 3500 is input-only).
- Quests disclaimer clearly «promo budget ≠ pool».
- Community path copy states it does not change withdraw % / L1–L3 split.

---

## Uniqueness check (не размывается ли модель)

| Уникальный элемент | Код | Copy | Risk |
|--------------------|-----|------|------|
| 3-level L1/L2/L3 | SSOT payout + caps | Calculator + team analytics | Low |
| Community 5 levels | 202.22 read-only | Disambiguation subtitle present | Medium if helpers say «хост/бронь» |
| Withdraw 60/75/85 | tier-sync | Progress card on profile | Medium — third ladder adjacent to community |
| Pool 45% / split 42/10/5/43 | FinTech live | Admin FinTech panel | Low (ADR-reference naming drift only) |
| Cap 1M | program-cap + RPC | Admin | Low if RPC deployed |
| Regional ownership | metadata + admin assign | Admin card | Needs ops process (1–2 per city) — product/ops, not code bug |
| Promo Tank / Turbo | separate services | Quests disclaimer OK | Quests still display-only |
| fintech_snapshot | attach + resolve | Admin FinTech note | Gap: missing snapshot → live |
| Soft-launch / no fake scale claims | — | Quests/roadmap cautious | Keep enforcing in marketing Stages |

---

## Definition of Done (audit)

- [x] 7 осей проверены  
- [x] Deliverable: `docs/audits/stage-referral-health-2026-09-01.md`  
- [x] Findings с severity + file hints + Stage recommendations  
- [x] Negative findings  
- [x] **Без кода / миграций / фиксов**

---

*Следующий шаг для owner: выбрать Stage 202.24 (audit money writes) как первый fix-wave — максимум safety без изменения экономики рефералки.*
