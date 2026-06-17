# Platform — вход для людей и AI

## Роль

Вы ведёте изменения так, чтобы **код и документация не расходились**.

## Имя бренда (white-label)

| Контекст | Канон |
|----------|--------|
| UI, email, push, PDF, ответы пользователю | **`getSiteDisplayName()`** — env **`NEXT_PUBLIC_SITE_NAME`** / **`SITE_DISPLAY_NAME`** (прод: **Airento**) |
| i18n JSON | плейсхолдер **`{brand}`** только (ADR §7a) |
| Ответы AI в чате / PR / runbook для людей | **Airento** или «платформа», **не** GoStayLo / Gostaylo |
| Legacy в коде | `gostaylo_*`, `GostayloListingCard` — internal id, не display name |

Проверка: **`npm run check:brand`**

## Обязательные документы (порядок)

| Файл | Роль |
|------|------|
| `ARCHITECTURAL_DECISIONS.md` | SSOT: политика и «золотые» правила. При противоречии с другими доками верен он. |
| `docs/TECHNICAL_MANIFESTO.md` | Сжатый снимок текущей реализации (API-идеи, чат, валюта, пуши, E2E, типы TEXT в Supabase). |
| `docs/ARCHITECTURAL_PASSPORT.md` | Архитектура, критичные маршруты, схемы, стандарты UI. |

Конституция для Cursor: **`.cursorrules`** + правило **`.cursor/rules/gostaylo-docs-constitution.mdc`** (`alwaysApply`).

## Когда обновлять манифест и паспорт

**Обновляйте в том же изменении**, если тронули:

- контракт HTTP (`app/api/**`), схему БД или RLS (`migrations/**`, политики Supabase);
- поведение продукта (брони, чат, платежи, пуши, валюта);
- зафиксированные в доках UX-инварианты или новые важные экраны.

**Можно не трогать** доки при чистом рефакторе (имена, форматирование) без смены поведения и контрактов.

В шапке паспорта поддерживайте **Version / Last Updated**, когда меняете смысловые разделы.

## PR

В описании PR отмечайте чеклист из **`.github/pull_request_template.md`**.

## Быстрые ссылки

- Supabase: новая таблица — **`migrations/_template_new_public_table.sql`**, **`migrations/README.md`** (GRANT + RLS; deadline платформы 2026-10-30)
- Сквозной продуктовый поток + backlog PR — **`docs/PRODUCT_FLOW_MAP.md`**
- Phase D итог + roadmap 2–3 мес. — **`docs/PHASE_D_CLOSURE_AND_ROADMAP.md`**
- Каталог: query-параметры поиска → файлы — **`docs/SEARCH_FILTERS_QUERY_MAP.md`**
- Пуши: `lib/services/push.service.js`, `components/push-client-init.jsx`, `public/firebase-messaging-sw.js`
- Критичная телеметрия: `lib/critical-telemetry.js`
- Бронирования: `lib/services/booking.service.js` (оркестратор) + модули в `lib/services/booking/` (Stage 2.1)
- **Resend в тестах:** `lib/email/resend-transport-guard.js` — smoke/E2E/тестовые адреса не вызывают Resend API; правило `.cursor/rules/gostaylo-resend-transport-guard.mdc`
