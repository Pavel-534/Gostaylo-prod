# ADR-300: RF–KR–TH financial overlay 3.0 (code SSOT + Phase 0)

| Field | Value |
|-------|--------|
| **Status** | **Accepted (Phase 0 active)** |
| **Stage** | **201.04** — ADR-only (no runtime) |
| **Date** | 2026-08-13 |
| **Deciders** | Product, Finance, Engineering (Senior Architect) |
| **Brand** | Airento (`getSiteDisplayName()`) |
| **Does not supersede** | [ADR-097](./097-financial-model-v2.md) (Pricing Profiles, snapshot v2, ledger legs, batch payouts) |
| **Overlays** | Concierge Launch manual treasury in `ARCHITECTURAL_DECISIONS.md`; geo / remittance ops vs product accounting |
| **SSOT after Accept** | This ADR for **geo overlay + Phase 0 ops policy**; ADR-097 + `lib/pricing-engine/` for **fee math** |

---

## 1. Context / Problem

Business scheme **3.0** (RF guest → RF agent ИП → KR ОсОО IT services → Thai / cross-border host) is the **target cash narrative**. A Word brief used names that **do not match the repo** (`system_settings.ru_agent_share_pct`, `price_expires_at`, `payout_pools`, `bookings.payout_batch_id`).

Code-truth already implements the **accounting** half:

- Immutable `bookings.pricing_snapshot` **v = 2** with RU / KR / FX / rounding / host netto.
- Checkout charge from the **snapshot**, not live `exchange_rates`.
- Ledger legs RU agent / KG IT / FX markup / rounding pot.
- Partner payout **batches** + rails `TBANK_RU` vs `KG_CRYPTO`.

The **cash** half (ИП→ОсОО remittance, buying USDT, which legal entity actually sent the host) is **operational**. Soft launch may run **months** with the RF entity only; KR ОсОО may not exist yet.

This ADR binds scheme 3.0 to **existing symbols**, authorizes **Phase 0 manual treasury from RF**, and forbids renaming SSOT to match the Word file.

---

## 2. Decision — target model 3.0

| Layer | Target (product + books) |
|-------|--------------------------|
| Guest (RF) | Pays the **RF agent** (acquiring / MIR). Guest Brutto locked on booking create. |
| RF margin | **Agency** share from `pricing_profiles.ru_agent_share_pct` → snapshot `ru_fee_thb` → ledger RU agent. Typical launch **~7% of subtotal**, not a hardcoded literal. |
| KR margin | **IT / platform support** (not royalty) from `kr_service_share_pct` → `kr_fee_thb` → ledger KG service. Typical launch **~8% of subtotal**. |
| Host | `total_partner_netto_thb` / `partner_earnings_thb` (subtotal − host fee). Not a stored `host_share_pct = 85`. |
| FX / rounding | Checkout spread → `fx_markup_thb` (KG P&L). Guest `Math.round` remainder → rounding pot. |
| Host payout | Batches; rail by partner preferred currency: **RUB domestic** vs **USDT / crypto international**. |
| RF→KR remittance | **Ops**, not a product money FSM. Batch CSV + ledger explain *what* is owed; treasurer decides *when / how* cash moves. |
| Fiscal (RF) | One receipt, full payment; agent tags on transit; supplier **name** = KR entity, **INN** = RF agent — payload in code, live kassa via env/provider. |

**Invariant:** Word / accountant vocabulary maps **onto** code symbols. Code symbols are not renamed «for beauty».

**Invariant:** Guest capture, escrow, and ledger stay **THB mid** (plus documented FX surcharge in snapshot). Acquirer charge currency is a separate adapter concern.

---

## 3. Phase 0 — Manual treasury from RF

**Duration:** first months (may be **1–6+**). Status of this ADR remains **Accepted (Phase 0 active)** until a successor ADR marks Phase 0 complete or supersedes the overlay.

**Explicitly allowed:**

1. Operate **primarily from RF** (guest acquiring + RF books).
2. KR ОсОО **may not be incorporated yet**. KR share still **accrues in ledger** (`kr_fee_thb` / `PLATFORM_FEE_KG_SERVICE`) as an internal P&L line.
3. Pay **foreign partners** by hand: USDT bought in RF or sent from a treasury wallet — **not** through an automated KR bank/crypto contour.
4. Product remains the **books + CSV**: snapshot, ledger, `payout_batches` / `payout_batch_items`. **Who physically sent** the money is the treasurer runbook, then admin `settled` after the fact (existing Concierge path).
5. Record FX conversions in FinTech admin («Конвертации и потери») when cash is exchanged — existing Stage 101 panel; no new FSM.

**Still required in Phase 0:**

- Do not invent a second price. Charge guest from **locked snapshot**.
- Do not skip payout-batch registry for partner settlements that the admin marks settled.
- Do not treat Phase 0 as permission to rewrite PricingEngine, escrow, or ledger core.

**Exit from Phase 0** (future ADR / Amendment): KR entity live, optional automated remittance, and/or policy that foreign host USDT **must** leave KR. Until then, **manual USDT from RF is compatible with this ADR.**

Detailed treasurer checklists (payment purpose, bank steps, buffer) live **outside git** — see §8.

---

## 4. Three geo contours

### (A) RF → TH (via KR ops when available)

Guest RF → RF agent cash-in. Books: RU agency + KR IT + FX + host netto. Host payout rail **`KG_CRYPTO`** (USDT / USD / THB). Physical path RF→KR→TH (or Phase 0: RF treasury USDT → host) does **not** change snapshot keys.

### (B) RF → RF (domestic host, Sochi-style)

Guest RF → RF agent. Host payout rail **`TBANK_RU`** (RUB). KR share remains **software / IT attribution** in the ledger; remitted to KR only when ops chooses to (Phase 0: may stay accrued in RF books). No separate «KR cash» requirement to pay a RF host.

### (C) KR local — future, not blocking launch

Guest or host primarily in KR (local acquiring, local payout). **Out of scope** for launch. Needs a later ADR (rails, fiscal, FX). Soft launch **must not wait** on (C).

---

## 5. Code SSOT map

Word / scheme 3.0 names are **aliases**. Canonical symbols are on the right.

| Scheme 3.0 concept | In repo (canonical) |
|--------------------|---------------------|
| Booking freeze / quote | `bookings.pricing_snapshot` JSONB, `v: 2`, `computed_at` — `lib/pricing-engine/snapshot-adapter.js` `toPricingSnapshotV2`; wired in `lib/services/booking/pricing-engine-integration.js` |
| Guest mid vs customer FX | `final_breakdown.fx_raw_rate_to_thb`, `fx_customer_rate_to_thb`, `fx_markup_pct_applied` |
| FX income | `final_breakdown.fx_markup_thb` / `fee_split_v2.fx_markup_thb` → ledger `la-sys-fx-markup-kg` |
| RU ~7% | `pricing_profiles.ru_agent_share_pct` → `ru_fee_thb` → `la-sys-platform-fee-ru` (`PLATFORM_FEE_RU_AGENT`) |
| KR ~8% IT (not royalty) | `pricing_profiles.kr_service_share_pct` → `kr_fee_thb` → `la-sys-platform-fee-kg` (`PLATFORM_FEE_KG_SERVICE`) |
| Guest fee total | `guest_fee_pct`; DB check `ru_agent_share_pct + kr_service_share_pct = guest_fee_pct` |
| Host netto | `final_breakdown.total_partner_netto_thb`, column `bookings.partner_earnings_thb` |
| Guest brutto (pay currency) | `final_breakdown.total_guest_brutto` `{ amount, currency }`; columns `price_paid`, `currency`, `exchange_rate` |
| Rounding | `rounding_pot_thb` / `rounding_diff_pot_thb` + column `bookings.rounding_diff_pot` → `la-sys-processing-pot` |
| Word `system_settings.ru_agent_share_pct` | **Do not use.** Percents live on **`pricing_profiles`**. Default profile id may sit in `system_settings.general.default_pricing_profile_id` |
| Word `freeze_ttl_minutes` / `price_expires_at` | `CHECKOUT_HOLD_TTL_MINUTES` (default 30) — `lib/booking/checkout-hold-policy.js`; `metadata.checkout_hold_expires_at`. **Hold expires → reject pay / cancel unpaid, no silent reprice** |
| What wins at pay | Snapshot + locked `price_paid` — `lib/booking/guest-payment-display.js`, `lib/services/payment-adapters/acquirer-charge-amount.js`. Not live `exchange_rates` for guest charge |
| Word `payout_pools` | `payout_batches` + `payout_batch_items` (`database/migrations/053_financial_model_v2.sql`) |
| Booking ↔ batch | `payout_batch_items.booking_id` + `batch_id` (UNIQUE pair). **No** `bookings.payout_batch_id`. Settlement journal `metadata.payout_batch_id` |
| Payout services | `lib/services/payout-batch.service.js`, `lib/services/payout-batch/payout-batch-creation.js`, `payout-batch-settlement.js`, `ledger-settlement.js` |
| Rails | `lib/treasury/payout-rails.js`: `TBANK_RU` (RUB Direct), `KG_CRYPTO` (USDT/intl). Resolver: `preferred_payout_currency === 'RUB'` → RU else international |
| Fiscal payload | `toFiscalKassaPayload` in `lib/pricing-engine/snapshot-adapter.js`; issue/sandbox `lib/services/fiscal-kassa.service.js`; tags `lib/pricing-engine/fiscal-config.js` |
| Fiscal shape | `one_receipt: true`, FFD payment method **4** / full payment; transit line `agent_sign: 5`; supplier name/INN from **env** (not committed) |
| `FISCAL_SANDBOX=true` | Mock receipt in `bookings.metadata.fiscal` (`SANDBOX_MOCK`); no provider HTTP. Disabled in production payment env |
| Ready-for-payout | Status `READY_FOR_PAYOUT` + `metadata.ready_for_payout_at` (not a `payout_pools` table) |

Profile resolution (unchanged ADR-097): listing → partner → geo assignment → `default_pricing_profile_id`. Engine: `lib/pricing-engine/compute-breakdown.js`, `resolve-profile.js`.

---

## 6. Explicit NON-goals

- **Do not** automate bank transfer ИП RF → ОсОО KR (no remittance UI, no new money FSM).
- **Do not** rewrite PricingEngine / ledger / escrow / payout **execution** to match Word field names.
- **Do not** treat the Word document as source of column or JSON keys.
- **Do not** add `bookings.payout_batch_id` or `price_expires_at` «because the brief said so» without a new ADR and a real product need.
- **Do not** block launch on contour (C) or on KR incorporation.
- **Do not** commit INN, ShopID, full banking templates, passport/tax-avoidance playbooks, or treasury buffer sizes.

---

## 7. Change process

This ADR is **not** a forever law.

| Change | How |
|--------|-----|
| Typo / SSOT path / Phase 0 clarification | **Amendment** subsection at the bottom of **this file** (date + author role). Do not rewrite history of §1–6. |
| New geo contour, mandatory KR cash-out, automated remittance, or different fee base | **New ADR** (e.g. 300.1 / 3xx). Set this file **Status: Superseded** (or «Superseded in part») with a link. Keep the old text. |
| Runtime (pricing, ledger, escrow, payout send) | Separate engineering PR **after** the ADR/Amendment. Financial formulas still require ADR + Manifesto/Constitution updates per repo constitution. |
| Percents 7/8/15 | Data: `pricing_profiles` rows (admin). Not a code change; not a new ADR unless the **formula base** changes. |

Do not silently «fix» snapshot keys or ledger account ids to match accountant slang.

---

## 8. Security note (public GitHub)

The repository **may be public**. This ADR is architecture + code map + Phase 0 policy only.

**Must not be committed:**

- Real INN / OGRN / BICs / account numbers / ShopID / kassa tokens.
- Full bank payment-purpose strings with unique contract codes if they identify the operating entities.
- Personal data, passport schemes, or a how-to for tax evasion.
- Treasury USDT buffer sizes, wallet addresses, or seed phrases.
- Env secrets (`FISCAL_*` values, acquiring keys).

**Private ops:** copy `docs/private/TREASURY_RF_KR_PHASE0.example.md` locally. Real runbook stays **out of git** (`docs/private/**` gitignored except `*.example.md`).

Детальный treasury runbook — локально/private, не в git.

---

## 9. References (repo paths only)

| Path | Role |
|------|------|
| [`docs/TECHNICAL_MANIFESTO.md`](../TECHNICAL_MANIFESTO.md) | Code-truth; Stage 201.04 delta |
| [`docs/FINANCIAL_FLOW_MAP.md`](../FINANCIAL_FLOW_MAP.md) | Wallet / referral / payout flow map |
| [`docs/CURRENCY_FX_SSOT.md`](../CURRENCY_FX_SSOT.md) | Retail vs checkout FX |
| [`docs/ADR/097-financial-model-v2.md`](./097-financial-model-v2.md) | Pricing profiles, RU/KG split, batches |
| [`ARCHITECTURAL_DECISIONS.md`](../../ARCHITECTURAL_DECISIONS.md) | Policy SSOT (Financial Model v2.0 + Concierge treasury) |
| [`docs/runbooks/CONCIERGE_LAUNCH_TREASURY_RUNBOOK.md`](../runbooks/CONCIERGE_LAUNCH_TREASURY_RUNBOOK.md) | Existing manual payout / CSV ops (no secrets) |
| `lib/pricing-engine/` | Breakdown + snapshot + fiscal payload |
| `lib/services/ledger/ledger-capture-legs.js`, `ledger-shared.js` | Capture legs + account ids |
| `lib/services/payout-batch.service.js`, `lib/services/payout-batch/*` | Batch create / settle / export |
| `lib/treasury/payout-rails.js` | Rail ids |
| `lib/booking/checkout-hold-policy.js` | Hold TTL |
| `database/migrations/053_financial_model_v2.sql` | `pricing_profiles`, `payout_batches`, `payout_batch_items` |

---

## 10. Consequences

- Launch accounting is **already** in code; Phase 0 cash movement is **ops**.
- Future KR automation is an **opt-in ADR**, not a missing launch blocker.
- Accountants map their chart of accounts to the SSOT table in §5; engineering does not duplicate it under Word names.

---

## Amendments

*(None yet. Append dated notes here; do not edit superseded facts out of §1–6.)*
