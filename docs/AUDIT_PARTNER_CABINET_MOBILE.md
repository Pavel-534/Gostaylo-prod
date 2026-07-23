# Discovery Audit: Partner Cabinet (Path A) — Mobile / PWA readiness

> **Version:** 1.1 · **Date:** 2026-07-22 · **Stage prep:** 194.0  
> **Scope:** read-only · **Product:** Airento partner (host) workspace  
> **Prior closed:** Stage 189.3.1 Auth Immersive · Stage 193.x iCal SSOT  
> **Rev 1.1:** merged deep-dive evidence (BottomNav exclusion, listings action density, &lt;44px chrome, token counts, i18n hardcodes).  

---

## 1. Architectural map (routes & files)

### Route group shell

| Layer | Path | Role |
|-------|------|------|
| Route group | `app/(partner)/layout.js` | `PartnerRouteShell` — Query + unread badge + partner i18n slice |
| Workspace layout | `app/(partner)/partner/layout.js` | Sidebar drawer, AppHeader workspace, role gate, nav |
| Page width shell | `components/product/PartnerPageShell.jsx` | `max-w-6xl` content frame (not navigation) |
| Context | `contexts/partner-notification-context.jsx` | Partner in-app notifications |
| Shell SSOT | `lib/layout/workspace-shell.js` | Frame / sidebar / toolbar geometry |
| Middleware | `middleware.ts` | `/partner` → roles `PARTNER` \| `ADMIN` \| `MODERATOR` |

### Primary routes (`/partner/*`)

| Section | Route | Page / entry | Key UI modules |
|---------|-------|--------------|----------------|
| Hub redirect | `/partner` | `partner/page.js` | → dashboard |
| Dashboard | `/partner/dashboard` | `partner/dashboard/page.js` | `components/partner/dashboard/*` |
| Listings | `/partner/listings` | `partner/listings/page.js` | Card list (not Table) |
| Listing create/edit | `/partner/listings/new`, `/partner/listings/[id]` | wizard + `EditPartnerListingView` | `listings/new/**`, `components/partner/wizard/*` |
| Calendar | `/partner/calendar` | `partner/calendar/page.js` | `components/calendar/*` (Grid desktop, Agenda mobile) |
| Bookings | `/partner/bookings` | `partner/bookings/page.js` | `components/partner/bookings/*` |
| Guest review | `/partner/bookings/[bookingId]/guest-review` | guest-review page | |
| Messages | `/messages` (shared) | chat app group | Nav item in partner sidebar |
| Finances | `/partner/finances` | finances page | `components/partner/finances/*` |
| Payout profiles | `/partner/payout-profiles` | payout-profiles page | |
| Promo | `/partner/promo` | promo page | Heavy `teal-*` legacy |
| Settings | `/partner/settings` | settings page | Heavy `teal-*` legacy |
| Reviews | `/partner/reviews` | reviews page | **Not in SIDEBAR_CONFIG** (orphaned nav?) |
| Referrals (partner) | `/partner/referrals` | referrals page | Sidebar links to `/profile/referral` instead |

### Components inventory (high level)

- **`components/partner/`** (~70 files): dashboard, bookings, finances, listing quality, onboarding checklist, host verification, wizard helpers.
- **`components/calendar/`**: master calendar engine (shared with partner calendar page).
- **Wizard local context:** `app/(partner)/partner/listings/new/context/ListingWizardContext.js` (not global `contexts/partner`).

### Access gate & onboarding

1. **Edge:** `middleware.ts` matcher `/partner/:path*` — JWT role allow-list.  
2. **Client belt:** `partner/layout.js` — `allowedRoles`, Access Denied UI with «Стать партнёром» → `/profile`.  
3. **Become partner:** storefront `/profile` + `POST /api/v2/partner/apply` (`lib/services/partner-application.service`) → success page `partner-application-success`.  
4. **Role switch:** not a soft toggle — application / verification flow; ADMIN/MODERATOR can open partner workspace.

---

## 2. Mobile UX & ergonomics (≤375px)

### What already works well

| Area | Finding |
|------|---------|
| Bookings | **Card stack** (`PartnerBookingList` → `PartnerBookingCard`), `min-h-[44px]`, drawer detail Stage 176.2 (`visualViewport` + sticky CTA) |
| Listings | Cards + horizontal filter chips; `overflow-x-hidden` on page root |
| Calendar ≤1023px | **`CalendarMobileAgenda`** (not compressed month grid); chips/rows `min-h-[44px]`; desktop `CalendarGrid` `lg:block` only |
| Wizard | **5-step progressive disclosure** (`LISTING_WIZARD_STEP_COUNT = 5`) + dedicated mobile chrome (`ListingWizardMobileChrome`, action bar, step dots) |
| Workspace chrome | Hamburger drawer + `AppHeader` workspace; brand tokens in shell (`bg-brand-surface`, sidebar brand hover) |

### Pain points (calendar / wizard depth)

- **Nav:** Guest `MobileBottomNav` **explicitly skips `/partner`** (`components/mobile-bottom-nav.jsx`). Partner IA = hamburger drawer only (10 sidebar items + Create Listing).  
- **Listings actions:** up to ~8 controls per card (publish/view/edit/price/photos/calendar/hide/delete); many labels `hidden sm:inline` → icon-only mis-tap risk despite many `min-h-[44px]` buttons.  
- **Under-44px chrome (constitution debt):** sidebar close `p-1.5` (`layout.js`); listing filter chips `py-1.5`; wizard slim header buttons **`h-9 w-9`** (`ListingWizardMobileSlimHeader.jsx`).  
- **Calendar:** Agenda + range + Stage 188 action sheet + bulk price + iCal — cognitively heavy for first-time hosts. Desktop grid `DAY_WIDTHS` compact **42px** day columns (lg+ only).  
- **Wizard:** Steps reduce friction vs single scroll, but steps 1–3 still heavy (category + geo + 5 photos + quality gates). Sticky mobile footer helps; keyboard + map picker remain friction hotspots.  

---

## 3. Design system & i18n

### Tokens

- Shell / dashboard / calendar header: largely **`brand`**, `rounded-xl` / `rounded-2xl`, brand surfaces.  
- **Legacy counts (approx., `components/partner` + `app/(partner)`):** `teal-*` **~42**, `indigo-*` **~10**, arbitrary `bg/text-[#…]` **0**. Hotspots: settings, promo, reviews, guest-review, `error.jsx`, finances payout preview.  

### i18n

- Partner layout / calendar / bookings cards: **`getUIText` + partner slice** (`register-partner-i18n-slice`, `partner-shell.js`) — RU / EN / ZH / TH present in shell.  
- Residual hardcodes: layout aria «Закрыть меню»; booking card `…, Thailand`; `partner-finances-shared.js` RU-only payout status map; bilingual ifs in category picker / import block; AppHeader workspace titles partially ad-hoc.  

---

## 4. Security & routing (summary)

| Control | Status |
|---------|--------|
| Middleware role gate | OK |
| Layout client gate + CTA to apply | OK |
| Renter blocked from partner UI | OK (unless ADMIN/MOD) |
| Onboarding discoverability | Medium — via profile / access-denied, not in-app guided Path A home |

---

## 5. Top-5 critical mobile UX/UI issues (Stage 194 candidates)

1. **No partner bottom navigation / PWA thumb IA** — guest BottomNav off for `/partner`; hamburger + 10 destinations.  
2. **Listings card action overcrowding** — ~8 icon actions per card on ≤375px (discoverability / mis-tap).  
3. **Under-44px chrome** — sidebar close, filter chips, wizard `h-9 w-9` controls vs Stage 176.2 rule.  
4. **Calendar mobile density** — agenda correct, but first-run path (iCal / block) buried under power-user tools.  
5. **Token + i18n debt** — `teal-*`/`indigo-*` surfaces + hardcodes (`Thailand`, finance status RU) break Immersive Auth / guest CRO parity; IA gaps (reviews off-sidebar, dual referral URLs).  

---

## 6. Complexity scores (mobile)

| Surface | Score (1=easy … 5=hard) | Notes |
|---------|-------------------------|--------|
| **Master Calendar** | **4 / 5** | Agenda path is solid; multi-listing + blocks + iCal + modals = high interaction surface |
| **Listing Wizard** | **3.5 / 5** | Real stepwise UX + mobile chrome exists; content volume + gates keep friction high |
| **Bookings** | **2 / 5** | Cards + drawer already Stage 176.2-aligned |
| **Finances** | **3 / 5** | Tab/subnav stack; sticky withdraw CTA present; visual token cleanup needed |
| **Listings list** | **2 / 5** | Card-based; filter chip overflow is mild |

---

## 7. Stage 194.0 — proposed phased plan

### 194.0-A — Foundations (P0, low risk)
1. Partner **mobile primary nav** (Dashboard / Listings / Calendar / Bookings / More) — do not break desktop sidebar; guest BottomNav stays storefront-only.  
2. **Listings actions** → overflow / “More” sheet; keep Publish + Calendar as primary.  
3. **Touch audit:** sidebar close, filter chips, wizard chrome → `min-h/w-[44px]`.  
4. Token sweep Wave 1: settings, promo, reviews, `error.jsx` — `teal-*` → `brand` / `Button variant="brand"`.  
5. Fix sidebar IA: Reviews on/off intentionally; unify referral entry (one SSOT URL).

### 194.0-B — Calendar host simplicity (P0/P1)
6. Mobile calendar first-run strip: primary **Import iCal** + **Block dates**; demote bulk price / force-sync; default shorter agenda window where safe.  

### 194.0-C — Wizard / publish (P1)
7. Wizard 44px chrome + plain-language quality checklist; post-approval deep-link to `/partner/dashboard` + checklist (apply stays on `/profile`).  

### 194.0-D — PWA / i18n / smoke (P1/P2)
8. i18n cleanup (finance statuses, “Thailand”, close-menu aria, import/category bilingual maps).  
9. Safe-area + `dvh` on drawers; Playwright `partner-mobile-smoke` @ 375px.

### Explicit non-goals for 194.0
- Do not change escrow / payout math.  
- Do not speed `vercel.json` crons.  
- Do not reopen listing quality gate thresholds without ADR (soft-publish = separate ticket).

---

## 8. Verdict

Partner cabinet is **architecturally mature** (cards for bookings/listings, agenda calendar, 5-step wizard, middleware + layout gates, i18n slice). It is **not yet Immersive-Auth / guest-CRO visual parity**, and **mobile IA lacks a dedicated thumb navigation**. Stage 194.0 should prioritize **IA + tokens + calendar first-run**, then wizard clarity — not a greenfield rewrite.

---

*End of Discovery Audit 1.1. Implementation only after explicit Stage 194.0 kickoff.*
