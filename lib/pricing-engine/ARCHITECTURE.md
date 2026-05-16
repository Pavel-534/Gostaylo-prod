# PricingEngine — Architecture (Stage 97.0.2)

**Status:** Implemented (module only). **Not** connected to `BookingService.createBooking` until Stage 97.0.3.  
**ADR:** `docs/ADR/097-financial-model-v2.md`  
**Migration:** `database/migrations/053_financial_model_v2.sql`

---

## Purpose

Single server-side entry for:

1. Resolving which **pricing profile** applies to a deal (listing → partner → region → default).
2. Computing an immutable **`FinalBreakdown`** (Brutto / Netto + internal RU/KG/FX lines).
3. Emitting **`pricing_snapshot` v = 2** for bookings.

Percents never live in application code — only in **`pricing_profiles`** (seeded by migration) and **`system_settings.general.default_pricing_profile_id`**.

---

## Module layout

| File | Responsibility |
|------|----------------|
| `index.js` | Public facade `PricingEngine` |
| `types.js` | JSDoc contracts |
| `resolve-profile.js` | DB resolution chain |
| `compute-breakdown.js` | Pure math from profile row |
| `snapshot-adapter.js` | v2 JSON + partner-safe projection |

---

## API

### `resolvePricingProfile(ctx)`

**Input:**

| Field | Role |
|-------|------|
| `listingId` | Strongest: `listings.pricing_profile_id` |
| `partnerId` | `profiles.pricing_profile_id` |
| `countryCode` | `pricing_profile_assignments` scope `COUNTRY` |
| `cityKey` | scope `CITY` |
| `districtKey` | scope `DISTRICT` |

**Output:** `{ profile, resolution_trace: string[] }`

**Throws** if no active profile (DB must be seeded).

---

### `computeFinalBreakdown(input)`

**Input:**

| Field | Required |
|-------|----------|
| `subtotal_thb` | Yes (after discounts) |
| `profile` | Yes (from resolve) |
| `payment_currency` | No (default THB) |
| `listing_base_currency` | No |
| `raw_fx_rate_map` | No — THB per 1 unit from `getDisplayRateMap({ applyRetailMarkup: false })` |
| `apply_pot_rounding` | No (default true) |

**Output: `FinalBreakdown`**

| Field | Partner/guest API | Admin / compliance |
|-------|-------------------|---------------------|
| `total_partner_netto_thb` | **Visible** (Netto) | Yes |
| `total_guest_payable_rounded_thb` | **Visible** (as total) | Yes |
| `total_guest_brutto` | **Visible** (amount + currency) | Yes |
| `guest_service_fee_thb` | Optional line item | Yes |
| `ru_fee_thb`, `kr_fee_thb`, `fx_markup_thb` | **Never** | Yes |
| `platform_margin_pool_thb` | **Never** | Yes |

**Invariant (enforced in DB + runtime):**  
`ru_agent_share_pct + kr_service_share_pct = guest_fee_pct`  
→ `ru_fee_thb + kr_fee_thb = guest_service_fee_thb` (on same subtotal base).

---

### `toPricingSnapshotV2(breakdown, priceCalc?, listingBasePriceThb?)`

Produces JSON:

```json
{
  "v": 2,
  "pricing_profile_id": "pp-global-default",
  "resolution_trace": ["default:pp-global-default"],
  "final_breakdown": { "...": "includes internal fields" },
  "fee_split_v2": { "immutable": true, "...": "compat with ledger" }
}
```

---

### `toPartnerVisibleBreakdown(breakdown)`

Strips `ru_fee_thb`, `kr_fee_thb`, `fx_markup_thb`, `platform_margin_pool_thb`. Use in partner APIs and PDP preview when v2 is enabled.

---

### `PricingEngine.buildSnapshotV2(params)`

Convenience: resolve + compute + snapshot in one call (for future `createBooking` integration).

---

## Where it will be used (Stage 97.0.3+)

| Consumer | Change |
|----------|--------|
| `lib/services/booking/creation.js` | Replace `calculateFeeSplit` path when `PRICING_ENGINE_V2=true` |
| `GET /api/v2/commission` | Return `toPartnerVisibleBreakdown` preview |
| Checkout hooks | Same preview, no internal fields |
| Admin booking detail | Full `final_breakdown` |
| Compliance export | `ledger_entries.*_rub` + snapshot internal fields |

**Not in scope yet:** ledger posting split, batch payout jobs, admin CRUD UI.

---

## FX markup

`fx_markup_pct` on profile maps to customer rate:

- `fxCustomerRate = fxRawRate / (1 + fx_markup_pct/100)` when payment currency ≠ listing base currency.
- `fx_markup_thb` estimated from delta between mid and customer Brutto (THB equivalent).

Legacy `chatInvoiceRateMultiplier` remains for live site until cutover; v2 uses **percent on profile** only.

---

## Feature flag (planned)

`PRICING_ENGINE_V2` env or `system_settings.general.pricingEngineV2Enabled` — default `false` until Stage 97.0.3.
