# Auth gateway prep — OAuth (Google / Apple) + referrals

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
- **Apple**: enable; configure **Services ID**, **Team ID**, **Key ID**, **Private key** (.p8), and return URLs per Apple Developer portal.

## Environment variables (typical)

Names follow Supabase / Next patterns; confirm against your project settings after enabling providers.

```bash
# Supabase (already present for DB)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Optional explicit site URL for OAuth redirects
NEXT_PUBLIC_BASE_URL=https://www.gostaylo.com

# Google OAuth (when using Supabase Auth in app)
# NEXT_PUBLIC_GOOGLE_CLIENT_ID=   # if client-side PKCE flow

# Apple (bundle / services id live in Apple Developer; secrets often in Supabase vault only)
```

Keep secrets out of client bundles unless using public anon flows documented by Supabase.

## Checklist before going live with OAuth

- [ ] Redirect URLs whitelist includes production and staging domains.
- [ ] Same **`NEXT_PUBLIC_BASE_URL`** as referral links and email verification links.
- [ ] After OAuth, new users get **`profiles`** row + **`referral_relations`** when **`gostaylo_pending_ref`** is set (reuse **`ReferralGuardService.validateActivation`** + **`computeInviteTreeFields`**).
- [ ] Rate limits and **`referral-guard`** rules apply to OAuth-created accounts the same as email register.
