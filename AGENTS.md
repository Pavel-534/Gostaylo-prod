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
