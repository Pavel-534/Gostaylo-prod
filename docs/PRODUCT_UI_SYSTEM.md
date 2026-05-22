# Product UI System (Stage 115.0 / 115.1)

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

## Компоненты `components/product/`

| Компонент | Где используется |
|-----------|------------------|
| `ProductPageShell` | `/profile/referral`, `/profile/wallet`, `/profile/status` |
| `ProfileHubNav` | Тот же хаб — единая навигация |
| `PageSectionHeader` | Заголовок + подзаголовок секции |
| `LoadingPageShell` | Единый loading (spinner + card) |
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

## Не менять в этом слое

- Формулы pricing, referral, escrow, payout  
- Контракты `app/api/**`  
- Поведение cron / smoke assertions
