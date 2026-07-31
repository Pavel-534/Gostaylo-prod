# AUDIT REPORT 01 — соответствие кодовой базы конституции

> **Дата:** 2026-07-31  
> **Канон:** [`docs/CONSTITUTION.md`](../../CONSTITUTION.md), [`docs/SYSTEM_MAP.md`](../../SYSTEM_MAP.md)  
> **Объём:** pricing / FSM / escrow / ledger / bookings API / checkout / payment webhooks / guards  
> **Ограничение исходного прохода:** анализ only.  
> **Remediation (тот же день):** CRITICAL #1–#3 закрыты в коде/доке — см. § Remediation ниже.

---

### [OK] — соответствует конституции

| Модуль / область | Комментарий |
|------------------|-------------|
| `lib/booking/status-transitions.js` | Partner + system FSM; `validatePaidEscrowFsmGuard`; совпадает с CONSTITUTION §1.3–1.4 |
| `lib/booking/status-sets.js` + `lib/booking-occupancy-statuses.js` | OCCUPYING / ESCROW pipeline / NO_PAY_TRAVEL — как в §1.5 |
| `lib/config/app-constants.js` → `BOOKING_STATUS` | Полный набор статусов из §1.1 (кроме UI-only `DECLINED`, см. WARN) |
| `lib/pricing/price-truth.js` | Stay payable + `resolveCheckoutChargeTotalThb` = `price_thb + commission_thb + rounding_diff_pot` |
| `lib/services/pricing/pricing-fee-policy.js` | Fee % из `system_settings.general`; explicit `hostCommissionPercent: 0` не перекрывается legacy |
| `lib/config/platform-split-fee-defaults.js` | Launch defaults 15 / 0 / 0.5 — единственный числовой фолбэк split-fee |
| `lib/booking-price-integrity.js` → `computeRoundedGuestTotalPot` | Pot до 10 THB (канон §2.3) |
| `lib/services/pricing.service.js` | Оркестратор stay/promo/fee |
| `lib/services/escrow.service.js` | `supabaseAdmin` + RPC `move_to_escrow_and_post_ledger_v1` → `PAID_ESCROW` (не прямой FSM UPDATE) |
| `lib/services/ledger.service.js` + `lib/services/ledger/*` | Facade + capture/settle/refund/dispute на `supabaseAdmin` |
| `lib/services/escrow/legacy-payout-guard.js` | Блокирует prod `processPayout` без `ALLOW_LEGACY_PAYOUT` |
| `lib/services/booking/booking-status.service.js` | Единая точка смены статуса + referral hook |
| `app/api/v2/bookings/route.js` | `resolveBookingCreateSession` (IDOR guard); create через `BookingService` / atomic RPC |
| `app/api/v2/bookings/[id]/payment/confirm/route.js` | Session + renter scope; `assertClientPaymentConfirmAllowed`; `EscrowService.moveToEscrow` |
| `app/api/v2/bookings/[id]/payment/initiate/route.js` | `supabaseAdmin`; переход в `AWAITING_PAYMENT` через `transitionBookingStatus` |
| `app/api/v2/bookings/[id]/check-in/confirm/route.js` | `PAID_ESCROW` → `CHECKED_IN` (system path); не путает с THAWED |
| `app/api/webhooks/payments/confirm/route.js` | HMAC / adapter signature + IP allowlist + guest gate + idempotent escrow |
| `app/api/webhooks/crypto/confirm/route.js` | Shared secret + `assertWebhookGuestPaymentAllowed` |
| `app/api/webhooks/supabase/booking-status/route.js` | `BOOKING_STATUS_WEBHOOK_SECRET` |
| `app/api/cron/**` (все 28 route.js) | `assertCronAuthorized` присутствует |
| Admin FinTech / ledger routes (выборка) | `requireAdminStaff` + ledger writes через service_role |
| Checkout hooks (`useCheckout*`) | Финансовые операции только через `/api/v2/...` (не прямой Supabase money write) |
| `lib/currency-last-resort.js` | Аварийные FX/комиссия только из env/settings — без литерала курса в коде |
| `hooks/use-commission.js` | Ставка с `/api/v2/commission`, не хардкод |

---

### [WARN] — несоответствие, не критично

| Файл:строка | Проблема | Рекомендация |
|-------------|----------|--------------|
| `lib/config/app-constants.js:32` + `status-sets.js` | `DECLINED` в enum / sets, но **нет** в `PARTNER`/`SYSTEM` transitions; Postgres enum без `DECLINED` (UI-only) | Зафиксировать в CONSTITUTION §1.1: «UI-only alias → пишется `CANCELLED`». Убрать мёртвые ветки `DECLINED` в partner PUT |
| `app/api/v2/partner/bookings/[id]/route.js:166–172,216,240` | Код принимает/обрабатывает `DECLINED`, но `validatePartnerBookingStatusTransition` его **отклонит** (dead code) | Клиент шлёт `CANCELLED` (`booking-request-card.js:84`); почистить API от `DECLINED` или маппить `DECLINED → CANCELLED` до валидации |
| `components/price-breakdown.js:72–75` | Fallback без `priceData.breakdown`: fee = `base * rate/100`, но **`total = totalBase` без fee** | Не использовать fallback для checkout/PDP; везде `BookingPriceBreakdown` / server totals. Либо чинить формулу, либо удалить path |
| `hooks/pricing/useListingPricing.js` | Клиентский preview через `calculatePrice` + defaults; authoritative charge — booking columns / initiate | Ок для PDP preview; не принимать client totals как charge без server reprice |
| `components/partner/wizard/WizardPartnerEarningsCalculator.jsx:26` | Локальный `fee = round(b * pct/100)` для preview payout | Оставить как preview; подпись «ориентир», не ledger SSOT |
| `components/admin/finances/FinTechAmbassadorSettingsPanel.jsx:21,86` | Default scenario `guestServiceFeePercent: 15` + локальный waterfall preview | Admin what-if; не путать с `getFeePolicy`. Можно читать defaults из `PLATFORM_SPLIT_FEE_DEFAULTS` |
| `app/demo/price-breakdown/page.js:7` | `DEMO_COMMISSION_RATE = 0.15` (доля), а `PriceBreakdown` ждёт **проценты** (`/100`) | Demo-only; либо `15`, либо закрыть `/demo` на prod |
| `app/admin/users/page.js` (~397) | Копирайт «глобальная 15%» | Заменить на «глобальная ставка из settings» / `{brand}`-нейтрально |
| `lib/config/app-constants.js:6` | Хардкод `GOSTAYLO_WALLET` crypto address | Вынести в env/`system_settings`; имя legacy ok как internal id |
| `app/api/v2/admin/ledger-balances/route.js:8–20` | Gate = `requireAdminStaff` (ADMIN **и** MODERATOR) | CONSTITUTION §4.2: финансы → `ADMIN`. Либо сузить gate до `requireAccess({ roles: ['ADMIN'] })`, либо уточнить док (MODERATOR read-only ledger) |
| `docs/CONSTITUTION.md` §2.3 Identity | Формула `userTotal − partnerPayout = platformMargin` **ломается** при `rounding_diff_pot > 0` (и при tax) | Исправить док (см. CRITICAL ниже) — код charge/pot верный |
| `docs/SYSTEM_MAP.md` §3.1 | Нет `apply-promo`, `payment-intent`, emergency-* | Дополнить карту при следующем docs PR |
| Checkout `fetch('/api/v2/...')` | Аудит-критерий «прямой fetch» — здесь fetch **на свой API**, не на PostgREST money | Считать OK; риск — дубли логики в hooks (сейчас initiate/confirm на сервере) |

---

### [CRITICAL] — нарушает SSOT или финансовую безопасность

| Файл:строка | Проблема | Срочная рекомендация |
|-------------|----------|----------------------|
| `app/api/v2/partner/bookings/[id]/route.js:140–146` | При отсутствии `SUPABASE_URL` / key возвращается **`status: 'success'`** без записи в БД (фейковый апдейт статуса) | **Немедленно:** возвращать `503` / `500`, никогда success без persisted transition. Правильная версия: **код должен отказывать**; текущее поведение опаснее доки |
| `app/api/v2/partner/bookings/[id]/route.js:25` · `partner/stats/route.js:48` · `partner/calendar/route.js:22` · `app/api/admin/settings/route.js:70` | `SUPABASE_SERVICE_ROLE_KEY \|\| NEXT_PUBLIC_SUPABASE_ANON_KEY` — fallback на **anon** для server REST | Убрать fallback; fail-closed если нет service_role. Финансовые/partner writes только `supabaseAdmin`. **Канон:** SYSTEM_MAP / мигра-rule — service_role на сервере |
| `docs/CONSTITUTION.md` §2.3 Identity vs код | Документ: `userTotalThb − partnerPayoutThb = platformMarginThb`. При pot: LHS = margin + `rounding_diff_pot` (+ tax). **Противоречие дока и математики кода** | **Правильная версия — код** (`price-truth` / pot / charge). Обновить CONSTITUTION: `userTotal − partnerPayout = platformMargin + roundingDiffPot [+ tax]` |
| (риск конфигурации) Partner PUT + anon fallback | Если в env только anon, RLS может дать частичный доступ / неожиданные 401, а при «успехе» без URL — silent lie (см. выше) | Prod checklist: обязателен `SUPABASE_SERVICE_ROLE_KEY`; алерт если key === anon |

*Не найдено:* клиентский прямой insert в `ledger_*` / `bookings` money columns через anon; escrow без RPC; cron без `assertCronAuthorized`; хардкод курса вида `35.5` вне last-resort env.

---

### [MISSING] — файл/модуль не найден или не покрыт конституцией

| Пробел | Деталь |
|--------|--------|
| `app/checkout/*` (корень) | Checkout живёт в `app/(storefront)/checkout/[bookingId]/*` — SYSTEM_MAP ок по смыслу, путь в аудит-инструкции устарел |
| `GET …/payment-status` | В legacy archive; не в живом SYSTEM_MAP — ок |
| `DECLINED` / UI cancel taxonomy | Не описаны в CONSTITUTION FSM; частично в `BOOKING_STATUS` + timelines |
| Identity + tax + pot | CONSTITUTION не описывает `taxRatePercent` в identity, хотя `pricing-fee-policy` / PDP его считают |
| `requireAccess({ roles: ['ADMIN'] })` vs `requireAdminStaff` | Док говорит ADMIN-only финансы; код часто staff (ADMIN+MODERATOR) — нет единой строки в CONSTITUTION |
| Client API clients для checkout | Хуки бьют `fetch` напрямую; нет единого `checkout-api-client.js` (не нарушение SSOT денег, но пробел карты клиентов) |
| Покрытие аудита | Закрыто в **[`AUDIT_REPORT_02.md`](./AUDIT_REPORT_02.md)** (2026-07-31): referral L2/MLM, payout-batch/Concierge, chat invoice, PricingEngine v2 vs pot10 |

---

## Краткий вердикт

Финансовое ядро (**price-truth → fee policy → initiate/confirm → Escrow RPC → ledger**) в целом **выровнено** с конституцией. Главные дыры: **фейковый success** partner booking PUT без БД, **anon-key fallback** на server routes, и **ошибочная identity-формула в CONSTITUTION** (править док под код). Клиентский checkout через API — норма; ручные fee в demo/admin preview — WARN.

**Следующий шаг (вне этого отчёта):** hotfix partner PUT fail-closed + убрать anon fallback; PR на правку CONSTITUTION §2.3 identity.

---

## Remediation (2026-07-31)

| CRITICAL | Статус | Где |
|----------|--------|-----|
| Fake success partner PUT | **Fixed** | `app/api/v2/partner/bookings/[id]/route.js` — `503` + `supabaseAdmin` only |
| Anon fallback server routes | **Fixed** | partner stats (service_role only), partner calendar (`supabaseAdmin` only), admin settings (`supabaseAdmin`, PUT/GET fail-closed) |
| Constitution §2.3 identity | **Fixed** | `docs/CONSTITUTION.md` — pot (+ tax) in identity; `DECLINED` UI note in §1.1 |

WARN (DECLINED dead paths / price-breakdown fallback / SYSTEM_MAP gaps) — **WARN remediations 2026-07-31** (см. AUDIT_02 § Remediation WARN); deferred: fintech literal sweep, held RMW, search pot10 mode.

