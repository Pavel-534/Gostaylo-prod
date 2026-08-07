# Product UI Inventory — экраны App Router

> **Version**: 1.6.0 | **Updated**: 2026-08-07 | **Source**: `app/**/page.{js,jsx}` (116 route pages)  
> **Purpose:** SSOT-инвентаризация UI-страниц (mobile-flat waves после Stage **200.52**).  
> **Tokens:** [`lib/ui/mobile-flat-canvas.js`](../lib/ui/mobile-flat-canvas.js) (`MOBILE_FLAT_*` / alias `MOBILE_FLAT_CANVAS`) · product shell — `components/product/*` · [`PRODUCT_UI_SYSTEM.md`](./PRODUCT_UI_SYSTEM.md).  
> **Не путать с API:** маршруты `app/api/**` сюда не входят.

---

## Легенда статуса дизайна

| Маркер | Значение |
|--------|----------|
| `[x] Finished (Wizard 200.52)` | Mobile-flat на listing wizard create/edit |
| `[x] Finished (Hub Wave 1 / 200.53)` | Partner Hub page mobile-flat (nesting ≤1 on `&lt;sm`) |
| `[x] Finished (Guest Wave 2A / 200.54)` | Core guest path: home → catalog → PDP → checkout → my-bookings |
| `[x] Finished (Guest Wave 2B / 200.55)` | Secondary guest: favorites, profile/wallet/settings, public `/u`, reviews |
| `[x] Finished (Chat Wave 3 / 200.56)` | Messages hall + thread chrome; composer safe-area kept |
| `[x] Finished (Auth Wave 4 / 200.57)` | Auth + marketing/legal public pages; demo exclude |
| `[x] Finished (Admin Wave 5A / 200.58)` | Core ops: `/admin`, dashboard, moderation (=listings), bookings |
| `[ ] Pending Flattening` | Нужен рефактор под mobile-flat / единый product shell |
| `redirect` | Нет UI — только redirect; не входит в visual polish |

**Правило обновления:** после закрытия волны flattening — перенести строки в `[x]` и указать Stage в «Notes».

**Уточнения ТЗ (Wave 1):**

- **`/partner/profile` не существует** — профиль партнёра = `/partner/settings` (+ avatar в sidebar).
- **`/partner`** и **`/partner/referrals`** — redirect-only (`→ /partner/dashboard`, `→ /profile/referral`); помечаются `redirect`, не visual flatten.
- Токены SSOT: [`lib/ui/mobile-flat-canvas.js`](../lib/ui/mobile-flat-canvas.js) — канон **`MOBILE_FLAT_*`** (алиасы `WIZARD_MOBILE_FLAT_*` для wizard).
- Shell `WORKSPACE_SCROLL` уже даёт `p-4` — на страницах не дублировать лишний gutter на `&lt;sm`.
- Isolation OK (1 уровень): alerts/banners (KYC, pin-conflict, amber), map, earnings math, interactive list separators (`border-b`), sheets/dialogs.

**Уточнения ТЗ (Wave 2A — Core Guest Path):**

- Канон путей: **`/`**, **`/listings`** (нет `/search`), **`/listings/[id]`**, **`/checkout/[bookingId]`** (нет `/book`), **`/my-bookings`**.
- **`/renter/bookings`** — redirect → `/my-bookings` (не visual polish).
- **Не flatten** shared tile chrome: `listing-card.jsx`, `RecommendationRailCard`, map rail cards, **`UnifiedOrderCard`** (order tile isolation + partner reuse).
- Isolation OK: listing tiles, sticky booking bar (PDP), sticky pay bar + price summary (checkout), search chrome, sheets, escrow/timer alerts.

**Уточнения ТЗ (Wave 2B — Guest Secondary):**

- Избранное: канон **`/renter/favorites`** (отдельного `/favorites` нет).
- Кошелёк: **`/profile/wallet`** (не `/renter/wallet`).
- Профиль: **`/renter/profile`**, **`/profile`**, **`/profile/status`**, **`/profile/referral`**, **`/renter/settings`**, **`/settings`**.
- Публичный профиль партнёра/гостя: **`/u/[id]`**; отзыв гостя: **`/renter/reviews/new`**.
- Не flatten listing tiles в favorites grid.
- Isolation OK: sticky withdraw (wallet), referral marketing export canvases, ReviewModal, status/alert messaging shells as single nested level.
- Redirect-only (не visual): **`/bookings/[id]`** → checkout, **`/go/[vanity]`** → `/u/[id]`, **`/renter`** → dashboard.

**Уточнения ТЗ (Wave 3 — Chat):**

- Канон: **`/messages`**, **`/messages/[id]`**, **`/messages/archived`**; **`/chat/[id]`** — redirect → `/messages/[id]`.
- Двухколоночный layout (inbox \| thread \| deal panel) — **lg+** в `ChatThreadChrome` (не переносить на sm).
- Flatten на **max-sm**: hall/archived shell (`MOBILE_FLAT_SHELL_CARD`), soft header glass, deal card nesting in sheet.
- **Не flatten:** message bubbles, composer capsules, VoiceRecorder/QuickReplies popovers, `ThreadDealDetailsSheet`, `pb-safe-chat-composer`.

**Уточнения ТЗ (Wave 4 — Auth & marketing/legal):**

- Канон auth: **`/auth/login`**, **`/auth/register`**, **`/auth/forgot-password`**, **`/auth/verify-email`**, **`/auth/complete-legal`**, **`/auth/link-conflict`**, **`/auth/oauth-error`**.
- **`/login`** — redirect → `/auth/login` (не visual).
- Reset: **`/reset-password`** (storefront) + forgot via AuthPageShell.
- Legal SSOT shell: **`LegalDocShell`** (`/legal/*`); marketing: about / loyalty / referral / help / terms.
- Flatten shared shells first (`AuthPageShell`, `LegalDocShell`) + page-local cards; **sm+** elevated chrome preserved.
- **Не трогать:** auth/session/API contracts, OAuth flows, consent checkbox logic.
- **Exclude:** `/demo/price-breakdown`, `/test-db` (dev/demo — out of product flatten).
- Isolation OK: Auth modal bottom-sheet, OTP inputs, provider buttons, FAQ `<details>`, escrow content blocks as single nested level after shell flatten.

**Уточнения ТЗ (Wave 5A — Admin Core Ops):**

- Scope: **`/admin`**, **`/admin/dashboard`**, **`/admin/moderation`** (listings registry alias — **нет** `/admin/listings`), **`/admin/bookings`**, **`/admin/bookings/[id]`**.
- Tables: desktop `hidden sm:block` (or `md` where already used); mobile stacked cards `sm:hidden` — Stage 176.2.
- Touch: `min-h-[44px]`; primary Approve/Reject/Save `w-full` on max-sm.
- Isolation OK: FX stale banner, Recharts, moderation Dialog/carousel, Switch rate-limit control.
- Next 5B+: users/partners/disputes/reviews/messages, then FinTech & marketing admin.

---

## Сводка

| Домен | Страниц | Finished | Pending |
|-------|--------:|---------:|--------:|
| Partner Hub | 14 | **14** | 0 |
| Storefront / Renter (+ Chat) | 29 | **27** | 2 |
| Auth & System (+ Marketing, demo) | 21 | **21** | 0 |
| Admin Panel | 52 | **5** | 47 |
| **Итого** | **116** | **67** | **49** |

**Wave 1–4 closed.** **Wave 5A (200.58):** Admin core ops started. Next → Admin users/partners/disputes (5B) or FinTech.

---

## Рекомендуемый порядок волн (Architect notes)

1. **Partner Hub** — **Done (200.53)**.
2. **Storefront critical path (Wave 2A)** — **Done (200.54)** — `/` → `/listings` → PDP → checkout → `/my-bookings`.
2b. **Guest secondary (Wave 2B)** — **Done (200.55)** — favorites, profile/wallet/settings, `/u/[id]`, reviews.
3. **Chat** (`/messages*`) — **Done (200.56)** — hall + thread; lg+ two-column preserved.
4. **Auth & marketing/legal** — **Done (200.57)** — AuthPageShell + LegalDocShell + public marketing.
5. **Admin** — **5A Done (200.58)** core ops; continue FinTech / marketing / system densest surfaces (tables → card stack `&lt;sm` per Stage 176.2).

**Замечания / долг:**

- Дубли маршрутов бронирований: `/my-bookings`, `/renter/bookings`, возможно legacy `/dashboard/*` — кандидаты на canonical redirect SSOT (не смешивать flattening с редиректом в одном PR без ADR).
- Legacy `/login` рядом с каноном `/auth/login` — зафиксировать один entry.
- Shared overlays (cancel booking, review modal, partner apply, sheets) — не `page.js`, но входят в UX-контракт; см. §5.
- Admin marketing subtree — отдельная волна (много страниц, свой layout).

---

## 1. Partner Hub

Кабинет исполнителя: `(partner)/partner/*`.

| Status | Path | Source | Notes |
|:------:|------|--------|-------|
| [x] | `/partner` | `app/(partner)/partner/page.js` | **redirect** → `/partner/dashboard` |
| [x] | `/partner/dashboard` | `…/dashboard/page.js` | **Hub Wave 1 / 200.53** |
| [x] | `/partner/listings` | `…/listings/page.js` | **Hub Wave 1 / 200.53** |
| [x] | `/partner/listings/new` | `…/listings/new/page.js` | **Wizard 200.52** |
| [x] | `/partner/listings/[id]` | `…/listings/[id]/page.js` | **Wizard 200.52** |
| [x] | `/partner/calendar` | `…/calendar/page.js` | **Hub Wave 1 / 200.53** |
| [x] | `/partner/bookings` | `…/bookings/page.js` | **Hub Wave 1 / 200.53** |
| [x] | `/partner/bookings/[bookingId]/guest-review` | `…/guest-review/page.js` | **Hub Wave 1 / 200.53** |
| [x] | `/partner/reviews` | `…/reviews/page.js` | **Hub Wave 1 / 200.53** |
| [x] | `/partner/finances` | `…/finances/page.js` | **Hub Wave 1 / 200.53** |
| [x] | `/partner/payout-profiles` | `…/payout-profiles/page.js` | **Hub Wave 1 / 200.53** |
| [x] | `/partner/promo` | `…/promo/page.js` | **Hub Wave 1 / 200.53** |
| [x] | `/partner/referrals` | `…/referrals/page.js` | **redirect** → `/profile/referral` |
| [x] | `/partner/settings` | `…/settings/page.js` | **Hub Wave 1 / 200.53** (profile analog) |

**Shell / errors:** `app/(partner)/partner/layout.js`, `app/(partner)/partner/error.jsx`, `loading.js`.

---

## 2. Storefront / Renter

Публичная витрина + кабинет заказчика: `(storefront)/*`. Чат — shared UI для renter и partner (route group `(chat)`).

### 2.1 Catalog & booking journey

| Status | Path | Source | Notes |
|:------:|------|--------|-------|
| [x] | `/` | `app/(storefront)/page.js` | **Guest Wave 2A / 200.54** (banners; listing tiles kept) |
| [x] | `/listings` | `…/listings/page.js` | **Guest Wave 2A / 200.54** (sidebar banners; ListingCard kept) |
| [x] | `/listings/[id]` | `…/listings/[id]/page.js` | **Guest Wave 2A / 200.54** (policies/host/reviews; sticky book bar kept) |
| [x] | `/checkout/[bookingId]` | `…/checkout/[bookingId]/page.js` | **Guest Wave 2A / 200.54** (methods/summary shells; sticky pay + price isolation) |
| [x] | `/bookings/[id]` | `…/bookings/[id]/page.js` | **redirect** → `/checkout/[id]` (Wave 2B) |
| [x] | `/my-bookings` | `…/my-bookings/page.js` | **Guest Wave 2A / 200.54** (login/empty; UnifiedOrderCard kept) |
| [x] | `/partner-application-success` | `…/partner-application-success/page.js` | **Guest Wave 2B / 200.55** |
| [x] | `/go/[vanity]` | `…/go/[vanity]/page.js` | **redirect** → `/u/[id]` (Wave 2B) |
| [x] | `/u/[id]` | `…/u/[id]/page.js` | **Guest Wave 2B / 200.55** (public + ambassador; review tiles isolation) |

### 2.2 Renter cabinet

| Status | Path | Source | Notes |
|:------:|------|--------|-------|
| [x] | `/renter` | `…/renter/page.js` | **redirect** → `/renter/dashboard` (Wave 2B) |
| [x] | `/renter/dashboard` | `…/renter/dashboard/page.js` | **Guest Wave 2B / 200.55** |
| [x] | `/renter/bookings` | `…/renter/bookings/page.js` | **redirect** → `/my-bookings` (Wave 2A) |
| [x] | `/renter/favorites` | `…/renter/favorites/page.js` | **Guest Wave 2B / 200.55** (ListingCard kept) |
| [x] | `/renter/reviews/new` | `…/renter/reviews/new/page.js` | **Guest Wave 2B / 200.55** (gate Cards; ReviewModal kept) |
| [x] | `/renter/profile` | `…/renter/profile/page.js` | **Guest Wave 2B / 200.55** |
| [x] | `/renter/settings` | `…/renter/settings/page.jsx` | **Guest Wave 2B / 200.55** |

### 2.3 Profile / wallet / settings (storefront)

| Status | Path | Source | Notes |
|:------:|------|--------|-------|
| [x] | `/profile` | `…/profile/page.js` | **Guest Wave 2B / 200.55** |
| [x] | `/profile/wallet` | `…/profile/wallet/page.js` | **Guest Wave 2B / 200.55** (sticky withdraw isolation) |
| [x] | `/profile/status` | `…/profile/status/page.js` | **Guest Wave 2B / 200.55** |
| [x] | `/profile/referral` | `…/profile/referral/page.js` | **Guest Wave 2B / 200.55** (MarketingKit export canvas kept) |
| [x] | `/settings` | `…/settings/page.js` | **Guest Wave 2B / 200.55** |

### 2.4 Legacy / role routers (storefront)

| Status | Path | Source | Notes |
|:------:|------|--------|-------|
| [ ] | `/dashboard` | `…/dashboard/page.js` | Role-based redirect |
| [ ] | `/dashboard/renter` | `…/dashboard/renter/page.js` | Legacy renter entry |
| [x] | `/login` | `…/login/page.js` | **redirect** → `/auth/login` (Wave 4) |
| [x] | `/reset-password` | `…/reset-password/page.js` | **Auth Wave 4 / 200.57** |

### 2.5 Chat (shared)

| Status | Path | Source | Notes |
|:------:|------|--------|-------|
| [x] | `/messages` | `app/(chat)/messages/page.js` | **Chat Wave 3 / 200.56** (shell flat; list rows kept) |
| [x] | `/messages/archived` | `…/messages/archived/page.js` | **Chat Wave 3 / 200.56** |
| [x] | `/messages/[id]` | `…/messages/[id]/page.js` | **Chat Wave 3 / 200.56** (lg+ two-col; composer safe-area) |
| [x] | `/chat/[id]` | `app/(chat)/chat/[id]/page.js` | **redirect** → `/messages/[id]` (Wave 3) |

**Shell / errors:** storefront `layout.js`, listings `error.jsx`, chat `layout.js`.

---

## 3. Auth & System

Auth (`app/auth/*`), marketing/legal (`(marketing)/*`), demo/internal, global error surfaces.

### 3.1 Auth

| Status | Path | Source | Notes |
|:------:|------|--------|-------|
| [x] | `/auth/login` | `app/auth/login/page.js` | **Auth Wave 4 / 200.57** (`AuthPageShell`) |
| [x] | `/auth/register` | `…/register/page.js` | **Auth Wave 4 / 200.57** |
| [x] | `/auth/forgot-password` | `…/forgot-password/page.js` | **Auth Wave 4 / 200.57** |
| [x] | `/auth/verify-email` | `…/verify-email/page.js` | **Auth Wave 4 / 200.57** |
| [x] | `/auth/complete-legal` | `…/complete-legal/page.js` | **Auth Wave 4 / 200.57** |
| [x] | `/auth/link-conflict` | `…/link-conflict/page.js` | **Auth Wave 4 / 200.57** (OTP nest flat) |
| [x] | `/auth/oauth-error` | `…/oauth-error/page.js` | **Auth Wave 4 / 200.57** (no card chrome) |

### 3.2 Marketing & legal (public)

| Status | Path | Source | Notes |
|:------:|------|--------|-------|
| [x] | `/about` | `app/(marketing)/about/page.js` | **Auth Wave 4 / 200.57** |
| [x] | `/about/loyalty` | `…/about/loyalty/page.js` | **Auth Wave 4 / 200.57** |
| [x] | `/about/referral` | `…/about/referral/page.js` | **Auth Wave 4 / 200.57** |
| [x] | `/help` | `…/help/page.js` | **Auth Wave 4 / 200.57** |
| [x] | `/help/escrow-protection` | `…/help/escrow-protection/page.js` | **Auth Wave 4 / 200.57** |
| [x] | `/terms` | `…/terms/page.js` | **Auth Wave 4 / 200.57** (CTA-only; no box shell) |
| [x] | `/legal/public-offer` | `…/legal/public-offer/page.js` | **Auth Wave 4 / 200.57** (`LegalDocShell`) |
| [x] | `/legal/privacy` | `…/legal/privacy/page.js` | **Auth Wave 4 / 200.57** |
| [x] | `/legal/refund` | `…/legal/refund/page.js` | **Auth Wave 4 / 200.57** |
| [x] | `/legal/partner-terms` | `…/legal/partner-terms/page.js` | **Auth Wave 4 / 200.57** |

### 3.3 Demo / internal (non-prod UX)

| Status | Path | Source | Notes |
|:------:|------|--------|-------|
| [x] | `/demo/price-breakdown` | `app/demo/price-breakdown/page.js` | **exclude** from product flatten (Wave 4) |
| [x] | `/test-db` | `app/test-db/page.js` | **exclude** / gate — out of Wave 4 |

---

## 4. Admin Panel

Staff: `app/admin/*` (52 pages). Flatten last; prefer card-stack `&lt;md` for tables (Stage 176.2).

### 4.1 Core ops

| Status | Path | Source | Notes |
|:------:|------|--------|-------|
| [x] | `/admin` | `app/admin/page.js` | **Admin Wave 5A / 200.58** |
| [x] | `/admin/dashboard` | `…/dashboard/page.js` | **Admin Wave 5A / 200.58** |
| [x] | `/admin/moderation` | `…/moderation/page.js` | **Admin Wave 5A / 200.58** (listings registry) |
| [ ] | `/admin/users` | `…/users/page.js` | Users list |
| [ ] | `/admin/users/[id]` | `…/users/[id]/page.js` | User detail |
| [ ] | `/admin/partners` | `…/partners/page.js` | Partners list |
| [ ] | `/admin/partners/[id]` | `…/partners/[id]/page.js` | Partner detail |
| [x] | `/admin/bookings` | `…/bookings/page.jsx` | **Admin Wave 5A / 200.58** |
| [x] | `/admin/bookings/[id]` | `…/bookings/[id]/page.jsx` | **Admin Wave 5A / 200.58** (table↔cards) |
| [ ] | `/admin/disputes` | `…/disputes/page.js` | Disputes |
| [ ] | `/admin/reviews` | `…/reviews/page.js` | Reviews moderation |
| [ ] | `/admin/categories` | `…/categories/page.js` | Categories |
| [ ] | `/admin/waitlist` | `…/waitlist/page.js` | Waitlist |
| [ ] | `/admin/locations/suggestions` | `…/locations/suggestions/page.js` | Geo suggestions |
| [ ] | `/admin/messages` | `…/messages/page.js` | Staff messages |
| [ ] | `/admin/messages/[id]` | `…/messages/[id]/page.js` | Staff thread |

### 4.2 Finance / FinTech

| Status | Path | Source | Notes |
|:------:|------|--------|-------|
| [ ] | `/admin/finances` | `…/finances/page.js` | Finances hub |
| [ ] | `/admin/financial-health` | `…/financial-health/page.jsx` | Financial health |
| [ ] | `/admin/finance/intelligence` | `…/finance/intelligence/page.js` | Intelligence |
| [ ] | `/admin/finance/intelligence/bookings/[id]` | `…/bookings/[id]/page.js` | Booking financial timeline |
| [ ] | `/admin/payout-methods` | `…/payout-methods/page.js` | Payout methods |
| [ ] | `/admin/payout-verification` | `…/payout-verification/page.jsx` | Payout verification |
| [ ] | `/admin/settings/finances` | `…/settings/finances/page.jsx` | FinTech settings |

### 4.3 Marketing / growth admin

| Status | Path | Source | Notes |
|:------:|------|--------|-------|
| [ ] | `/admin/marketing` | `…/marketing/page.js` | Marketing hub |
| [ ] | `/admin/marketing/settings` | `…/settings/page.js` | Marketing settings |
| [ ] | `/admin/marketing/campaigns` | `…/campaigns/page.js` | Campaigns |
| [ ] | `/admin/marketing/campaigns/[slug]` | `…/campaigns/[slug]/page.js` | Campaign detail |
| [ ] | `/admin/marketing/promos` | `…/promos/page.js` | Promos |
| [ ] | `/admin/marketing/rules` | `…/rules/page.js` | Rules |
| [ ] | `/admin/marketing/reward-rules` | `…/reward-rules/page.js` | Reward rules |
| [ ] | `/admin/marketing/attribution` | `…/attribution/page.js` | Attribution |
| [ ] | `/admin/marketing/analytics` | `…/analytics/page.js` | Analytics |
| [ ] | `/admin/marketing/budget` | `…/budget/page.js` | Budget |
| [ ] | `/admin/marketing/payouts` | `…/payouts/page.js` | Marketing payouts |
| [ ] | `/admin/marketing/referral-payouts` | `…/referral-payouts/page.js` | Referral payouts |
| [ ] | `/admin/marketing/fraud-queue` | `…/fraud-queue/page.js` | Fraud queue |
| [ ] | `/admin/marketing/roi` | `…/roi/page.js` | ROI |
| [ ] | `/admin/marketing/roi/[campaignSlug]` | `…/roi/[campaignSlug]/page.js` | ROI by campaign |
| [ ] | `/admin/marketing/audit` | `…/audit/page.js` | Marketing audit |
| [ ] | `/admin/marketing/wallet-audit` | `…/wallet-audit/page.js` | Wallet audit |

### 4.4 System / security / compliance

| Status | Path | Source | Notes |
|:------:|------|--------|-------|
| [ ] | `/admin/system` | `…/system/page.js` | System hub |
| [ ] | `/admin/system/ai` | `…/system/ai/page.js` | AI system |
| [ ] | `/admin/system/ical` | `…/system/ical/page.js` | iCal ops |
| [ ] | `/admin/system/ical/logs` | `…/system/ical/logs/page.js` | iCal logs |
| [ ] | `/admin/ai-usage` | `…/ai-usage/page.js` | AI usage |
| [ ] | `/admin/security` | `…/security/page.js` | Security |
| [ ] | `/admin/health` | `…/health/page.jsx` | Health |
| [ ] | `/admin/marketplace-health` | `…/marketplace-health/page.js` | Marketplace health |
| [ ] | `/admin/audit` | `…/audit/page.jsx` | Audit log |
| [ ] | `/admin/audit-export` | `…/audit-export/page.js` | Audit export |
| [ ] | `/admin/privacy/erasure` | `…/privacy/erasure/page.jsx` | GDPR erasure |
| [ ] | `/admin/settings` | `…/settings/page.js` | Admin settings |
| [ ] | `/admin/settings/legal` | `…/settings/legal/page.js` | Legal docs admin |
| [ ] | `/admin/test-db` | `…/test-db/page.js` | Dev — gate / skip product wave |

**Shell / errors:** `app/admin/layout.js`, `app/admin/error.jsx`, `app/admin/marketing/layout.js`.

---

## 5. Shared overlays (не page routes)

Не входят в счётчик 116, но обязательны для UX SSOT при flattening родительских экранов:

| Surface | Typical host | Notes |
|---------|--------------|-------|
| Cancel booking dialog | Renter bookings / cards | `components/renter/cancel-booking-dialog.jsx` |
| Review modal | Orders / my-bookings | `components/review-modal` |
| Partner application modal | Renter / storefront | `components/renter/PartnerApplicationModal.jsx` |
| Chat deal sheets | Messages thread | e.g. `ThreadDealDetailsSheet` — bottom-sheet + `dvh` |
| Unified order card actions | Partner + renter orders | `components/orders/UnifiedOrderCard.jsx` |
| Global Dialog / Sheet primitives | All | `components/ui/dialog.jsx`, `sheet.jsx` |

При волне: overlays наследуют **один** mobile sheet pattern; не плодить вторые статусные матрицы вне `toUnifiedOrder`.

---

## 6. Как вести этот файл

1. Новая `app/**/page.*` → добавить строку в нужный домен в том же PR.
2. Закрыта flatten-волна → `[x]` + Stage id в Notes.
3. Redirect-only / router pages можно помечать `Notes: redirect-only` и не тратить visual polish.
4. Dev (`/test-db`, `/admin/test-db`, `/demo/*`) — не смешивать с product KPI волн.

---

## 7. Связанные документы

| Doc | Role |
|-----|------|
| [`TECHNICAL_MANIFESTO.md`](./TECHNICAL_MANIFESTO.md) | Code-truth; Stage 200.52 tokens |
| [`SYSTEM_MAP.md`](./SYSTEM_MAP.md) | Routes / APIs passport |
| [`PRODUCT_FLOW_MAP.md`](./PRODUCT_FLOW_MAP.md) | Product flow + backlog |
| [`lib/ui/mobile-flat-canvas.js`](../lib/ui/mobile-flat-canvas.js) | Mobile-flat class SSOT |
