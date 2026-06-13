# ADR-134: Referral payout FX policy (Rate Lock, Stale Guard)

| Field | Value |
|-------|--------|
| **Status** | Accepted |
| **Stage** | 134.0 |
| **Date** | 2026-06-01 |

## Context

Ambassador withdrawals settle in RUB while ledger SSOT remains THB. Live FX between user request and admin approve created volatility risk and UX mismatch.

## Decision

1. **Rate Lock (48h)** — on `requestReferralWithdrawal`, single mid FX call; snapshot in `user_wallets.referral_withdrawal_metadata`.
2. **Approve SSOT** — `createReferralWithdrawalPayoutRow` uses locked metadata only; no live FX. Legacy rows without metadata → `REFERRAL_PAYOUT_FX_LOCK_MISSING`.
3. **Stale Guard (6h)** — `assertReferralPayoutFxFresh()` blocks preview and new requests when RUB quote in `exchange_rates` is older than 6 hours.
4. **Lazy expire** — past `fx_lock_expires_at`, queue cleared; user/admin gets `REFERRAL_PAYOUT_FX_LOCK_EXPIRED`.
5. **Display FX** — `GET /api/v2/wallet/me` → `displayBalances` from `profiles.referral_display_currency`; ledger unchanged THB.
6. **Isolation** — open `REFERRAL_RUB_CARD` payouts excluded from partner batch settle blockers (`isOpenPartnerHostPayoutRow`).

## Invariants

- Marketing wallet ⊥ partner ledger / escrow (unchanged).
- `wallet_apply_operation` still THB-only.
- T-Bank CSV reads frozen `amount_in_payout_currency` from approve-time payout row.

## Migration

`migrations/stage134_01_referral_withdrawal_fx_lock.sql` — `referral_withdrawal_metadata JSONB`.
