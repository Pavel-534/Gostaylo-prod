# Product UI System (Stage 115.0–115.4)

**Цель:** единое ощущение продукта (не «набор модулей») без смены бизнес-логики и API.

## SSOT

| Слой | Путь |
|------|------|
| Токены (hex) | `lib/theme/product-ui.js`, `lib/theme/constants.js` |
| CSS utilities | `app/globals.css` — классы `.gsl-*` |
| Tailwind | `tailwind.config.js` — `brand`, `brand-hover`, `brand-surface` |
| Кнопка | `components/ui/button.jsx` — `variant="brand"` |
| Оболочки | `components/product/*` |

## Классы `.gsl-*`

| Класс | Назначение |
|-------|------------|
| `gsl-page` | Фон `#f7f9fb`, min-height экрана |
| `gsl-page-container` | Контейнер профиля/хаба (max-w-6xl, отступы) |
| `gsl-card` | Карточка: border, shadow-sm, rounded-xl |
| `gsl-card-hover` | Hover shadow для интерактивных карточек |
| `gsl-hub-nav` | Полоска Profile Hub (referral / wallet / status) |
| `gsl-nav-item-active` / `gsl-nav-item-idle` | Пункты sidebar partner/renter |
| `gsl-btn-brand` | Первичная CTA (дублирует `variant="brand"`) |
| `gsl-shimmer` | Skeleton shimmer overlay |
| `GSL_FINTECH_HERO_GRADIENT` | FinTech console dark hero (`from-brand via-brand-hover`) |
| `GSL_BRAND_SHADOW_*` | Brand-tinted shadows для иллюстраций и hover-карточек |

## Компоненты `components/product/`

| Компонент | Где используется |
|-----------|------------------|
| `ProductPageShell` | `/profile/referral`, `/profile/wallet`, `/profile/status` |
| `ProfileHubNav` | Тот же хаб — единая навигация |
| `PageSectionHeader` | Заголовок + подзаголовок секции |
| `LoadingPageShell` | Единый loading (spinner + card); partner finances/calendar — `variant="inline"` |
| `GuestBookingFlowHint` | PDP, checkout, messages hall + thread sidebar (guest) |
| `MessagesAuthGate` | `/messages`, `/messages/[id]` loading & sign-in |

## Stage 115.1 — мигрированные экраны

| Экран | Изменения |
|-------|-----------|
| Главная | `HomeHeroLuxe`, `TopListingsGrid`, `StickySearchBar`, loyalty strip → `brand` |
| Messages | `MessagesAuthGate`, `GuestBookingFlowHint`, `ConversationList` → `brand` |
| Partner dashboard | `PageSectionHeader`, KPI cards, skeleton `gsl-shimmer` |
| PDP | `ListingPageNav` blur, skeleton shimmer, flow hint |
| Header | `AppHeader` public nav → `brand` |
| Empty state | `Button variant="brand"` |

## Пользовательские пути (cohesion)

1. **Гость:** listings → PDP (flow hint) → messages (hint) → checkout (flow hint) → renter/bookings  
2. **Партнёр:** `partner/layout` sidebar + `brand-surface` + `gsl-nav-item-*`  
3. **Рефералка:** Profile Hub nav на всех трёх страницах + `ProductPageShell`  
4. **FinTech:** `AdminFinTechConsole` на `brand-surface` gradient  
5. **Mobile:** `MobileBottomNav` — active `text-brand` / `bg-brand/10`

## i18n

Ключи `stage115_*` в `lib/translations/slices/product-ui.js` (мерж через `profile-app.js`).

## Правила для новых экранов

- Фон страницы: `gsl-page` или `ProductPageShell`
- Primary CTA: `Button variant="brand"`
- Акцентный текст/иконки: `text-brand`, не произвольный `#006666`
- Loading: `LoadingPageShell` или skeleton с `gsl-shimmer`
- Empty: `components/empty-state.jsx` или `ReferralEmptyState` для referral-контекста

## Stage 115.2 — глубокая миграция (referral, partner, search, admin)

| Область | Изменения |
|---------|-----------|
| Referral (`components/referral/*`) | `#006666` / `teal-*` → `brand` / `brand-hover` / `brand/10`; CTA → `variant="brand"`; `/u/[id]` skeleton → `gsl-shimmer` |
| Partner finances | `PageSectionHeader`, `LoadingPageShell`, finance cards/strips → brand tokens; withdraw dialog → `variant="brand"` |
| Partner calendar | `LoadingPageShell`, CTA → `variant="brand"`, hint banners → `brand/10` |
| Partner layout | Sidebar/breadcrumbs/loading → `brand`; active nav icon `text-brand` |
| Search | `UnifiedSearchBar`, `FilterBar`, `WhereCombobox`, `MobileSearchBottomSheet`, `SearchFiltersDialog` → brand tokens |
| Admin (referral panels) | `ReferralPayoutWorkflowPanel`, `ReferralLiabilityPanel`, dispute peek/timeline → brand |
| Partner dashboard widgets | `RevenueSparkline` → `BRAND_CHART_HEX`; welcome modal gradient → `brand` |

## Stage 115.3 — финальная миграция Design System

| Область | Изменения |
|---------|-----------|
| Home marketing | `HowItWorks`, `TrustBar`, `PartnerCTA`, `StickySearchBar`, footer links → `brand` / `variant="brand"` |
| Empty states | `empty-state.jsx`, `FinTechEmptyState` → brand rings + `GSL_BRAND_SHADOW_*` |
| FinTech hero | `FinTechConsoleHeader` → `GSL_FINTECH_HERO_GRADIENT`, white/opacity tints |
| FinTech panels | Оставшиеся `teal-*` в admin finances → brand tokens |
| Chat thread | `ChatThreadChrome`, composer (`VoiceRecorder`, `QuickReplies`), `ChatTransportUpsell`, headers → brand |
| Partner calendar | `Calendar*`, `calendar-sync-manager`, `seasonal-price-manager`, `PartnerCalendarEducationCard` |
| Referral `/u/[id]` | Hero subtitle/stats → `text-white/*` на brand gradient |

## Stage 115.4 — long tail & final cohesion

| Область | Изменения |
|---------|-----------|
| Auth modals | `LoginForm`, `RegisterForm`, `PasswordResetForm`, `AuthModalShell` → brand + `variant="brand"` |
| Legal | `legal-doc-shell` → `bg-brand-surface`; consent/terms links → brand |
| Renter profile | `LoadingPageShell`, partner application CTA → `variant="brand"` |
| PDP booking | `BookingWidget`, `BookingActionButtons`, `BookingModal` → `variant="brand"` |
| Orders | Cards, timeline, filters, help dialogs → brand + `variant="brand"` |
| Long tail (~80 files) | Оставшиеся `teal-*` / `#006666` в `components/**` → brand tokens |

**Остаток (намеренно):** `airento-logo.jsx` (SVG `#006666`), hero depth `to-teal-900`, комментарии в `AppHeader`.

## Не менять в этом слое

- Формулы pricing, referral, escrow, payout  
- Контракты `app/api/**`  
- Поведение cron / smoke assertions
