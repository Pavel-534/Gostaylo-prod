# Архив документации и отчётов

Здесь лежат **исторические** отчёты, заметки по итерациям тестов и разовые SQL-скрипты. На повседневную разработку они не обязательны; актуальные правила и архитектура — в корне и в `docs/` (см. ниже).

## Что считать актуальным (не архив)

| Назначение | Путь |
|------------|------|
| Архитектурный манифест | `ARCHITECTURAL_DECISIONS.md` (корень) |
| Карта документации по системе | `docs/ARCHITECTURAL_PASSPORT.md`, `docs/TECHNICAL_MANIFESTO.md` |
| Схема БД | `docs/DATABASE_SCHEMA.md` |
| Дорожная карта | `ROADMAP.md` (корень) |
| Требования к миграции схемы (если ещё актуально) | `docs/DB_MIGRATION_REQUIRED.md` |
| PRD / продукт | `memory/PRD.md` |

## Содержимое этой папки

### Отчёты по фазам и планам

- `PHASE1_REPORT.md` … `PHASE4_REPORT.md` — отчёты по фазам разработки
- `REPAIR_PLAN.md` — план правок отзывов/рейтингов (SQL: `sql/MIGRATION_RUN_THIS.sql`)
- `DOCS_READY_FOR_PAYMENTS.md` — чеклист готовности к платежам (снимок состояния)

### Ручные / E2E заметки о тестах

- `test_result.md`, `test_result_premium_listing.md`, `test_summary_e2.md`

### JSON-итерации автотестов

- `test_reports/` — `iteration_*.json`, артефакты `pytest/`, XML-результаты. Пути внутри JSON со старым префиксом `/app/test_reports/` относятся к прежней среде; физически файлы теперь здесь: `docs/history/test_reports/`.

### Разовые SQL-скрипты

- `sql/create_demo_listings.sql`
- `sql/MIGRATION_RUN_THIS.sql` и другие `MIGRATION_*.sql`
- `sql/sync_ratings.sql`, `sql/update_test_listing_images.sql`

Перед выполнением в Supabase сверяйтесь с текущей схемой (`prisma/schema.prisma`, `docs/DATABASE_SCHEMA.md`), чтобы не применить устаревший шаг.
