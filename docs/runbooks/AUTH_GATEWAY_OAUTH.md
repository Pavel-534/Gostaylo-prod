# Auth gateway prep — OAuth (Google) + referrals

## Current session stack (audit)

| Layer | Implementation |
|--------|----------------|
| Primary session | JWT in HttpOnly cookie **`gostaylo_session`**, HS256 (`JWT_SECRET`). Issued by **`POST /api/v2/auth/login`** and **`GET /api/v2/auth/verify`**; verified in **`middleware.ts`** (jose) for `/admin`, `/partner`, `/renter`, `/messages`; **`lib/services/session-service.js`** for Node API handlers. |
| Credentials auth | **`POST /api/v2/auth/register`** creates rows in **`profiles`** (email + bcrypt); not Supabase Auth sessions for this path. |
| Supabase client | **`SUPABASE_SERVICE_ROLE_KEY`** for server DB access; product auth is **not** switching to Supabase session cookies today — OAuth below is documented for when Supabase Auth is enabled alongside or instead of email flow. |

## Referral continuity (Stage 72.6)

1. Sharing link uses **`/?ref=CODE`** (`GET /api/v2/referral/me`).
2. **`AuthProvider`** reads `ref` on load, persists **`gostaylo_pending_ref`** cookie + **`gostaylo_pending_ref_code`** in `localStorage`, validates via **`POST /api/v2/referral/validate`**.
3. **`POST /api/v2/auth/register`** merges **`referredBy`** JSON with **`gostaylo_pending_ref`** so users who lose the query string still attach to the tree; cookie cleared on successful registration response.

For **OAuth**, before `signInWithOAuth`, copy the same pending referral code into **`gostaylo_pending_ref`** (already done on landing). After OAuth callback, either map Supabase user to **`profiles`** and run the same **`referral_relations`** upsert used in register, or redirect through a server route that reads the cookie once.

## Supabase Dashboard — enable providers

In **Authentication → Providers**:

- **Google**: enable; add **Client ID** and **Client secret** from Google Cloud Console (OAuth 2.0 Web client). Authorized redirect URIs must include Supabase callback, e.g. `https://<project-ref>.supabase.co/auth/v1/callback` and your app URL if using PKCE hosted flow.

Продуктовый UI (**`components/auth/AuthProviderButtons.jsx`**) вызывает **`signInWithOAuth`** для **`google`**, **`apple`**, **`yandex`**, **`vk`** — видимость по **`lib/auth/auth-provider-policy.js`**: Google/Apple только при **`!isRussia`** (IP РФ); Yandex/VK — везде. Полноэкранный вход: **`/auth/login`**, **`/auth/register`**.

## Environment variables (typical)

Names follow Supabase / Next patterns; confirm against your project settings after enabling providers.

```bash
# Supabase — Split URL (Stage 130.8)
NEXT_PUBLIC_SUPABASE_URL=https://airento.ru/supabase   # browser / Realtime
SUPABASE_SERVER_URL=https://<project-ref>.supabase.co  # server (API, admin, OAuth token exchange)
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Site origin (letters, OAuth redirectTo context)
NEXT_PUBLIC_APP_URL=https://airento.ru
NEXT_PUBLIC_BASE_URL=https://airento.ru

# Phone OTP SMS — Stage 189.2 dual-route (`lib/auth/sms-dispatch.service.js`)
# RU (+7) → SMSC.ru
SMSC_LOGIN=
SMSC_PASSWORD=
SMSC_SENDER=              # optional alphanumeric sender (if approved in SMSC cabinet)

# International (+66, etc.) → Twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=       # E.164, e.g. +12025551234

# Local / E2E only (ignored in production)
AUTH_PHONE_OTP_MOCK=1

# Telegram — same bot for notifications + Login Widget (Stage 189.3 dual-mode)
TELEGRAM_BOT_TOKEN=           # server: verify Login Widget + sendMessage
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=   # BotFather @username (Login Widget data-telegram-login)
# BotFather → Domain: allow prod/staging host for Login Widget
# Profile link (logged-in): t.me/<username>?start=link_<profileId> via webhook /start
```

Keep secrets out of client bundles unless using public anon flows documented by Supabase.

## Checklist before going live with OAuth

- [ ] Redirect URLs whitelist includes production and staging domains.
- [ ] Same **`NEXT_PUBLIC_BASE_URL`** as referral links and email verification links.
- [ ] After OAuth, new users get **`profiles`** row + **`referral_relations`** when **`gostaylo_pending_ref`** is set (reuse **`ReferralGuardService.validateActivation`** + **`computeInviteTreeFields`**).
- [ ] Rate limits and **`referral-guard`** rules apply to OAuth-created accounts the same as email register.
