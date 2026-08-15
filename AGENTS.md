# Platform — вход для людей и AI

## Роль

Вы ведёте изменения так, чтобы **код и документация не расходились**.

**Операционная модель доков (обязательно прочитать один раз):** [`docs/README.md`](docs/README.md).

## Имя бренда (white-label)

| Контекст | Канон |
|----------|--------|
| UI, email, push, PDF, ответы пользователю | **`getSiteDisplayName()`** — env **`NEXT_PUBLIC_SITE_NAME`** / **`SITE_DISPLAY_NAME`** (прод: **Airento**) |
| i18n JSON | плейсхолдер **`{brand}`** только (ADR §7a) |
| Ответы AI в чате / PR / runbook для людей | **Airento** или «платформа», **не** GoStayLo / Gostaylo |
| Legacy в коде | `gostaylo_*`, `GostayloListingCard` — internal id, не display name |

Проверка: **`npm run check:brand`**, **`npm run check:guest-terminology`** (renter UI — не «партнёр», SSOT **`lib/i18n/get-guest-provider-label.js`**)

## Обязательные документы (порядок)

| # | Файл | Роль |
|---|------|------|
| 1 | `ARCHITECTURAL_DECISIONS.md` | **Policy SSOT.** При противоречии с любыми другими доками верен он. |
| 2 | `docs/TECHNICAL_MANIFESTO.md` | **Манифест / code-truth** — §0–13 + короткие «Свежие дельты» (не Stage-роман). |
| 3 | `docs/CONSTITUTION.md` | **Инварианты** — FSM броней, формула цены, FX, роли, таблица SSOT-файлов. |
| 4 | `docs/SYSTEM_MAP.md` | **Живой архитектурный паспорт** — стек, таблицы, API-пути, интеграции. |

| Вспомогательные | Роль |
|-----------------|------|
| `docs/HISTORY.md` | Хронология Stage (не правила) |
| `docs/ROADMAP.md` | Планы после запуска |
| `docs/CURRENCY_FX_SSOT.md` | Валюты: base / UI / payment, retail vs checkout FX |
| `docs/ARCHITECTURAL_PASSPORT.md` | **Индекс-алиас** → ссылки на живые доки |
| `docs/archive/ARCHITECTURAL_PASSPORT_ARCHIVE.md` | Архив монолита — **только чтение** (stub: `docs/ARCHITECTURAL_PASSPORT_ARCHIVE.md`) |
| `docs/runbooks/` · `docs/guides/` | Ops и продуктовые гайды |

Конституция для Cursor: **`.cursorrules`** + **`.cursor/rules/airento-docs-constitution.mdc`** (`alwaysApply`) — оба указывают на ту же матрицу.

## Когда что обновлять (кратко)

| Изменили | Обновить |
|----------|----------|
| API / поведение / значимый UX | **Manifesto** + при необходимости Constitution / System Map |
| FSM, fee, FX, RBAC | **Constitution** (+ Manifesto) |
| Таблицы, эндпоинты, интеграции | **System Map** (+ Manifesto) |
| Закрыли Stage | **History** (не ARCHIVE) |
| Backlog / post-launch | **Roadmap** |
| Политика / «золотое правило» | **ARCHITECTURAL_DECISIONS** (+ ADR) |
| Чистый рефактор без контракта | доки не обязательны |

Полная матрица — в **`docs/README.md` §3**.

**Не** пишите новые Stage в **`docs/archive/`** (в т.ч. монолит-паспорт).

## PR

Чеклист: **`.github/pull_request_template.md`**.

## Быстрые ссылки

- Хаб доков — **`docs/README.md`**
- Supabase: новая таблица — **`migrations/_template_new_public_table.sql`**, **`migrations/README.md`**
- Продуктовый поток — **`docs/PRODUCT_FLOW_MAP.md`**
- Roadmap — **`docs/ROADMAP.md`**
- Каталог query → файлы — **`docs/SEARCH_FILTERS_QUERY_MAP.md`**
- Пуши / PWA SW: `lib/services/push.service.js`, `components/push-client-init.jsx`, **`src/pwa/sw.template.js`**
- Критичная телеметрия: `lib/critical-telemetry.js`
- Бронирования: `lib/services/booking.service.js` + `lib/services/booking/`
- Resend в тестах: `lib/email/resend-transport-guard.js`

## Cursor Cloud specific instructions

Durable, non-obvious notes for future cloud agents. The startup update script already runs `npm install`, so do not repeat dependency installation here.

- **Single app at repo root.** This is one Next.js 14 (App Router) codebase — frontend + `app/api/**` together. `frontend/` is symlinks into the app root, `backend/` is only legacy Python test scripts, `mobile/` is a Capacitor/TWA shell. There is no separate backend service to start.
- **Run dev:** `npm run dev` → serves on `0.0.0.0:3000` (`predev` bumps the SW cache automatically). Node 22 works; CI pins Node 20.
- **Local env file is required for auth paths.** Create a gitignored `.env.local` with at least `JWT_SECRET` (hard failure whenever auth/session code runs — see `lib/auth/jwt-secret.js`). There is no committed `.env.example`. Optional: `NEXT_PUBLIC_SITE_NAME`/`SITE_DISPLAY_NAME` (brand, prod = `Airento`).
- **Graceful degradation without Supabase.** With Supabase env unset, `lib/supabase.js` clients become `null`: pages still render (HTTP 200) but listing/search/booking/auth data flows are empty and the dev log shows `Cannot read properties of null (reading 'from')` from the search query builder — this is expected locally. There is no bundled local DB/Docker; for real data or E2E, point at a hosted **staging** Supabase project (never production) and apply migrations from `migrations/` + `database/migrations/`.
- **Other integrations degrade/mocked** when unset: rate-limit → in-memory, Resend/FCM/Telegram/PostHog/OpenAI → no-op or mock (`RESEND_MOCK=1` etc.).
- **Lint:** `npm run lint` (`eslint . --max-warnings 50`). There are pre-existing `no-undef` errors in service-worker/storage source (`public/*.js`, `src/pwa/sw.template.js`, `lib/storage/*`) — not caused by env setup.
- **Build:** `npm run build` (resilient wrapper + type-check + SW precache) succeeds offline without any env.
- **Unit tests:** node test runner scripts import an alias register, e.g. `npm run test:map-pin-price`, `npm run test:discovery-housing` — run offline, no DB.
- **Known broken offline scripts (pre-existing, not env):** `npm run verify:currency` and `npm run check:i18n` fail under Node 22 with `ERR_MODULE_NOT_FOUND` (extensionless ESM imports without the alias register). `npm run check:brand` also flags historical doc literals by design.
- **Playwright E2E** (`npm run test:e2e:nightly`, `npx playwright test`) additionally needs `npx playwright install --with-deps chromium` and a dedicated staging Supabase project; not runnable with the default no-DB local setup.
