# Документация Airento — хаб

> Один вход для людей, Cursor и внешнего ИИ-архитектора.  
> Политика верхнего уровня: [`ARCHITECTURAL_DECISIONS.md`](../ARCHITECTURAL_DECISIONS.md) (корень репо).  
> Агенты: [`AGENTS.md`](../AGENTS.md) · [`.cursorrules`](../.cursorrules).

---

## Масштаб продукта (что это)

**Airento** — white-label Super App аренды (жильё, транспорт, туры, услуги): витрина → бронирование → эскроу → чат → выплаты партнёрам → рефералы / Concierge.

| Область | Что внутри |
|---------|------------|
| **Витрина** | Каталог, поиск/фильтры, PDP, рекомендации, FX display |
| **Заказ** | FSM броней, checkout, YooKassa / acquiring, pricing snapshot |
| **Деньги** | Ledger (double-entry), escrow thaw, payouts, FinTech admin |
| **Чат** | Треды по сделке, push FCM, anti-spam |
| **Кабинеты** | Renter / Partner / Admin / Concierge |
| **Рост** | Referral / ambassador, marketing promo |
| **Ops** | Cron (Vercel daily + external hourly), smoke/E2E, PWA |

Стек и таблицы — **[`SYSTEM_MAP.md`](./SYSTEM_MAP.md)**. Правила денег/FSM — **[`CONSTITUTION.md`](./CONSTITUTION.md)**.

---

## 1. Канон (читать в этом порядке)

| # | Файл | Вопрос |
|---|------|--------|
| 1 | [`ARCHITECTURAL_DECISIONS.md`](../ARCHITECTURAL_DECISIONS.md) | Можно ли / как должно быть по политике? |
| 2 | [`TECHNICAL_MANIFESTO.md`](./TECHNICAL_MANIFESTO.md) | Что сейчас в коде? (§0–13 + свежие дельты) |
| 3 | [`CONSTITUTION.md`](./CONSTITUTION.md) | Какие инварианты нельзя нарушать? |
| 4 | [`SYSTEM_MAP.md`](./SYSTEM_MAP.md) | Из чего состоит система? (**живой паспорт**) |

| Вспомогательные | Роль |
|-----------------|------|
| [`HISTORY.md`](./HISTORY.md) | Хронология Stage |
| [`ROADMAP.md`](./ROADMAP.md) | Планы после запуска |
| [`ARCHITECTURAL_PASSPORT.md`](./ARCHITECTURAL_PASSPORT.md) | Индекс-алиас (не монолит) |

### Пакет для внешнего ИИ (Grok / Gemini / …)

Скопируйте **только**:

1. этот `README.md`  
2. `ARCHITECTURAL_DECISIONS.md`  
3. `CONSTITUTION.md`  
4. `SYSTEM_MAP.md`  
5. `TECHNICAL_MANIFESTO.md` (или шапку + нужные §)

По теме добавьте: [`PRODUCT_FLOW_MAP.md`](./PRODUCT_FLOW_MAP.md) · [`FINANCIAL_FLOW_MAP.md`](./FINANCIAL_FLOW_MAP.md) · [`ROADMAP.md`](./ROADMAP.md).

**Не** давайте папку `archive/` целиком и не путайте stub-файлы в корне `docs/` с живыми доками (stub — 3 строки «Moved: …»).

---

## 2. Структура папок

```
docs/
  README.md                 ← вы здесь
  CONSTITUTION.md           ← инварианты
  SYSTEM_MAP.md             ← паспорт
  TECHNICAL_MANIFESTO.md    ← code-truth
  HISTORY.md · ROADMAP.md
  PRODUCT_FLOW_MAP.md · FINANCIAL_FLOW_MAP.md
  PRODUCT_UI_SYSTEM.md · SEARCH_FILTERS_QUERY_MAP.md · DATABASE_SCHEMA.md

  runbooks/                 ← ops: cron, go-live, smoke, env
  guides/                   ← продукт/маркетинг/referral
  ADR/                      ← архитектурные решения (файлы)
  specs/ · proposals/       ← спецификации / предложения
  archive/                  ← аудиты, отчёты, старые Stage/планы, монолит-паспорт
  history/                  ← ещё более старые отчёты/SQL/тесты
```

Старые пути вроде `docs/CRON_EXTERNAL_FINANCIAL.md` **сохранены как stub** → реальный файл в `runbooks/` / `archive/` / `guides/`.

---

## 3. Матрица «что обновить в PR»

| Изменение | Manifesto | Constitution | System Map | History | Roadmap | ADR |
|-----------|:---------:|:------------:|:----------:|:-------:|:-------:|:---:|
| API / поведение / UX | ✅ | ◐ | ✅ путь | ◐ | | ◐ |
| Таблица / RLS | ✅ | ◐ | ✅ | ◐ | | |
| FSM / fee / FX / роли | ✅ | ✅ | ◐ | ◐ | | ◐ |
| Закрыт Stage | дельты 2–5 строк | | | ✅ | | |
| Backlog | | | | | ✅ | |
| Чистый рефактор | | | | | | |

✅ обязательно · ◐ если затронуто

**Запрещено** писать новые Stage в `archive/ARCHITECTURAL_PASSPORT_ARCHIVE.md`.

---

## 4. Быстрые ссылки

| Нужно | Куда |
|-------|------|
| Ops cron / money jobs | [`runbooks/CRON_EXTERNAL_FINANCIAL.md`](./runbooks/CRON_EXTERNAL_FINANCIAL.md) |
| Go-live / treasury | [`runbooks/`](./runbooks/) |
| Referral | [`guides/referral/`](./guides/referral/) |
| Последний аудит vs Constitution | [`archive/audits/AUDIT_REPORT_02.md`](./archive/audits/AUDIT_REPORT_02.md) (prev: [`AUDIT_REPORT_01`](./archive/audits/AUDIT_REPORT_01.md)) |
| Миграции Supabase | [`../migrations/README.md`](../migrations/README.md) |
| Монолит-паспорт (только чтение) | [`archive/ARCHITECTURAL_PASSPORT_ARCHIVE.md`](./archive/ARCHITECTURAL_PASSPORT_ARCHIVE.md) |
| Исторический Stage-проз манифеста | [`archive/reports/TECHNICAL_MANIFESTO_STAGE_LOG.md`](./archive/reports/TECHNICAL_MANIFESTO_STAGE_LOG.md) |

---

## 5. Ведение хаба (`docs/README.md`)

**Да — это живой файл**, но **не** changelog продукта.

| Обновлять README | Не обновлять |
|------------------|--------------|
| Сменился набор канонических файлов / папок | Каждый Stage / UX-правка |
| Новый слой (например `docs/ops/`) | Правки манифеста / Constitution по смыслу фичи |
| Меняется пакет для внешнего ИИ | Обычный PR с API |

Матрица PR (§3) про манифест/паспорт; хаб трогают редко — когда **меняется карта документации**.

---

## 6. Ведение манифеста (`TECHNICAL_MANIFESTO.md`)

- **Писать:** текущее поведение + пути файлов (§0–13) и короткий блок «Свежие дельты».
- **Не писать:** полный Stage-проз (он в [`archive/reports/TECHNICAL_MANIFESTO_STAGE_LOG.md`](./archive/reports/TECHNICAL_MANIFESTO_STAGE_LOG.md) + таблица [`HISTORY.md`](./HISTORY.md)).
- После закрытия Stage: 1 строка в HISTORY + 2–5 строк в «Свежие дельты» (или правка §).

*Хаб (§5) — при смене структуры доков; манифест — при смене кода.*
