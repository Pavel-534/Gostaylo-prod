# Payout retention logic (SSOT)

**Stage:** 72.4  
**Last updated:** 2026-04-27

## 1) Wallet structure

`user_wallets` now keeps three balances:

- `balance_thb` — total wallet balance (legacy-compatible aggregate).
- `internal_credits_thb` — spendable only inside platform (checkout/fees).
- `withdrawable_balance_thb` — eligible for payout flow (with verification gates).

Rule: `internal_credits_thb + withdrawable_balance_thb` is the economic split of earned bonus flows; `balance_thb` remains the global ledger-backed sum.

## 2) Retention policy parameter

`system_settings.general.payout_to_internal_ratio` (0..100, default 70).

- Example: value `70` means from `1000 THB` referral bonus:
  - `700 THB` -> `withdrawable_balance_thb`
  - `300 THB` -> `internal_credits_thb`

Formula:

- `withdrawable = amount * (payout_to_internal_ratio / 100)`
- `internal = amount - withdrawable`

## 3) Which bonus goes where

- `referral_bonus` (including host-activation L1/L2 rewards): **hybrid split** by ratio.
- `referral_cashback`: 100% to `internal_credits_thb`.
- `welcome_bonus`: 100% to `internal_credits_thb`.

Checkout spend (`walletUseThb`) is allowed only against `internal_credits_thb`.

Payout readiness uses `withdrawable_balance_thb` + profile/admin gates:

- `profiles.is_verified == true`
- `user_wallets.verified_for_payout == true`
- `withdrawable_balance_thb >= wallet_min_payout_thb`

## 4) Stage 72.4 smoke chain

`Referrer -> Referee -> Booking COMPLETED -> L1/L2 reward split -> retention split`

1. Booking becomes `COMPLETED`.
2. `ReferralPnlService` computes L1/L2 ledger rewards.
3. `WalletService.addFunds(..., 'referral_bonus', ...)` applies retention split.
4. Wallet updates:
   - `withdrawable_balance_thb` gets payout part
   - `internal_credits_thb` gets retention part
5. Admin `/admin/marketing/payouts` shows payout-ready users by withdrawable balance only.
6. Renter checkout spends only internal credits; partner sees withdrawable/internal progress in referral UI.

## 5) Why this retention model

Hybrid split prevents “cash-out and churn” behavior:

- ambassadors still get real payout path (`withdrawable_balance_thb`);
- a guaranteed part remains inside ecosystem (`internal_credits_thb`) and drives repeat bookings.

