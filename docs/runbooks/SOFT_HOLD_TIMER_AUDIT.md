# Soft-Hold & Timer Audit (Stage 200.79)

> Read-only product/tech snapshot. Not a migration plan.

## How holds work today

| Path | Status / block | TTL / deadline | Depends on days-until-check-in? | Guest timer UI |
|------|----------------|----------------|----------------------------------|----------------|
| **Checkout hold** | `AWAITING_PAYMENT` | `CHECKOUT_HOLD_TTL_MINUTES` (default **30**, min 5). Anchor = intent `initiated_at`/`created_at` or booking `created_at` (+ minutes). **Not** `updated_at`. | **No** | **Yes** — `CheckoutHoldTimer` on `/checkout` (`checkout-hold-policy.js`) |
| **Chat invoice window** | Invoice `PENDING` + `calendar_blocks` `invoice_hold` | Transport **20 min**; housing/other **180 min** (`payment-window-policy.js`). Deadline in invoice `metadata.expires_at`. Checkout hold uses that deadline when chat-invoice booking. | **No** (tier by **category**, not lead time) | Same checkout timer when invoice present |
| **Inquiry soft-hold** | historically `inquiry_hold` | Deprecated. Stage **175.3**: `createInquirySoftHold` is **no-op** — inquiry does **not** reserve dates. | n/a | **No** |
| **Partner response SLA** | `PENDING` / `INQUIRY` auto-cancel | **`PARTNER_RESPONSE_SLA_HOURS = 24`** (`lib/booking/partner-response-sla.js`) from `created_at` (`cleanup-drafts`) | **No** | **Yes** — calm deadline line on `GuestBookingNextStepsCard` (usual 24h + «until {date}»; no live ticker; Stage 200.80) |
| **Unpaid nudge** | FCM while hold active | Delay default **10 min** after initiate; needs ≥**5 min** remaining (`UNPAID_CHECKOUT_*` envs) | **No** | Banner / push, not a live timer |

## Key files

- `lib/booking/checkout-hold-policy.js` / `checkout-hold-expiry.js`
- `lib/booking/payment-window-policy.js`
- `lib/booking/inquiry-soft-hold.js` (no-op create)
- `app/api/cron/cleanup-drafts/route.js`
- `components/checkout/CheckoutHoldTimer.jsx`

## Gaps for a guest-facing countdown (backlog)

1. **Request (`PENDING`)**: calm SLA copy on next-steps (`created_at + 24h`) — Stage **200.80**. Lead-time–aware SLA still not implemented.
2. **Lead-time tiers**: product often wants shorter host SLA / pay window when check-in is tomorrow vs next month — **not implemented**; all TTLs are flat or category-based.
3. **CONFIRMED (pre-initiate)**: payable but no hold countdown until payment intent / `AWAITING_PAYMENT` — dates occupancy rules differ; UX may feel “open-ended” until initiate.
4. **Dismissed next-steps**: if guest hides “What’s next?”, only Details remains — timer should live on order card / sticky bar independently of dismiss.
5. **Single SSOT clock**: checkout timer is good; extend same `expires_at` rendering to chat deal card and my-bookings for invoice + awaiting payment.

## Recommendation (not in this Stage’s code)

Ship display-only countdowns first (PENDING SLA + reuse `resolveCheckoutHoldExpiresAtIso` on my-bookings), then optionally ADR for lead-time–aware TTL without changing escrow/ledger.
