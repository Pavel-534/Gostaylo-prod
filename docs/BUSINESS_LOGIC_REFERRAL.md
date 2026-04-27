# Referral Program — Business Logic

## Purpose

This document describes how GoStayLo allocates referral rewards without damaging booking unit-economics.

Canonical engine: `lib/services/marketing/referral-pnl.service.js`.

## Core Inputs (per booking)

- `PlatformGross` = `GuestServiceFee + HostCommission`.
- `BaseNetProfitOrder` = `PlatformGross - InsuranceReserve`.
- `acquiring_fee_percent` (from `system_settings.general`): variable PSP/bank cost share.
- `operational_reserve_percent` (from `system_settings.general`): operational reserve share.
- `AdjustedNetProfitOrder` = `BaseNetProfitOrder - AcquiringFee - OperationalReserve`.
- `referral_reinvestment_percent` (from `system_settings.general`): how much of `NetProfitOrder` is reinvested into referral rewards.
- `referral_split_ratio` (from `system_settings.general`): referrer share in `[0..1]`, where:
  - `bonus` (referrer) = `ReferralPool × referral_split_ratio`,
  - `cashback` (referee) = `ReferralPool × (1 - referral_split_ratio)`.

## Safety Lock (mandatory)

To prevent loss-making referrals, reward pool is strictly capped:

`ReferralPool = min(AdjustedNetProfitOrder × referral_reinvestment_percent, PlatformGross × 0.95)`

This lock guarantees total referral payouts per booking can never exceed 95% of platform gross margin for that booking.

## Booking Lifecycle

1. Booking reaches `COMPLETED`.
2. Engine resolves referral relation (`referrer -> referee`) by `booking.renter_id`.
3. Engine creates/normalizes `pending` rows in `referral_ledger` (`bonus`, `cashback`).
4. Engine transitions rows to `earned`.
5. Re-run is idempotent: if already `earned`, no duplicate payout is created.

For bookings without referral relation:

6. Order is treated as `organic`.
7. A configured share of order net profit can be moved into `marketing_promo_pot`.

## Data Model

- `referral_codes`: one code per user profile.
- `referral_relations`: inviter/invitee relation (one inviter per invitee).
- `referral_ledger`: financial journal by booking, with status lifecycle:
  - `pending` -> `earned` or `canceled`.
- `marketing_promo_tank_ledger`: ledger of global promo tank topups/debits.

## Admin Controls

Settings UI: `/admin/system` -> tab `Маркетинг`.

- Marketing Reinvestment %.
- Referral Split (referrer/referee).
- Acquiring fee %.
- Operational reserve %.
- Organic -> Promo Pot %.
- Promo boost per booking (THB).
- Turbo mode toggle.
- Promo Tank Control (balance + manual topup).
- Referral P&L Monitor (earned/pending/canceled totals from `referral_ledger`).

Expense Control Panel applies costs in this order:
1. Gross margin from booking fees.
2. Insurance reserve.
3. Acquiring fee reserve.
4. Operational reserve.
5. Reinvestment share for referral pool.

## Default Policy (if missing in settings)

- `referral_reinvestment_percent`: `70`.
- `referral_split_ratio`: `0.5` (50/50).

These defaults are conservative bootstraps and should be tuned by business targets (CAC, LTV, refund rate, PSP costs).

## Security Rules (Stage 71.2)

Activation guard: `lib/services/marketing/referral-guard.service.js`.

- Self-referral protection by:
  - user id,
  - email equality,
  - owner IP metadata (`referral_codes.metadata.owner_ip`) vs referee request IP.
- Device fingerprint shield:
  - registration/onboarding sends device fingerprint,
  - one fingerprint cannot activate codes of different referrers.
- Monthly anti-spam cap:
  - max new referrals per referrer/month (`referral_monthly_limit_per_user`, default `30`).
- Public validation endpoint:
  - `POST /api/v2/referral/validate` checks code + guard rules before registration submit.

## Marketing Promo Tank (Stage 71.3)

Global tank: `system_settings.general.marketing_promo_pot`.

Core controls:

- `organic_to_promo_pot_percent`: share of `AdjustedNetProfitOrder` moved into tank for completed **organic** bookings.
- `promo_turbo_mode_enabled`: enables tank-funded boost logic.
- `promo_boost_per_booking`: fixed THB amount added to each referral booking payout while turbo is active.

Boost strategy:

1. Engine calculates base referral pool by reinvestment policy + safety lock.
2. If turbo is enabled and tank has funds, system debits up to `promo_boost_per_booking`.
3. Boost amount is added to referral payout and split by `referral_boost_allocation_rule`:
   - `100_to_referrer`,
   - `100_to_referee`,
   - `split_50_50`.
4. Debit/topup operations are stored in `marketing_promo_tank_ledger` with idempotency by booking + entry type.

Operational strategy:

- **Conservative mode:** turbo off, only organic-to-pot accumulation.
- **Growth mode:** turbo on with small fixed boost.
- **Aggressive launch mode:** higher organic funnel % + higher boost, monitored daily by tank runway.

## Финансовая модель кошелька и лимиты списаний (Stage 71.5)

Wallet SSOT:

- `user_wallets` — баланс пользователя в THB.
- `wallet_transactions` — неизменяемый журнал кредитов/дебетов.
- Атомарная операция через DB-функцию `wallet_apply_operation(...)`.

Правила:

1. Баланс не может стать отрицательным (жёсткий DB-check + транзакционная функция).
2. Все списания/начисления проходят через `lib/services/finance/wallet.service.js`.
3. Welcome bonus (`welcome_bonus_amount`) начисляется пользователю при регистрации по рефкоду.
4. Earned реферальные строки (`referral_ledger.status = earned`) зеркалируются в кошелёк:
   - `bonus` -> кошелёк пригласившего,
   - `cashback` -> кошелёк приглашённого.
5. В checkout можно применить кошелёк только в пределах:
   - баланса пользователя,
   - `wallet_max_discount_percent` от суммы заказа,
   - платформенной комиссии заказа (доля партнёра не уменьшается).

Формула лимита списания:

`wallet_spend_cap = min(wallet_balance, order_total × wallet_max_discount_percent, platform_fee)`

Фактический платёж гостя:

`guest_payable = order_total - wallet_spend_applied`

## One-Minute Campaign (Ideologist)

How to launch a marketing push in 1 minute:

1. Open `/admin/system` -> `Маркетинг`, top up Promo Tank (`Promo Tank Control`).
2. Enable `Turbo Mode` and set `promo_boost_per_booking`.
3. Trigger audience communication (push / social / partner channels) with referral CTA.

Recommended micro-check before launch:

- Tank balance covers at least 3-7 days of expected boosted conversions.
- `organic_to_promo_pot_percent` remains non-zero to replenish tank from organic flow.

