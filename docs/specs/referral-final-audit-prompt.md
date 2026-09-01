# Referral Final Audit (post-10-этапов) — Промт для Cursor

**Зачем:** 31.08-01.09.2026 закрыли 10 этапов подряд (202.21-202.30). Первый health audit (`docs/audits/stage-referral-health-2026-09-01.md`) нашёл 3 P0 + 9 P1 + 11 P2. Нужна **точка проверки целостности**:
- Закрыты ли P0/P1 **реально** (не только на бумаге)?
- Не размылся ли SSOT после 10 этапов?
- Готовы ли мы показать рефералку медиа-персонам (через 30 дней)?

**Это ТОЛЬКО ДИАГНОСТИКА**, без кода, без фиксов. Cursor пишет `docs/audits/stage-referral-final-audit-2026-09-XX.md`.

---

## Контекст: что строили 10 этапов

| Stage | Что | SSOT/контракт |
|-------|-----|---------------|
| 202.21 (Phase B) | Admin money write hardening | dual-write закрыт, server guardrail, owner canon banner |
| 202.22 (Leader) | Local Leader Tier + Quests + Roadmap | 5-уровневая лестница (Участник→Лидер региона), read-only |
| 202.23 (Region) | Admin assign region | `local_leader_region_id` в profiles.metadata, через admin-api-access matrix |
| 202.24 (Money Audit) | recordAdminAudit + Idempotency-Key | 4 money endpoints, money-write-audit.js SSOT |
| 202.25 (Snapshot) | Inventory + freeze + insurance SSOT | FROZEN_POLICY_19AUG2026, fail-closed для новых |
| 202.26 (Glossary) | 4 метрики партнёра (НЕ 3) + UI disambiguation | `l1_invites` / `withdraw_tier` / `network_earnings` / `community_qualified` |
| 202.27 (Engagement) | SQL aggregate + cache + composite index | `referral_earned_thb_total` RPC, `unstable_cache` 60s |
| 202.27b (Hot Spots) | qualified host timestamps + monthly cap global | `qualified_host_first_completed_booking`, `referral_program_monthly_guest_spend_thb` |
| 202.29b (i18n) | THB literals → currency + ProfileTabSettings RU | campaign block i18n, disclaimer copy |
| 202.30 (me/rank) | SQL aggregate + ROW_NUMBER | `referral_user_rank_for_period` зеркало leaderboard RPC |

---

## Что строим (deliverable)

**Один аудит-док:** `docs/audits/stage-referral-final-audit-2026-09-XX.md`

Структура:
- TL;DR (статус по 7 осям)
- Re-audit P0/P1 из первого audit (закрыты ли реально)
- **Новые findings** от 10 этапов (integration, edge cases)
- Готовность к production / media demo
- Negative findings (что проверено и OK)
- Recommended Stage 202.31+ (если есть)

**Без кода, без миграций, без фиксов.** Cursor только ЧИТАЕТ.

---

## 7 осей аудита (post-10-этапов)

### 1. SSOT discipline — целостность после 10 этапов

**Проверить:**

a) **Pool 45%, split 42/10/5/43, cap 1M** — НЕ размылись ли за 10 этапов? Все reads идут через `system_fintech_settings` или `FINTECH_CONFIG_DEFAULTS`? Нет ли копипаста в новых файлах (202.22/202.26/202.27/202.30)?

b) **3 tier-системы** (withdraw/network/community) — после Stage 202.26 glossary всё ещё disambiguated? Нет ли мест где метрики перепутались?

c) **Snapshot SSOT** (Stage 202.25):
   - `FROZEN_POLICY_19AUG2026` корректен (mirror 19.08 канон)?
   - `resolveFintechPolicyForBooking` правильно выбирает путь (snapshot / frozen snapshot / pre-cutover frozen / post-cutover fail-closed)?
   - НЕ появилось ли мест, где `bookings.metadata.fintech_snapshot` пишется не через `attachFintechSnapshotToBooking`?

d) **Qualified host SSOT** (Stage 202.22 + 202.27b):
   - Все callers используют `lib/referral/qualified-host-metrics.js`?
   - `first_completed_at` (timestamp) нигде не подменён на count?
   - 30-дневное окно работает корректно?

e) **Region SSOT** (Stage 202.23):
   - `local_leader_region_id` пишется только через `local-leader-region.service.js`?
   - НЕ появилось ли direct write в `profiles.metadata`?

f) **Insurance SSOT** (Stage 202.25):
   - `insurance_fund_percent` читается через `readInsuranceFundPercent`?
   - `pricing-fee-policy.js` — сначала FinTech, fallback на general?
   - waterfall без hardcode 0.005?

g) **Audit SSOT** (Stage 202.24):
   - 4 money endpoints пишут через `recordAdminAudit` + money-write-audit.js?
   - Idempotency-Key в каждом?
   - `requireAdmin` возвращает userId?

h) **i18n SSOT** (Stage 202.29b):
   - Community i18n без THB literals?
   - Currency отображается через display formatter (НЕ hardcoded)?

i) **Rank/leaderboard SSOT** (Stage 202.30):
   - `referral_user_rank_for_period` filters зеркалят `referral_ledger_leaderboard_for_period`?
   - `ROW_NUMBER()` а не `RANK()`?
   - Cache 600s сохранён?

**Severity:**
- P0: live ≠ SSOT (drift), хардкод финансовых значений в новых файлах
- P1: 3 tier-системы перепутаны, snapshot/qualified-host/region SSOT не используется
- P2: неоптимальный путь чтения

### 2. Write-path — все 10 этапов вместе

**Проверить (после 202.21 + 202.24):**

a) **Все admin write endpoints:**
   - Каждый зарегистрирован в `lib/admin/admin-api-access.ts`?
   - Каждый пишет `recordAdminAudit`?
   - Каждый с money/SSOT impact имеет Idempotency-Key?
   - Audit payload стандартизирован `{ action, entity_type, entity_id, payload_json: { before, after, source } }`?

b) **P0 из первого audit** — реально закрыты?
   - `PATCH /api/v2/admin/payouts/[id]` (PAID/FAILED) — audit OK?
   - `PATCH /api/v2/admin/partner-payout-profiles/[id]` verify — audit OK?
   - `PATCH /api/v2/admin/wallet/payouts` (verified_for_payout + clear) — оба path audit OK?

c) **Новые write-path** после 10 этапов:
   - `local-leader-region/assignment` (202.23) — audit + idempotency?
   - Admin FinTech settings (Phase B) — server guardrail + ack для опасных?
   - `freezeBookingsWithoutSnapshot` (202.25) — audit?

d) **Self-protection:**
   - Admin может изменить сам себя? (202.23 self-assign region запрещён — что ещё?)
   - Idempotency-Key dedupe работает?

**Severity:**
- P0: admin endpoint без audit, RBAC fail-open
- P1: нет idempotency, нет self-protection
- P2: нет re-auth, нет rate limit

### 3. i18n — после 202.29b

**Проверить (после 202.22 + 202.26 + 202.29b):**

a) **4 языка везде:**
   - `npm run check:i18n` (если есть) — pass?
   - Community i18n (local-leader-tier, leader-quests, leader-roadmap) — все 4 языка полные?
   - Admin i18n (admin-local-leader) — все 4 языка?

b) **Currency** (202.29b):
   - THB literal отсутствует в community i18n?
   - Display currency отображается правильно во всех 4 локалях?

c) **Disambiguation copy** (202.26):
   - 4 метрики партнёра разведены в копи?
   - Tooltip с правильным axis в каждом из 3 компонентов?

d) **Hardcoded RU** — убрать:
   - `ReferralProfileTabSettings.jsx:106,151` (202.29b) — fixed?
   - `app/admin/users/[id]/page.js` (P1, не блокер) — статус?

**Severity:**
- P0: hardcoded RU в коде
- P1: THB literal в i18n
- P2: missing translation

### 4. Design system consistency

**Проверить (после 202.22 + 202.23):**

a) `.module.css` — **отсутствует** во всех referral/admin components?
b) `Badge variant="warning"` — **отсутствует** везде?
c) Lucide иконки — не emoji locks?
d) Card patterns — consistent (Card component, не `<div className="rounded border">`)?
e) Header hierarchy (h1/h2/h3) — consistent?
f) Tailwind tokens only (НЕ custom CSS)?

**Severity:**
- P0: `.module.css` в новых компонентах
- P1: header hierarchy сломан
- P2: helper-text отсутствует

### 5. Performance — после 202.27/202.27b/202.30

**Проверить (после 3 perf этапов):**

a) **N+1 queries** — после 202.27/202.27b, остались ли где-то?
b) **Hot endpoints без cache** — `/engagement`, `/me/rank`, `/leaderboard/public`, `/finance-summary` — все кэшируются?
c) **DB indexes**:
   - `idx_referral_ledger_analytics_core (referrer_id, status, earned_at DESC)` — есть (Stage 202.30 source)?
   - `idx_bookings_partner_completed (partner_id) WHERE status='COMPLETED'` — есть (Stage 136)?
   - `idx_referral_ledger_referrer_status (referrer_id, status)` — есть (Stage 71)?
   - Нет ли мест, где composite index нужен но отсутствует?

d) **RPC vs Node reduce** — после 3 этапов всё ledger scan в Node заменён на RPC?
e) **Client bundle** — `/profile/referral` размер не вырос за 10 этапов?

**Severity:**
- P0: N+1 на hot path
- P1: нет кэша на read-heavy
- P2: bundle size

### 6. Dead code / orphan / docs drift

**Проверить (после 10 этапов):**

a) **Orphan API endpoints** — есть ли routes, не покрытые тестами/доками?
b) **Dead code** — старые fallback'и которые Cursor оставил (например, `LegacyXxx` reducers) — активны или dead?
c) **i18n orphans** — старые ключи, которые больше не используются?
d) **DB columns** — есть ли колонки, которые никто не читает после изменений?
e) **Docs drift**:
   - `docs/SYSTEM_MAP.md` — знает про 10 этапов (engagement, region admin, partner glossary)?
   - `docs/HISTORY.md` — все 10 этапов записаны?
   - `docs/TECHNICAL_MANIFESTO.md` — § актуальна?

**Severity:**
- P0: orphan endpoint с уязвимостью
- P1: большие мёртвые куски кода
- P2: docs drift

### 7. Race conditions / consistency — после 10 этапов

**Проверить (после всех этапов):**

a) **`referral_ledger` concurrent writes** — после 202.27b нет ли новых мест?
b) **`referral_relations` cycles** — после 202.22/202.23 нет ли новых?
c) **Leaderboard + rank staleness** — после 202.30 cache 600s + leaderboard 300s, нет ли race window?
d) **Tier recompute timing** — после 202.22 Local Leader Tier пересчитывается live, а `metadata.local_leader_region_id` меняется (202.23) — race?
e) **Payout + cap race** — после 202.27b monthly cap RPC atomic, нет ли race?
f) **Booking status transitions** — FSM корректна? После 202.25 (snapshot freeze) как меняется?
g) **Currency conversion** — RUB-fallback fix (carryover) — сделан или нет?
h) **MLM consent** — write-once (Stage 202.22) — корректно?
i) **Region concurrent admins** — после 202.23 last-write-wins, audit both writes?

**Severity:**
- P0: double-pay ledger, double PAID payout
- P1: leaderboard staleness > 1h, tier inconsistency
- P2: edge cases

---

## Специальный фокус: INTEGRATION TESTS (новое)

**После 10 этапов критично проверить, что они работают ВМЕСТЕ:**

a) **End-to-end referral flow:**
   - User A invites B → B completes booking → L1 credited → A sees rank change
   - Все 10 этапов задействованы: 202.22 (tier), 202.25 (snapshot), 202.27 (sum), 202.27b (qualified host), 202.30 (rank)

b) **Admin flow:**
   - Admin assigns region to user → user sees tier change in `/profile/referral` → admin can audit in audit log
   - 202.23 (region), 202.24 (audit), 202.25 (snapshot)

c) **Money flow:**
   - Booking paid → snapshot attaches → accrual at COMPLETED → cap enforcement → payout PAID → audit log
   - 202.21 (guardrails), 202.25 (snapshot), 202.24 (audit), 202.27b (cap)

d) **Cross-system:**
   - YooKassa payment → snapshot → engagement metrics update → leaderboard update
   - 202.12 (YooKassa idempotence), 202.25 (snapshot), 202.22 (engagement)

**Если integration tests отсутствуют — это P1** (Stage 202.31 candidate).

---

## Edge cases — что мы НЕ покрыли за 10 этапов

**Проверить явно:**

a) **Quest claim flow** — UI показывает «до +reward», но **реального начисления нет** (Stage 202.22). Это P1 product gap.

b) **Live L3 для whitelisted лидеров** — не делали (gate L2). Это Q4 2026.

c) **Public leader page** `/leader/[id]` — не делали. Это Q4 2026.

d) **Verified-by badge** — упоминали в стратегии, не реализовано. Q4 2026.

e) **Stories feed** — упоминали, не делали. Q4 2026.

f) **Push на `first_booking_pending`** — не делали. Q4 2026.

g) **RUB-fallback fix** (carryover) — known bug, не делали.

h) **Batch-remittance UI** для /admin/finances — не делали. Carryover.

**Severity:** все P2 (известные gaps, не блокеры), но в audit-доке должны быть явно перечислены.

---

## Production readiness (новое)

**Проверить:**

a) **Migrations applied:** все 10 этапов migrations применены в FannRent?
   - `stage202_21_strip_fintech_keys_from_general.sql`
   - `stage202_25_insurance_fund_percent.sql`
   - `stage202_27_referral_earned_thb_total_rpc.sql`
   - `stage202_27b_qualified_host_first_completed_booking_rpc.sql`
   - `stage202_27b_referral_program_monthly_guest_spend_rpc.sql`
   - `stage202_30_referral_user_rank_for_period_rpc.sql`
   - Stage 136 (`idx_bookings_partner_completed`)
   - Stage 71 (`idx_referral_ledger_referrer_status`)
   - Stage 74.2 (`referral_ledger_leaderboard_rpc`)

b) **Runbooks существуют:** 6 runbooks для всех ops-процедур?
   - `stage202-25-snapshot-freeze-runbook.md`
   - `stage202-27-engagement-perf-runbook.md`
   - `stage202-27b-hot-spots-perf-runbook.md`
   - `stage202-30-me-rank-perf-runbook.md`
   - + общий referral freeze/inventory ops?

c) **Tests:**
   - Unit: все 10 этапов покрыты?
   - Integration: есть ли e2e?
   - Regression: 10 этапов покрыты между собой?

d) **Monitoring / alerts:**
   - `recordCriticalSignal` настроен для fail-closed (202.25)?
   - Ops alert на inventory N>0?
   - Cache hit/miss tracking?

e) **Docs:**
   - `TECHNICAL_MANIFESTO.md` актуальна?
   - `SYSTEM_MAP.md` знает про 10 этапов?
   - `HISTORY.md` — все 10 этапов?
   - ADR-131/131A + references — актуальны?

---

## Media demo readiness (новое)

**Что можем показать медиа-персонам через 30 дней:**

✅ Можем показать:
- `/profile/referral` — calculator + balance + tier ladder + engagement section
- Калькулятор на 35K THB — показывает Pool ฿1 300, Owner ฿1 589
- Public leaderboard `/leaderboard`
- `/admin/finances` — Phase A/B FinTech panel
- Region admin на `/admin/users/[id]` (для владельца)
- 4 языка: RU / EN / ZH / TH

❌ Не можем показать:
- Live L3 для whitelisted leaders (нет legal + whitelisted)
- Public leader page `/leader/[id]`
- Stories feed
- Push уведомления
- Quest claim flow (real money)
- Verified-by badge

**Это даст media person правильный контекст:** «вот что есть, вот что в работе».

---

## Формат deliverable

`docs/audits/stage-referral-final-audit-2026-09-XX.md`:

```markdown
# Referral Final Audit — 2026-09-XX (post-10-этапов)

## TL;DR
- SSOT discipline: ✅/⚠️/❌
- Write-path: ✅/⚠️/❌
- i18n: ✅/⚠️/❌
- Design system: ✅/⚠️/❌
- Performance: ✅/⚠️/❌
- Dead code / docs: ✅/⚠️/❌
- Race conditions: ✅/⚠️/❌
- Integration: ✅/⚠️/❌
- Production readiness: ✅/⚠️/❌

P0 findings: N
P1 findings: N
P2 findings: N

## Re-audit P0/P1 (от первого audit)
### Закрыты реально (✅):
- 3 P0 money write audit (Stage 202.24) — verified
- ...

### Закрыты на бумаге, но НЕ реально (⚠️):
- ...

### Новые P0 от 10 этапов:
- ...

## Axis 1: SSOT discipline
...

## Axis 2-7: ...

## Special: Integration tests
...

## Edge cases (что НЕ покрыли)
...

## Production readiness
### Migrations applied:
- ✅ / ❌
...

## Media demo readiness
### Можем показать:
- ✅
...

### Не можем показать:
- ❌
...

## Recommended Stage 202.31+ (prioritized)
1. Stage 202.31: ... (P0, ~1 day)
2. Stage 202.32: ... (P1, ~1-2 days)
...

## Negative findings (что OK)
- ...
```

---

## Definition of Done для audit'а

- [ ] Cursor прочитал 7 осей + integration + production readiness + media demo
- [ ] Re-audit 3 P0 + 9 P1 из первого audit — реально ли закрыты
- [ ] Написал `docs/audits/stage-referral-final-audit-2026-09-XX.md` (по формату выше)
- [ ] Каждое finding имеет severity (P0/P1/P2) + file:line + рекомендация
- [ ] Список Stage 202.31+ с приоритетами
- [ ] Negative findings (что OK) — чтобы знали, что проверено
- [ ] БЕЗ кода, БЕЗ фиксов, БЕЗ изменений в репо

---

## После audit'а (Pavel + я)

1. Я (Mavis) прочитаю audit-док
2. Расставлю приоритеты по стратегии
3. Дадим Cursor'у **промт на Stage 202.31+** — фикс топ-P0/P1
4. **Если 0 P0 + ≤3 P1** → рефералка готова, можно показывать медиа-персонам + Trademark в работе
5. **Если 5+ P1** → ещё 1-2 этапа, потом audit снова

**Audit — это финал интенсивной недели.** Цель: подтвердить, что 10 этапов = production-ready продукт, а не 10 изолированных фич.

---

**Конец промта.** Скопируй и отправь в Cursor. Это **только диагностика**, без кода. Если Cursor уточняет — отвечай на основе `docs/audits/stage-referral-health-2026-09-01.md` (первый audit) + текущего `main` (все 10 этапов закоммичены). **НЕ фикс, НЕ миграции, НЕ изменения кода.**
