# Plan — Mobile platforms (PWA + TWA + Capacitor), 2–4 weeks

**Date:** 2026-08-09  
**Based on:** [`../audits/AUDIT_MOBILE_PLATFORMS_PWA_TWA_CAPACITOR.md`](../audits/AUDIT_MOBILE_PLATFORMS_PWA_TWA_CAPACITOR.md)  
**Invariant:** web remains UX/financial SSOT; no Cap/TWA pricing or escrow math. **This plan is docs-only until owner approves execution PRs.**

---

## Goal

1. Prove PWA on real devices (Phuket bar).  
2. Unblock **Google Play via TWA** with correct Digital Asset Links SSOT.  
3. Keep Capacitor as a **gated** track (iOS APNs / App Store), not a parallel rewrite.

---

## Principles (SSOT)

| Rule | Detail |
|------|--------|
| One product, multiple shells | PWA / TWA (`ru.airento.app`) / Cap (`app.airento.shell`) share Next origin |
| DAL | Prefer **two statements** in `assetlinks.json` (TWA + Cap) — never overwrite one with the other |
| Domain | Pick prod apex (**`airento.ru`** vs `airento.app`) and align Cap `server.url` / allowNavigation |
| Push | One registration path to `POST /api/v2/push`; Cap bridge later |
| Money | Untouched by mobile packaging work |

---

## Phase map

### P0 — Gate (week 1)

| ID | Owner | Work | Done when |
|----|-------|------|-----------|
| M0.1 | Owner | Fill [`STAGE_189_IOS_SMOKE_RESULTS`](../stages/STAGE_189_IOS_SMOKE_RESULTS.md) (+ optional Android PWA pass) | Matrix leaves ⏳; paste telemetry if possible |
| M0.2 | Eng | Analyze smoke → **point fixes only** (post-smoke stage id TBD; avoid colliding HISTORY “189.2”) | Cold start / resume / safe-area issues from matrix closed |
| M0.3 | Eng + Owner | **DAL SSOT restore for TWA**: `ru.airento.app` + Play App Signing SHA-256; keep Cap statement as second entry if Cap remains planned | `/.well-known/assetlinks.json` validates for TWA package |
| M0.4 | Eng | Signed **AAB** from `mobile/android-twa` per `RELEASE.md`; store icons/splash baseline | AAB uploads to Play internal track |

**Exit P0:** Internal testing track installable; DAL green for `ru.airento.app`; PWA smoke decided (pass or listed blockers).

---

### P1 — Harden guest mobile (weeks 1–3)

| ID | Owner | Work | Done when |
|----|-------|------|-----------|
| M1.1 | Eng | Push client registration after login / install (not only `(chat)` layout) — quiet policy preserved | Token appears without opening messages |
| M1.2 | Eng + Owner | Android PWA smoke checklist (mirror iOS runbook) | Written results |
| M1.3 | Eng | Align Cap config default host with prod apex (env-first) | No silent `airento.app` vs `airento.ru` drift in docs/config |
| M1.4 | Eng | Play listing pack: screenshots, short/full description, privacy URL | Console listing draft complete |
| M1.5 | Docs | Fix Cap branch claims in ROADMAP vs reality; single Cap plan pointer | ROADMAP matches repo |

**Exit P1:** Soft-launch guests on PWA; TWA internal testers; push coverage acceptable for SEA.

---

### P2 — Capacitor only if triggered (weeks 3–4+)

**Trigger (any one):** business needs App Store; iOS PWA push insufficient for partner SLA; owner completes Apple Phase A (Team, certs, APNs).

| ID | Owner | Work | Done when |
|----|-------|------|-----------|
| M2.1 | Owner | Apple Developer + App ID `app.airento.shell` + APNs + TEAMID in AASA | Phase A checklist green |
| M2.2 | Eng | Install `@capacitor/*`, `cap add ios/android` on dedicated branch (not mixed with finance PRs) | Native projects exist |
| M2.3 | Eng | Wire `bootCapacitorShell`; deep links; push-bridge → existing API | TestFlight build opens staging |
| M2.4 | Eng | Second DAL statement + real SHA; AASA without TEAMID placeholder | Links open checkout/messages |

**Non-goals for P2 MVP:** native UI screens, offline booking, second commission engine.

---

## Priority order (next 14 days)

1. **Owner smoke fill** (M0.1) — unblocks measured PWA work.  
2. **DAL + TWA AAB** (M0.3–M0.4) — unblocks Play path.  
3. **Push init scope** (M1.1).  
4. Cap (M2.*) — **parked** unless App Store/APNs is P0.

---

## Explicit non-work (defer)

- Capacitor on `main` without branch discipline.  
- Replacing TWA with Cap for Android “for cleanliness”.  
- Deep offline / second SW cache for `/api` financial routes.  
- Renaming packages mid-flight without owner identity matrix.  
- Wave H UX epics that do not depend on this packaging gate (can parallel only after P0 exit).

---

## Owner identity matrix (fill before store submit)

| Field | TWA | Capacitor | Web PWA |
|-------|-----|-----------|---------|
| Package / app id | `ru.airento.app` | `app.airento.shell` | — |
| Prod HTTPS origin | `https://airento.ru` | ? (must match allowlist) | `https://airento.ru` |
| SHA-256 (Play App Signing) | _TBD_ | _TBD_ | — |
| Apple Team ID | — | _TBD_ | — |
| Store account | Google Play | Apple + optional Play | — |

---

## Success metrics

| Metric | Target |
|--------|--------|
| iOS standalone cold feel | Catalog usable &lt; ~4s on 4G (from smoke) |
| TWA | Internal track install; DAL statement passes Google checker for `ru.airento.app` |
| Push | Logged-in guest receives NEW_MESSAGE after install without mandatory `/messages` first open (P1) |
| Cap | Not required for P0 success |

---

## Document control

| Field | Value |
|-------|-------|
| Status | Approved for planning; **execution needs owner OK** |
| Audit | [`../audits/AUDIT_MOBILE_PLATFORMS_PWA_TWA_CAPACITOR.md`](../audits/AUDIT_MOBILE_PLATFORMS_PWA_TWA_CAPACITOR.md) |
| Stub | [`../../MOBILE_PLATFORMS_PLAN.md`](../../MOBILE_PLATFORMS_PLAN.md) |
