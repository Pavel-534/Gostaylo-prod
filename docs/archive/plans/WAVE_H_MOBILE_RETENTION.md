# Wave H — Mobile CRO & Retention

> **Version:** 1.2 · **Date:** 2026-07-27 · **Stages:** **197.0** (H0) · **197.0.1** (H5) · **197.0.2** (H1)  
> **Product:** Airento · **Scope:** web mobile / PWA (native apps deferred)  
> **Prior closed:** Stages **190–191** guest CRO · **194** partner mobile · **195** renter polish · **196** guest journey / access pack  

---

## 1. Goal

Close remaining **pay urgency** and **mobile ergonomics** gaps without rewriting shells or touching escrow math. Then extend **push parity** for partner SLA and unpaid recovery.

**Priority order:** Mobile feel → Retention / Push → Conversion polish.

---

## 2. SSOT backlog (do not use stale PR queues)

| Document | Role |
|----------|------|
| [`docs/CRO_FUNNEL_CLOSURE_191.md`](./CRO_FUNNEL_CLOSURE_191.md) | Guest funnel residual friction (F1–F10) after Stages 190–191 |
| [`docs/AUDIT_PARTNER_CABINET_MOBILE.md`](../audits/AUDIT_PARTNER_CABINET_MOBILE.md) | Partner mobile IA residual (post 194.0 A–D) |
| [`docs/AUDIT_IOS_PWA_PERFORMANCE.md`](../audits/AUDIT_IOS_PWA_PERFORMANCE.md) | iOS First Load / SW / resume (perf track) |
| This file | Wave H stages, order, and acceptance |

`PRODUCT_FLOW_MAP.md` §8 (Stage 108-era) is **not** the live Wave H backlog.

---

## 3. Architecture plan

### H0 — CRO Quick Wins (Stage **197.0**) — shipped

| ID | Item | Behaviour | Effort |
|----|------|-----------|--------|
| **H0.4** | **Sticky Pay Bar** on `/checkout` | `< lg`: fixed footer with total + brand CTA; clears `--app-bottom-nav-height` + safe-area; hides when in-flow `checkout-pay-submit` intersects viewport | S |
| **H0.4b** | **Hold timer** on checkout | MM:SS from `resolveCheckoutHoldExpiresAtIso` (`checkout-hold-policy.js`) — same SSOT as chat invoice / cron | S |
| **H0.1** | **iOS PWA ergonomics** | Confirm `apple-mobile-web-app-capable` + `viewport-fit=cover`; bottom sheets `max-h` via **`dvh`**; standalone already skips focus/reconnect refetch (`query-default-options.js`) | S |

**Non-goals for H0:** escrow/ledger, payment gateway changes, soft-publish threshold ADR, new BottomNav.

### H5 — Partner SLA FCM Parity (Stage **197.0.1**) — shipped

| ID | Item | Notes |
|----|------|-------|
| **H5** | Partner booking lifecycle **FCM** + SLA nudge parity with Telegram | Templates `BOOKING_REQUEST`, `PAYMENT_COMPLETED`, `CANCEL_REQUESTED`, `SLA_EXPIRING_SOON`; deep link `/partner/bookings?booking=&highlight=true`; cron FCM + TG; SW click → navigate/focus |

### H1 — Guest unpaid recovery (Stage **197.0.2**) — shipped

| ID | Item | Notes |
|----|------|-------|
| **H1.1** | Guest **AWAITING_PAYMENT** soft FCM | Template `CHECKOUT_ABANDONED`; cron `unpaid-checkout-nudge` (~5m on cron-job.org); delay default 10m; quiet hours skip; deep link `/checkout/[id]` |
| **H1.1b** | In-app hold banner | `UnpaidCheckoutNudgeBanner` on storefront + messages; `GET /api/v2/me/unpaid-checkout-hold`; Pay → checkout sticky bar |
| **H1.2** | Soft push permission prompt | Deferred — after first booking / partner publish (not this stage) |

### H2+ (backlog)

Search consolidation (F6/F7), wizard content density, unpaid win-back email, renter dual-chrome IA — see CRO / partner audits.

---

## 4. Suggested order

1. **197.0 H0** — sticky pay + hold timer + sheet `dvh` ✅  
2. **197.0.1 H5** — partner SLA FCM parity ✅  
3. **197.0.2 H1** — unpaid checkout FCM + in-app banner ✅  
4. Search / wizard density / H1.2 opt-in as capacity allows.

---

## 5. Acceptance

### H0

- [x] Mobile checkout: sticky bar visible until primary Pay scrolls into view.  
- [x] Sticky bar does not sit under storefront BottomNav / home indicator.  
- [x] Hold countdown renders when policy returns an expiry ISO.  
- [x] Sheet `side="bottom"` defaults include `max-h` in `dvh` units.  
- [x] Passport / manifesto **12.197.0.0** updated.

### H5

- [x] Partner FCM on new request / payment completed / cancel requested / SLA expiring.  
- [x] Payload title/body + deep link with `highlight=true`.  
- [x] SW click focuses/opens `/partner/bookings` deep link.  
- [x] Unit tests for templates + deep link (`__tests__/partner-sla-fcm-parity.test.js`).  
- [x] Passport / manifesto **12.197.0.1** updated.

### H1

- [x] Soft FCM after delay while `AWAITING_PAYMENT` hold is active; deep link `/checkout/{id}`.  
- [x] Quiet hours respected (skip without burning dedup).  
- [x] In-app banner on home / my-bookings / messages with live MM:SS + Pay CTA.  
- [x] Unit tests (`__tests__/unpaid-checkout-retention.test.js`).  
- [x] Passport / manifesto / Wave H doc **12.197.0.2**.

---

*Wave H living doc — H0/H1/H5 core shipped; residual H1.2 + H2+ remain.*
