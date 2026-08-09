# Deep Audit — Mobile Platforms (PWA + TWA + Capacitor)

**Date:** 2026-08-09  
**Role:** Senior Mobile Architect  
**Product:** Airento (white-label; legacy internal id Gostaylo)  
**Stack:** Next.js 14 App Router + PWA + Android TWA scaffold + Capacitor scaffold  
**Method:** repository fact pass on `main` (code paths, `.well-known`, `mobile/android-twa`, Cap stubs, Stage 189 docs). **No code changes in this document.**  
**Related:** [`AUDIT_IOS_PWA_PERFORMANCE.md`](./AUDIT_IOS_PWA_PERFORMANCE.md) (2026-07), [`CAPACITOR_SHELL_PREP.md`](../plans/CAPACITOR_SHELL_PREP.md), plan → [`MOBILE_PLATFORMS_PLAN_2_4W.md`](../plans/MOBILE_PLATFORMS_PLAN_2_4W.md)

> **SSOT note:** package ids, domains, and Digital Asset Links currently **diverge**. Treat the tables in §5 as the inventory of truth until owner consolidates one matrix.

---

## 0. Executive summary (3–5 sentences)

PWA **code** for guest install, SW, safe-area, and standalone refetch guards is mature enough for a **soft** guest launch, but **owner iOS real-device smoke is still unfilled** — Phuket readiness is not measured. Android **TWA** (`mobile/android-twa`, package `ru.airento.app`, targetSdk 35) is the only real Play packaging project; on `main`, **`public/.well-known/assetlinks.json` points at Capacitor id `app.airento.shell` with a placeholder SHA**, so verified TWA / App Links for the TWA package are broken. Capacitor is **scaffold-only** (`capacitor.config.ts`, `lib/capacitor/*`, no `@capacitor/*` deps, no `android/`/`ios/`). Strategy: close PWA smoke + fix DAL SSOT + signed TWA AAB before Cap TestFlight.

---

## 1. PWA (iOS + Android)

### 1.1 Install quality

| Item | Status | Path / fact |
|------|--------|-------------|
| `beforeinstallprompt` (Android) | EXISTS | `hooks/use-pwa-install.js` |
| iOS A2HS instructions | EXISTS | `components/pwa/PwaInstallSheet.jsx` |
| Overlay / sheet / home banner | EXISTS | `AppInstallationOverlay`, `PwaInstallPrompt`, `MobileSmartInstallBanner` |
| Mount scope | Storefront only | `StorefrontAppShell` → `(storefront)` layout; **not** chat/partner shells |
| Dynamic manifest | EXISTS | `app/manifest.js` — `getPublicBrandDisplayName()` → Airento |
| Static fallback | EXISTS (drift) | `public/manifest.json` — Airento; incomplete vs dynamic icons |
| Apple title / viewport-fit | EXISTS | `app/layout.js` (189.31 title = brand; `viewportFit: 'cover'`) |

### 1.2 Cold start, Service Worker, updates

| Item | Status | Path / fact |
|------|--------|-------------|
| SW SSOT template | EXISTS | `src/pwa/sw.template.js` |
| Generated `public/sw.js` | Build artifact | **gitignored**; `prebuild` / `postbuild` / `bump-sw-cache` / `generate-sw-precache` |
| Register | EXISTS | `lib/pwa/register-app-sw.js` — `updateViaCache: 'none'` |
| Client lifecycle | EXISTS | `components/sw-register.jsx` via `DeferredRootChrome` (all routes) |
| First-install `skipWaiting` | EXISTS | Before precache (189.1) |
| Standalone update throttle | EXISTS | 30 min (`STANDALONE_UPDATE_MIN_MS`) |
| Push visibility + FCM SW | EXISTS | `public/push-visibility-policy.js`, `public/firebase-messaging-sw.js` |

### 1.3 Safe-area, tab bar, viewport, keyboard

| Item | Status | Path / fact |
|------|--------|-------------|
| Guest tab bar | EXISTS | `components/mobile-bottom-nav.jsx` + `.mobile-bottom-nav-safe` |
| iOS standalone pad trim | EXISTS | **−16px** (189.33); Android unchanged; `min-h-12` hit targets |
| Chat keyboard / vv | EXISTS | `MessagesViewportShell`, composer `.pb-safe-chat-composer` |
| Partner tab bar | Separate | `PartnerMobileBottomNav` — not the guest trim CSS |

### 1.4 Standalone behaviour (resume, refetch, push)

| Item | Status | Path / fact |
|------|--------|-------------|
| RQ focus / reconnect off in standalone | EXISTS | `lib/query/query-default-options.js` |
| Telemetry cold + resume | EXISTS | `lib/pwa/pwa-ios-telemetry.js` + `PwaIosTelemetry` (via `SwRegister`); stage tag still **`189.1`** |
| `PushClientInit` | EXISTS, **scoped** | **Only** `ChatAppShell` → `(chat)` layout. Storefront/partner do not register FCM token until user opens messages. |
| iOS Web Push | Platform-limited | Smoke checklist marks push optional |

### 1.5 Real-device / Phuket readiness

| Doc | Status |
|-----|--------|
| Checklist | `docs/runbooks/PWA_IOS_REAL_DEVICE_SMOKE.md` |
| Results matrix | `docs/archive/stages/STAGE_189_IOS_SMOKE_RESULTS.md` — **WAITING ON OWNER**, all ⏳ |
| Backlog gate | `docs/archive/stages/STAGE_189_PWA_IOS_BACKLOG.md` |

**Verdict PWA:** code ~**75–80%** (Android higher); **device-proven iOS ~45–55%** until matrix filled. Suitable for **controlled soft-launch**, not for claiming “Phuket certified” without smoke.

---

## 2. Android TWA (Google Play readiness)

### 2.1 What exists

| Item | Fact |
|------|------|
| Project | `mobile/android-twa/android/` — Android Browser Helper / LauncherActivity |
| Application id | **`ru.airento.app`** |
| SDK | minSdk 23, **targetSdk 35**, compileSdk 35 |
| Host / start URL | **`https://airento.ru/`** |
| Release runbook | `mobile/android-twa/RELEASE.md` |
| Keystore | Local/gitignored pattern; **not** in git |
| Bubblewrap / `twa-manifest.json` | **MISSING** (hand-rolled Gradle is fine) |
| Play listing assets in repo | **MISSING** |
| Signed AAB in tree | **MISSING** (unsigned APK may exist locally only) |

### 2.2 Digital Asset Links — SSOT break (blocker)

**Live on `main`:** `public/.well-known/assetlinks.json`

- `package_name`: **`app.airento.shell`** (Capacitor template id)
- fingerprint: **`REPLACE_WITH_PLAY_APP_SIGNING_SHA256`**

**TWA requires (RELEASE.md):** `ru.airento.app` + real SHA-256 of Play App Signing / upload key.

**Historical note:** commit era “PWA / Cap scaffold” replaced TWA statement with Cap placeholder — **TWA and Cap templates overwrite each other instead of coexisting as two statements**.

Vercel: Content-Type for `assetlinks.json` configured; AASA Content-Type not verified as equally wired.

### 2.3 Icons / splash / theme

Weak for store: default Android icon usage called out in audit; not Play Store–ready branding.

### 2.4 Play readiness score

| Layer | % |
|-------|---|
| Gradle / targetSdk 35 | ~90 |
| Signing / AAB pipeline | ~40 |
| DAL matches `ru.airento.app` | **~15** |
| Store Console listing | ~20 |
| **Overall “upload to Play”** | **~35–45** |

**Can we ship to Play via TWA today?** **No** — not until DAL SSOT + signed AAB + icons/listing baseline.

---

## 3. Capacitor readiness

### 3.1 Scaffold (EXISTS on `main`)

| Path | Role |
|------|------|
| `capacitor.config.ts` | `appId: app.airento.shell`; remote `server.url` (default host **`airento.app`**, env `CAPACITOR_SERVER_URL`) |
| `lib/capacitor/deep-links.js` | Universal / App Link path helpers |
| `lib/capacitor/push-bridge.js` | Token → `POST /api/v2/push` |
| `lib/capacitor/boot-capacitor-shell.js` | Dynamic import pattern (not wired into Next layouts) |
| `__tests__/capacitor-deep-links.test.js` | Unit coverage for deep-link helpers |
| AASA | `public/.well-known/apple-app-site-association` — `TEAMID.app.airento.shell` placeholder |
| Plans | `docs/archive/plans/CAPACITOR_SHELL_PREP.md`, `docs/archive/stages/STAGE_189_CAPACITOR_INTEGRATION_PLAN.md` |

### 3.2 MISSING for store binaries

| Need | Status |
|------|--------|
| `@capacitor/core`, `cli`, `ios`, `android`, `app`, `push-notifications` | **Not in `package.json`** |
| Generated `android/` / `ios/` | **MISSING** |
| `bootCapacitorShell` mounted in app | **MISSING** |
| Apple Developer / Xcode / provisioning / APNs `.p8` | Owner (out of repo) |
| Real TEAMID / Play SHA in `.well-known` | Placeholders |
| Branch `feature/capacitor-shell` as Cap home | **Docs claim ≠ tip content**; stale vs `main`; Cap packages never landed |

### 3.3 Effort estimates (engineering + owner)

| Milestone | Estimate |
|-----------|----------|
| Cap Android → internal Play track | **1.5–2.5 weeks** after packages + DAL entry + icons |
| Cap iOS → TestFlight | **2–3.5 weeks** (blocked on Apple Team + Mac/Xcode + APNs) |
| Hardening (cookies, badge, CI `cap sync`) | **+1 week** |

### 3.4 TWA vs Capacitor (Android)

| Dimension | TWA | Capacitor |
|-----------|-----|-----------|
| Native project today | **Yes** | No |
| Path to Play | Faster **after DAL fix** | Slower (greenfield) |
| Push | Web FCM / site | Native bridge (scaffold intent) |
| Domain in config | `airento.ru` | Default `airento.app` — **SSOT risk** |
| Fit | Thin store shell over web SSOT | Needed when **iOS store + reliable APNs** |

---

## 4. Identity / SSOT inventory (critical)

| Identity | Used by | Domain | DAL / AASA |
|----------|---------|--------|------------|
| Web PWA | Safari / Chrome A2HS | `airento.ru` (prod) | N/A (web) |
| TWA | `ru.airento.app` | Host `airento.ru` | **Broken on main** |
| Capacitor (planned) | `app.airento.shell` | Config default `airento.app` | Placeholder SHA / TEAMID |

**Until owner publishes one matrix (package ↔ domain ↔ fingerprint ↔ store), store releases will keep colliding.**

---

## 5. Readiness table (%)

| Layer | Readiness | Note |
|-------|-----------|------|
| PWA Android (Chrome) | **78%** | Code strong; device smoke light |
| PWA iOS standalone | **58%** | Code ~75%; matrix empty; push weak |
| Web push (FCM) | **55%** | SW global; client init chat-only |
| TWA → Google Play | **40%** | Project yes; DAL/AAB/listing no |
| Capacitor → TestFlight | **20%** | Scaffold only |
| Capacitor → Play | **15%** | No native project |
| Deep-link SSOT (DAL/AASA) | **25%** | Placeholders + package mismatch |

---

## 6. Blockers (ordered)

1. Owner **iOS (and Android) smoke matrix** unfilled.  
2. **`assetlinks.json` ≠ `ru.airento.app`** (+ placeholder SHA).  
3. No **signed AAB** + Play listing baseline for TWA.  
4. Cap: no packages / no native projects / Apple Team+APNs.  
5. Domain drift: **`airento.ru` vs `airento.app`**.  
6. **PushClientInit** only under `(chat)`.  
7. Doc/branch drift for Cap (`feature/capacitor-shell`).

---

## 7. Strategy answers (audit conclusions)

| Question | Answer |
|----------|--------|
| Ship Google Play via TWA **now**? | **No.** After DAL + signed AAB + icons/listing — **yes, realistic in 1–2 weeks**. |
| When Capacitor? | After PWA smoke + TWA DAL path stable, **or** when iOS App Store / APNs becomes business P0. |
| Critical next | Smoke fill + DAL SSOT + TWA AAB. |
| Defer | Cap native, second push stack, deep offline booking. |

**Architecture note:** Prefer **web SSOT + thin store shells** (Airbnb/Booking pattern). Do not fork pricing/escrow into native. Keep one financial SSOT on Next/API.

---

## 8. Document control

| Field | Value |
|-------|-------|
| Status | Complete (docs only) |
| Follow-up plan | [`../plans/MOBILE_PLATFORMS_PLAN_2_4W.md`](../plans/MOBILE_PLATFORMS_PLAN_2_4W.md) |
| Stub URL | [`../../AUDIT_MOBILE_PLATFORMS.md`](../../AUDIT_MOBILE_PLATFORMS.md) |
