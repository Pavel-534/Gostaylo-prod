# UI/UX SSOT Audit — Design System & Visual Layer

**Status:** UI-0 + UI-1 complete (Stage 129.0–129.2) — foundation closed before MIR pause  
**Date:** 2026-06-01 (updated 129.2)  
**Context:** Stage 128.4 — RQ foundation closed, PAUSE until MIR. Visual layer audit as **Stage 129 proposal** (UI-SSOT).  
**Reference:** `docs/PRODUCT_UI_SYSTEM.md` (Stage 115.0–115.4), `lib/theme/product-ui.js`, `tailwind.config.js`

---

## Executive summary

| Область | Оценка | Комментарий |
|---------|--------|-------------|
| **Токены цвета** | 🟡 6/10 | Три параллельных палитры (product `brand`, email `primary`, FinTech Mint/Navy); Mint/Navy **не** в `tailwind.config.js` |
| **UI-примитивы** | 🟢 7/10 | shadcn/ui полный набор; `Button`/`Input`/`Select`/`Skeleton` есть; ~140+ файлов на `Button`, но ~60 всё ещё с сырым `<button>` |
| **Типографика** | 🟡 5/10 | Inter подключён, но **не** привязан к `font-sans` в Tailwind; иерархия заголовков частично в `product-ui.js`, частично ad-hoc |
| **Spacing** | 🟢 8/10 | Стандартная шкала Tailwind; произвольные `p-[13px]` почти нет |
| **Storybook** | 🔴 0/10 | Не установлен |
| **Док SSOT** | 🟢 8/10 | `PRODUCT_UI_SYSTEM.md` + Stage 115 — хорошая база, не enforced в CI/rules |

**Контекст:** Stage 115.0–115.4 уже дала сильный фундамент (`brand`, `.gsl-*`, `variant="brand"`). Публичная витрина и referral-hub заметно чище, чем partner/admin legacy. Цель — довести до уровня Airbnb/Stripe: **один слой токенов → один слой примитивов → паттерны → страницы**.

---

## 1. Аудит `tailwind.config.js` и токенов

### 1.1 Что есть сейчас

`tailwind.config.js`:

- **`brand`:** `DEFAULT #006666`, `hover #005757`, `surface #f7f9fb`, `muted #e6f4f3`
- **`teal-*`:** полная шкала Tailwind (дублирует смысл `brand`)
- **shadcn semantic:** `primary`, `muted`, `border`… через CSS variables в `app/globals.css`
- **`azure-*`:** legacy, почти не используется в product UI

SSOT-документ: `docs/PRODUCT_UI_SYSTEM.md` → `lib/theme/product-ui.js`, `lib/theme/constants.js`.

### 1.2 Mint / Navy — где живут и чего нет

| Токен | Значение | SSOT-файл | В Tailwind? |
|-------|----------|-----------|-------------|
| Product brand | `#006666` | `lib/theme/product-ui.js` → `brand` | ✅ `brand` |
| Email / viewport | `#0d9488` | `lib/theme/constants.js` → `primary` | ❌ (только `--primary` HSL ≈ teal) |
| FinTech Mint | `#0D9488` | `lib/admin/fintech-console-shared.js` | ❌ |
| FinTech Navy | `#0F172A` | `lib/admin/fintech-console-shared.js` | ❌ (≈ `slate-900`, но не alias) |

**`brand-mint` / `brand-navy` в конфиге нет.** FinTech использует inline `style={{ color: NAVY, backgroundColor: MINT }}` — обход Tailwind.

**Примеры отхождений:**

| Файл | Проблема |
|------|----------|
| `components/admin/finances/FinTechTreasuryConversionsPanel.jsx` | локальные `MINT`/`NAVY` + `style={{ backgroundColor: MINT }}` |
| `components/admin/finances/FinTechTreasuryHeroDashboard.jsx` | `style={{ color: NAVY }}` |
| `components/admin/finances/PayoutBatchesPanel.jsx` | `FINTECH_MINT` / `FINTECH_NAVY` inline |
| `app/admin/marketing/attribution/page.js` | `FINTECH_NAVY` + **`#6366f1` (indigo)** в `borderLeft` |

### 1.3 Хардкод hex / arbitrary colors — **UI-1 DONE (Stage 129.2)**

Зачищено 12 product-файлов из списка ниже → `text-brand`, `bg-brand`, `bg-brand-surface`, `hover:bg-brand-hover`, `shadow-brand-*`.

| Файл | Статус |
|------|--------|
| `app/help/page.js` | ✅ 129.2 |
| `app/auth/complete-legal/page.js` | ✅ `Button variant="brand"` |
| `app/u/[id]/PublicUserProfileClient.jsx` | ✅ |
| `app/admin/marketing/layout.js` | ✅ |
| `app/about/loyalty/page.js` | ✅ fallback surface |
| `components/home/HomeHero.jsx`, `CategoryBar.jsx` | ✅ (hero radial rgba — UI-2) |
| `components/about/AboutLoyaltyClient.jsx`, `AboutContent.jsx` | ✅ |
| `components/geo/GeoSuggestToast.jsx`, `terms/TermsContent.jsx` | ✅ |

**Намеренные исключения (документировать):**

- `components/brand/airento-logo.jsx` — SVG `#006666`
- `lib/theme/product-ui.js`, charts/PDF/email — programmatic hex
- `components/home/HomeHero.jsx` — radial overlay с rgba (не Tailwind arbitrary hex)

**SSOT-слой `.gsl-*`:** исправлен в **Stage 129.0** (`globals.css` → brand tokens).

**`teal-*` в `app/`:** ~40 файлов (partner settings, renter bookings, checkout, profile) — legacy, **UI-2+**.

**`text-slate-*`:** массово (100+ файлов) — допустимо, но нет semantic alias (`text-fg`, `text-muted-fg`) как у Stripe.

### 1.4 Конфликт primary

- shadcn `Button variant="default"` → `bg-primary` (`--primary: 174 84% 32%` ≈ **#0d9488**)
- Product CTA → `variant="brand"` → **#006666**

На экранах со смешением `default` и `brand` пользователь видит **два «фирменных» teal**.

**Источники рассинхрона:**

| Файл | `primary` / accent |
|------|-------------------|
| `tailwind.config.js` | `brand #006666` |
| `lib/theme/constants.js` | `primary #0d9488` |
| `app/layout.js` | `themeColor: '#0d9488'` |
| `app/globals.css` | `--primary: 174 84% 32%` |

---

## 2. Аудит UI-примитивов

### 2.1 Канон (есть)

| Примитив | Путь | Зрелость |
|----------|------|----------|
| Button | `components/ui/button.jsx` | ✅ `variant="brand"`, CVA |
| Input | `components/ui/input.jsx` | ✅ focus `border-brand` |
| Select | `components/ui/select.jsx` | ✅ Radix |
| Skeleton | `components/ui/skeleton.jsx` | ⚠️ `bg-primary/10`, не `gsl-shimmer` |
| +40 shadcn | `components/ui/*` | Dialog, Sheet, Tabs… |

Product-оболочки: `components/product/*` (6 файлов):

- `ProductPageShell`, `ProfileHubNav`, `PageSectionHeader`
- `LoadingPageShell`, `MessagesAuthGate`, `GuestBookingFlowHint`

### 2.2 Adoption (grep, без `.next`)

| Паттерн | ~Файлов (components) | ~Файлов (app) |
|---------|----------------------|---------------|
| `import … Button` | **140** | **86** |
| Сырой `<button` | **60** | **10** |
| `import … Input` | **75** (оба каталога) | |
| `import … Select` | **35** | |
| `Skeleton` / `*-skeleton` | **25** | |

**~30–35% UI-файлов** содержат сырой `<button>` (часть — рядом с `Button` в том же файле).

### 2.3 Hotspots — верстка «с нуля»

**Search (Airbnb-критичный путь):**

| Файл | Проблема |
|------|----------|
| `components/search/UnifiedSearchBar.jsx` | импортирует `Button`, но **11× `<button`** (chips, mobile) |
| `components/search/WhereCombobox.jsx` | 6× raw button |
| `components/search/MobileSearchBottomSheet.jsx` | 8× raw button |
| `components/search/FilterBar.jsx`, `GuestsPopover.jsx` | raw buttons |

**Auth:**

- `components/auth/modals/LoginForm.jsx`, `RegisterForm.jsx` — mix: `Button` + raw `<button>` (OAuth, toggles)

**Chat:**

- `components/chat/composer/QuickReplies.jsx`, `chat-media-gallery.jsx`, `RealtimeDiagOverlay.jsx`

**Admin (legacy):**

- `app/admin/messages/page.js` — raw buttons + `blue-*` / `indigo-*`
- `app/admin/dashboard/page.js`, `app/settings/page.js` — старые blue CTA

**Partner legacy:**

- `app/partner/settings/page.js`, `app/partner/payout-profiles/page.js` — много `teal-*`, мало `variant="brand"`

### 2.4 Skeleton — два SSOT

1. shadcn `Skeleton` (`bg-primary/10`)
2. Custom: `home-page-skeleton.jsx`, `listings-catalog-skeleton.jsx`, `listing-card-skeleton.jsx`, `gsl-shimmer` в CSS

Нет единого **`LoadingSkeleton`** с вариантами `card | text | avatar`.

---

## 3. Типографика и отступы

### 3.1 Шрифты — важная находка

`app/layout.js` загружает **Inter** → CSS variable `--font-sans`:

```js
const inter = Inter({ subsets: ['latin', 'cyrillic'], variable: '--font-sans' })
// body: `${inter.variable} ${cormorant.variable} font-sans`
```

Но `tailwind.config.js`:

```js
fontFamily: {
  sans: FONT_STACK_PARTS, // system stack, БЕЗ var(--font-sans)
}
```

**Inter подключён, но `font-sans` в Tailwind его не использует** — фактически рендерится system UI font. Inter остаётся только как CSS variable без привязки к utility.

Cormorant Garamond (`--font-serif`) — luxury hero; использование точечное.

**Рекомендуемый SSOT:** `sans: ['var(--font-sans)', ...FONT_STACK_PARTS]` + sync с `lib/theme/constants.js`.

### 3.2 Иерархия текста

**Есть SSOT** (`lib/theme/product-ui.js`):

- `sectionTitle`: `text-2xl sm:text-3xl font-bold tracking-tight text-slate-900`
- `sectionSubtitle`: `text-slate-600 max-w-2xl text-sm sm:text-base leading-relaxed`

**Ad-hoc повсеместно:** `text-2xl font-bold`, `text-3xl font-semibold`, `text-lg font-medium` без общего `Heading` / `Text` компонента.

Admin FinTech: inline `style={{ color: NAVY }}` вместо `text-slate-900` или `text-brand-navy`.

### 3.3 Spacing

- **Хорошо:** `space-y-4`, `gap-6`, `p-4`, `px-3 sm:px-4` — доминируют
- **Arbitrary spacing:** ~11 файлов в `components/` (`MobileSearchBottomSheet`, `StickySearchBar`, radix overlays) — edge cases
- **В `app/`:** arbitrary `p-[…]` не найдено

**Gap:** нет documented spacing scale (4/6/8/10/12) в `PRODUCT_UI_SYSTEM.md`.

---

## 4. Дорожная карта UI-SSOT

### 4.1 Целевая структура (Stripe / Airbnb DS)

```
lib/theme/
  tokens.js              ← NEW: colors, type, radius, shadow (единый export)
  product-ui.js          ← compose Tailwind class strings (как сейчас)
  constants.js           ← email-only subset, import from tokens.js

components/
  ui/                    ← shadcn primitives ONLY (atoms)
  product/               ← page shells, hub nav (layout organisms)
  patterns/              ← NEW: SearchField, FilterChip, StatCard, FormField
  {domain}/              ← listing/, referral/, admin/ (feature composites)

docs/
  PRODUCT_UI_SYSTEM.md   ← + token table, do/don't
  proposals/UI_SSOT_AUDIT.md  ← этот документ
```

**Правило слоёв:** страница в `app/` **не** задаёт цвета/spacing — только composes `patterns` + `product`.

### 4.2 Фазы (после MIR; параллельно с паузой RQ)

| Phase | Scope | Effort |
|-------|-------|--------|
| **UI-0** | `tokens.js`; tailwind `brand.mint`, `brand.navy`; `--primary` = brand; `font-sans` → Inter | 1–2 d |
| **UI-1** | Починить `.gsl-*` hex → token classes; ~16 файлов arbitrary hex | 1–2 d |
| **UI-2** | Search bar SSOT: `patterns/Search*`; убрать raw buttons | 2–3 d |
| **UI-3** | Partner zone (`app/partner/*`) teal → brand | 3–4 d |
| **UI-4** | Admin FinTech: `FINTECH_MINT/NAVY` → tailwind; убрать inline styles | 2–3 d |
| **UI-5** | Typography: `Heading`/`Text` или documented text-* map | 1–2 d |

### 4.3 Storybook

**Сейчас:** не в `package.json`.

**Рекомендуемый стек:**

- `@storybook/nextjs` v8 + `@storybook/addon-essentials`
- Stories: `components/ui/button.stories.jsx` (рядом с компонентом)
- Decorators: mock `AppQueryProvider`, `I18nProvider`, import `app/globals.css`
- **Chromatic** (optional) — visual regression на `Button`, `Input`, Search patterns

**MVP stories (week 1):** Button (all variants), Input, Select, Skeleton, Card, EmptyState, ProfileHubNav, UnifiedSearchBar (visual only, mocked props).

**CI:** `npm run build-storybook` на PR при изменениях в `components/ui/**` или `lib/theme/**`.

### 4.4 Четыре жёстких правила для `.cursorrules`

```markdown
## UI SSOT (Stage 129+)

1. **Цвета:** Запрещены `bg-[#…]`, `text-[#…]`, inline `style={{ color/background }}`
   в `app/` и `components/` (кроме `lib/theme/*`, SVG logo, OG/email).
   Использовать только `brand`, `brand-*`, `text-slate-*`, semantic shadcn tokens.

2. **CTA:** Любая primary/submit action — только `<Button variant="brand">`
   или `gsl-btn-brand`. Сырой `<button>` — только внутри `components/ui/*` и Radix wrappers.

3. **Формы:** Поля ввода — `<Input>`, `<Select>`, `<Textarea>` из `@/components/ui/*`.
   Не дублировать `className="h-9 rounded-md border…"`.

4. **Новые экраны:** Обязательны `ProductPageShell` / `gsl-page` + `PageSectionHeader`
   для заголовков; loading — `LoadingPageShell` или `Skeleton` + `gsl-shimmer`;
   empty — `components/empty-state.jsx`.
```

**CI (optional):** `rg 'bg-\[#|text-\[#|style=\{\{.*color'` на PR → warn/fail.

---

## 5. План действий (prioritized)

### P0 — token unification (1 PR)

- Создать `lib/theme/tokens.js` с `brand`, `mint`, `navy`, `surface`, text grays
- Расширить `tailwind.config.js`: `brand: { DEFAULT, hover, surface, muted, mint, navy }`
- Синхронизировать `--primary` в `globals.css` с `brand.DEFAULT`
- `fontFamily.sans`: добавить `var(--font-sans)` первым

### P1 — SSOT enforcement in CSS (1 PR)

- Переписать `.gsl-*` на token classes (убрать hex из `globals.css`)
- Fix ~16 product hex files из §1.3

### P2 — Search + auth patterns (high visibility)

- `components/patterns/search/*` — extract chips/triggers from UnifiedSearchBar
- Auth OAuth buttons → `Button variant="outline"`

### P3 — Partner/admin debt

- Partner: bulk `teal-*` → `brand` (codemod)
- Admin: FinTech panels → tailwind tokens, kill inline `style={{ backgroundColor: MINT }}`

### P4 — Storybook + docs

- Storybook init + 10 core stories
- Update `PRODUCT_UI_SYSTEM.md` + `ARCHITECTURAL_PASSPORT.md` § Design System

---

## 6. Идеи (beyond audit)

1. **Semantic text tokens** — `text-fg`, `text-fg-muted`, `text-fg-subtle` (Stripe-style) вместо 20 оттенков slate вручную.
2. **Single primary in shadcn** — сделать `variant="default"` = brand, убрать дублирование default vs brand.
3. **`patterns/PriceDisplay`** — связать с FX SSOT (Stage 128) и `CardPriceDisplay` для единого вида цен.
4. **Visual regression** — Chromatic на catalog card + PDP + checkout summary (3 golden paths).
5. **Partner «island» migration** — `PartnerPageShell` (как `ProductPageShell`) через `app/partner/layout.js`.
6. **Post-MIR timing** — UI-SSOT не блокирует MIR; P0–P1 — 1–2 дня без риска для payments.

---

## 7. Связь с паузой RQ (128.4)

Data layer (TanStack Query) **закрыт и на паузе** до MIR.

**UI-SSOT — отдельный трек (Stage 129)**, не конфликтует с MIR, если:

- не трогать checkout payment UI logic;
- P0–P1 — только tokens / globals / hex cleanup;
- search / partner — после ops checklist.

---

## 8. Связанные документы

| Документ | Роль |
|----------|------|
| `docs/PRODUCT_UI_SYSTEM.md` | Текущий SSOT Stage 115 |
| `lib/theme/product-ui.js` | Class string composers |
| `ARCHITECTURAL_DECISIONS.md` | ADR-128 (data layer); UI ADR — TBD Stage 129 |
| `docs/proposals/TANSTACK_QUERY_MIGRATION_PLAN.md` | Data layer roadmap (PAUSED) |
