# User flow audit — roles, referrals, and money (SSOT)

**Purpose:** describe how **one human** can be both **guest (renter)** and **host (partner)** without breaking referral identity, and where each fact lives in the database.

**Version:** Stage 72.2 | **Last updated:** 2026-04-27

---

## 1. Identity vs role (`profiles`)

| Field / table | Meaning | Changes when user becomes Partner? |
|---------------|---------|-----------------------------------|
| `profiles.id` | Stable primary key | **Never** |
| `profiles.role` | `RENTER` \| `PARTNER` \| … | **Yes** — application / admin flow |
| `profiles.referred_by` | Legacy **code string** (optional) from signup | **Should not change** after registration (marketing attribution) |
| `referral_relations` | One row per invited user: `(referrer_id → referee_id)` | **Immutable** after insert (`referee_id` unique) |
| `referral_codes` | Own promo code per user | Persists across role change |

**Conclusion:** The inviter→invitee relationship is stored in **`referral_relations`**, not in `role`. Changing **RENTER → PARTNER** does **not** rewrite who referred whom.

---

## 2. Referral ledger vs capacity (`referral_ledger`)

- Rows are keyed by **`booking_id`** + **`type`** (`bonus` | `cashback`) + **`referral_type`** (Stage 72.2: `guest_booking` \| `host_activation`).
- **Guest-side economics** (current engine): referee = **renter on the booking** (`booking.renter_id`). Distribution runs on **COMPLETED** bookings via `ReferralPnlService.distribute`.
- **Partner-side (supply) bonus** for “invited host”: designed as **`referral_type = host_activation`**, credited after the invited partner’s **first COMPLETED booking as owner**. Engine hook: `ReferralPnlService.distributeHostPartnerActivation` (wired in a future PR once listing-owner completion rules are finalized).

---

## 3. Same person rents and hosts

Typical sequence:

1. User registers with a referral code → **`referral_relations`** row stores inviter for **life**.
2. User books as **guest** → guest referral pool uses **relation(referee_id = user)** when booking completes.
3. User applies to become **partner** → **`profiles.role`** updates; **`referral_relations`** unchanged.
4. Guest bookings made **before** partnership still attribute referral economics to the **same referee identity** (`profiles.id`).
5. Partner listings create **host** bookings: referral semantics split:
   - **Guest booking referral:** unchanged (renter-side).
   - **Host activation referral:** new ledger flavour (`host_activation`) — separate from guest ledger rows.

**UI surfaces (Stage 72.2):**

- **`GET /api/v2/referral/me`** → `inviteNetwork.depth`, `ancestorChainLength` (chain depth at signup).
- **`GET /api/v2/wallet/me`** → `payout` eligibility (min THB, email verified, `verified_for_payout`).
- **`/profile/referral`** — network card + payout card + existing stats.

---

## 4. Admin SSOT

- **`wallet_min_payout_thb`** — `system_settings.general` (editable in **`/admin/system`** → Marketing → Wallet & Payout Policy).
- **`user_wallets.verified_for_payout`** — compliance gate for future card payouts (defaults **true** in migration for soft launch; can be tightened per environment).

---

## 5. Open product decisions (for your backlog)

1. **Multi-level payouts:** `ancestor_path` / `network_depth` are stored for analytics and future commission rules. **Financial guardrails** must keep ∑ payouts + acquiring + reserves ≤ distributable platform margin — see `docs/FINANCIAL_FLOW_MAP.md` (Stage 72.2 addendum).
2. **Admin toggle** for `verified_for_payout` per user — not implemented in this PR; use SQL or follow-up admin endpoint.
