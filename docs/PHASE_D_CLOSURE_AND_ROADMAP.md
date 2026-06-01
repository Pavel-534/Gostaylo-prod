# Phase D — официальное закрытие и Roadmap (Stage 124.17)

**Дата:** 2026-06-01  
**Статус:** Phase D (Referral & Marketing Intelligence) **закрыта** — Stages **124.11–124.16**.  
**Этот документ:** итог для владельца, честный tech-debt review, план на **2–3 месяца**.

SSOT по коду: `ARCHITECTURAL_DECISIONS.md`, `docs/TECHNICAL_MANIFESTO.md`, `docs/ARCHITECTURAL_PASSPORT.md`.  
Owner guide в UI: `/admin/marketing/roi#owner-guide` · `lib/analytics/owner/referral-roi-owner-guide.js`.

---

## 1. Итог Phase D (124.11–124.16)

### Что построили

| Stage | Результат |
|-------|-----------|
| **124.11** | ROI-пульт `/admin/marketing/roi`, SSOT `lib/analytics/reports/referral-roi.report.js` |
| **124.12** | CAC, бюджетные алерты, CSV/Excel export, виджет FI → ROI |
| **124.13** | Owner Digest (email/Telegram, cron пн 07:00 UTC) |
| **124.14** | Drill-down кампания → брони → FI P&L; график дни/недели |
| **124.15** | LTV/retention, fraud-adjusted ROI, блок «Что это значит для бизнеса» |
| **124.16** | Карточка «Как пользоваться аналитикой», навигация FI ↔ ROI, playbook в доках |

### Архитектурный принцип Phase D

- **Read-only аналитика** — не меняет деньги; настройки остаются в «Кампании» / «Бюджет» / FinTech.
- **Единый SSOT** — `lib/analytics/` + `FinancialReportingService`; UI не считает ROI/CAC сам.
- **Связка с FI** — от executive summary к реферальной экономике без дублирования ledger-математики.

### Чего Phase D намеренно не делала

- Новые платёжные рельсы, автоматические выплаты реферерам, полноценный multi-country rollout.
- Замена операционных экранов (`/admin/marketing/campaigns`, attribution) — они дополняют ROI, а не заменяют.

---

## 2. Owner Summary — что владелец теперь контролирует

### Ежедневно / по сигналу (2–5 мин)

| Вопрос | Где смотреть |
|--------|----------------|
| Сколько денег «в системе» и в эскроу? | **Financial Intelligence** `/admin/finance/intelligence` |
| Окупается ли рефералка? | **Referral ROI** `/admin/marketing/roi` (ROI, CAC, алерты) |
| Критическая проблема? | Красные баннеры на ROI + TG FINANCE + `/admin/settings/finances` |

### Еженедельно (5–10 мин)

1. **Owner Digest** (пн, email/Telegram) — сводка ROI/CAC/топ-кампаний.
2. ROI за **7 дней** → блоки «Как пользоваться» и «Что это значит для бизнеса».
3. При алерте бюджета — drill-down: **кампания → бронь → P&L**.

### По решению (глубокий разбор)

| Задача | Путь |
|--------|------|
| Понять одну кампанию | `/admin/marketing/roi/[slug]` — LTV, retention, таблица броней |
| Понять одну бронь | Клик по брони → `/admin/finance/intelligence/bookings/[id]` |
| Исключить фрод из ROI | Переключатель **Fraud-adjusted** + `/admin/marketing/fraud-queue` |
| Экспорт для бухгалтерии/совета | CSV/Excel на ROI-пульте; FI export |

### Формулы (простым языком)

- **ROI** = комиссия платформы ÷ расход на бонусы (promo). **> 1** — программа окупается.
- **CAC** = расход ÷ число привлечённых гостей (первые брони).
- **Net effect** = комиссия − бонусы − clawback.
- **Fraud-adjusted** — те же метрики без броней с меткой `fraud_suspicious`.

### Ритм владельца (рекомендация)

- **Не** открывать все дашборды каждый день — достаточно digest + FI при необходимости.
- **Да** реагировать на critical-алерты в течение 24 ч.
- Перед первыми реальными деньгами — пройти `docs/PRE_REAL_PAYMENTS_CHECKLIST.md` и `docs/GO_NO_GO_FIRST_REAL_PAYMENT.md`.

---

## 3. Честный Architectural & Technical Debt Review

Оценка по шкале: **Низкий риск** / **Средний** / **Высокий** для масштаба «международный агрегатор в 2–3 странах».

### 3.1 Архитектура и масштабируемость — **Средний**

**Сильные стороны**

- Чёткий SSOT: Supabase + `supabaseAdmin` на сервере; Prisma только как схема-док.
- Финансы: ADR-097, `PayoutBatchService`, `legacy-payout-guard`, escrow RPC, `lib/analytics/` для read-модели.
- Брони: оркестратор `booking.service.js` + модули; статусы — `status-transitions.js`.
- Admin RBAC: `requireAdminStaff`, `admin-api-access`, меню SSOT.

**Проблемы**

| Проблема | Риск | Комментарий |
|----------|------|-------------|
| **Монолит Next.js** — вся логика в одном деплое | Средний | Нормально до ~сотен RPS; узкое место — тяжёлые отчёты и cron, не UI |
| **`reporting.service.js` ~49 KB** | Средний | Исторический «god module»; Phase D вынес отчёты в `lib/analytics/`, но referral funnel всё ещё там |
| **Дублирование маркетинговых экранов** | Низкий | ROI drill-down vs `/admin/marketing/campaigns/[slug]` — разные роли (analytics vs ops) |
| **Нет выделенного worker tier** | Средний | Cron = HTTP на Vercel; длинные job'ы конкурируют с API |

### 3.2 Финансовая модель (ADR-097) — **Средний–Высокий** до live money

**Сильные стороны**

- Pricing snapshot на брони, jurisdiction split в FI, payout batches, smoke 19/19, Concierge manual mode.
- Attestation / price integrity, compliance export, bank reconciliation block в FI.

**Gaps (честно)**

| Gap | Риск | Что нужно |
|-----|------|-----------|
| **Реальный эквайринг не в проде** | **Высокий** | ЮKassa, webhook, fiscal URL, prod verify — `PRE_REAL_PAYMENTS_CHECKLIST` |
| **Ручной Concierge по умолчанию** | Средний (намеренно) | Правильно для старта; автопулы — отдельное решение владельца |
| **Реферальные выводы вручную** | Средний | GO/No-Go §13: очередь без автобанка — ops нагрузка |
| **FX / multi-currency display vs THB ledger** | Средний | Учёт в THB каноничен; выплаты RUB/USDT — отдельные пути, не все страны |
| **Fiscal provider optional в dev** | Средний | На prod без URL оплаты блокируются — ок, но нужен боевой провайдер |

### 3.3 Cron / Scheduling / Reliability — **Средний–Высокий**

**Факты**

- Vercel **Hobby**: максимум **1 запуск/день** на cron expression в `vercel.json`.
- **Hourly** `promote-ready-for-payout`, `escrow-thaw`, `payout-batch-pools` — **внешний** [cron-job.org](https://cron-job.org) (`docs/CRON_EXTERNAL_FINANCIAL.md`).
- 15+ cron routes в репо; часть daily на Vercel, критичные financial — external.

**Риски**

| Риск | Уровень |
|------|---------|
| Забыли настроить cron-job.org на prod | **Высокий** — брони зависнут в THAWED |
| Нет единого «cron health» дашборда для владельца | Средний — есть monitor routes, но ops-зависимость |
| Owner digest только Mon Vercel | Низкий — достаточно для weekly |
| Нет idempotent dead-letter для failed cron | Средний — retry вручную |

### 3.4 Международная готовность — **Средний** (не «глобальный агрегатор» yet)

| Область | Состояние |
|---------|-----------|
| **Учёт** | THB-centric ledger; RU/KG split в pricing snapshot и FI |
| **Гость платит** | RUB MIR (подготовлено), crypto/USDT paths, display FX |
| **Партнёр получает** | RUB Direct, KG crypto scaffolding в ADR-097 |
| **Compliance** | KG IT contract summary, compliance CSV; не полный multi-jurisdiction legal matrix |
| **Локализация** | RU/EN/ZH/TH в translations; ops-контент частично |
| **Новая страна** | Требует: pricing profile, payout rail, fiscal, legal, FX — **не plug-and-play** |

**Вывод:** продукт — **сильный Concierge-маркетплейс с THB-книгой и RU-веткой**, а не готовый «plug any country» агрегатор.

### 3.5 Кодовая база — **Средний**

| Тема | Оценка |
|------|--------|
| **Legacy** | Guards есть (`legacy-payout-guard`, archived routes); не удалено, но изолировано |
| **Fat modules** | `reporting.service`, `attribution.service`, translation slices 50–70 KB |
| **Тесты** | Сильный **financial smoke** (19 шагов); E2E Playwright точечно; нет широкого unit-покрытия API |
| **Документация** | Хорошая для AI/команды; риск — расхождение при быстрых PR без чеклиста |
| **Типы ID** | TEXT FK на profiles/listings/bookings — осознанный SSOT, но легко ошибиться в новых миграциях |

### 3.6 Производительность и надёжность — **Средний**

- Analytics cache 90s — разумно для admin.
- Тяжёлые отчёты (FI, ROI) — несколько parallel Supabase reads; при росте данных — индексы и пагинация.
- Realtime chat + push — отдельный контур нагрузки.
- `.next-dev` в git status у разработчиков — не prod issue, но шум в репо.

### 3.7 Безопасность и операционная устойчивость — **Низкий–Средний**

**Сильные стороны**

- RLS sweep, storage policies, booking IDOR fix, prod perimeter 404, admin staff gate.
- Anti-fraud v2 + fraud queue; rate limits на auth/promo.
- Emergency pause, treasury manual mode.

**Остаточные риски**

| Риск | Уровень |
|------|---------|
| `CRON_SECRET` leak = mass job trigger | Средний — rotate + IP allowlist на cron-job.org |
| Service role key exposure | Высокий impact, низкая вероятность при нормальном ops |
| Зависимость от Telegram для алертов | Средний — дублировать email для critical |

---

## 4. Roadmap на 2–3 месяца

Легенда: **P0** — блокер масштаба/денег · **P1** — продукт и ops · **P2** — улучшения · **P3** — отложить  
Сложность: **S** / **M** / **L** · Риск при игноре: **H** / **M** / **L**

### 4.1 Критические архитектурные долги (месяц 1, в первую очередь)

| # | Задача | P | Сложность | Риск | Примечание |
|---|--------|---|-----------|------|------------|
| 1 | **Live payments path** — ЮKassa, fiscal, prod `verify:schema` + smoke | P0 | L | H | `PRE_REAL_PAYMENTS_CHECKLIST`, Go/No-Go 9/10 → 10/10 |
| 2 | **External cron на prod** — escrow-thaw hourly, promote-ready hourly, payout pools ПН/ЧТ | P0 | S | H | `CRON_EXTERNAL_FINANCIAL.md`; чеклист в FinTech UI |
| 3 | **Cron observability** — единая карточка «последний успешный run» + TG alert при stale | P0 | M | H | Снижает silent failure |
| 4 | **Prod env audit** — один spreadsheet всех financial env | P0 | S | M | Owner + dev один раз |
| 5 | **Financial SSOT audit** — карта «кто пишет в ledger» (1 страница) | P1 | M | M | Уже частично в `FINANCIAL_FLOW_MAP` — актуализировать |

### 4.2 Продуктовые и операционные задачи (месяц 1–2)

| # | Задача | P | Сложность | Риск | Примечание |
|---|--------|---|-----------|------|------------|
| 6 | **Первые 10–50 live броней** в Concierge mode — ручной контроль | P0 | M | H | Реальная обратная связь важнее новых фич |
| 7 | **Partner payout SOP** — документ + UI checklist на FinTech | P1 | S | M | `CONCIERGE_LAUNCH_TREASURY_RUNBOOK` |
| 8 | **Referral withdrawal ops** — процесс ручной обработки очереди | P1 | M | M | До автоматизации — SLA и ответственный |
| 9 | **Listing quality & conversion** — publish checklist, search | P1 | M | M | Stage 116.x база есть |
| 10 | **Dispute / support loop** — медиация, SLA в TG | P1 | M | M | Уже есть cron; закрепить ops |
| 11 | **Страна #2 planning** — не внедрение, а ADR: что нужно для новой юрисдикции | P2 | M | L | Документ, не код |

### 4.3 Технические улучшения (месяц 2–3)

| # | Задача | P | Сложность | Риск | Примечание |
|---|--------|---|-----------|------|------------|
| 12 | **Split `reporting.service`** — funnel в отдельный модуль, analytics только читает | P2 | M | M | Продолжение линии Phase D / FI |
| 13 | **API integration tests** — top 20 financial routes | P2 | L | M | Дополнение к smoke |
| 14 | **ROI/FI cache invalidation** — при batch settle / clawback | P2 | S | L | Уже частично; проверить полноту |
| 15 | **Staging environment** — mirror prod env для smoke | P2 | M | M | Снижает «сюрпризы на prod» |
| 16 | **DB index review** — referral_ledger, bookings по admin reports | P2 | M | M | После роста данных |
| 17 | **E2E: booking → pay (mock) → escrow → FI P&L** | P2 | M | M | Связка Phase C + D |

### 4.4 Что отложить (явно)

| Задача | Почему |
|--------|--------|
| Новые marketing dashboards, cohort UI по всем реферерам | Phase D закрыта; diminishing returns |
| Referral 2.0 «Phase E» (digest Excel, side-by-side campaigns) | Только по боли владельца |
| Полная автоматизация referral bank payouts | После live money и ops SOP |
| Microservices / отдельный analytics warehouse | Преждевременно |
| Mobile apps | Web-first до PMF в одном регионе |
| AI listing generation at scale | Вторично к trust & payments |

---

## 5. Рекомендация: с чего начать после Stage 124.17

### Неделя 1 (владелец + 1 dev)

1. **Не открывать новую аналитику** — Phase D завершена.
2. **Закрыть ops-контур денег:**
   - cron-job.org на production по `CRON_EXTERNAL_FINANCIAL.md`;
   - карточка готовности на `/admin/settings/finances` — все зелёное;
   - `npm run verify:schema-103-2` и smoke на **production** после деплоя.
3. **Юридическое / ЮKassa** — параллельно с dev (блокер Go-Live).

### Неделя 2–4

4. **Первый controlled live payment** (1–5 броней, Concierge, ручной payout).
5. **Cron health alert** (если ещё нет stale detection) — маленький PR, высокий ROI.
6. Еженедельно: Owner Digest + ROI 7d — уже настроено.

### Месяц 2–3

7. Накопить данные → решение по **автопулам** vs ручной Concierge.
8. Техдолг: `reporting.service` split + integration tests — без спешки.
9. ADR «вторая страна» — только после стабильного THB/RU контура.

---

## 6. Официальное заключение

**Phase D (124.11–124.16) закрыта.** Владелец получил связную read-only систему: **FI → ROI → кампания → P&L**, digest, fraud-adjusted, owner guide.

**Следующий фокус проекта — не аналитика, а operational readiness для реальных денег и надёжности cron/платежей.** Это согласуется с Go/No-Go **9/10**: код готов, внешние блокеры и ops — нет.

**Амбиция «международный агрегатор»** достижима поэтапно: сначала **безупречный контур THB + RU Concierge**, затем документированное расширение юрисдикций — не параллельная стройка новых дашбордов.

---

*Документ поддерживается при существенных изменениях в финансах, cron или маркетинговой аналитике. Версия: 124.17.*
