# ADR-133: Team Analytics & Growth (кабинет амбассадора)

| Field | Value |
|-------|--------|
| **Status** | **Accepted** (Product + Engineering, 2026-06-13) |
| **Stage** | **133.0** |
| **Date** | 2026-06-13 |
| **Implementation SSOT (planned)** | `migrations/stage133_*_referral_team_analytics_rpc.sql` · `lib/referral/build-referral-team-analytics.js` · `GET /api/v2/referral/me` |
| **Deciders** | Product owner, Engineering |
| **Supersedes (partially)** | Неформальная семантика `stats.monthlyL1EarnedThb` / `monthlyNetworkEarnedThb` как «L1/L2 от меня» |
| **SSOT after adoption** | Этот ADR + `ARCHITECTURAL_DECISIONS.md` (§ Team Analytics) + `docs/TECHNICAL_MANIFESTO.md` + `docs/ARCHITECTURAL_PASSPORT.md` |
| **Related** | ADR-131 (Guest L2 pool), Stage 74.2 (`referral_ledger_leaderboard_for_period`), Stage 72.6 (`buildReferralTeamMembers`), Stage 131.1 (shadow L2) |

---

## 1. Context

### 1.1. Продуктовая цель

Перед запуском РФ-контура и первыми реальными амбассадорами нужен **прозрачный блок «Аналитика команды»** в `/profile/referral`:

- сколько приносит **прямая команда** vs **сеть (L2)**;
- **retention** приглашённых хостов (активированы ли);
- **прогресс** до следующего Ambassador tier и gamification badges;
- per-member вклад (без N+1 и без полной выгрузки ledger в Node).

### 1.2. As-is (код, 2026-06)

| Контур | Поведение |
|--------|-----------|
| **`GET /api/v2/referral/me`** | ~520 строк; **2–3 полных scan** `referral_ledger` за request; месячные bucket’ы в JS + `resolveReferralStatsTimeZone` |
| **L1/L2 breakdown** | `stats.monthlyL1EarnedThb` если `ledger_depth ≤ 1`, иначе `monthlyNetworkEarnedThb` — **абсолютная глубина referee в дереве**, не «от текущего амбассадора» |
| **`teamMembers[]`** | Только **прямые** `referral_relations.referrer_id = me`; поля activity/timeline/chat; **нет `earnedThb`** |
| **Полное дерево L2+** | Нет user-facing API; `ancestor_path` используется при регистрации и L2 accrual, без GIN-индекса |
| **Guest L2 выключен** | Shadow accrual в `bookings.metadata.fintech_snapshot`; view `referral_shadow_l2_monthly` (service_role) — **не в ledger** |
| **Gamification** | `lib/referral/referral-badges.js` — пороги; tier — `referral_tiers` + `countDirectPartnersInvited` |
| **Precedent RPC** | `referral_ledger_leaderboard_for_period` (Stage 74.2) — агрегация в Postgres |

### 1.3. Проблема

1. **Misleading metrics** — амбассадор не у корня сети видит прямые бонусы в bucket «L2+».
2. **Latency** — рост ledger rows + team size усугубляет triple-scan в одном GET.
3. **Product gap** — tab «Команда» не отвечает на «кто сколько принёс» и «сколько хостов реально работают».

---

## 2. Decision summary

**Stage 133** вводит **Team Analytics SSOT** с тремя решениями:

1. **Семантика L1/L2 «от меня»** — не `ledger_depth` как абсолютная глубина дерева.
2. **Агрегация в Postgres (RPC)** — один вызов для KPI; Node только оркестрирует и обогащает team list.
3. **UI в tab «Команда»** — sub-layout «Обзор + люди», без 6-го top-level tab; reuse `ReferralTeamMetricsStrip` / `ReferralAmbassadorLevels`.

**Инварианты (не обсуждаются):**

- Суммы начислений — **THB** в API (`ledgerBaseCurrency: 'THB'`); display currency — существующий `referral_display_currency`.
- Календарные периоды — **`resolveReferralStatsTimeZone(profile)`** (как Stage 73.6), не UTC-by-default для user KPI.
- RLS: аналитика только **своего** `referrer_id`; `supabaseAdmin` на server route после session check.
- **Не строим** полное дерево downline (L3+) в v1 — monetization cap ADR-131 = L2; UI = direct team + aggregate L2 earnings.
- Shadow L2 **не смешивать** с earned в ledger без явного disclaimer (`shadowL2Notice`).

---

## 3. Семантика метрик (SSOT)

### 3.1. Earnings breakdown «от амбассадора A»

Для строк `referral_ledger` где `referrer_id = A` и `status IN ('earned', 'earned_held')`:

| Bucket | Правило | Примеры `referral_type` |
|--------|---------|-------------------------|
| **`l1DirectThb`** | `referee_id` ∈ direct invites: `SELECT referee_id FROM referral_relations WHERE referrer_id = A` | `guest_booking` bonus с direct referee; `host_activation` с `ledger_depth = 1` |
| **`l2NetworkThb`** | Все прочие earned строки с `referrer_id = A` | L2 live guest (`metadata.split_role = 'l2_mentor'`), `host_activation` upline (`ledger_depth = 2`, `upline_l2`) |

**Запрещено** для новых полей Stage 133 использовать только `ledger_depth ≤ 1` как proxy L1 (legacy поля `monthlyL1*` остаются до deprecation с migration note в manifesto).

### 3.2. `totalTeamEarningsThb`

```
totalTeamEarningsThb = l1DirectThb + l2NetworkThb   // за выбранный period
```

Lifetime — тот же breakdown без фильтра периода (или `period.kind = 'lifetime'`).

### 3.3. `retentionRate` (v1)

**Определение (фиксируем в API):**

```
denominator = count(direct referees WHERE profiles.role = 'PARTNER')
numerator   = count(those with EXISTS booking status = 'COMPLETED' AND partner_id = referee_id)
ratePercent = round(numerator / max(denominator, 1) * 100, 1)
definition  = "direct_partners_with_completed_host_booking"
```

**Не путать** с `teamMembers[].activityStatus` (guest **или** host COMPLETED) — retention v1 только **host-side**.

### 3.4. Shadow L2

Если `ambassador_guest_l2_enabled !== true`:

- KPI из `referral_ledger` **не включают** shadow L2.
- API MAY вернуть `teamAnalytics.shadowL2Notice` с суммой из `referral_shadow_l2_monthly` (service_role read) **только как indicative**, с `messageKey` для UI disclaimer.

---

## 4. Backend architecture

### 4.1. Postgres RPC (primary)

Новая функция (имя каноническое):

```sql
referral_team_analytics_for_referrer(
  p_referrer_id text,
  p_period_start timestamptz,
  p_period_end_exclusive timestamptz
)
RETURNS TABLE (
  l1_direct_thb numeric,
  l2_network_thb numeric,
  pending_thb numeric,
  held_thb numeric,
  guest_booking_thb numeric,
  host_activation_thb numeric
)
```

- `SECURITY INVOKER` + `GRANT EXECUTE TO service_role` (вызов только из server route с `supabaseAdmin`).
- Фильтр earned: `earned_at` в `[start, end)`; pending/held — отдельные SUM по status.
- L1/L2 split — JOIN `referral_relations rr ON rr.referrer_id = p_referrer_id AND rr.referee_id = rl.referee_id`.

**Индексы (та же миграция):**

```sql
CREATE INDEX IF NOT EXISTS idx_referral_ledger_referrer_earned_at
  ON public.referral_ledger (referrer_id, earned_at DESC)
  WHERE status IN ('earned', 'earned_held');

CREATE INDEX IF NOT EXISTS idx_referral_relations_referrer_referred_at
  ON public.referral_relations (referrer_id, referred_at DESC);
```

### 4.2. Node SSOT module

**`lib/referral/build-referral-team-analytics.js`**

- Resolves period bounds via existing `referral-stats-month-bounds` + `resolveReferralStatsTimeZone`.
- Calls RPC + retention SQL (single query or second RPC `referral_team_retention_for_referrer`).
- Returns object matching §5 JSON contract.

**Dedupe в `GET /api/v2/referral/me`:**

- Один fetch earned rows **или** только RPC (preferred: RPC для aggregates, отдельный lean fetch для sparklines if needed).
- Pass precomputed `monthlyNetworkEarnedThb` / `totalLifetimeEarnedThb` into `buildReferralGamificationForUser` to avoid duplicate scans.

### 4.3. Per-member earnings

Расширить **`buildReferralTeamMembers`** (не N+1):

```sql
SELECT referee_id, round(sum(amount_thb), 2) AS earned_thb
FROM referral_ledger
WHERE referrer_id = $me AND status IN ('earned','earned_held')
  AND referee_id = ANY($referee_ids)
GROUP BY referee_id
```

Один batched query после pagination relations.

### 4.4. API surface

**v1:** расширение **`GET /api/v2/referral/me`** → `data.teamAnalytics` (default `includeTeamAnalytics=1` when `includeTeam=1`).

**v2 (optional):** `GET /api/v2/referral/team-analytics` если payload `/referral/me` превысит ~50KB p95.

Query params:

| Param | Default | Notes |
|-------|---------|-------|
| `includeTeamAnalytics` | `1` | `0` — skip RPC (mobile list-only) |
| `analyticsPeriod` | `month` | `month` \| `year` \| `lifetime` |
| `teamLimit` / `teamOffset` | existing | unchanged |

---

## 5. API contract (v1)

```json
{
  "teamAnalytics": {
    "period": {
      "kind": "month",
      "yearMonth": "2026-06",
      "ianaTimezone": "Europe/Moscow",
      "computedAt": "2026-06-13T12:00:00.000Z"
    },
    "earnings": {
      "ledgerBaseCurrency": "THB",
      "totalTeamEarningsThb": 12450.75,
      "lifetimeTeamEarningsThb": 98200.0,
      "breakdown": {
        "l1DirectThb": 8200.5,
        "l2NetworkThb": 4250.25,
        "byReferralType": {
          "guest_booking": 11000.0,
          "host_activation": 1450.75
        }
      },
      "pendingThb": 320.0,
      "heldThb": 150.0
    },
    "network": {
      "directInvitesTotal": 87,
      "directPartnersTotal": 12,
      "retention": {
        "ratePercent": 75.0,
        "numerator": 9,
        "denominator": 12,
        "definition": "direct_partners_with_completed_host_booking"
      }
    },
    "progress": {
      "currentTierId": "tier-pro",
      "nextTierId": "tier-ambassador",
      "directPartnersInvited": 12,
      "remainingToNextTier": 8,
      "tierProgressPercent": 40
    },
    "topContributors": [],
    "shadowL2Notice": {
      "applicable": false,
      "messageKey": null,
      "shadowMonthlyThb": null
    }
  }
}
```

**`teamMembers[]` extension:**

```json
{
  "refereeId": "user-abc",
  "earnedForReferrerThb": 2400.0,
  "l1ShareThb": 2400.0
}
```

---

## 6. Frontend architecture

### 6.1. Placement

| Component | Action |
|-----------|--------|
| `ReferralProfilePage.jsx` | Без нового top-level tab |
| `ReferralProfileTabTeam.jsx` | Stack: metrics → analytics card → activity → team list |
| **New** `ReferralTeamAnalyticsCard.jsx` | KPI grid, L1/L2 bars, retention, tier progress |
| `ReferralTeamMetricsStrip.jsx` | Перенести/продублировать на Team tab |
| `ReferralTeamSection.jsx` | Колонка «Принёс, THB» |
| `ReferralProfileTabEarnings.jsx` | Подписи L1/L2 sync с новой семантикой + tooltip |

### 6.2. Mobile (360px)

- Sub-sections vertical stack; KPI `grid-cols-2` (existing pattern).
- Progress bars — reuse `ReferralAmbassadorLevels` (`truncate`, `min-w-0`).
- Top contributors max **5** on mobile, **10** on `md+`.

### 6.3. Data fetching

- Extend `useReferralMeQuery` queryKey: `{ includeTeamAnalytics, analyticsPeriod }`.
- `staleTime: 60_000` сохраняем; invalidate on teammate join event (existing toast flow).

---

## 7. Performance & scale

| Scale | Risk | Mitigation |
|-------|------|------------|
| 1k direct invites | Full partner count scan | Cache `directPartnersInvited` on profile (`referral_tier_partner_count` already updated by tier sync) |
| 10k+ ledger rows / user | JS aggregation | RPC + partial index |
| 200 team page | Per-member GROUP BY | Single batched query |
| Full downline tree | Table scan on `ancestor_path` | **Out of scope v1** |

**SLO (target):** `GET /api/v2/referral/me` p95 < **800ms** with analytics at 500 ledger rows + teamLimit=100.

**Future (v2):** nightly rollup `referral_team_analytics_daily` if p95 > 1.5s sustained.

---

## 8. Migration & backward compatibility

1. Ship RPC + `teamAnalytics` **additive** — no breaking changes to existing `stats.*`.
2. Deprecation window: document in manifesto that `monthlyL1EarnedThb` / `monthlyNetworkEarnedThb` use **legacy** `ledger_depth` semantics; UI Earnings tab switches labels to `teamAnalytics.earnings.breakdown` when present.
3. Gamification `NETWORK_BUILDER` badge — optionally rebase on corrected `l2NetworkThb` (same RPC period = current month).

---

## 9. Alternatives considered

| Option | Rejected because |
|--------|------------------|
| Только расширить `route.js` без RPC | Triple-scan worsens; нет index-friendly GROUP BY |
| Materialized view on boot | Stale data + migration complexity for v1 |
| Full recursive tree UI | ADR-131 cap L2; product не требует L3+ dashboard |
| Client-side aggregation from history API | N+1, leaks pagination, no SSOT |

---

## 10. Consequences

### Positive

- Честные L1/L2 для мотивации сети.
- Один SQL round-trip для KPI.
- Per-member earnings без N+1.

### Negative / trade-offs

- Два источника truth для L1/L2 до полного deprecation legacy `stats.monthlyL1*`.
- Retention SQL на больших `referee_ids` — нужен chunking (pattern from `referral-stats.service.js` `chunkArray`).
- Shadow L2 disclaimer может путать, если не copywriting.

### Testing

- Extend financial/referral smoke or dedicated step: fixture A→B→C, assert RPC breakdown matches ledger rows.
- Manual: `/profile/referral` tab Team @ 360px.

---

## 11. Open questions

| # | Question | Default if unresolved |
|---|----------|------------------------|
| 1 | Отдельный route vs только `/referral/me`? | Только `/referral/me` в v1 |
| 2 | Top contributors in API or client sort of `teamMembers`? | Server `topContributors` max 10 |
| 3 | Include `earned_held` in totalTeamEarnings? | **Yes** (same as wallet display policy) |
| 4 | Rebasing gamification badges in 133 or 133.1? | 133.1 follow-up |

---

## 12. Acceptance checklist (Stage 133)

- [ ] Migration: RPC + indexes + GRANT
- [ ] `build-referral-team-analytics.js` + unit/integration against fixture
- [ ] `GET /api/v2/referral/me` → `teamAnalytics`; deduped ledger reads
- [ ] `teamMembers[].earnedForReferrerThb`
- [ ] UI: `ReferralTeamAnalyticsCard` on Team tab
- [ ] i18n `stage133_*` (ru/en/zh/th)
- [ ] `TECHNICAL_MANIFESTO.md` + `ARCHITECTURAL_PASSPORT.md` v12.133
- [ ] `ARCHITECTURAL_DECISIONS.md` § Team Analytics pointer
- [ ] Smoke green / manual QA per release checklist

---

*Draft v1 — 2026-06-13. Status **Proposed** until Product sign-off.*
