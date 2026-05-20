# GoStayLo — Pre-Launch Checklist (Stage 103)

**Цель:** безопасный soft launch (первые 50–100 броней) с Financial Model v2.0, фискализацией, treasury и ручными выплатами (Concierge Launch).

**Краткий smoke для владельца:** `npm run smoke:full-financial` или кнопка в `/admin/settings/legal`. Подробный чеклист: `docs/STAGE_103_PRE_LAUNCH_CHECKLIST.md`.

**SSOT:** `ARCHITECTURAL_DECISIONS.md` → `docs/ADR/097-financial-model-v2.md` → `docs/TECHNICAL_MANIFESTO.md` → `docs/ARCHITECTURAL_PASSPORT.md`.

---

## 1. Инфраструктура и секреты

| # | Пункт | Как проверить | Ответственный |
|---|--------|----------------|---------------|
| 1.1 | Production env на Vercel / хостинге | Все `NEXT_PUBLIC_*`, Supabase, cron `CRON_SECRET` | DevOps |
| 1.2 | `PRICING_ENGINE_V2` — осознанное значение | `GET /api/v2/pricing/engine-config` → `roundingMode: integer` | FinTech |
| 1.3 | `FISCAL_SANDBOX=false` перед live-чеками | Admin → FinTech → карточка Fiscal prod | FinTech |
| 1.4 | `FISCAL_PROVIDER_URL` — prod OFD/касса | Smoke чек на тестовой оплате 1 ₽ / минимум | Бухгалтерия + Dev |
| 1.5 | `FISCAL_KG_SUPPLIER_NAME`, `FISCAL_RU_AGENT_INN` | Compliance export по booking → supplier tag | Бухгалтерия |
| 1.6 | **Vercel Hobby:** в `vercel.json` **нет** hourly (`0 * * * *`) — иначе deploy fail | Только daily: `escrow-thaw`, `financial-health-monitor` | DevOps |
| 1.6b | **cron-job.org** (обязательно для hourly) | `promote-ready-for-payout`, `escrow-thaw` hourly; `payout-batch-pools` ПН/ЧТ — см. `docs/CRON_EXTERNAL_FINANCIAL.md` | DevOps |
| 1.6c | Smoke cron | `npm run smoke:financial` → PASS | DevOps |
| 1.6e | Smoke E2E financial (Stage 103) | `npm run smoke:full-financial` → все ✅; см. `docs/STAGE_103_PRE_LAUNCH_CHECKLIST.md` | FinTech |
| 1.6f | Schema 103.2 (payout lifecycle) | `npm run verify:schema-103-2` → 6/6 ✅; иначе `migrations/stage103_2_payout_batches_lifecycle_columns.sql` | DevOps |
| 1.6d | Prod env | `docs/PRODUCTION_ENV.md` — `PRICING_ENGINE_V2=true`, `FISCAL_SANDBOX=false` | DevOps |
| 1.7 | Legal KG IT contract wording | `docs/legal/IT_SERVICE_KG_CONTRACT_SUMMARY.md` согласован с бухгалтерией | Legal |

---

## 2. Smoke E2E (финансы)

Выполнить на **staging** с `PRICING_ENGINE_V2=true`, затем повторить 1 сценарий на prod.

| # | Шаг | Ожидание |
|---|------|----------|
| 2.1 | Создать бронь (категория stay + transport) | `pricing_snapshot.v=2`, `final_breakdown`, `rounding_pot_thb` |
| 2.2 | Гость: PDP/checkout total = server | Нет расхождения с `computeRoundedGuestTotal` / engine-config |
| 2.3 | Оплата → `PAID_ESCROW` | Ledger journal: host credit, split `PLATFORM_FEE_*`, pot |
| 2.4 | Fiscal | `metadata.fiscal` → `ISSUED` или `PENDING_FISCAL` + retry из admin |
| 2.5 | Завершение stay → thaw cron | `THAWED`, `metadata.escrow_thawed_at` |
| 2.6 | < 24 ч после thaw | Партнёр: карточка «Разморозка (24 ч)», **не** в «Доступно к выводу» |
| 2.7 | ≥ 24 ч + `promote-ready-for-payout` | `READY_FOR_PAYOUT`, `metadata.ready_for_payout_at` |
| 2.8 | Заявка на выплату | Только сумма из `availableBalanceThb` |
| 2.9 | ПН/ЧТ: пул | Admin «Сформировать пул» → DRAFT → Lock → CSV export |

**Playwright:** существующие E2E auth/booking; добавить сценарий checkout total при v2 (если ещё нет).

---

## 3. Attestation и целостность цен (Stage 100 — LOCKED)

| # | Пункт | Действие |
|---|--------|----------|
| 3.1 | Checkout attestation v2 | SSOT: `lib/booking-price-integrity.js` — `final_breakdown.total_guest_payable_rounded_thb` + **Math.round 1 THB** при v2; **pot10 только** для legacy snapshot |
| 3.2 | createBooking / inquiry | `computeAttestationGuestTotalThb` + `verifyClientGuestTotalAttestation` |
| 3.3 | Checkout UI | `usePricingEngineConfig` + `computeRoundedGuestTotal(..., integer)` |
| 3.4 | Shadow compare | Логи `pricing_shadow` без критичных drift > порога |
| 3.5 | Guest API | Нет утечки internal % в partner/guest responses |
| 3.6 | UI статусы | `lib/booking/booking-status-display.js` — THAW_HOLD, DISPUTED, READY_FOR_PAYOUT |

---

## 4. Ledger reconcile

| # | Пункт | Действие |
|---|--------|----------|
| 4.1 | Выборка 10 оплаченных броней v2 | Admin Compliance → legs = snapshot split |
| 4.2 | Σ ledger THB по booking = snapshot | RU agent + KG service + FX + host + pot |
| 4.3 | Partner reconciliation | `/partner/finances` — «совпадают с ledger» (зелёный) |
| 4.4 | RUB columns | Экспорт для бухгалтера (если курс зафиксирован в snapshot) |

---

## 5. Fiscal (prod)

| # | Пункт | Env / код |
|---|--------|-----------|
| 5.1 | Sandbox off | `FISCAL_SANDBOX=false` |
| 5.2 | Provider URL | `FISCAL_PROVIDER_URL` → prod endpoint |
| 5.3 | Один чек «Полный расчёт» | `payment_method: full_payment` |
| 5.4 | Transit | `agent_sign=5`, supplier = KG name + RU INN |
| 5.5 | Формулировки | IT-услуги / техподдержка (не «роялти») в line names |
| 5.6 | Retry | Admin FinTech → Retry fiscal по booking UUID |

---

## 5b. Dispute × payout (Stage 99)

| # | Пункт | Проверка |
|---|--------|----------|
| 5b.1 | Открытие спора | Партнёр видит «Заблокировано спором» |
| 5b.2 | Ledger hold | `DISPUTE_PARTNER_FUNDS_HELD` |
| 5b.3 | Закрытие спора | `DISPUTE_PARTNER_FUNDS_RELEASED`, withdraw снова доступен |
| 5b.4 | Smoke | `docs/FINANCIAL_SMOKE_E2E.md` сценарий B |

## 6. Treasury и статусы

| # | Статус | UI партнёра | Cron / job |
|---|--------|---------------|------------|
| 6.1 | `PAID_ESCROW` | «В эскроу» | — |
| 6.2 | `THAWED` (< 24h) | «Разморозка (24 ч)» | — |
| 6.3 | `THAWED` (≥ 24h) или `READY_FOR_PAYOUT` | «Доступно к выводу» | `POST /api/cron/promote-ready-for-payout` |
| 6.4 | Batch | Admin пулы ПН/ЧТ | `POST /api/cron/payout-batch-pools` |

**SSOT hold:** `lib/partner/partner-payout-eligibility.js` (`PARTNER_WITHDRAWAL_HOLD_MS`).

---

## 7. Admin и compliance

| # | Пункт | Путь |
|---|--------|------|
| 7.1 | FinTech dashboard | `/admin/settings/finances` |
| 7.1b | Concierge treasury runbook | `docs/CONCIERGE_LAUNCH_TREASURY_RUNBOOK.md` (cron, первая бронь, пул → CSV → банк) |
| 7.2 | Сформировать пул на сегодня | Кнопка + Force (не ПН/ЧТ) |
| 7.3 | Реестр для банка (CSV) | Пульт → «Реестр для банка» → период по **дате оплаты** (не создания брони) или UUID → CSV с `;` для Excel; пустой период — пояснение в файле + toast |
| 7.3b | Конвертации (Stage 101) | Пульт → блок-заглушка «Конвертации и потери» — ручной журнал в следующем релизе |
| 7.4 | Pricing profiles CRUD | Без изменения % без ADR |
| 7.5 | Simulator | Только staff — не в guest/partner API |

---

## 8. Legal и договоры

| # | Документ | Примечание бухгалтера |
|---|----------|------------------------|
| 8.1 | Договор **ИТ-услуги и техподдержка** (KG) | 0% налог у источника в РФ (не роялти) |
| 8.2 | Публичная оферта / агентский договор RU | Согласованы формулировки комиссии |
| 8.3 | Реестры выплат и акты | «ИТ-услуги», transit, полный расчёт |
| 8.4 | Privacy / refund | Актуальны на сайте `/legal/*` |

---

## 9. Rollback

| Сценарий | Действие |
|----------|----------|
| Ошибка в pricing v2 | `PRICING_ENGINE_V2=false` → pot10 rounding, legacy ledger single line |
| Fiscal provider down | `FISCAL_SANDBOX=true` + queue `PENDING_FISCAL`, не блокировать escrow |
| Неверный пул | Batch в DRAFT — не Lock; удалить draft items в admin/DB по runbook |
| Массовый drift ledger | Стоп новых оплат, флаг v2 off, расследование по compliance export |

---

## 10. Мониторинг (первые 72 ч)

- Ops job runs: `promote-ready-for-payout`, `escrow-thaw`, `payout-batch-pools`
- Critical telemetry: fiscal failures, ledger capture errors
- Support macro: «24 ч после разморозки — доступно к выводу»

---

## 10b. Vercel deploy (Hobby)

- [ ] `vercel.json` — **no** `0 * * * *` or `*/N` patterns (only ≤1×/day per job)
- [ ] Deploy succeeds on Vercel
- [ ] cron-job.org jobs created per `docs/CRON_EXTERNAL_FINANCIAL.md`
- [ ] `financial-prelaunch-smoke.mjs` PASS on production URL

## 12. Перед первой реальной выплатой партнёру (владелец, без кода)

Отметьте галочкой в день перевода денег.

- [ ] `npm run smoke:full-financial` — все шаги ✅ (или кнопка «Сгенерировать тестовый полный пакет» в `/admin/settings/legal`)
- [ ] `/admin/settings/finances` — нет красного баннера (чеки, drift, крупная сумма)
- [ ] Карточка **«Готово к выплате»** — сумма и число броней ожидаемы
- [ ] Пул сформирован → **Lock** → скачаны **CSV** и **ZIP** для банка
- [ ] Реквизиты в CSV совпадают с `/partner/payout-profiles` у каждого партнёра
- [ ] Нет открытых споров по броням из пула
- [ ] Деньги **уже переведены** в банке → только потом **«Закрыть пул»**
- [ ] Партнёр видит акт: `/partner/finances` → вкладка **Документы**
- [ ] ZIP + выписка банка сохранены для бухгалтерии
- [ ] При обмене валют — запись в «Конвертации и потери»

**Runbook:** `docs/CONCIERGE_LAUNCH_TREASURY_RUNBOOK.md` — раздел «День первой выплаты».

---

## 11. Sign-off

| Роль | Имя | Дата | Подпись |
|------|-----|------|---------|
| Product | | | |
| FinTech / Backend | | | |
| Бухгалтерия | | | |
| Legal | | | |
| DevOps | | | |

---

## Связанные артефакты

- `docs/INVESTOR_ONE_PAGER_FINANCIAL_V2.md`
- `docs/ADR/097-financial-model-v2.md`
- Migration `database/migrations/053_financial_model_v2.sql`
- `lib/pricing-engine/`, `lib/services/payout-batch.service.js`
