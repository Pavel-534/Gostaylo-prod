# Launch Risk Register — РФ / Таиланд

> **Version:** 1.0.0 · **Updated:** 2026-08-01 · **Scope:** soft / controlled live Airento (RU guests + TH inventory / ops)  
> **Не заменяет** Go/No-Go: [`runbooks/GO_NO_GO_FIRST_REAL_PAYMENT.md`](./runbooks/GO_NO_GO_FIRST_REAL_PAYMENT.md), [`runbooks/PRE_REAL_PAYMENTS_CHECKLIST.md`](./runbooks/PRE_REAL_PAYMENTS_CHECKLIST.md), [`runbooks/CONCIERGE_LAUNCH_TREASURY_RUNBOOK.md`](./runbooks/CONCIERGE_LAUNCH_TREASURY_RUNBOOK.md).  
> Владельцы ниже — роли, не ФИО. Пересматривать после первого live MIR и каждые 2 недели soft launch.

**Шкала влияния (ориентир soft launch, не P&L-модель):**

| Уровень | Смысл |
|---------|--------|
| Critical | Остановка приёма денег / юридический стоп / потеря доверия к эскроу |
| High | Часы–дни ручного разбора, репутация, кассовые/казначейские сбои |
| Medium | Локальные инциденты, обходной процесс есть |
| Low | Дискомфорт / косметика / отложенный долг |

---

## Сводная таблица

| ID | Название | Уровень | Вероятность | Влияние (порядок) | Владелец |
|----|----------|---------|-------------|-------------------|----------|
| **R01** | Webhook оплаты не дошёл / задержался | **Critical** | Средняя | 1 бронь: полная сумма гостя «висит»; при пилоте 3–10k ₽–30k ₽/кейс; при росте — ×N | FinOps + Dev |
| **R02** | Ошибка Concierge-выплаты партнёру | **High** | Высокая (ручной процесс) | 1 неверный payout: сотни–тысячи THB/₽; репутация партнёра | Concierge / FinOps |
| **R03** | БД / индексы / отсутствие проверенного restore | **High** | Низкая (инцидент) / Средняя (деградация) | Полный outage или медленный каталог; RPO/RTO по политике Supabase | Dev + Owner |
| **R04** | Лимиты Vercel Hobby (cron, cold start, timeout) | **High** | Средняя | Thaw lag до ~24ч если только Vercel daily; SLA выплат/эскроу | Dev / Ops |
| **R05** | 54-ФЗ / оферта / агентская схема устарели | **Critical** | Средняя до live | Штрафы / блок кассы / остановка эквайринга; юр. No-Go | Legal + Owner |
| **R06** | Модерация объявлений — пропуск / очередь | **High** | Средняя | Фейк/скам листинг → chargeback / спор; урон бренду | Admin / Moderation |
| **R07** | Telegram bot token / группа FINANCE недоступны | **High** | Низкая–средняя | «Слепой» пилот: нет алертов drift/fiscal/payment | Ops / Owner |
| **R08** | Резкий FX THB/RUB (±20%) | **Medium** | Средняя (волатильность) | Маржа/NPS на RUB rails; спор «цена изменилась» | FinOps + Pricing |
| **R09** | Скрапинг / копии каталога | **Medium** | Высокая (фон) | Утечка витрины; конкуренты; нагрузка API | Dev + Owner |
| **R10** | Рост до ~1000 броней/день без апгрейда | **High** | Низкая на старте | Очереди, timeout, drift, Concierge overload | Owner + Dev |
| **R11** | Dual SSOT баланс партнёра (status vs ledger) | **High** | Средняя до Phase 2 | Неверная выплата / спор «где деньги»; путаница FinOps | FinOps + Dev (ADR-203) |
| **R12** | Очередь `PENDING_FISCAL` / касса down | **Critical** | Средняя | Нарушение 54-ФЗ по факту оплаты; backlog чеков | FinOps + Fiscal vendor |

---

## Детали — Critical и High

### R01 — Webhook оплаты не дошёл / задержался *(Critical)*

**Категория ТЗ:** платежи (YooKassa / crypto).

**Что может пойти не так:** ЮKassa/crypto confirm не вызывает prod webhook (IP, secret, 5xx, timeout). Гость списан, бронь остаётся `CONFIRMED` / `AWAITING_PAYMENT` без `PAID_ESCROW` и без capture journal.

**Уже есть в продукте:**

- Идемпотентный webhook + `EscrowService.moveToEscrow`
- Cron **`reconcile-confirmed-payments`** (hourly на cron-job.org) — AUDIT_03 C3.4
- Ручной confirm в FinTech (`/admin/finances`) — только если webhook реально не пришёл
- Controlled Live + Emergency Pause

**Митигация:**

1. Держать hourly `reconcile-confirmed-payments` + TG FINANCE на ошибки webhook.  
2. Playbook: «гость пишет „оплатил“» → FinTech intent → admin confirm **один раз**.  
3. Не снимать IP/secret enforce на prod.  
4. Пилот: min сумма + лимит `CONTROLLED_LIVE_MAX_THB_PER_DAY`.

**Владелец:** FinOps (процесс) · Dev (webhook/cron).

---

### R02 — Ошибка Concierge-выплаты партнёру *(High)*

**Категория ТЗ:** выплаты партнёрам.

**Что может пойти не так:** неверный реквизит, двойная выплата, settle batch без ledger, выплата по спору/hold. Человеческий фактор при `TREASURY_MANUAL_MODE=1`.

**Уже есть:**

- Concierge treasury runbook, draft pools (`payout-batch-pools`), fail-closed settle
- Payout eligibility / dispute freeze / 24h thaw hold
- Ledger settlement journals при PAID
- ADR-203 Phase 1 shadow (бакеты vs `accountNet`)

**Митигация:**

1. Чеклист 4 глаз на первый live payout и на суммы &gt; порога (задать Owner).  
2. Не включать авто-банк payouts до зелёного soft launch.  
3. Сверять FinTech + `partner-ledger-shadow` / financial-health перед PAID.  
4. Запрет: два confirm одной оплаты (webhook + admin).

**Владелец:** Concierge / FinOps.

---

### R03 — База данных: размер, индексы, backup/restore *(High)*

**Категория ТЗ:** БД.

**Что может пойти не так:** нет проверенного restore drill; тяжёлые admin/search запросы без индексов; рост `ledger_*` (append-only) без политики архива.

**Митигация:**

1. Раз в квартал (до масштаба — до первого 100 live): restore drill в отдельный branch/project.  
2. Следить Advisors Supabase + медленные запросы после роста.  
3. Не DELETE money bookings / ledger rows (Stage 203) — планировать cold storage отдельно.  
4. Мониторить размер `ops_job_runs` / `critical_signal_events` (cleanup cron уже есть).

**Владелец:** Dev · Owner (бюджет Supabase plan).

---

### R04 — Vercel Hobby: cron, cold start, timeout *(High)*

**Категория ТЗ:** Vercel Hobby.

**Что может пойти не так:** hourly money jobs **нельзя** повесить только на Hobby; если cron-job.org молчит, thaw/reconcile живут на daily fallback (лаг до ~24ч). Cold start → таймаут тяжёлого cron/smoke.

**Уже есть:** dual schedule (Vercel daily + external hourly) — [`runbooks/CRON_EXTERNAL_FINANCIAL.md`](./runbooks/CRON_EXTERNAL_FINANCIAL.md); `ledger-shadow-reconcile` daily на Vercel OK.

**Митигация:**

1. Не убирать escrow-thaw / reconcile / promote с cron-job.org.  
2. Алерт «stale cron» (нет successful `ops_job_runs` N часов).  
3. При росте — Pro / отдельный worker, не «надеемся на Hobby».

**Владелец:** Dev / Ops.

---

### R05 — Юридика: 54-ФЗ, оферта, агентская / KG схема *(Critical)*

**Категория ТЗ:** юридика.

**Что может пойти не так:** касса не бьёт чек / sandbox на prod; оферта не совпадает с fee split / agent_sign; партнёрские договоры не подписаны → юр. No-Go даже при зелёном коде.

**Митигация:**

1. Закрыть §B–D в `PRE_REAL_PAYMENTS_CHECKLIST.md` до Live Mode.  
2. `FISCAL_PROVIDER_URL` боевой; sandbox выкл; retry из FinTech.  
3. Версии оферты через `/admin/settings/legal` — не публиковать в день массовых выплат без Legal.  
4. Сверка fiscal line labels с ADR-097 / IT service KG summary.

**Владелец:** Legal + Owner · FinOps (касса).

---

### R06 — Модерация контента *(High)*

**Категория ТЗ:** модерация.

**Что может пойти не так:** очередь PENDING растёт; ошибочный Approve скама; партнёр обходит quality gate.

**Уже есть:** `/admin/moderation`, approve→ACTIVE + revalidate, reject reason, launch readiness counters, listing publish quality.

**Митигация:**

1. Owner: SLA модерации (например &lt; 24ч) на soft launch.  
2. Не авто-approve без правил.  
3. Мониторить `ownerOps.pendingModeration` на `/admin`.  
4. Блок брони на PENDING listing (CONSTITUTION).

**Владелец:** Admin / Moderation · Owner (процесс).

---

### R07 — Telegram bot / FINANCE topic *(High)*

**Категория ТЗ:** Telegram.

**Что может пойти не так:** `TELEGRAM_BOT_TOKEN` revoked/rotated без обновления env; неверный `TELEGRAM_ADMIN_GROUP_ID` / thread → алерты в никуда. Пилот без глаз на drift/fiscal/payment.

**Митигация:**

1. Пункт Go/No-Go #9 обязателен до live.  
2. После ротации токена — smoke «TEST alert» + проверка topic FINANCE.  
3. Не полагаться только на email для money alerts.  
4. Дублировать critical signals в `critical_signal_events` (уже частично).

**Владелец:** Ops / Owner.

---

### R08 — Курсы THB/RUB (±20%) *(Medium)*

**Категория ТЗ:** FX.

**Что может пойти не так:** retail/mid display и payout spread расходятся с ожиданиями гостя/партнёра; маржа на RUB rails сжимается; споры «цена была другая».

**Уже есть:** snapshot на брони, mid vs retail SSOT, payout RUB spread, `exchange-rates-refresh` cron.

**Митигация:**

1. Не менять FX policy без ADR.  
2. При шоке: Emergency Pause новых оплат / временно поднять spread (с ADR/owner).  
3. Guest UI всегда из snapshot, не «живой» курс на старых бронях.

**Владелец:** FinOps + Pricing.

---

### R09 — Скрапинг / копии *(Medium)*

**Категория ТЗ:** конкуренты.

**Что может пойти не так:** массовый съём ACTIVE листингов/цен; клоны лендинга; нагрузка на search API.

**Уже есть:** rate-limit tiers (`lib/rate-limit`), guest-gate / crawler OG, session guards на create booking.

**Митигация:**

1. Не отдавать PII/точные координаты в публичном API сверх политики.  
2. Усилить rate limit на search/listings при аномалии.  
3. Юр. мониторинг доменов-клонов (Owner).  
4. Watermark / ToS на контент партнёров — процесс, не только код.

**Владелец:** Dev + Owner.

---

### R10 — Масштаб ~1000 броней/день *(High)*

**Категория ТЗ:** масштабирование.

**Что может пойти не так:** Concierge не успевает; Hobby timeouts; ledger shadow/health сканы упираются в лимиты; dispute/fiscal очереди.

**Митигация:**

1. Soft launch caps (Controlled Live max THB/day, ручные payouts).  
2. До роста: Pro/worker plan, очереди, batch settle proven.  
3. ADR-203: не flip SoT до 30d zeroDrift.  
4. Нагрузочный сценарий на search + create_booking_atomic до маркетинга.

**Владелец:** Owner (темп роста) · Dev (инфра).

---

### R11 — Dual SSOT partner cash (status vs ledger) *(High, доп.)*

**Не из списка 10, но релевантно запуску после Stage 203.**

**Что может пойти не так:** FinOps смотрит UI available, а `accountNetThb` уже после settle/hold другой → ошибочная выплата или «пропали деньги».

**Митигация:** Phase 1 shadow + daily `ledger-shadow-reconcile` (Vercel) + `[LEDGER_DRIFT]`; не менять `balance.service.js` до ADR-203 Phase 2/3; обучить Concierge читать shadow/accountNet.

**Владелец:** FinOps + Dev.

---

### R12 — Fiscal backlog / касса недоступна *(Critical, доп.)*

**Что может пойти не так:** оплата прошла, чек `PENDING_FISCAL` копится; регуляторный риск РФ.

**Митигация:** Go/No-Go касса; FinTech retry; `financial-health-monitor` алерт backlog; Pause при длительном down провайдера.

**Владелец:** FinOps + Fiscal vendor.

---

## Что уже снижает риск (не дублировать работу)

| Механизм | Риски |
|----------|--------|
| Controlled Live + Emergency Pause | R01, R08, R10 |
| Hourly cron-job.org (thaw / reconcile / promote) | R01, R04 |
| Concierge manual treasury | R02, R10 |
| Admin moderation + quality gate | R06 |
| Rate limits + booking guards | R09, R10 |
| ADR-203 shadow + append-only ledger | R02, R11 |
| Pre-real / Go-No-Go checklists | R05, R07, R12 |

---

## Рекомендуемые следующие шаги (ops, не код)

1. Закрыть открытые Critical из Go/No-Go (касса, оферта, TG FINANCE) — **R05, R07, R12**.  
2. Подтвердить на cron-job.org hourly money jobs (не shadow) — **R04**.  
3. Назначить Owner SLA модерации и порог «4 глаза» на payout — **R02, R06**.  
4. Раз в 2 недели обновлять статусы строк этого реестра (колонка «остаточный риск»).  
5. Детальный money-flow аудит (FSM/webhooks/dual SSOT): [`archive/audits/AUDIT_REPORT_MONEY_FLOW_04.md`](./archive/audits/AUDIT_REPORT_MONEY_FLOW_04.md).

*Документ живой; при смене модели выплат / тарифа Vercel / юрлица — обновить ID и митигации в том же PR.*
