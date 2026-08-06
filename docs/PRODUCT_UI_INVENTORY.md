# Product UI Inventory — экраны App Router

> **Version**: 1.1.0 | **Updated**: 2026-08-06 | **Source**: `app/**/page.{js,jsx}` (116 route pages)  
> **Purpose:** SSOT-инвентаризация UI-страниц перед волнами **mobile-flat** / product UI unification (после Stage **200.52**).  
> **Tokens:** [`lib/ui/mobile-flat-canvas.js`](../lib/ui/mobile-flat-canvas.js) (`MOBILE_FLAT_*`) · product shell — `components/product/*` · [`PRODUCT_UI_SYSTEM.md`](./PRODUCT_UI_SYSTEM.md).  
> **Не путать с API:** маршруты `app/api/**` сюда не входят.

---

## Легенда статуса дизайна

| Маркер | Значение |
|--------|----------|
| `[x] Finished (Wizard 200.52)` | Mobile-flat на listing wizard create/edit |
| `[x] Finished (Hub Wave 1 / 200.53)` | Partner Hub page mobile-flat (nesting ≤1 on `&lt;sm`) |
| `[ ] Pending Flattening` | Нужен рефактор под mobile-flat / единый product shell |
| `redirect` | Нет UI — только redirect; не входит в visual polish |

**Правило обновления:** после закрытия волны flattening — перенести строки в `[x]` и указать Stage в «Notes».

**Уточнения ТЗ (Wave 1):**

- **`/partner/profile` не существует** — профиль партнёра = `/partner/settings` (+ avatar в sidebar).
- **`/partner`** и **`/partner/referrals`** — redirect-only (`→ /partner/dashboard`, `→ /profile/referral`); помечаются `redirect`, не visual flatten.
- Токены SSOT: [`lib/ui/mobile-flat-canvas.js`](../lib/ui/mobile-flat-canvas.js) — канон **`MOBILE_FLAT_*`** (алиасы `WIZARD_MOBILE_FLAT_*` для wizard).
- Shell `WORKSPACE_SCROLL` уже даёт `p-4` — на страницах не дублировать лишний gutter на `&lt;sm`.
- Isolation OK (1 уровень): alerts/banners (KYC, pin-conflict, amber), map, earnings math, interactive list separators (`border-b`), sheets/dialogs.

---

## Сводка

| Домен | Страниц | Finished | Pending |
|-------|--------:|---------:|--------:|
| Partner Hub | 14 | **14** | 0 |
| Storefront / Renter (+ Chat) | 29 | 0 | 29 |
| Auth & System (+ Marketing, demo) | 21 | 0 | 21 |
| Admin Panel | 52 | 0 | 52 |
| **Итого** | **116** | **14** | **102** |

**Wave 1 (Stage 200.53):** Partner Hub closed. Next → Storefront critical path (Wave 2).

---

## Рекомендуемый порядок волн (Architect notes)

1. **Partner Hub** — **Done (200.53)**.
2. **Storefront critical path** — `/` → `/listings` → PDP → checkout → `/my-bookings` / renter dashboard (Airbnb-style: guest journey first).
3. **Chat** (`/messages*`) — shared shell; один раз для renter + partner.
4. **Auth & marketing/legal** — проще, но влияют на first impression и compliance.
5. **Admin** — densest surface; flatten постепенно (tables → card stack `&lt;md` per Stage 176.2), не блокировать guest/partner.

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
| [ ] | `/` | `app/(storefront)/page.js` | Home / discovery |
| [ ] | `/listings` | `…/listings/page.js` | Search / catalog |
| [ ] | `/listings/[id]` | `…/listings/[id]/page.js` | PDP |
| [ ] | `/checkout/[bookingId]` | `…/checkout/[bookingId]/page.js` | Checkout / pay |
| [ ] | `/bookings/[id]` | `…/bookings/[id]/page.js` | Booking detail (guest) |
| [ ] | `/my-bookings` | `…/my-bookings/page.js` | Orders list (canonical guest?) |
| [ ] | `/partner-application-success` | `…/partner-application-success/page.js` | Post-apply success |
| [ ] | `/go/[vanity]` | `…/go/[vanity]/page.js` | Referral / vanity landing |
| [ ] | `/u/[id]` | `…/u/[id]/page.js` | Public profile |

### 2.2 Renter cabinet

| Status | Path | Source | Notes |
|:------:|------|--------|-------|
| [ ] | `/renter` | `…/renter/page.js` | Redirect → dashboard |
| [ ] | `/renter/dashboard` | `…/renter/dashboard/page.js` | Renter home |
| [ ] | `/renter/bookings` | `…/renter/bookings/page.js` | Likely overlap with `/my-bookings` |
| [ ] | `/renter/favorites` | `…/renter/favorites/page.js` | Favorites |
| [ ] | `/renter/reviews/new` | `…/renter/reviews/new/page.js` | Leave review |
| [ ] | `/renter/profile` | `…/renter/profile/page.js` | Profile |
| [ ] | `/renter/settings` | `…/renter/settings/page.jsx` | Settings |

### 2.3 Profile / wallet / settings (storefront)

| Status | Path | Source | Notes |
|:------:|------|--------|-------|
| [ ] | `/profile` | `…/profile/page.js` | Profile hub |
| [ ] | `/profile/wallet` | `…/profile/wallet/page.js` | Wallet |
| [ ] | `/profile/status` | `…/profile/status/page.js` | Status / tiers |
| [ ] | `/profile/referral` | `…/profile/referral/page.js` | Guest referral |
| [ ] | `/settings` | `…/settings/page.js` | Account settings |

### 2.4 Legacy / role routers (storefront)

| Status | Path | Source | Notes |
|:------:|------|--------|-------|
| [ ] | `/dashboard` | `…/dashboard/page.js` | Role-based redirect |
| [ ] | `/dashboard/renter` | `…/dashboard/renter/page.js` | Legacy renter entry |
| [ ] | `/login` | `…/login/page.js` | Legacy vs `/auth/login` |
| [ ] | `/reset-password` | `…/reset-password/page.js` | Password reset (storefront shell) |

### 2.5 Chat (shared)

| Status | Path | Source | Notes |
|:------:|------|--------|-------|
| [ ] | `/messages` | `app/(chat)/messages/page.js` | Inbox |
| [ ] | `/messages/archived` | `…/messages/archived/page.js` | Archived |
| [ ] | `/messages/[id]` | `…/messages/[id]/page.js` | Thread |
| [ ] | `/chat/[id]` | `app/(chat)/chat/[id]/page.js` | Legacy/alternate thread URL? |

**Shell / errors:** storefront `layout.js`, listings `error.jsx`, chat `layout.js`.

---

## 3. Auth & System

Auth (`app/auth/*`), marketing/legal (`(marketing)/*`), demo/internal, global error surfaces.

### 3.1 Auth

| Status | Path | Source | Notes |
|:------:|------|--------|-------|
| [ ] | `/auth/login` | `app/auth/login/page.js` | Canonical login |
| [ ] | `/auth/register` | `…/register/page.js` | Register |
| [ ] | `/auth/forgot-password` | `…/forgot-password/page.js` | Forgot password |
| [ ] | `/auth/verify-email` | `…/verify-email/page.js` | Email verify |
| [ ] | `/auth/complete-legal` | `…/complete-legal/page.js` | Legal acceptance gate |
| [ ] | `/auth/link-conflict` | `…/link-conflict/page.js` | OAuth/link conflict |
| [ ] | `/auth/oauth-error` | `…/oauth-error/page.js` | OAuth error |

### 3.2 Marketing & legal (public)

| Status | Path | Source | Notes |
|:------:|------|--------|-------|
| [ ] | `/about` | `app/(marketing)/about/page.js` | About |
| [ ] | `/about/loyalty` | `…/about/loyalty/page.js` | Loyalty |
| [ ] | `/about/referral` | `…/about/referral/page.js` | Referral program |
| [ ] | `/help` | `…/help/page.js` | Help center |
| [ ] | `/help/escrow-protection` | `…/help/escrow-protection/page.js` | Escrow explainer |
| [ ] | `/terms` | `…/terms/page.js` | Terms |
| [ ] | `/legal/public-offer` | `…/legal/public-offer/page.js` | Public offer |
| [ ] | `/legal/privacy` | `…/legal/privacy/page.js` | Privacy |
| [ ] | `/legal/refund` | `…/legal/refund/page.js` | Refund policy |
| [ ] | `/legal/partner-terms` | `…/legal/partner-terms/page.js` | Partner terms |

### 3.3 Demo / internal (non-prod UX)

| Status | Path | Source | Notes |
|:------:|------|--------|-------|
| [ ] | `/demo/price-breakdown` | `app/demo/price-breakdown/page.js` | Pricing demo |
| [ ] | `/test-db` | `app/test-db/page.js` | Dev DB check — **exclude from product flatten waves** or gate |

---

## 4. Admin Panel

Staff: `app/admin/*` (52 pages). Flatten last; prefer card-stack `&lt;md` for tables (Stage 176.2).

### 4.1 Core ops

| Status | Path | Source | Notes |
|:------:|------|--------|-------|
| [ ] | `/admin` | `app/admin/page.js` | Admin entry |
| [ ] | `/admin/dashboard` | `…/dashboard/page.js` | Dashboard |
| [ ] | `/admin/moderation` | `…/moderation/page.js` | Listing moderation |
| [ ] | `/admin/users` | `…/users/page.js` | Users list |
| [ ] | `/admin/users/[id]` | `…/users/[id]/page.js` | User detail |
| [ ] | `/admin/partners` | `…/partners/page.js` | Partners list |
| [ ] | `/admin/partners/[id]` | `…/partners/[id]/page.js` | Partner detail |
| [ ] | `/admin/bookings` | `…/bookings/page.jsx` | Bookings list |
| [ ] | `/admin/bookings/[id]` | `…/bookings/[id]/page.jsx` | Booking detail |
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
