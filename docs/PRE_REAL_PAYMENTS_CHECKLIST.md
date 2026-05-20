# Чеклист до первой реальной выплаты и подключения ЮKassa

**Для кого:** владелец / финансовый оператор.  
**Когда:** после успешной симуляции Stage 104 (`npm run smoke:full-financial:all`) и настройки мониторинга Stage 105.  
**SSOT:** `ARCHITECTURAL_DECISIONS.md`, ADR-097, `lib/treasury/payout-rails.js`, `lib/treasury/treasury-ops-config.js`.

> **Stage 108 (2026-05) — техническая уборка завершена.** P0/P1 из `docs/PRODUCT_FLOW_MAP.md` закрыты в коде: legacy payout guard, status SSOT, schema 103.2 verify (`npm run verify:schema-103-2`), cron health на FinTech-пульте, чат/inbox dedup, pricing aliases, режим владельца на `/admin/settings/finances`. Дальше — внешние шаги: ЮKassa, ОсОО, договоры (§B–D ниже).

---

## A. Техническая готовность 100% (код и среда)

**Быстрая проверка владельца (без терминала):** откройте **`/admin/settings/finances`** → вверху карточка **«Статус готовности к реальным платежам»**. Обязательные пункты — **зелёные**. Нажмите **«Запустить полный smoke»** — все шаги зелёные.

### Перед паузой на 1–2 недели (≈10 минут)

1. Откройте **`/admin/settings/finances`** (финансовый пульт).
2. Нажмите **«Подготовить систему к паузе»** → подтвердите.  
   Скачается ZIP: юридические документы, PDF-памятка «при возвращении», отчёт проверки. **Пауза включится автоматически** — новые оплаты остановятся.
3. Сохраните ZIP на компьютер и в облако (Google Drive / почта себе).
4. По желанию: зайдите в **Мониторинг** (вкладка) — убедитесь, что нет красных алертов.
5. Можно спокойно заниматься ЮKassa, ОсОО и договорами.

*Вручную (если кнопка недоступна): smoke → legal ZIP → Emergency Pause — см. runbook §14.*

**Что уже защищено в коде (Stage 106.1–106.2):**

- На production **нельзя** подтвердить MIR/CARD без webhook ЮKassa.
- Mock-эквайринг и тестовая касса **отключены** на production.
- Без **FISCAL_PROVIDER_URL** новые оплаты **блокируются** (понятное сообщение гостю).
- Без **TREASURY_MANUAL_MODE=1** на production оплаты **блокируются** (ручной Concierge).
- **Emergency Pause** блокирует новые оплаты.

---

## A. Техническая готовность (код и среда) — детальный чеклист

### A0. Stage 108 (код-уборка) — выполнено в репозитории

- [x] P0: legacy payout guard, booking status SSOT, schema 103.2 tooling, cron health UI
- [x] P1: chat POST SSOT, inbox Realtime dedup, CHECKED_IN ≠ THAWED, `BOOKING_STATUS` parity, pricing aliases
- [x] `npm run verify:schema-103-2` — **6/6** на среде из `.env.local`
- [ ] Деплой на production + повтор verify/smoke на prod

### A1. Симуляция и мониторинг

- [ ] `npm run smoke:full-financial:rub` — **PASS** (15/15)
- [ ] `npm run smoke:full-financial:intl` — **PASS** (15/15)
- [ ] `npm run smoke:full-financial:all` — шаг **«16. Два рельса одновременно»** — **PASS**
- [ ] `/admin/settings/finances` → **Мониторинг**: пороги понятны, алерты приходят в TG (топик FINANCE)
- [ ] `TELEGRAM_BOT_TOKEN` + `TELEGRAM_ADMIN_GROUP_ID` заданы на prod
- [ ] `TREASURY_MANUAL_MODE` не снят без решения (по умолчанию **true** — авто-пулы выключены)
- [ ] Emergency Pause протестирован: вкл → бронь не создаётся → выкл

### A2. Env (prod)

| Переменная | Рекомендация |
|------------|----------------|
| `TREASURY_MANUAL_MODE` | `1` или не задавать (default ручной) |
| `TREASURY_AUTO_POOL` | `0` до live Concierge |
| `TREASURY_AUTO_PROMOTE` | можно `1` — cron только меняет статусы |
| `TREASURY_ALERT_PAYMENT_THB_MIN` | порог крупной оплаты (default 50000) |
| `TREASURY_ALERT_READY_POOL_THB_MIN` | порог «готово к выплате» (default 100000) |
| `TREASURY_ALERT_LEDGER_DRIFT_THB_MIN` | default 0.5 |
| `PAYMENT_ACQUIRER_RUB_ENABLED` | `1` перед live MIR |
| `PAYMENT_ACQUIRER_RUB_SHADOW` | `0` на prod |
| `FISCAL_PROVIDER_URL` | боевой провайдер кассы |
| `YOOKASSA_*` / webhook secret | по договору с PSP |

### A3. Cron (внешний, cron-job.org)

- [ ] `escrow-thaw` — hourly
- [ ] `promote-ready-for-payout` — hourly  
  См. `docs/CRON_EXTERNAL_FINANCIAL.md`
- [ ] Auto-создание пулов **не** включено (ручные пулы из FinTech)

### A4. База и миграции

- [ ] `payout_batches`: `locked_at`, `exported_at`, `settled_at` (Stage 103.2)
- [ ] `critical_signal_events` — для аудита алертов
- [ ] RLS и service_role для admin finance API

---

## B. Что нужно сделать **вне кода** (организация, 1–2 недели)

| # | Задача | Кто |
|---|--------|-----|
| B0 | Договор с **ЮKassa**, боевые ключи и webhook URL на prod | Владелец + банк/PSP |
| B1 | **ОсОО KG** / IT-договор, реквизиты в fiscal env | Владелец + юрист |
| B2 | **ИП РФ**: эквайринг, ИНН в `FISCAL_*` env | Владелец |
| B3 | Подключить **боевую онлайн-кассу** (`FISCAL_PROVIDER_URL`, без sandbox) | Владелец + провайдер кассы |
| B4 | Реквизиты партнёров и пилотный лимит первой выплаты | Владелец |
| B5 | Экспорт юр. документов: **`/admin/settings/legal`** → **ZIP** — архив для банка/юриста | Владелец (1 клик) |
| B6 | Telegram FINANCE: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_GROUP_ID` | Владелец |

Пока эти пункты не закрыты — **не включайте** приём live-платежей на production, даже если код зелёный.

---

## C. Юридическое и комплаенс

| # | Задача | ☐ |
|---|--------|---|
| C1 | ИП РФ: договор эквайринга, ИНН в fiscal config | ☐ |
| C2 | ОсОО KG: договор IT-услуг, процедура USDT/KG | ☐ |
| C3 | Оферта гостя и условия партнёра **опубликованы** (`/admin/settings/legal`) | ☐ |
| C4 | Версии в ZIP выплат актуальны | ☐ |
| C5 | Политика ПДн / возвраты — ссылки в checkout | ☐ |

---

## D. Банковское и два рельса

### D1. RUB Direct (`TBANK_RU`)

- [ ] Договор с банком (T-Bank / массовые выплаты)
- [ ] Партнёры RUB: `preferred_payout_currency = RUB`, реквизиты проверены
- [ ] Пилотный пул → `registry-rub-direct.csv` → ручной перевод → «Отметить как оплаченный»
- [ ] PDF-акт партнёру в кабинете «Документы»

### D2. International (`KG_CRYPTO`)

- [ ] Процедура USDT / KG (до API биржи — ручной реестр)
- [ ] `PARTNER_PAYOUT_FX_*` согласованы с финмоделью
- [ ] Пилотный пул → `registry-kg-usdt.csv`
- [ ] Конвертации в FinTech «Конвертации и потери»

**Правило:** не смешивать рельсы в одном банковском платеже.

---

## E. ЮKassa и первый live-платёж

| Шаг | Действие | ☐ |
|-----|----------|---|
| E1 | Боевые ключи ЮKassa, webhook `POST /api/webhooks/payments/confirm` на prod URL | ☐ |
| E2 | Тестовая оплата MIR/RUB на минимальную сумму | ☐ |
| E3 | Webhook → `PAID_ESCROW` + ledger THB | ☐ |
| E4 | Чек fiscal (не `PENDING_FISCAL`) | ☐ |
| E5 | TG: «ПЛАТЁЖ ПОЛУЧЕН»; при крупной сумме — алерт мониторинга | ☐ |
| E6 | Сверка PSP ↔ snapshot RUB ↔ escrow THB | ☐ |

---

## F. Первая реальная выплата партнёру

1. Drift ledger **OK** (< порога), fiscal **0** pending (или объяснён backlog).
2. Пул по **одному** рельсу, lock, CSV/ZIP, перевод в банке/кошельке.
3. «Отметить как оплаченный» → акты → уведомление партнёру.
4. Запись конвертации (если был обмен валют).

---

## G. Go / No-Go

| **Go** | **No-Go** |
|--------|-----------|
| Smoke all rails PASS, мониторинг в TG, ручной режим вкл | Любой FAIL smoke, drift > порога без разбора |
| ЮKassa webhook проверен на staging/prod | Sandbox fiscal на prod |
| Пилот ≤ согласованного лимита | Emergency Pause активен без причины |
| Реквизиты сверены вручную | Смешение RUB Direct и International в одном платеже |

---

## Связанные документы

- `docs/CONCIERGE_LAUNCH_TREASURY_RUNBOOK.md` — §12 симуляция, §10 эквайринг  
- `docs/PRE_LAUNCH_CHECKLIST.md` — soft launch  
- `docs/CRON_EXTERNAL_FINANCIAL.md` — cron  

*Stage 105 · 2026-05-19*
