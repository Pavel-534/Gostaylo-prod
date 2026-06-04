# Product UI System (Stage 115.0–115.4, 129.0)

**Цель:** единое ощущение продукта (не «набор модулей») без смены бизнес-логики и API.

## SSOT

| Слой | Путь |
|------|------|
| **Design tokens (Stage 129.0)** | **`lib/theme/tokens.ts`** (typed API) + **`lib/theme/tokens.cjs`** (Tailwind / Node bridge) |
| **Display name (white-label)** | **`lib/site-url.js`** → **`getSiteDisplayName()`** (`NEXT_PUBLIC_SITE_NAME` / `SITE_DISPLAY_NAME`); CJS bridge **`lib/site-brand.cjs`** |
| Токены (hex, legacy) | `lib/theme/product-ui.js`, `lib/theme/constants.js` (email) |
| CSS utilities | `app/globals.css` — классы `.gsl-*` (token-based с 129.0) |
| Tailwind | `tailwind.config.js` — `brand`, `brand-mint`, `brand-navy`, shadows |
| Шрифты | `lib/theme/font-stack.cjs` — `var(--font-sans)` первым; Inter в `app/layout.js` |
| Кнопка | `components/ui/button.jsx` — `variant="brand"` |
| Оболочки | `components/product/*` |

## Design Tokens (Stage 129.0)

Единый источник визуальных значений для Figma ↔ код:

| Группа | Ключи | Пример |
|--------|-------|--------|
| `colors.brand` | `DEFAULT`, `hover`, `surface`, `muted`, `mint`, `navy` | `#006666`, `#0D9488`, `#0F172A` |
| `colors.text` | `DEFAULT`, `muted`, `subtle`, `inverse` | slate-scale semantic |
| `colors.surface` | `DEFAULT`, `canvas`, `elevated` | white / `#f7f9fb` |
| `spacing` | Tailwind-compatible scale | `4` → `1rem` |
| `radii` | `sm` … `full` + shadcn `--radius` | `rounded-2xl` = 16px product standard |
| `shadows` | `brand-sm`, `brand-md`, … | brand-tinted elevation |
| `typography` | `fontSize`, `fontWeight`, `letterSpacing` | section titles via `product-ui.js` |
| `cssVars.primary` | HSL для shadcn | `180 100% 20%` (= brand `#006666`) |

**Tailwind classes:** `bg-brand`, `bg-brand-surface`, `bg-brand-muted`, `text-brand`, `hover:bg-brand-hover`, `bg-brand-mint`, `text-brand-navy`, `shadow-brand`, `shadow-brand-sm`.

**Правило:** новые цвета — только в `tokens.cjs` → re-export в `tokens.ts` → `toTailwindExtend()` в конфиге.

### Экспорт для Figma (Stage 129.2)

```bash
npm run export-tokens
```

- Скрипт: `scripts/export-figma-tokens.mjs`
- Выход: **`docs/design-tokens.json`** (colors, spacing, radii, shadows, typography + `meta`)
- Импорт: Figma Tokens / Variables plugin — привязать к Tailwind-классам из таблицы выше
- **Имя бренда** в JSON **нет** — white-label через `NEXT_PUBLIC_SITE_NAME` (`lib/site-url.js`)

## Классы `.gsl-*`

| Класс | Назначение |
|-------|------------|
| `gsl-page` | Фон `brand-surface`, min-height экрана |
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

## Stage 129.2 — Design System Completion (UI-1 + Figma export)

| Область | Изменения |
|---------|-----------|
| Figma | `npm run export-tokens` → `docs/design-tokens.json` |
| UI-1 | §1.3 audit files — arbitrary `#006666` / `#f7f9fb` / `#005555` → `brand` tokens |
| Остаток | `airento-logo.jsx` SVG, hero radial gradient rgba, partner `teal-*` bulk, FinTech inline → UI-2+ |

## Stage 129.1 — Emergency brand SSOT fix

| Область | Изменения |
|---------|-----------|
| Regression | Stage 129.0 accidentally hardcoded «Airento» in `tailwind.config.js` comment |
| Fix | `lib/site-brand.cjs` — CJS bridge for `getSiteDisplayName()`; neutral Tailwind comment |
| Rule | **Display name** → `lib/site-url.js`; **visual tokens** → `lib/theme/tokens.*` — never mix |

## Stage 129.0 — Design System Foundation (UI-0)

| Область | Изменения |
|---------|-----------|
| Tokens SSOT | `lib/theme/tokens.ts` + `tokens.cjs` — colors, spacing, radii, shadows, typography |
| Tailwind | Neutral palette comment + `lib/site-brand.cjs` SSOT pointers; `brand.mint` / `brand.navy`; token shadows; Inter via `var(--font-sans)` |
| globals.css | `--primary` HSL = brand `#006666`; `.gsl-*` без hardcoded hex |
| Cursor rules | `.cursorrules` — UI / Design System Rules (Stage 129+) |
| Audit | `docs/proposals/UI_SSOT_AUDIT.md` — baseline for UI-1+ |

**Не в scope 129.0:** partner `teal-*` bulk, FinTech inline styles → **UI-2+** (UI-1 закрыт в 129.2).

## Не менять в этом слое

- Формулы pricing, referral, escrow, payout  
- Контракты `app/api/**`  
- Поведение cron / smoke assertions
