# Чеклист до первой реальной выплаты и подключения ЮKassa

**Для кого:** владелец / финансовый оператор.  
**Когда:** после успешной симуляции Stage 104 (`npm run smoke:full-financial`) и настройки мониторинга Stage 105.  
**SSOT:** `ARCHITECTURAL_DECISIONS.md`, ADR-097, `lib/treasury/payout-rails.js`, `lib/treasury/treasury-ops-config.js`.

> **Stage 127.2 (2026-06-03):** `PaymentsV3Service.confirmPayment` — short-circuit на `CONFIRMED`/`COMPLETED` (`alreadyConfirmed`, без повторного escrow). Smoke **6c**.

> **Stage 127.1 (2026-06-03):** Pre-flight — smoke 12c ledger backoff; security sweep PAID_ESCROW UPDATE; USDT re-export в `booking-price-integrity.js`; Prisma enum warning.

> **Stage 127.0 (2026-06-03):** Payment Core hardening — idempotent `payments/confirm` на весь escrow pipeline; USDT SSOT `getExpectedUsdtForBooking`; ROI marketplace-health = `buildReferralRoiReport` (30d). Smoke **25/25** обязателен после деплоя.

> **Stage 126.3 (2026-06-03):** Подготовка к первой MIR — усиленные TG-алерты, баннер **CONTROLLED LIVE: ACTIVE** на FinTech, FI пресет **Real Payments Only**. Runbook: [`docs/CONTROLLED_LIVE_RUNBOOK.md`](CONTROLLED_LIVE_RUNBOOK.md).

> **Stage 126.2 (2026-06-03):** Минимализм — без отдельного Live Payments log и digest-cron; FI + TG по событиям.

> **Stage 126.0 (2026-06-03):** Controlled Live — кнопка **«Перейти в Live Mode»** на FinTech, live monitoring, алерт первой оплаты.

> **Stage 125.8 (2026-06-03):** **Фаза 1 закрыта** в репозитории. Pre-Live Readiness + owner sign-off.

> **Stage 125.7 (2026-06-03):** Pre-Live Readiness card на **`/admin/settings/finances`** — статусы по защите в коде и ops.

> **Stage 124.18–124.19 (2026-06-01):** checkout `AWAITING_PAYMENT` + RPC; auth на `submit-txid` / `verify-tron`; webhook guards; smoke шаг **6** = HTTP `initiate` → mock webhook → `PAID_ESCROW`.

**Быстрый Go/No-Go (15 мин):** [`docs/GO_NO_GO_FIRST_REAL_PAYMENT.md`](GO_NO_GO_FIRST_REAL_PAYMENT.md)

---

## Stage 126.3 — перед первой реальной MIR-оплатой (всё должно быть зелёным)

Короткий список **P0** — без этого не включайте Live Mode и не принимайте MIR.

| # | ☐ | Проверка | Где |
|---|---|----------|-----|
| 1 | ☐ | **Pre-Live Readiness** — Фаза 1 зелёная, ops без красных | `/admin/settings/finances` |
| 2 | ☐ | **Smoke 25/25** PASS на prod/staging | Pre-Live Readiness → «Запустить полный smoke» |
| 3 | ☐ | **Cron Health** — 7 задач OK | FinTech → Cron Health |
| 4 | ☐ | **Emergency Pause** выключен | FinTech-пульт |
| 5 | ☐ | **TREASURY_MANUAL_MODE=1**, mock/sandbox **выкл** | env + Pre-Live Readiness |
| 6 | ☐ | **ЮKassa** — боевые ключи, webhook URL → prod, секрет совпадает | §B, §E |
| 7 | ☐ | **Касса** — `FISCAL_PROVIDER_URL` боевой, `FISCAL_SANDBOX` выкл | §A2, §B3 |
| 8 | ☐ | **TG FINANCE** — `TELEGRAM_BOT_TOKEN` + `TELEGRAM_ADMIN_GROUP_ID` | Telegram тест |
| 9 | ☐ | **Controlled Live** — «Перейти в Live Mode» → баннер **ACTIVE** | FinTech header + карточка |
| 10 | ☐ | **Go/No-Go** подписан | [`GO_NO_GO_FIRST_REAL_PAYMENT.md`](GO_NO_GO_FIRST_REAL_PAYMENT.md) |

**Пилот MIR:** минимальная сумма · одна бронь · сразу проверить TG (ПЛАТЁЖ + ПЕРВАЯ MIR) · FI → **Real Payments Only** → P&L.

**Не включайте live**, пока пункты **1–8** не закрыты.

---

## Owner summary: что изменилось в 125.x и почему безопаснее live

Коротко для владельца — без технических деталей.

| Было (риск) | Стало (125.x) | Зачем вам |
|-------------|---------------|-----------|
| Повтор webhook банка мог снова «провести» оплату | Webhook отвечает «уже обработано» (2xx), деньги не двигаются второй раз | Банк может слать повтор — сайт не сломается и не задвоит |
| Повторный вызов escrow мог дублировать уведомления и fiscal | Side-effects с маркерами: promo, fiscal, «платёж получен» — только один раз | Меньше спама в Telegram и лишних чеков в кассе |
| Гость мог «откатить» оплату через submit-txid после escrow | Блокировка 409 — после escrow путь закрыт | Нельзя случайно испортить уже оплаченную бронь |
| Статус PAID_ESCROW можно было поставить в обход | Только через официальный escrow RPC | Деньги и статус брони всегда согласованы |
| Crypto webhook на уже оплаченной брони тянул лишние проверки | Безопасный 2xx без повторной верификации блокчейна | Меньше нагрузки и ложных ошибок |
| Алерты казначейства могли теряться при перезаписи настроек | Append-only журнал `critical_signal_events` | История алертов не пропадает |
| Fiscal мог повторно бить в кассу при reconcile | `PENDING_FISCAL` + попытка уже была → kassa не вызывается | Нет двойных чеков при сбоях провайдера |

**Вывод:** **Фаза 1 закрыта в коде** — можно готовиться к **controlled live** (пилот с лимитом). Перед первым реальным платежом нужны **внешние** пункты: ЮKassa, боевая касса, cron на prod, ручная staging-проверка (см. ниже).

---

## Закрытие Фазы 1 (Pre-Live Hardening) — официальный статус

| | |
|---|---|
| **Статус** | **ЗАКРЫТА** в репозитории (Stages 125.0–125.7, финал 125.8) |
| **Дата** | 2026-06-03 |
| **Smoke** | 25/25 PASS (`npm run smoke:full-financial`) |
| **UI** | `/admin/settings/finances` → **Pre-Live Readiness** |
| **Следующий этап** | Controlled Live (126.0) → pilot → owner sign-off |

- [x] Фаза 1 hardening (125.0–125.7) — код и smoke
- [x] Owner checklist + Pre-Live Readiness UI
- [ ] Деплой 125.8+ на **production**
- [ ] Smoke 25/25 на prod/staging
- [ ] Owner sign-off Go/No-Go ([`GO_NO_GO_FIRST_REAL_PAYMENT.md`](GO_NO_GO_FIRST_REAL_PAYMENT.md))

---

## Для владельца: что сделать перед первым реальным платежом

Короткий список без терминала. **P0** — блокер live; **P1** — до пилота желательно.

| # | ☐ | P | Действие | Где / как проверить |
|---|---|---|----------|---------------------|
| 1 | ☐ | P0 | **Деплой** последнего кода (Stage **125.8+**) на production | Vercel / CI |
| 2 | ☐ | P0 | **Миграции БД** на prod (124.18+, 125.5) | Supabase → Migrations |
| 3 | ☐ | P0 | **Pre-Live Readiness** — Фаза 1 зелёная, ops без красных | `/admin/settings/finances` |
| 4 | ☐ | P0 | **«Можно ли уже принимать деньги?»** — обязательные пункты зелёные | FinTech-пульт |
| 5 | ☐ | P0 | **«Запустить полный smoke»** — **25/25 PASS** | Pre-Live Readiness или верхняя карточка |
| 6 | ☐ | P0 | **Cron Health** — 7 задач OK | Кнопка «Проверить Cron Health» · [`CRON_EXTERNAL_FINANCIAL.md`](CRON_EXTERNAL_FINANCIAL.md) |
| 7 | ☐ | P0 | **Emergency Pause** выкл; **TREASURY_MANUAL_MODE=1**; mock/sandbox выкл | FinTech / env |
| 8 | ☐ | P0 | **ЮKassa**: ключи + webhook + секрет | §B, §E |
| 9 | ☐ | P0 | **Касса**: `FISCAL_PROVIDER_URL` боевой | §A2, §B3 |
| 10 | ☐ | P0 | **Controlled Live ACTIVE** (баннер на FinTech) | `/admin/settings/finances` |
| 11 | ☐ | P1 | **Юридическое**: оферта опубликована, ZIP | `/admin/settings/legal` · §C |
| 12 | ☐ | P1 | **Пилот MIR**: min сумма → PAID_ESCROW + fiscal ISSUED + TG | §E |

**Не включайте** приём live-платежей, пока пункты **3–10** не закрыты, даже если код «зелёный».

---

## Фаза 1 — что сделано (125.0–125.7)

Всё ниже **в коде** после деплоя Stage 125.8. Проверяется smoke и карточкой **Pre-Live Readiness**.

| Stage | Защита | Код / smoke |
|-------|--------|-------------|
| **125.0** | Idempotent `moveToEscrow` + reconcile side-effects | `move-to-escrow-side-effects.js` · smoke **6a** |
| **125.1** | `payments/confirm` → 2xx post-escrow | `status-sets.js` · smoke **7b** |
| **125.2** | `submit-txid` → 409 post-escrow | `payments-v3.service.js` · smoke **6c** |
| **125.3** | FSM: PAID_ESCROW только через escrow RPC | `status-transitions.js` · smoke **6d** |
| **125.4** | `crypto/confirm` → 2xx post-escrow | `crypto/confirm/route.js` · smoke **7c** |
| **125.5** | Treasury alerts → `critical_signal_events` | `treasury-monitoring-alerts.js` |
| **125.6** | Fiscal reconcile idempotency | `fiscal-kassa.service.js` · smoke **6a** |
| **125.7** | Pre-Live Readiness UI + owner checklist | `PreLiveReadinessCard`, `PRE_REAL_PAYMENTS_CHECKLIST.md` |
| **127.0** | Webhook idempotent на PAID_ESCROW…COMPLETED; USDT SSOT; ROI unified | `payments/confirm`, `booking-price-integrity.js`, `marketing-referral-roi.js` |

- [x] Фаза 1 hardening в репозитории (125.0–125.7)
- [x] Stage 127.0 payment-core hardening в репозитории
- [x] Pre-Live Readiness: smoke + Cron Health actions (125.8)
- [ ] Деплой на production + smoke **25/25** на prod/staging
- [ ] Owner Go/No-Go sign-off

---

## Что проверить вручную на staging перед первым реальным платежом

Чек-лист для владельца и оператора (~30–45 мин). Выполнять на **staging** (или prod с Emergency Pause до пилота).

### Платёж и escrow

| ☐ | Проверка | Ожидаемый результат |
|---|----------|---------------------|
| ☐ | Создать тестовую бронь → оплата MIR (или mock checkout на dev) | Статус `PAID_ESCROW`, сумма в FinTech |
| ☐ | Повторно отправить тот же webhook оплаты (или второй `moveToEscrow`) | 2xx / idempotent, **без** второго списания и **без** второго «ПЛАТЁЖ ПОЛУЧЕН» |
| ☐ | Проверить Telegram FINANCE | Одно уведомление о платеже на бронь |
| ☐ | Проверить fiscal | `ISSUED` или `SANDBOX_MOCK` (не зависший `PENDING_FISCAL` без причины) |

### Guards (негативные сценарии — через разработчика или smoke)

| ☐ | Проверка | Ожидаемый результат |
|---|----------|---------------------|
| ☐ | `submit-txid` на бронь уже в escrow | **409** — отклонено |
| ☐ | Прямая смена статуса на PAID_ESCROW в обход escrow | **403/409** — запрещено |
| ☐ | Webhook оплаты на бронь THAWED/COMPLETED | **2xx** idempotent, без изменений |

### Cron и мониторинг

| ☐ | Проверка | Ожидаемый результат |
|---|----------|---------------------|
| ☐ | FinTech → **Cron Health** | `escrow-thaw`, `promote-ready-for-payout`, `financial-health-monitor` — не stale |
| ☐ | FinTech → **Мониторинг** | Drift ledger в пределах порога |
| ☐ | Тест Emergency Pause | Вкл → новая оплата блокируется → выкл |

### Перед включением live на prod

| ☐ | Проверка | Ожидаемый результат |
|---|----------|---------------------|
| ☐ | ЮKassa webhook URL указывает на **prod** домен | Подтверждение в ЛК ЮKassa |
| ☐ | `FISCAL_PROVIDER_URL` — **боевой**, `FISCAL_SANDBOX` выключен | Pre-Live Readiness зелёный |
| ☐ | Пилотный лимит согласован (сумма / одна бронь) | Записано в runbook |
| ☐ | Go/No-Go [`GO_NO_GO_FIRST_REAL_PAYMENT.md`](GO_NO_GO_FIRST_REAL_PAYMENT.md) | Подпись владельца |

---

## A. Техническая готовность 100% (код и среда)

**Быстрая проверка владельца (без терминала):**

1. **`/admin/settings/finances`** → **Pre-Live Readiness** — Фаза 1 зелёная, операционные пункты без блокеров.
2. Там же → **«Можно ли уже принимать деньги?»** — обязательные пункты зелёные.
3. **«Запустить полный smoke»** — все шаги зелёные.

### Перед паузой на 1–2 недели (≈10 минут)

1. Откройте **`/admin/settings/finances`** (финансовый пульт).
2. Нажмите **«Подготовить систему к паузе»** → подтвердите.  
   Скачается ZIP: юридические документы, PDF-памятка «при возвращении», отчёт проверки. **Пауза включится автоматически** — новые оплаты остановятся.
3. Сохраните ZIP на компьютер и в облако (Google Drive / почта себе).
4. По желанию: зайдите в **Мониторинг** (вкладка) — убедитесь, что нет красных алертов.
5. Можно спокойно заниматься ЮKassa, ОсОО и договорами.

**Что уже защищено в коде (Stage 106.1–106.2 + 125.x):**

- На production **нельзя** подтвердить MIR/CARD без webhook ЮKassa.
- Mock-эквайринг и тестовая касса **отключены** на production.
- Без **FISCAL_PROVIDER_URL** новые оплаты **блокируются** (понятное сообщение гостю).
- Без **TREASURY_MANUAL_MODE=1** на production оплаты **блокируются** (ручной Concierge).
- **Emergency Pause** блокирует новые оплаты.
- **125.x:** idempotent webhooks, escrow reconcile, fiscal без повторных чеков, FSM/submit-txid guards.

---

## A. Техническая готовность (код и среда) — детальный чеклист

### A0. Stage 108–112.3 + 125.x — выполнено в репозитории

- [x] P0: legacy payout guard, booking status SSOT, schema 103.2 tooling, cron health UI
- [x] P1: chat POST SSOT, inbox Realtime dedup, CHECKED_IN ≠ THAWED, `BOOKING_STATUS` parity
- [x] Perimeter prod 404; FinTech API clients; `components/` без fetch (launch)
- [x] **125.0–125.6:** escrow/webhook/fiscal idempotency, guards, treasury alerts SSOT
- [x] Go/No-Go + readiness — `docs/GO_NO_GO_FIRST_REAL_PAYMENT.md`
- [x] `npm run verify:schema-103-2` — **6/6** на dev (повторить на prod после деплоя)
- [ ] Деплой **125.8+** на production + повтор verify/smoke на prod

### A1. Симуляция и мониторинг

- [ ] `npm run smoke:full-financial` — **25/25 PASS** (шаги 6, 6a, 6c, 6d, 7b, 7c)
- [ ] `npm run smoke:full-financial:rub` / `:intl` / `:all` — по необходимости
- [ ] Dev env: `PAYMENT_ACQUIRING_WEBHOOK_SECRET` · для MIR: `YOOKASSA_*`
- [ ] Миграции **124.18**, **125.5** на prod БД
- [ ] `/admin/settings/finances` → **Pre-Live Readiness** + **Cron Health**
- [ ] `TELEGRAM_BOT_TOKEN` + `TELEGRAM_ADMIN_GROUP_ID` на prod
- [ ] `TREASURY_MANUAL_MODE` не снят без решения
- [ ] Emergency Pause протестирован: вкл → бронь не создаётся → выкл

### A2. Env (prod)

| Переменная | Рекомендация |
|------------|----------------|
| `TREASURY_MANUAL_MODE` | `1` или не задавать (default ручной) |
| `TREASURY_AUTO_POOL` | `0` до live Concierge |
| `TREASURY_AUTO_PROMOTE` | можно `1` — cron только меняет статусы |
| `TREASURY_ALERT_*` | пороги крупных оплат / drift |
| `PAYMENT_ACQUIRER_RUB_ENABLED` | `1` перед live MIR |
| `PAYMENT_ACQUIRER_RUB_SHADOW` | `0` на prod |
| `FISCAL_PROVIDER_URL` | боевой провайдер кассы |
| `YOOKASSA_*` / webhook secret | по договору с PSP |

### A3. Cron (внешний, cron-job.org)

- [ ] `escrow-thaw` — hourly
- [ ] `promote-ready-for-payout` — hourly  
  См. [`docs/CRON_EXTERNAL_FINANCIAL.md`](CRON_EXTERNAL_FINANCIAL.md)
- [ ] `payout-batch-pools` — пн/чт (или по runbook)
- [ ] FinTech **Cron Health**: 7 jobs — без stale/error
- [ ] Auto-создание пулов **не** включено (ручные пулы из FinTech)

### A4. База и миграции

- [ ] `payout_batches`: `locked_at`, `exported_at`, `settled_at` (Stage 103.2)
- [ ] `critical_signal_events` — аудит алертов (125.5)
- [ ] `ops_job_runs` — Cron Health
- [ ] RLS и service_role для admin finance API

---

## B. Что нужно сделать **вне кода** (организация, 1–2 недели)

| # | ☐ | Задача | Кто |
|---|---|--------|-----|
| B0 | ☐ | Договор с **ЮKassa**, боевые ключи и webhook URL на prod | Владелец + банк/PSP |
| B1 | ☐ | **ОсОО KG** / IT-договор, реквизиты в fiscal env | Владелец + юрист |
| B2 | ☐ | **ИП РФ**: эквайринг, ИНН в `FISCAL_*` env | Владелец |
| B3 | ☐ | **Боевая онлайн-касса** (`FISCAL_PROVIDER_URL`, без sandbox) | Владелец + провайдер |
| B4 | ☐ | Реквизиты партнёров и пилотный лимит первой выплаты | Владелец |
| B5 | ☐ | Юр. документы: **`/admin/settings/legal`** → **ZIP** | Владелец |
| B6 | ☐ | Telegram FINANCE: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_GROUP_ID` | Владелец |

---

## C. Юридическое и комплаенс

| # | Задача | ☐ |
|---|--------|---|
| C1 | ИП РФ: договор эквайринга, ИНН в fiscal config | ☐ |
| C2 | ОсОО KG: договор IT-услуг, процедура USDT/KG | ☐ |
| C3 | Оферта гостя и условия партнёра **опубликованы** | ☐ |
| C4 | Версии в ZIP выплат актуальны | ☐ |
| C5 | Политика ПДн / возвраты — ссылки в checkout | ☐ |

---

## D. Банковское и два рельса

### D1. RUB Direct (`TBANK_RU`)

- [ ] Договор с банком · реквизиты партнёров RUB
- [ ] Пилотный пул → CSV → ручной перевод → «Отметить как оплаченный»
- [ ] PDF-акт в кабинете «Документы»

### D2. International (`KG_CRYPTO`)

- [ ] Процедура USDT / KG · `PARTNER_PAYOUT_FX_*`
- [ ] Пилотный пул → `registry-kg-usdt.csv`
- [ ] Конвертации в FinTech

**Правило:** не смешивать рельсы в одном банковском платеже.

---

## E. ЮKassa и первый live-платёж

| Шаг | Действие | ☐ |
|-----|----------|---|
| E1 | Боевые ключи ЮKassa, webhook на prod URL | ☐ |
| E2 | Тестовая оплата MIR/RUB на минимальную сумму | ☐ |
| E3 | Webhook → `PAID_ESCROW` + ledger THB | ☐ |
| E4 | Чек fiscal (не `PENDING_FISCAL`) | ☐ |
| E5 | TG: «ПЛАТЁЖ ПОЛУЧЕН» | ☐ |
| E6 | Сверка PSP ↔ snapshot RUB ↔ escrow THB | ☐ |
| E7 | Повтор webhook от PSP → 2xx, без дубля (125.1) | ☐ |

---

## F. Первая реальная выплата партнёру

1. Drift ledger **OK**, fiscal backlog **0** (или объяснён).
2. Пул по **одному** рельсу, lock, CSV/ZIP, перевод.
3. «Отметить как оплаченный» → акты → уведомление партнёру.
4. Запись конвертации (если был обмен).

---

## G. Go / No-Go

| **Go** | **No-Go** |
|--------|-----------|
| Smoke 25/25 PASS, Pre-Live Readiness без красных ops | Любой FAIL smoke, drift > порога |
| Фаза 1 (125.x) задеплоена, cron OK | Sandbox fiscal на prod |
| ЮKassa webhook проверен на staging/prod | Emergency Pause без причины |
| Пилот ≤ согласованного лимита | Смешение рельсов в одном платеже |

---

## Связанные документы

- [`docs/GO_NO_GO_FIRST_REAL_PAYMENT.md`](GO_NO_GO_FIRST_REAL_PAYMENT.md) — быстрый Go/No-Go  
- [`docs/CONCIERGE_LAUNCH_TREASURY_RUNBOOK.md`](CONCIERGE_LAUNCH_TREASURY_RUNBOOK.md) — §12 симуляция, §10 эквайринг  
- [`docs/CRON_EXTERNAL_FINANCIAL.md`](CRON_EXTERNAL_FINANCIAL.md) — cron  
- [`docs/PHASE_D_CLOSURE_AND_ROADMAP.md`](PHASE_D_CLOSURE_AND_ROADMAP.md) — roadmap после Фазы 1  
- [`docs/CONTROLLED_LIVE_RUNBOOK.md`](CONTROLLED_LIVE_RUNBOOK.md) — ежедневный чек-лист первых 2 недель live  

*Stage 105 · обновлено **126.3** (2026-06-03) — Фаза 1 закрыта, подготовка к первой MIR*
