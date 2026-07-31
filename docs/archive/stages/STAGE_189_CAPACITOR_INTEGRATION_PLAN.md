# Stage 189 — Capacitor full integration plan

**Prerequisite scaffold:** [`docs/CAPACITOR_SHELL_PREP.md`](CAPACITOR_SHELL_PREP.md) + `lib/capacitor/*` + `capacitor.config.ts`  
**Cap branch:** `feature/capacitor-shell` only (large integration — **not** mixed into main PWA commits).  
**PWA polish (189.1):** ships on **`main`** (light workflow). Cap code stays untouched until Phase B.

---

## Phase A — Owner prerequisites (blocking)

| # | Deliverable | Who |
|---|-------------|-----|
| A1 | Apple Developer Program (org preferred) | Owner |
| A2 | Mac with Xcode 15+ **or** CI Mac runner | Owner |
| A3 | App ID `app.airento.shell` + Push + Associated Domains | Owner |
| A4 | `TEAMID` → replace in `public/.well-known/apple-app-site-association` | Owner |
| A5 | APNs `.p8` → Firebase iOS app (same project as web FCM) | Owner |
| A6 | Play Console + SHA-256 → `assetlinks.json` | Owner (Android) |
| A7 | Staging HTTPS URL → `CAPACITOR_SERVER_URL` | Ops |

---

## Phase B — Engineering MVP (TestFlight)

**Goal:** one binary that loads staging Airento WebView + deep links + push → chat/checkout.

| Step | Work | Est. |
|------|------|------|
| B1 | `npm i @capacitor/core @capacitor/cli @capacitor/ios @capacitor/app @capacitor/push-notifications` on Cap branch | 0.5d |
| B2 | `npx cap add ios` + Team / signing | 1d (owner Mac) |
| B3 | Wire `bootCapacitorShell` after auth session ready (dynamic import only) | 0.5d |
| B4 | Host AASA on prod/staging; verify Universal Link to `/messages/[id]` and `/checkout/[id]` | 1d |
| B5 | Push: Cap token → `registerCapacitorPushToken` → existing `POST /api/v2/push` | 1d |
| B6 | TestFlight internal + smoke: cold open, deep link from Notes, push open thread | 1–2d |

**Explicit non-goals for MVP:** native UI screens, offline booking, second pricing engine.

---

## Phase C — Hardening (post-TestFlight)

- Cookie / SameSite audit in WKWebView  
- Silent badge sync parity with PWA  
- CI: `cap sync` on macos runner  
- Decide: keep PWA as default install path vs Cap store listing  

---

## Decision gate (owner smoke → Stage 189.2)

Fill [`STAGE_189_IOS_SMOKE_RESULTS.md`](STAGE_189_IOS_SMOKE_RESULTS.md) first. Then:

| If iOS PWA smoke… | Next |
|-------------------|------|
| Passes Phuket bar (≤4s feel, confirm OK, no resume storm) | Cap remains parallel prep; optional Cap Phase B when A1–A5 ready |
| Fails cold start / SW / resume | **189.2** targeted PWA fixes from matrix (Cap only if push/deeplink is the blocker) |
| Needs reliable APNs | Prioritize Cap Phase B (PWA push on iOS is weak) |

**189.1 note:** PWA deep polish already on `main` (SW early `skipWaiting`, calendar 90d constrained, resume telemetry, composer safe-area). Do **not** start Cap Phase B until smoke matrix has measured rows.

---

## Financial / product invariants

- No Cap-side commission/price math  
- Checkout/legal consent remain Next routes  
- Escrow / ledger unchanged
