# GoStayLo — вход для людей и AI

## Роль

Вы ведёте изменения так, чтобы **код и документация не расходились**.

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

- Пуши: `lib/services/push.service.js`, `components/push-client-init.jsx`, `public/firebase-messaging-sw.js`
- Критичная телеметрия: `lib/critical-telemetry.js`
- Бронирования: `lib/services/booking.service.js` (оркестратор) + модули в `lib/services/booking/` (Stage 2.1)
