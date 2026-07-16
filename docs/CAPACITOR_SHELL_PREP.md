# Capacitor Shell — Stage 172.0 (scaffold lock)

**Branch:** `feature/capacitor-shell`  
**Product:** Airento (`getSiteDisplayName()` / env)  
**Rule:** native shell only — **no second checkout/math/escrow stack**. SSOT remains `BookingService` / `PricingService` / ledger.

---

## Delivered in repo (minimal working scaffold)

| Path | Role |
|------|------|
| `capacitor.config.ts` | Cap appId `app.airento.shell`, remote `server.url` |
| `lib/capacitor/deep-links.js` | Allowlisted paths for Universal/App Links + push click |
| `lib/capacitor/push-bridge.js` | `POST /api/v2/push` `{ action: 'register', token, deviceInfo }` |
| `lib/capacitor/boot-capacitor-shell.js` | Inject Cap plugins → deep link + push listeners |
| `public/.well-known/apple-app-site-association` | iOS Universal Links template (`TEAMID` placeholder) |
| `public/.well-known/assetlinks.json` | Android App Links template (SHA-256 placeholder) |

`ios/` / `android/` folders are **generated on Mac** (`npx cap add`) — not committed until first successful sync.

---

## Owner checklist (required from you)

### Apple (App Store / TestFlight / APNs)

1. **Apple Developer Program** (org preferred).
2. **Mac** with Xcode 15+ **or** CI Mac (MacStadium / GitHub `macos-latest`).
3. Create App ID `app.airento.shell` with:
   - Push Notifications
   - Associated Domains → `applinks:YOUR_DOMAIN` (and `webcredentials:YOUR_DOMAIN` if sharing passwords)
4. Replace `TEAMID` in `public/.well-known/apple-app-site-association`.
5. Host AASA on **HTTPS** at `https://YOUR_DOMAIN/.well-known/apple-app-site-association` (no `.json` suffix; `Content-Type: application/json`).
6. APNs Auth Key (`.p8`) → Firebase Cloud Messaging iOS app (same Firebase project as web FCM) **or** document direct APNs later.
7. App Store Connect: privacy questionnaire, screenshots (iPhone 11 Pro+ class for Phuket demo).

### Google / Android

1. Play Console developer account.
2. Firebase Android app + `google-services.json`.
3. Put Play App Signing SHA-256 into `public/.well-known/assetlinks.json`.

### Ops

1. Staging HTTPS URL for Cap QA (`CAPACITOR_SERVER_URL=https://staging…`).
2. Never point TestFlight at `localhost`.
3. Confirm cookies/session work in WKWebView for the chosen domain (SameSite / Secure).

---

## Deep links (canonical)

| Path | Purpose |
|------|---------|
| `/checkout/[bookingId]` | Pay (legal consent unchanged) |
| `/messages`, `/messages/[id]` | Chat / partner confirm |
| `/listings/[id]` | PDP |
| `/my-bookings` | Renter orders |

Router SSOT: `resolveCapacitorDeepLinkPath` / `deepLinkPathFromPushData` in `lib/capacitor/deep-links.js`.

---

## Push bridge

1. PWA/web: existing FCM + `/sw.js` (unchanged).
2. Native: Cap Push plugin → token → `registerCapacitorPushToken` → **`POST /api/v2/push`** `action: 'register'` with `deviceInfo.platform` = `ios`|`android`, `source: 'capacitor'`.
3. Notification open → `deepLinkPathFromPushData` → navigate.
4. Message copy stays on server templates — do not fork copy in Swift/Kotlin.

---

## First Mac commands

```bash
git checkout feature/capacitor-shell
# ensure scaffold files above are present
npm i @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android \
  @capacitor/app @capacitor/push-notifications --save
export CAPACITOR_SERVER_URL=https://YOUR_STAGING_ORIGIN
npx cap add ios
npx cap add android
npx cap sync
# Xcode: Team, Push, Associated Domains
```

Wire boot once in a client entry (only when Cap packages installed), e.g. after auth ready:

```js
if (window.Capacitor?.isNativePlatform?.()) {
  const { Capacitor } = await import('@capacitor/core')
  const { App } = await import('@capacitor/app')
  const { PushNotifications } = await import('@capacitor/push-notifications')
  const { bootCapacitorShell } = await import('@/lib/capacitor/boot-capacitor-shell.js')
  await bootCapacitorShell({
    Capacitor, App, PushNotifications,
    navigate: (path) => { window.location.assign(path) },
  })
}
```

---

## Non-goals (172.0)

- Shipping to App Store
- Replacing Next screens with native UI
- Changing escrow / pricing / commissions

---

## Phuket impact

Native install + push deep links into `/messages` and `/checkout` cut “lost Safari tab” drop-off for partners confirming bookings and renters finishing pay on cellular. PWA remains default until TestFlight is green.
