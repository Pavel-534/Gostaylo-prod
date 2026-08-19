# Referral Accounting (SSOT)

**Stage 114.7** — launch readiness (approaching monthly spend, FinTech progress bar, payout queue UX).  
**Stage 114.5** — единый бухгалтерский учёт реферальной программы для владельца и FinOps.  
**Stage 131.A1** — guest pool L3 (dual-mode): live ledger только при флаге; иначе shadow. Экономика начислений до cutover = ADR-131.  
Операционный поток: `docs/REFERRAL_FINANCIAL_FLOW.md`.

---

## 1. Учётные счета (логические)

| Счёт | Источник данных | Что означает |
|------|-----------------|--------------|
| **Referral obligation (ledger)** | `referral_ledger.status = earned` | Обязательство платформы перед амбассадором/гостем |
| **Wallet liability** | `user_wallets.withdrawable_balance_thb` + `internal_credits_thb` | Исполнение obligation в кошельке |
| **Promo tank** | `marketing_promo_pot` + `marketing_promo_tank_ledger` | Маркетинговый резерв (turbo, host activation) |
| **Cash-out / withdrawn** | `wallet_transactions` debit (referral payout refs) | Фактический вывод withdrawable (полуавтомат) |
| **Pending accrual** | `referral_ledger.status = pending` | Ещё не earned (может быть **hold**) |
| **Canceled / clawback** | `referral_ledger.status = canceled` + `metadata.clawback_at` | Сторно obligation |

Основной **`financial_ledger`** (escrow, комиссии) — **отдельный контур**; не смешивать с `referral_ledger`.

---

## 2. Формулы FinTech-дашборда

Снимок: `loadReferralAccountingSnapshot()` → `GET /api/v2/admin/referral/liability`.

| KPI | Формула | Примечание |
|-----|---------|------------|
| **totalEarnedThb** | Σ `referral_ledger.amount_thb` где `status = earned` | Lifetime |
| **totalWithdrawnThb** | Σ debit `wallet_transactions` с referral payout признаками | Если дебетов нет — 0 (история до Stage 114.2 могла не логировать) |
| **currentLiabilityThb** | `totalEarned − totalWithdrawn − canceledEarned*` | *canceled не уменьшает earned в агрегате monitor — см. gap |
| **walletExposureThb** | Σ withdrawable + internal по кошелькам | «В системе» сейчас |
| **promoTankUsageThb** | Σ отрицательных движений `marketing_promo_tank_ledger` | Дебеты tank |
| **netMarketingCostThb** | `totalEarnedThb + promoTankUsageThb` | Оценка полной маркетинговой нагрузки |
| **monthlyEarnedThb** | earned с `earned_at` ≥ 1-е число UTC месяца | Для месячного spend alert |

---

## 3. Жизненный цикл строки ledger

```mermaid
stateDiagram-v2
  [*] --> pending: distribute / createPendingRows
  pending --> earned: markPendingAsEarned (если не admin_hold / hold rule)
  pending --> earned_held: hold days / fraud gate
  pending --> canceled: cancel / admin reject
  pending --> pending: admin hold (metadata.admin_hold)
  earned_held --> earned: unlockHeldRowsForBooking
  earned --> canceled: clawback / admin reject
  earned --> wallet: referral_distribute_bonus_atomic
  earned_held --> held_balance: adjust_held_referral_balance_thb
```

**Credit path (канон):** wallet credit идёт через **`referral_distribute_bonus_atomic`** (`lib/services/marketing/referral-distribute-atomic.service.js`), не через прямой `WalletService.addFunds` в earn/unlock. Held balance — RPC **`adjust_held_referral_balance_thb`** (+ CAS fallback в `adjustHeldReferralBalanceThb`).

**Admin hold (114.5):** `metadata.admin_hold = true` на `pending` — строка **не** переходит в `earned` при `markPendingAsEarned`.

**Admin reject:**
- `pending` → `canceled`
- `earned` → clawback кошелька + `canceled` (одна строка, `PATCH /api/v2/admin/referral/ledger/[id]`)

---

## 4. Вывод средств (полуавтомат)

1. Пользователь: `POST /api/v2/wallet/referral-withdrawal-request`
2. `referral_withdrawal_status = withdrawable_referral`
3. Админ: `/admin/marketing/payouts?referralOnly=1`, `POST …/referral-bulk` approve/reject
4. **Автобанковский вывод не включён** — отдельный payout rail по политике платформы

История в UI: `/profile/referral` → вкладка «История» (`ReferralWithdrawalHistory`, данные `GET /api/v2/wallet/me`).

---

## 5. Алерты (TG FINANCE)

Пороги в `system_settings.general` (через `getReferralAdminAlertPolicy()`):

| Ключ | Default | Событие |
|------|---------|---------|
| `referral_admin_large_earn_alert_thb` | 10 000 | Одно earned ≥ порога |
| `referral_admin_hourly_burst_alert_thb` | 25 000 | Σ earned referrer за 1ч |
| `referral_admin_monthly_spend_alert_thb` | 150 000 | **Early warning · referral spend growing** (info, 1×/мес., `REFERRAL_MONTHLY_SPEND_ALERT`) |
| 80% of `referral_monthly_program_cap_thb` | сейчас 80% × **250 000** = 200 000; после cutover 80% × **1 000 000** = 800 000 | **Approaching program cap** (warning, 1×/мес., `REFERRAL_PROGRAM_CAP_APPROACHING`) — независимо от 150k |

Событие: `REFERRAL_ADMIN_ALERT` → `referral-events.handleReferralAdminAlert` → topic **FINANCE** (large / burst / early warning 150k / approaching program cap). Оба spend-порога могут сработать в одном месяце.

FinTech KPI: `monthlySpendAlertTriggered` (150k), `approachingCapTriggered` (80% program cap) в `accounting` снимка; UI `/admin/settings/finances` (`ReferralMonthlySpendBar`).

---

## 6. Контроль и лимиты (рекомендации)

1. Ежедневно: `currentLiability` vs `walletExposure`, баланс promo tank.
2. При `monthlySpendAlertTriggered`: ревью топ-амбассадоров и hold подозрительных `pending`.
3. Перед массовым approve referral payouts: сверка очереди с `totalWithdrawn` + withdrawable.
4. Не повышать `referral_reinvestment_percent` без ADR; tier ratio меняет только split кошелька.

### 6.0 L3 ledger & shadow (Stage 131.A1+)

**Live row (при `ambassador_guest_l3_enabled=true` + gate + consent):**

- `referral_ledger` строка с `type=bonus`, `referral_type=guest_booking`, `metadata.split_role='l3_upline'`, `referrer_id=l3ReferrerId`.
- Per-booking cap: **500 THB**.
- Monthly cap: **20 000 THB** per beneficiary (UTC month).
- Excess / skip → `bookings.metadata.fintech_snapshot.shadow_l3_thb`.

**Shadow (при `l3_enabled=false` или gate/consent fail / нет hop L3):**

- `bookings.metadata.fintech_snapshot.shadow_l3_thb` = unallocated L3 amount.
- **Не** пишется в `referral_ledger`. **Не** включается в program cap spend.
- При cutover существующие shadow строки остаются в metadata, **не** конвертируются retroactively.

**Invariant:**

- L1 + L2 + L3 + referee = 100% пула (sum при L3 enabled).
- L1 + L2 + referee = 100% пула (sum при L3 disabled, l3=0).
- Drift округления → в referee, как при L2 shadow. Неразмещённый L3 → withhold владельцу, не в referee.

**Program cap:**

- Колонка SSOT `referral_monthly_program_cap_thb` (не плодить `referral_program_cap_thb`).
- **Runtime сейчас:** default **250 000** (A1.1/A1.2 cutover не делали).
- **Цель после cutover:** **1 000 000** THB/мес (ADR-131A).
- Только **фактически записанные** ledger rows учитываются.
- Shadow (deferred L3) **не** учитывается.

### 6.1 Launch readiness — рекомендуемые лимиты (Stage 114.6)

Настраиваются в **`system_settings.general`** (без смены формул начисления):

| Параметр | Ключ | Default | Назначение |
|----------|------|---------|------------|
| Крупное earned | `referral_admin_large_earn_alert_thb` | 10 000 | TG FINANCE на одно начисление |
| Всплеск за час | `referral_admin_hourly_burst_alert_thb` | 25 000 | Подозрительная активность referrer |
| Месячный spend (early warning) | `referral_admin_monthly_spend_alert_thb` | 150 000 | 1×/мес. info · рост spend |
| Approaching program cap | 80% × `referral_monthly_program_cap_thb` | 200 000 сейчас / 800 000 после cap 1M | 1×/мес. warning; независимо от 150k |
| Мин. вывод | `wallet_min_payout_thb` | из pricing | Порог заявки withdrawable |
| Reinvestment % | `referral_reinvestment_percent` | ADR | Не поднимать без ревью маржи |

**Операционные лимиты (ручной контроль, не hardcode в коде):**

- **Max earned на пользователя / месяц** — мониторить в FinTech (топ амбассадоров + CSV export); при превышении внутреннего порога (например 50 000 THB) — hold pending + ревью.
- **Max approve payouts за смену** — не более N заявок без второй подписи (процесс FinOps).
- **Promo tank floor** — не допускать `marketing_promo_pot` ниже прогноза 10 host activations без topup.

**FinTech workflow (114.6–114.7):** очередь `withdrawable_referral` — поиск, сортировка, approve/reject выбранных и **filtered**; bulk **Hold all pending** / **Release all held** по фильтру ledger. Компонент: `ReferralPayoutWorkflowPanel`, `ReferralMonthlySpendBar`.

---

## 7. API и код

| Назначение | Путь / модуль |
|------------|----------------|
| Accounting snapshot | `lib/admin/referral-accounting-snapshot.js` |
| Liability UI | `components/admin/finances/ReferralLiabilityPanel.jsx` |
| Ledger admin actions | `lib/admin/referral-ledger-admin.js`, `PATCH /api/v2/admin/referral/ledger/[id]` |
| Ledger bulk hold/release | `POST /api/v2/admin/referral/ledger-bulk` |
| Payout bulk approve/reject | `POST /api/v2/admin/wallet/payouts/referral-bulk` |
| Профиль (perf) | `GET /api/v2/referral/me?includeTeam=0&teamLimit=` |
| Публичная визитка | `GET /api/v2/referral/landing-meta/[userId]` (revalidate 60s) + `referral-landing-meta-client.js` |

---

## 8. Связанные документы

- `docs/REFERRAL_FINANCIAL_FLOW.md` — поток денег
- `docs/FINANCIAL_FLOW_MAP.md` §8 — clawback, cancel
- `docs/ADR/131-ambassador-3-0.md` — Ambassador 3.0
- `docs/ADR/131A-ambassador-3-1-multi-level.md` — Ambassador 3.1 (L3 policy)
- `ARCHITECTURAL_DECISIONS.md` — политика маржи / reinvestment

При расхождении KPI с БД — правка кода и этого файла в одном PR (`AGENTS.md`).
