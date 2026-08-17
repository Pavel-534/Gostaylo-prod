# Currency & FX — SSOT (Stage 200.115)

> Living policy for **listing base currency**, **UI display currency**, **payment currency**, retail markup, and checkout FX.  
> Code helpers: `lib/pricing/fx-policy.js`. Engine: `lib/pricing-engine/compute-breakdown.js`.  
> Do **not** change L3 ledger mid math without ADR.

## Three currencies (never conflate)

| Name | Meaning | Examples |
|------|---------|----------|
| **Listing base** (`listings.base_currency`) | Partner L1 price currency — from **country of the object** | DE→EUR, RU→RUB, TH→THB, CN→CNY |
| **UI / display** (header switcher) | How the guest **sees** prices on catalog / PDP / preview | Any supported FX code |
| **Payment** (`bookings.currency` / pay method) | What the guest **actually pays** the PSP | Only `BOOKING_PAYMENT_CURRENCIES`: **THB, USD, RUB, CNY, USDT** |

Ledger / escrow remain **THB mid** (L3).

## Two markups (independent)

| Markup | Config | When |
|--------|--------|------|
| **Retail (витрина)** | `system_settings.general.chatInvoiceRateMultiplier` | Converting **THB → non-THB** for display (`getDisplayRateMap({ applyRetailMarkup: true })`). **THB display is never retail-marked.** |
| **Checkout FX (курсовая)** | `pricing_profiles.fx_markup_pct` | **`payment_currency ≠ listing_base_currency`**. Partner netto unchanged. Stage **200.88** covers pay=THB × base≠THB. |

Same-currency UI (`display === base`): L1 × (1 + guest fee), no retail round-trip (`same-currency-guest-display.js`).  
Catalog/home/search **must** send `baseCurrency` + `basePriceAsset` (Stage **201.88**); lite metadata alone used to strip the asset and silently apply retail.  
Same-currency **payment** (`pay === base`): checkout FX = **0**.  
Header currency is **not** payment currency: guest can view RUB then pay USDT/THB → catalog stays native RUB; **checkout FX** applies only at pay.

## Matrix (catalog vs checkout)

| Listing base | UI display | Catalog retail? | Guest pays | Checkout FX? |
|--------------|------------|-----------------|------------|--------------|
| RUB | RUB | No (same-currency) | RUB | **No** |
| RUB | THB | **No** (THB hub) | THB | **Yes** |
| RUB | USD / CNY | **Yes** | USD / CNY | **Yes** if pay≠RUB |
| THB | THB | No | THB | **No** |
| THB | RUB | Yes | RUB (MIR / YooKassa) | **Yes** |
| EUR (Berlin) | EUR | No (same-currency UI) | EUR | **N/A** — EUR **not** payable today |
| EUR | THB / USD / RUB / CNY | THB: no; others: yes | THB / USD / RUB / CNY | **Always yes** (pay≠EUR) |
| USD | USD | No | USD | **No** |
| CNY | CNY | No | CNY | **No** |

Payable set: `lib/finance/currency-codes.js` → `BOOKING_PAYMENT_CURRENCIES`.

## Scenario answers

### Berlin listing (EUR) + “Stripe EUR”
- There is **no Stripe** path as product SSOT; intl card is **CARD_INTL (Mandarin)**.
- Guest **cannot** pay EUR (= base). Must pick THB/USD/RUB/CNY/USDT → **checkout FX applies**.

### Berlin EUR + YooKassa / MIR (RUB card)
- `pay=RUB` ≠ `base=EUR` → **`fx_markup_pct` yes**.
- Acquirer charges **RUB** from snapshot brutto (`resolveAcquirerChargeAmount`); ledger stays THB mid (+ `fx_markup_thb` in owner reporting).

### Berlin EUR + pay THB
- Stage **200.88**: guest THB brutto = mid payable + integer FX surcharge; partner netto unchanged.

### Thailand listing (THB) + partner chat invoice + RF guest with RU card
1. Partner sets invoice amount in allowed invoice currencies (typically THB/USD/RUB/USDT).
2. Server settles invoice → `amount_thb` via **retail** map (`settleInvoiceDisplayAmount`).
3. Guest sees **invoice currency** as primary; UI may show secondary in header currency.
4. Paying with MIR / RU card → charge **RUB** (from brutto / locked rate); escrow in THB.
5. Chat-invoice sync prefers invoice quote and clears stale PricingEngine `final_breakdown` (AUDIT) — charge SSOT is the **invoice THB quote**, not a second silent FX pass.

### Partner wizard preview (your screenshots)
- Header currency only changes **L2 display**.
- RUB listing + UI THB ≈ mid+fee (no retail) — **expected**.
- Same listing + UI USD/CNY → retail — **expected**.
- That does **not** mean checkout FX is off when guest later pays THB for a RUB listing.

## End-to-end flow (booking)

1. Partner sets L1 in country currency → save converts to `base_price_thb` (mid).
2. Catalog / PDP: guest fee in THB hub + retail if UI ≠ THB (or same-currency native path).
3. Create booking / inquiry: `computeFinalBreakdown` with `payment_currency` + `listing_base_currency` → snapshot (`fx_markup_thb`, `total_guest_brutto`).
4. Checkout / intent: amount from snapshot brutto / intent THB helpers (`guest-fx-charge.js`).
5. PSP: MIR→RUB, CARD_INTL often THB (or RUB when booking/brutto is RUB), crypto USDT path separate.
6. Capture / ledger: THB mid (+ THB FX extra when brutto is THB cross-currency).

## Invariants (do not break)

- Partner **netto** never reduced by FX markup.
- L3 always THB mid for escrow legs.
- Do not feed retail `rateMap` into settlement breakdown.
- Do not invent EUR (or other non-payable) as `payment_currency` without expanding `BOOKING_PAYMENT_CURRENCIES` + acquirer adapters + ADR.
- **Checkout hold (Stage 200.121):** `POST /api/v2/bookings/[id]/payment/initiate` rejects when `isCheckoutHoldExpired` (`CHECKOUT_HOLD_EXPIRED`). FX snapshot is still locked at booking create (no silent reprice on initiate). Guest cancel UI may show refund in locked pay currency; ledger refund remains THB.

## Related code

| Concern | File |
|---------|------|
| Policy helpers | `lib/pricing/fx-policy.js` |
| Checkout FX math | `lib/pricing-engine/compute-breakdown.js` |
| THB FX surcharge helpers | `lib/pricing-engine/guest-fx-charge.js` |
| Retail rate map | `lib/services/currency.service.js` |
| Same-currency display | `lib/pricing/same-currency-guest-display.js` |
| Checkout rate helper | `lib/services/pricing/pricing-fx-helpers.js` |
| Acquirer charge | `lib/services/payment-adapters/acquirer-charge-amount.js` |
| Guest refund display | `lib/booking/guest-refund-display.js` |
| Initiate hold gate | `lib/booking/checkout-hold-initiate-gate.js` |
| Module map | `lib/pricing/PRICING_SERVICES.md` |
| Normative L1/L2/L3 | `ARCHITECTURAL_DECISIONS.md` (ADR-181) |
