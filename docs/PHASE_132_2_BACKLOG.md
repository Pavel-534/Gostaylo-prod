# Phase 132.2 — Backlog: Supply Activation · Sharing Copy · Mobile UX · OpenGraph

> **Status:** Planning (read-only audit completed 2026-06-01)  
> **Prerequisite:** Phase 132.0 (balance SSOT) + 132.1 (Referral Payout Ops Desk) — smoke financial **28/28 GREEN**  
> **Related:** `docs/REFERRAL_FINANCIAL_FLOW.md`, `docs/REFERRAL_OWNER_GUIDE.md`, `docs/TECHNICAL_MANIFESTO.md`

---

## Product frame

**Goal:** Platform is ready for first real users, hosts, and bookings in Russia — clear value from the first screen:

- **Guest** — bonus + booking via ambassador link.
- **Referred host** — knows they were invited, what to do next, and what happens after the first completed booking.

**Out of scope for 132.2** (unless explicitly decided):

- New payout rails or FinTech core changes.
- Changing `host_activation` economics (today the bonus goes to the **referrer/upline**, not the invited host).
- Full geographic rebrand (Phuket → RU); only targeted RU-first copy.

---

## Open decisions (resolve before A3 / B2 coding)

| # | Question | Options | Recommendation |
|---|----------|---------|----------------|
| 1 | **Host activation bonus for invitee?** | A) Honest copy: bonus to ambassador only · B) Add host incentive in 132.x | **A** for 132.2; B = separate epic |
| 2 | **Primary share URL for OG?** | A) Canonical `/u/[id]` only · B) Full OG for `/go/[vanity]` | **B** (D3) + UI hint that `/u/` is safest for previews |
| 3 | **RU supply vertical in pitches?** | Housing only · Housing + mobility/services | **Housing-first**, optional second template for “services” |

---

## Epic A — Supply Activation (invited host)

### A1. `PartnerReferralWelcomeStrip` on partner dashboard

| Field | Value |
|-------|--------|
| **Priority** | P0 |
| **Estimate** | M |
| **Files** | `components/partner/dashboard/PartnerDashboardPageContent.jsx`, new `components/partner/PartnerReferralWelcomeStrip.jsx` |

**Problem:** Partner who registered via referral link sees generic onboarding with no connection to the ambassador.

**Solution:**

- Strip on `/partner/dashboard` (after `PartnerDashboardWalletOverview`, before `PartnerOnboardingChecklist`).
- Data: `GET /api/v2/referral/me` → `inviteNetwork.directReferrerId` + ambassador display name, **or** new `GET /api/v2/partner/referral-context` (preferred for RBAC clarity).
- Show only when `directReferrerId` exists and host is not yet “supply activated” (see A3).

**Acceptance criteria:**

- [ ] Copy (RU example): «Вас пригласил {name}. После первой успешной брони вашего объекта активируется программа — амбассадор получит бонус, вы получите полный доступ к кабинету и выплатам».
- [ ] CTA → `/partner/listings/new`.
- [ ] Hidden after host activation rule (A3) is met.
- [ ] i18n: `ru` + `en` minimum.

---

### A2. Supply CTA in listing wizard

| Field | Value |
|-------|--------|
| **Priority** | P1 |
| **Estimate** | S |
| **Files** | `app/partner/listings/new/components/ListingWizardPageInner.jsx` |

**Problem:** Wizard has zero referral personalization on step 1.

**Acceptance criteria:**

- [ ] Compact dismissible banner (sessionStorage) on step 0 for referred partners without completed booking.
- [ ] Same data contract as A1.

---

### A3. SSOT `host activated` for UI

| Field | Value |
|-------|--------|
| **Priority** | P0 |
| **Estimate** | M |
| **Files** | New or extended API route; `lib/partner/partner-referral-context.js` (suggested) |

**Logic gap (critical):** Backend `distributeHostPartnerActivation` credits the **referrer**, not the invited host. UI must **not** promise the host “you will get a bonus after the first booking” unless product adds that economics.

**Solution:**

- API field e.g. `partnerSupplyStatus: { referredBy: { id, displayName }, hostActivationCompleted: boolean, firstCompletedBookingAt?: string }`.
- Truth source: `bookings` (COMPLETED for listing owner) + ledger/metadata `referral_type=host_activation`.

**Acceptance criteria:**

- [ ] Contract documented in `docs/TECHNICAL_MANIFESTO.md` (one paragraph).
- [ ] All supply UI copy aligned: ambassador bonus vs host welcome/activation are separate messages.
- [ ] A1/A2 use this flag to show/hide strip.

---

### A4. Extend `PartnerOnboardingChecklist` for referred hosts

| Field | Value |
|-------|--------|
| **Priority** | P2 |
| **Estimate** | S |
| **Files** | `components/partner/PartnerOnboardingChecklist.jsx` |

**Idea:** Optional 4th checklist item for referred users only: «Дождитесь первой брони — так активируется ваша ветка».

---

## Epic B — Sharing copy (`ReferralMarketingKit`)

### B1. Wire `referralStoriesCopy` + i18n headlines

| Field | Value |
|-------|--------|
| **Priority** | P0 |
| **Estimate** | S |
| **Files** | `components/referral/ReferralProfileTabLink.jsx`, `components/referral/ReferralMarketingKit.jsx` |

**Problem:** `GET /api/v2/referral/me` builds `referralStoriesCopy`, but TabLink does not pass props → Stories PNG falls back to English (`Travel and earn with …`).

**Acceptance criteria:**

- [ ] Pass `storiesCardHeadline={t('stage73_storiesCardHeadline')}`, tier/badge/team lines from `data.referralStoriesCopy`.
- [ ] RU profile → RU Stories PNG headline.
- [ ] EN fallback only as last resort.

---

### B2. RU-first pitch templates: Guest + Host

| Field | Value |
|-------|--------|
| **Priority** | P0 |
| **Estimate** | M |
| **Files** | `lib/translations/slices/profile-app-referral.js`, `ReferralProfileTabLink.jsx`, `ReferralMarketingKit.jsx` |

**Problem:** All templates target “first trip / ฿ welcome”; no supply-side pitch for RU hosts.

**New i18n keys (suggested):**

| Key | Use |
|-----|-----|
| `stage1322_shareBodyGuest` | WA/TG default for guests |
| `stage1322_shareBodyHost` | WA/TG for host recruitment |
| `stage1322_postShortHost` | Short / Stories |
| `stage1322_postMediumHost` | Telegram medium |

**RU host pitch draft:**

> «Сдаёшь квартиру или апартаменты? Подключайся к {brand} — я в программе, помогу с первым объявлением. Регистрация: {link}»

**Acceptance criteria:**

- [ ] UI toggle or tabs in MarketingKit: «Для гостей» / «Для хостов».
- [ ] `defaultPitch` follows active tab.
- [ ] Existing `stage91_shareBodyInvitee` remains guest default (no regression).

---

### B3. THB → dual display in share copy

| Field | Value |
|-------|--------|
| **Priority** | P1 |
| **Estimate** | M |
| **Files** | `profile-app-referral.js`, share prop builders in TabLink |

**Logic gap:** Wallet says “withdraw in ₽”; share texts show `฿{welcomeThb}` only — confusing for RU audience.

**Acceptance criteria:**

- [ ] Placeholders `{welcomeRub}` / `{welcomeDisplay}` via mid-FX from `wallet/me` or `referral/me`.
- [ ] RU templates: «до {welcomeRub} ₽ (≈ {welcomeThb} THB)» or RUB-only when `referral_display_currency=RUB`.
- [ ] Graceful fallback if FX unavailable.

---

### B4. Remove hardcoded EN fallback in MarketingKit

| Field | Value |
|-------|--------|
| **Priority** | P1 |
| **Estimate** | XS |
| **Files** | `ReferralMarketingKit.jsx` |

Replace inline `Travel and earn with ${b}!…` with `getUIText('stage73_shareBodyDefault', lang)` via `useI18n` or `language` prop.

---

### B5. Facebook share

| Field | Value |
|-------|--------|
| **Priority** | P2 |
| **Estimate** | XS |

FB sharer URL-only; low priority for RU. Option: copy-to-clipboard helper or de-emphasize FB on mobile.

---

### B6. Telegram double-link fix

| Field | Value |
|-------|--------|
| **Priority** | P2 |
| **Estimate** | XS |
| **Files** | `ReferralMarketingKit.jsx` → `openTg()` |

**Logic gap:** `text=defaultPitch` already contains `{link}` **and** `url=qrLink` — duplicate link in Telegram.

**Fix:** TG-specific pitch variant without embedded URL in text body.

---

## Epic C — Mobile UX (wallet & payout profile)

### C1. Touch-friendly hold explanations

| Field | Value |
|-------|--------|
| **Priority** | P0 |
| **Estimate** | M |
| **Files** | `ReferralBalanceBreakdown.jsx`, optional `BalanceHintPopover.jsx` |

**Problem:** Radix Tooltip (`components/ui/tooltip.jsx`) is hover/focus-first; unreliable on touch.

**Recommended approach:** Popover on tap for ℹ️ button, or inline Collapsible “Что значит холд?”.

**Acceptance criteria:**

- [ ] Tap ℹ️ on 360px iOS Safari + Android Chrome shows full explanation.
- [ ] Works in `full` and `compact` variants.

---

### C2. i18n: Waterfall + RuForm + Blockers

| Field | Value |
|-------|--------|
| **Priority** | P1 |
| **Estimate** | M |
| **Files** | `ReferralWithdrawalWaterfall.jsx`, `ReferralRuPayoutProfileForm.jsx`, `ReferralPayoutBlockers.jsx`, `wallet.service.js` |

**Tail from 132.1:** Wallet page i18n done; these components still hardcoded RU. Server `blockerDetails[].messageRu` is RU-only.

**Acceptance criteria:**

- [ ] Keys `stage1322_waterfall_*`, `stage1322_ruForm_*`, `stage1322_blockers_*`.
- [ ] Server: add `messageKey` + params alongside `messageRu` (client resolves via `getUIText`).

---

### C3. Mobile layout polish

| Field | Value |
|-------|--------|
| **Priority** | P2 |
| **Estimate** | S |

| Location | Fix |
|----------|-----|
| TabLink copy row | `flex-col sm:flex-row`, full-width Copy button |
| Waterfall amount row | Stack on `<sm` |
| Breakdown compact labels | Shorter i18n keys or `text-[11px]` at `<360px` |
| Withdraw CTA | Optional sticky bottom bar on mobile |

---

## Epic D — SEO / OpenGraph (TG / WA previews)

### D1. RU `opengraph-image`

| Field | Value |
|-------|--------|
| **Priority** | P0 |
| **Estimate** | M |
| **Files** | `app/u/[id]/opengraph-image.js` |

**Problem:** Subtitle hardcoded `Referral · Travel · Earn` (English).

**Acceptance criteria:**

- [ ] RU subtitle via i18n or request locale (default `ru` for `.ru` hosts).
- [ ] Brand from `getSiteDisplayName()`.
- [ ] Subline example: «Сдавай жильё · Бронируй · Получай бонусы».

---

### D2. OG description: guest + host dual CTA

| Field | Value |
|-------|--------|
| **Priority** | P1 |
| **Estimate** | S |
| **Files** | `app/u/[id]/layout.js`, `profile-app-referral.js` |

New key e.g. `stage1322_uMetaDescriptionRu`: «Присоединяйся к команде {name}: бронируй жильё или подключай свой объект на {brand}».

---

### D3. `/go/[vanity]` metadata before redirect

| Field | Value |
|-------|--------|
| **Priority** | P0 |
| **Estimate** | M |
| **Files** | `app/go/[vanity]/layout.js` (new), `app/go/[vanity]/page.js` |

**Logic gap:** `/go/[vanity]` is redirect-only; crawlers may not follow → empty TG/WA card.

**Acceptance criteria:**

- [ ] `generateMetadata` on `/go/[vanity]` (resolve vanity → ambassador, same OG as `/u/[id]`).
- [ ] Browser redirect preserved.
- [ ] MarketingKit primary share URL documented as `/u/[id]`; vanity labeled “short verbal link”.

**Audit:** `lib/referral/public-landing-url.js`, PDF generator — ensure QR/PDF use `/u/[id]` for OG-safe sharing.

---

### D4. OG language without cookie

| Field | Value |
|-------|--------|
| **Priority** | P2 |
| **Estimate** | S |
| **Files** | `app/u/[id]/layout.js` |

**Logic gap:** Metadata lang = `gostaylo_language` cookie; TG user never visited → wrong locale.

**Idea:** `Accept-Language` fallback; force `ru_RU` for known RU site hosts.

---

## Epic E — Documentation & verification

### E1. Docs update (same PR as meaningful changes)

| File | Updates |
|------|---------|
| `docs/TECHNICAL_MANIFESTO.md` | Supply UI, share templates, OG, `partnerSupplyStatus` API |
| `docs/ARCHITECTURAL_PASSPORT.md` | Routes, endpoints, version bump **12.132.2** |
| `docs/REFERRAL_OWNER_GUIDE.md` | What to share: `/u/` vs `/go/`, guest vs host pitches |

---

### E2. Smoke & manual checklist

**Automated:**

- [ ] `npm run smoke:full-financial` → **28/28** (132.2 must not break ledger).

**Manual:**

- [ ] Referred partner sees supply strip on dashboard.
- [ ] Host pitch → Telegram link preview (RU title + image).
- [ ] Wallet breakdown ℹ️ tap works on mobile emulator.
- [ ] Full cycle unchanged: ambassador request → Payout Ops approve → registry export.

---

## Logic inconsistencies (must not ignore)

### 1. Who gets “bonus after first booking”?

| Actor | Current behavior | User may assume |
|-------|------------------|-----------------|
| **Ambassador (referrer)** | `host_activation` → wallet/ledger credit | Correct |
| **Invited host** | Guest welcome bonus if registered as guest; **no** direct host_activation payout to self | “I was promised a bonus” |

**132.2 rule:** Copy must be explicit. Host incentive for invitee = separate product decision (132.3+).

---

### 2. Two different “welcome” flows

| Surface | Audience | Referral-aware? |
|---------|----------|-----------------|
| `ReferralVanityWelcomeBanner` on `/u/[id]` | Guest | Yes |
| `WelcomePartnerModal` on `/partner/dashboard` | Partner | No (generic) |

Invited user may hit both → mixed messages.

**Idea:** After partner approve, one-time `SupplyActivationModal` instead of generic welcome when `directReferrerId` present.

---

### 3. `referral/me` vs partner portal

Partner dashboard uses `usePartnerStats`, not `referral/me`. `inviteNetwork.directReferrerId` exists in API but **zero frontend consumers** (audit 132.2).

**132.2:** Add explicit fetch in partner shell or dedicated partner API — do not assume referral tab is loaded.

---

### 4. Duplicate SSOT for Stories strings

`lib/referral/referral-stories-copy.js` (server) vs `profile-app-referral.js` (client i18n).

**Direction:** API returns numbers (`monthlyNetworkEarnedThb`); client resolves all display strings via i18n.

---

### 5. Share URL vs OG URL

MarketingKit: `qrLink = landingShareUrl || referralLink` → typically `/u/[id]` (OG-safe). Verify PDF/QR never prefer `/go/` without D3 metadata.

---

### 6. Blockers i18n asymmetry

Client wallet i18n (132.1) vs server `messageRu` only → EN-profile ambassadors see RU blockers.

---

### 7. Phuket-centric partner welcome

`welcomePartnerBody`: «виллы, яхты, туры» — weak fit for RU supply. Consider `welcomePartnerBodyRuSupply` or category-aware variant.

---

## Ideas for 132.3+ (not in 132.2 scope)

1. Ambassador **share mode** preference (Guest / Host / Both) persisted in profile.
2. Deep link `/partner/listings/new?supply=1` with checklist pre-highlight.
3. D+1 email/push to referred host: «First listing in 10 minutes».
4. Dynamic OG image with QR + welcome amount (1200×630).
5. A/B copy via `system_fintech_settings` marketing keys.
6. Wallet «Share link» CTA next to withdraw button.
7. Dashboard progress: «0/1 booking until network activation».

---

## Suggested sprint order

| Week | Deliverables |
|------|----------------|
| **W1** | A3 contract → A1 strip → B1 Stories wire → D1 OG image → D3 `/go/` metadata |
| **W2** | B2 host/guest pitches → C1 touch hints → B3 dual currency |
| **W3** | C2 i18n tail → D2 OG description → A2 wizard banner → E docs + manual QA |

---

## Definition of Done — Phase 132.2

- [ ] Referred partner sees supply strip with **honest** host_activation copy.
- [ ] MarketingKit: RU guest + host templates; Stories not English by default.
- [ ] TG/WA preview works for `/u/[id]` and `/go/[vanity]` with RU OG.
- [ ] Mobile: tap ℹ️ on balance breakdown shows hold explanation.
- [ ] `npm run smoke:full-financial` → 28/28 GREEN.
- [ ] `TECHNICAL_MANIFESTO.md` + `ARCHITECTURAL_PASSPORT.md` updated to **v12.132.2**.

---

## Audit reference (132.2 prep)

Read-only audit performed 2026-06-01. Key files reviewed:

| Zone | Files |
|------|--------|
| Supply | `PartnerDashboardPageContent.jsx`, `PartnerOnboardingChecklist.jsx`, `partner-dashboard-widgets.jsx`, `app/partner/listings/new/*` |
| Sharing | `ReferralMarketingKit.jsx`, `ReferralProfileTabLink.jsx`, `profile-app-referral.js`, `referral-stories-copy.js` |
| Mobile | `ReferralBalanceBreakdown.jsx`, `ReferralPayoutBlockers.jsx`, `ReferralRuPayoutProfileForm.jsx`, `ReferralWithdrawalWaterfall.jsx`, `app/profile/wallet/page.js` |
| OG | `app/u/[id]/layout.js`, `app/u/[id]/opengraph-image.js`, `app/go/[vanity]/page.js` |
