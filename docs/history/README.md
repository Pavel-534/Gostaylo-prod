# Архив документации и отчётов (`docs/history/`)

Ещё более старый слой: отчёты фаз 1–4, SQL-скрипты, JSON/pytest артефакты.  
**Актуальная раскладка живых доков:** [`../README.md`](../README.md).  
**Аудиты / Stage / монолит-паспорт:** [`../archive/`](../archive/README.md).

## Что считать актуальным (не этот каталог)

| Назначение | Путь |
|------------|------|
| Хаб | `docs/README.md` |
| Policy | `ARCHITECTURAL_DECISIONS.md` |
| Манифест / конституция / паспорт | `docs/TECHNICAL_MANIFESTO.md`, `CONSTITUTION.md`, `SYSTEM_MAP.md` |
| Roadmap | `docs/ROADMAP.md` |
| Схема (снимок) | `docs/DATABASE_SCHEMA.md` + `migrations/` |
| Ops | `docs/runbooks/` |

## Содержимое этой папки

- `PHASE*_REPORT.md`, `REPAIR_PLAN.md`, `DOCS_READY_FOR_PAYMENTS.md`
- `test_reports/` — итерации автотестов
- `sql/` — разовые скрипты (перед применением сверять с живой схемой)

Перед SQL в Supabase — актуальная схема (`prisma/schema.prisma`, `docs/SYSTEM_MAP.md`, Dashboard).
