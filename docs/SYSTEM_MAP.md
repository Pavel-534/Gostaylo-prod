# System Map — архитектурный паспорт (живой)

> **Version**: 13.2.10 | **Last Updated**: 2026-08-05 | **Stage 200.30:** wizard pin→geo SSOT; **200.29** field highlight.  
> **Это и есть «паспорт» системы** (стек, таблицы, API-пути, интеграции).  
> Инварианты — [`CONSTITUTION.md`](./CONSTITUTION.md). Code-truth — [`TECHNICAL_MANIFESTO.md`](./TECHNICAL_MANIFESTO.md).  
> Хаб — [`README.md`](./README.md). Монолит-архив — [`archive/ARCHITECTURAL_PASSPORT_ARCHIVE.md`](./archive/ARCHITECTURAL_PASSPORT_ARCHIVE.md).

---

## 0. Масштаб поверхностей

| Поверхность | Маршруты / зона | Кто |
|-------------|-----------------|-----|
| Storefront | `/`, `/listings`, PDP | Renter / guest |
| Checkout | `/checkout/[bookingId]` | Renter |
| Chat | `/messages` | Renter ↔ Partner (+ staff) |
| Renter hub | `/my-bookings`, `/profile`, favorites | Renter |
| Partner | `/partner/*` | Partner |
| Admin / FinTech | `/admin/*` | Staff |
| Concierge ops | treasury / payouts UI + runbooks | Ops |
| Auth | `/auth/*` immersive | All |
| API | `/api/v2/*`, `/api/webhooks/*`, `/api/cron/*` | Server |
| PWA / push | SW + FCM | Clients |

Детальный продуктовый поток — [`PRODUCT_FLOW_MAP.md`](./PRODUCT_FLOW_MAP.md). Деньги — [`FINANCIAL_FLOW_MAP.md`](./FINANCIAL_FLOW_MAP.md).

---

## 1. Стек

| Слой | Технология |
|------|------------|
| Framework | **Next.js 14** (App Router), React 18 |
| UI | Tailwind CSS + Shadcn/UI |
| Database | **Supabase** PostgreSQL |
| Auth | Cookie `gostaylo_session` + опционально **Supabase Auth** (OAuth) |
| Storage | Supabase Storage |
| State (client) | React + **TanStack Query** (`lib/query-keys.js`) |
| Notifications | Telegram Bot API + Resend email + **FCM** push |
| Deployment | **Vercel** |
| Schema doc | `prisma/schema.prisma` (описание; рантайм — Supabase) |

**Ключи БД:** доменные PK/FK (`profiles`, `listings`, `bookings`, chat ids) в проде — **TEXT**, не нативный `uuid`.

---

## 2. Ключевые таблицы БД

| Таблица | Назначение |
|---------|------------|
| `profiles` | Пользователи, роли, балансы, Telegram, quiet hours, referral |
| `listings` | Объявления; `base_price_thb` THB-канон; `metadata` JSONB; статус модерации |
| `categories` | Вертикали: `slug`, `wizard_profile`, i18n, visibility flags |
| `bookings` | Заказы; статусы FSM; `pricing_snapshot`; fee/pot колонки |
| `conversations` | Чаты; deal SSOT через `booking_id` |
| `messages` | Сообщения треда |
| `calendar_blocks` | Блокировки календаря (manual / iCal / holds) |
| `seasonal_prices` | Сезонные цены (приоритет над metadata) |
| `promo_codes` | Промо PLATFORM/PARTNER, flash sale, allowlist |
| `reviews` / `guest_reviews` | Отзывы гостя о листинге / партнёра о клиенте (+ moderation) |
| `ledger_accounts` | План счетов (THB double-entry); Stage 203: +`DISPUTE_HOLD_RESERVE` |
| `ledger_journals` | Журналы; append-only; `booking_id` ON DELETE SET NULL + `deleted_booking_id` |
| `ledger_entries` | DEBIT/CREDIT строки; append-only |
| `payout_methods` | Рельсы выплат (CARD/BANK/CRYPTO) |
| `partner_payout_profiles` | Реквизиты партнёра |
| `payouts` / `payout_batches` / `payout_batch_items` | Заявки и Concierge-пулы |
| `pricing_profiles` | Pricing engine v2 / jurisdiction split |
| `system_settings` | General fee/FX/settlement keys |
| `system_fintech_settings` | FinTech singleton (acquiring, referral waterfall, L2 flags) |
| `user_push_tokens` | FCM multi-device |
| `chat_push_delivery_batch` | Отложенный chat push (anti-spam) |
| `ops_job_runs` | Журнал cron/background jobs |
| `critical_signal_events` | Аудит критичных сигналов |
| `profile_auth_identities` | Связка провайдеров auth |
| `auth_phone_otp_challenges` | Phone OTP |
| `referral_codes` / referral ledger tables | Реферальная программа |
| `leads_waiting_list` | Waitlist «coming soon» категорий |
| `activity_log` / `audit_logs` | Операционный / staff audit |
| `finance_bank_reconciliation_entries` | Bank reconciliation (FI) |

---

## 3. Критические API endpoints

Только пути (детали — манифест / архив паспорта).

### 3.1 Public / renter

| Path |
|------|
| `GET /api/v2/listings` |
| `GET /api/v2/listings/[id]` |
| `GET /api/v2/search` / listings search |
| `GET /api/v2/categories` |
| `GET /api/v2/exchange-rates` |
| `GET /api/v2/favorites` · `…/check` |
| `GET /api/v2/recommendations/for-you` |
| `GET /api/v2/listings/[id]/similar` |
| `POST /api/v2/bookings` |
| `GET /api/v2/bookings` · `…/[id]` |
| `POST /api/v2/bookings/[id]/payment/initiate` |
| `POST /api/v2/bookings/[id]/payment/confirm` |
| `GET|POST /api/v2/bookings/[id]/payment-intent` |
| `POST /api/v2/bookings/[id]/apply-promo` |
| `GET|PATCH /api/v2/bookings/[id]/emergency-contact` · `emergency-context` · `emergency-support-ticket` |
| `POST /api/v2/bookings/[id]/check-in/confirm` |
| `POST /api/v2/bookings/[id]/cancel` |
| `POST /api/v2/promo-codes/validate` |
| `POST /api/v2/push` |
| `POST /api/v2/upload` · `DELETE /api/v2/upload` |

### 3.2 Chat

| Path |
|------|
| `GET|POST /api/v2/chat/conversations` |
| `POST /api/v2/chat/messages` (и связанные message routes) |
| `POST /api/v2/chat/invoice` · `GET /api/v2/chat/invoice` |

### 3.3 Partner

| Path |
|------|
| `GET|POST|PATCH /api/v2/partner/listings*` | Wizard draft-after-category; soft publish (`softPublish` → PENDING + `quality_incomplete`); locales via `mergeDescriptionTranslationsForSave` |
| `POST /api/v2/partner/listings/generate-description` | `mode: 'generate'\|'translate'` |
| `GET|PUT /api/v2/partner/bookings*` |
| `GET /api/v2/partner/calendar` |
| `GET /api/v2/partner/stats` |
| `GET /api/v2/partner/balance-breakdown` |
| `GET /api/v2/partner/finances-summary` |
| `GET|POST /api/v2/partner/payouts*` |
| `POST /api/v2/partner/promo-codes*` |
| `POST /api/v2/partner/guest-reviews` |

### 3.4 Admin / staff

| Path |
|------|
| `GET|PATCH /api/admin/moderation` (approve/reject/set_featured/**update**: title/desc/district/price) |
| `GET /api/admin/metrics/overview` |
| `GET|PUT /api/admin/finances/fintech-settings` |
| `GET|POST /api/admin/finances/payout-batches` · `…/[id]` (lock/settled; settled single-flight → 409 `settle_in_progress`, TTL 1800s + heartbeat; `finally` release) · export · bank-package |
| `GET /api/admin/finances/compliance-export` |
| `GET /api/admin/finances/dashboard` · treasury / conversions / movements |
| `/admin/finance/intelligence*` |
| `GET /api/v2/admin/ledger-balances` (ADMIN only) · `ledger-reconciliation` |
| `GET /api/v2/admin/partner-ledger-shadow?partnerId=` (ADMIN/MODERATOR) — ADR-203 Phase 1 |
| `GET|PATCH /api/v2/admin/payouts*` |
| `POST /api/v2/admin/payouts/tbank-registry` |
| `POST /api/v2/admin/bookings/[id]/emergency-actions` |

### 3.5 Auth

| Path |
|------|
| `POST /api/v2/auth/login` · logout / me |
| `POST /api/v2/auth/phone/send` · `verify` |
| `POST /api/v2/auth/telegram` |
| OAuth callback routes (Google / region-gated providers) |

### 3.6 Webhooks & cron

| Path |
|------|
| `POST /api/webhooks/telegram` |
| `POST /api/webhooks/payments/confirm` |
| `POST /api/webhooks/crypto/confirm` |
| `POST /api/v2/payments/verify-tron` |
| `POST /api/v2/payments/submit-txid` |
| `/api/cron/escrow-thaw` |
| `/api/cron/promote-ready-for-payout` |
| `/api/cron/payout-batch-pools` |
| `/api/cron/ical-sync` |
| `/api/cron/push-sweeper` |
| `/api/cron/review-reminder` |
| `/api/cron/cleanup-drafts` — Stage 200.22: empty drafts 7d / contentful 30d |
| `/api/cron/exchange-rates-refresh` |
| `/api/cron/referral-*` · financial health monitors |
| `/api/cron/ledger-shadow-reconcile` — ADR-203 Phase 1 status↔ledger shadow |

---

## 4. Внешние интеграции

| Интеграция | Роль | Статус (из паспорта) |
|------------|------|----------------------|
| **YooKassa** (MIR_RU) | Гостевая оплата картой RUB/MIR | **READY** |
| **Mandarin** (CARD_INTL) | Int’l card acquiring scaffold | **PARTIAL** |
| **Tron / USDT TRC-20** | Crypto pay + `verifyTronTransaction` + crypto webhook | **PARTIAL** |
| **Telegram** | Admin topics, partner DM, Login Widget (non-RU), notify deep-link | **READY** (ops-зависимо) |
| **FCM / Firebase** | Web (и Cap) push; SW template → `public/sw.js` | **READY** |
| **Resend** | Транзакционная почта (+ transport guard для smoke/E2E) | **READY** |
| **Vercel Cron** | Daily schedules; hourly financial — часто **внешний** cron-job.org | Hybrid |
| **iCal / Airbnb feeds** | Импорт занятости партнёра | **READY** (cron) |
| **TronScan** (verify path) | On-chain проверка USDT | Часть crypto path |
| **T-Bank CSV registry** | Исходящие RUB payouts (Concierge) | Ops / READY tooling |
| **Stripe** | — | **Absent** |

---

## 5. Карта сервисов (верхний уровень)

```
BookingService          → create / query / status orchestration
  booking-status.service → transitionBookingStatus (FSM SSOT)
  smoke-booking-status   → smoke/E2E FSM helpers (+ negative_test force only)
  payout-batch-settle-two-phase → settling_at → ledger → COMPLETED (+ orphan scan)
  ops-job-outcome / stale-cron-monitor → soft-fail≠success; [STALE_CRON]
  ESCROW_THAW_SOURCE_STATUSES → PAID_ESCROW∪CHECKED_IN → THAWED
  treasury-conversion-idempotency → client/ext/fp keys
PricingService          → stay math, fee policy, promo validate
PaymentsV3Service       → initiate / confirm / adapters
EscrowService           → PAID_ESCROW + thaw + balance sync
LedgerService           → double-entry capture / settle / refund
PayoutBatchService      → Concierge pools (Mon/Thu or manual)
NotificationService     → email / Telegram / FCM dispatch
PushService             → FCM templates + quiet policy
ReputationService       → partner trust / health
```

Основные UI-поверхности: storefront (`/`, `/listings`, PDP, checkout), `/messages`, `/my-bookings`, `/partner/*`, `/admin/*`, `/profile/referral`.
