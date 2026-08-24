# System Map — архитектурный паспорт (живой)

> **Version**: 13.2.106 | **Last Updated**: 2026-08-23 | **201.113** FX cron soft 200 + 429 cooldown; **201.112** FX cron skip/keep-existing.  
> **Это и есть «паспорт» системы** (стек, таблицы, API-пути, интеграции).  
> Инварианты — [`CONSTITUTION.md`](./CONSTITUTION.md). Code-truth — [`TECHNICAL_MANIFESTO.md`](./TECHNICAL_MANIFESTO.md).  
> Хаб — [`README.md`](./README.md). Монолит-архив — [`archive/ARCHITECTURAL_PASSPORT_ARCHIVE.md`](./archive/ARCHITECTURAL_PASSPORT_ARCHIVE.md).

---

## 0. Масштаб поверхностей

| Поверхность | Маршруты / зона | Кто |
|-------------|-----------------|-----|
| Storefront | `/`, `/listings`, PDP — Stage 200.71: apex canonical + true 404; `sitemap.xml`/`robots.txt` via `getPublicSiteUrl()` | Renter / guest |
| Checkout | `/checkout/[bookingId]` | Renter |
| Chat | `/messages` | Renter ↔ Partner (+ staff) |
| Renter hub | `/my-bookings`, `/profile`, favorites | Renter |
| Partner | `/partner/*` | Partner |
| Admin / FinTech | `/admin/*` | Staff |
| Concierge ops | treasury / payouts UI + runbooks | Ops |
| Auth | `/auth/*` immersive | All |
| API | `/api/v2/*`, `/api/webhooks/*`, `/api/cron/*` | Server |
| PWA / push | SW + FCM; **201.19** silent push ack; **M1.1** `PushClientInit`; Soft CTA; `unregister` on logout; install UX **200.81**. Catalog phone: **201.96** mobile-first mount; **201.104** Search tab paints catalog skeleton immediately, listings metadata skips search; **201.103** Home/catalog UI inside page HydrationBoundary; **201.101** instant PDP chrome; Search tab does not open filter sheet; **201.99** Home rails 10 min stale | Clients |
| List scroll restore | Soft-back to same Y/card: `route-scroll-memory.js` + root `RouteScrollMemoryHost` (**201.18–201.22**, **201.111** pin clicked link until height is stable; **201.109** never silent miss). Allowlist home `/`, `/listings?…`, `/my-bookings`. Map camera is separate (`catalog-map-viewport-memory`). | Clients |

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
| `profiles` | Пользователи, роли, балансы, Telegram, quiet hours, referral; ADR-210: `is_shadow`, `shadow_claimed_at` |
| `listings` | Объявления; `base_price_thb` THB-канон (L1 asset→THB mid); wizard form `basePriceThb` = asset in `baseCurrency` (preview: mid→THB→guest fee→retail header FX, Stage 200.49); `metadata` JSONB; статус модерации; ADR-210: optional `concierge_batch_id` |
| `categories` | Вертикали: `slug`, `wizard_profile`, i18n, visibility flags |
| `bookings` | Заказы; статусы FSM; `pricing_snapshot`; fee/pot колонки |
| `conversations` | Чаты; deal SSOT через `booking_id` |
| `messages` | Сообщения треда |
| `calendar_blocks` | Блокировки: manual / iCal URL / invoice_hold; **201.47** expired holds purged |
| `seasonal_prices` | Сезонные цены (приоритет над metadata) |
| `promo_codes` | Промо PLATFORM/PARTNER, flash sale, allowlist |
| `reviews` / `guest_reviews` | Отзывы гостя о листинге / партнёра о клиенте (+ moderation) |
| `ledger_accounts` | План счетов (THB double-entry); Stage 203: +`DISPUTE_HOLD_RESERVE` |
| `ledger_journals` | Журналы; append-only; `booking_id` ON DELETE SET NULL + `deleted_booking_id`; **201.09** `purge_test_ledger_rows` |
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
| `referral_program_stats` | Квартальный avg earned активного амбассадора (ADR-131A; cron A1.3) |
| `leads_waiting_list` | Waitlist «coming soon» категорий |
| `activity_log` / `audit_logs` | Операционный / staff audit |
| `finance_bank_reconciliation_entries` | Bank reconciliation (FI) |
| `concierge_import_batches` | ADR-210 Concierge Supply import batches (ops; service_role + admin read) |
| `partner_claim_invites` | ADR-210 magic claim invites (`token_hash` only) |

---

## 3. Критические API endpoints

Только пути (детали — манифест / архив паспорта).

### 3.1 Public / renter

| Path |
|------|
| `GET /api/v2/listings` |
| `GET /api/v2/listings/[id]` |
| `GET /api/v2/search` / listings search (lite: L1 currency **201.88** + `countryCode`/`cityCode` **201.93**) |
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
| `GET|PATCH /api/v2/bookings/[id]/emergency-contact` · `emergency-context` · `emergency-support-ticket` — Stage 200.72: SMS via `dispatchSms` or ops_fallback |
| `POST /api/v2/bookings/[id]/check-in/confirm` — Stage 200.72: `fundsReleased: false` / `escrowHeld: true` |
| `POST /api/v2/bookings/[id]/cancel` |
| `POST /api/v2/promo-codes/validate` |
| `POST /api/v2/push` |
| `POST /api/v2/upload` · `DELETE /api/v2/upload` |
| `POST /api/v2/feedback` — product feedback (session required) → TG `TELEGRAM_USER_FEEDBACK_TOPIC_ID` (fallback system-alerts) + optional `getSupportInboxEmail()`; Stage **200.137** + **202.0** (currency, Home/`/help` CTA) |

### 3.2 Chat

| Path |
|------|
| `GET|POST /api/v2/chat/conversations` |
| `POST /api/v2/chat/messages` (и связанные message routes) |
| `POST /api/v2/chat/invoice` · `GET /api/v2/chat/invoice` |

### 3.3 Partner

| Path |
|------|
| `GET|POST|PATCH /api/v2/partner/listings*` | Wizard draft-after-category; soft publish (`softPublish` → PENDING + `quality_incomplete`); locales via `mergeDescriptionTranslationsForSave`; Stage 200.36 geo assert on write |
| `POST /api/v2/partner/listings/generate-description` | `mode: 'generate'\|'translate'` |
| `POST /api/v2/partner/geo/provisional` | Upsert provisional city into `geo_locations`; name normalize + centroid/TZ backfill (Stage 200.45/200.47) |
| `POST /api/v2/partner/geo/ensure-country` | Upsert ISO country row for wizard typeahead / FK (Stage 200.45) |
| `GET /api/v2/geo/locations` | Cascade catalog (`level` / `parent` / `code`) |
| `GET /api/v2/geo/resolve-where` | Public where → label/centroid/zoom (`geo_locations`) |
| `GET /api/v2/geo/listing-label` | Listing location display line (codes → labels) |
| `GET /api/v2/geocode` · `/suggest` · `/reverse` | GeoService (catalog + Nominatim cache) |
| `GET|PUT /api/v2/partner/bookings*` |
| `GET /api/v2/partner/calendar` | Stage **200.53.3** bulk raw (3 queries) + `buildCalendar` in-memory; DTO unchanged |
| `GET /api/v2/partner/stats` |
| `GET /api/v2/partner/balance-breakdown` |
| `GET /api/v2/partner/finances-summary` |
| `GET /api/v2/partner/finances-export` | CSV/PDF statement; `from`/`to`/`format`/`axis=created\|checkout` (Stage 211.1; read-model SSOT; max 366d / 2000 rows) |
| `GET /api/v2/partner/finances-period` | Stage 211.2 period pack: gross/fee/net earned + PAID/COMPLETED payouts + linked settlement acts |
| `GET /api/v2/partner/finances-statement-pdf` | Legacy PDF alias (`created_at` only) → same loader as `finances-export` |
| `GET|POST /api/v2/partner/payouts*` |
| `POST /api/v2/partner/promo-codes*` |
| `POST /api/v2/partner/guest-reviews` |

### 3.4 Admin / staff

| Path |
|------|
| `GET|PATCH /api/admin/moderation` (approve/reject/set_featured/**update**: title/desc/district/**L1 asset price** via `buildListingPriceWriteFields`) |
| `GET /api/admin/metrics/overview` |
| `GET|PUT /api/admin/finances/fintech-settings` |
| `GET|POST /api/admin/finances/payout-batches` · `…/[id]` (lock/settled; settled single-flight → 409 `settle_in_progress`, TTL 1800s + heartbeat; `finally` release) · export · bank-package |
| `GET /api/admin/finances/compliance-export` |
| `GET /api/admin/finances/dashboard` · treasury / conversions / movements |
| `/admin/finance/intelligence*` |
| `GET /api/v2/admin/ledger-balances` (ADMIN only) · `ledger-reconciliation` |
| `GET /api/v2/admin/partner-ledger-shadow?partnerId=` (ADMIN/MODERATOR) — ADR-203 Phase 1 |
| `POST /api/v2/admin/concierge/partners` (ADMIN) — ADR-210 shadow partner provision |
| `POST /api/v2/admin/concierge/ingest` (ADMIN) — ADR-210 Concierge listing ingest |
| `POST /api/v2/admin/concierge/claim-invites` (ADMIN) — ADR-210 magic claim invite + email |
| `POST /api/v2/admin/concierge/rehost-media` (ADMIN) — ADR-210 Concierge image rehost → listing-images |
| `POST|GET /api/v2/admin/concierge/validate-payload` (ADMIN) — ADR-210 mapping dry-run (no DB) |
| `GET /api/v2/admin/concierge/batches` · `GET …/batches/[id]` (ADMIN) — ADR-210 batch journal |
| `GET /api/v2/admin/concierge/partner-search` · `GET …/prompt` (ADMIN) — Slice 7 UI helpers |
| UI `/admin/concierge` (ADMIN) — Concierge Supply import + journal |
| `GET|PATCH /api/v2/admin/payouts*` |
| `POST /api/v2/admin/payouts/tbank-registry` |
| `POST /api/v2/admin/bookings/[id]/emergency-actions` |

### 3.5 Auth

| Path |
|------|
| `POST /api/v2/auth/login` · logout / me — client applies `result.user` immediately; `finishAuthNavigation` (pending + replace). Destination still hydrates via `GET /me` |
| `POST /api/v2/partner/concierge-welcome/ack` — ADR-210 clear welcome-pending flag |
| `POST /api/v2/auth/phone/send` · `verify` |
| `POST /api/v2/auth/telegram` |
| OAuth callback routes (Google / region-gated providers) |

### 3.6 Webhooks & cron

| Path |
|------|
| `POST /api/webhooks/telegram` |
| `POST /api/webhooks/payments/confirm` — Stage 200.70: amount fail-closed; CARD_INTL Mandarin GET verify |
| `POST /api/webhooks/crypto/confirm` — Stage 200.69: header secret (prod); `settle-crypto-payment.js` |
| `POST /api/v2/payments/verify-tron` — Stage 200.69: `getExpectedUsdtForBooking` + same settle SSOT |
| `POST /api/v2/payments/submit-txid` |
| `/api/cron/escrow-thaw` |
| `/api/cron/reconcile-confirmed-payments` |
| `/api/cron/reconcile-yookassa-pending` — Stage **202.7**: poll INITIATED MIR_RU via YooKassa GET (~10m external) |
| `/api/cron/promote-ready-for-payout` |
| `/api/cron/payout-batch-pools` |
| `/api/cron/ical-sync` |
| `/api/cron/push-sweeper` |
| `/api/cron/review-reminder` |
| `/api/cron/cleanup-drafts` — Stage 200.22: empty drafts 7d / contentful 30d; **201.09** stale unpaid past check-out cancel |
| `/api/cron/cleanup-test-data` — Stage **201.09**: E2E/smoke + `purge_test_ledger_rows(markers)` |
| GitHub Actions **`.github/workflows/playwright.yml`** — Stage **201.11**: nightly keep-list `npm run test:e2e:nightly` (03:00 UTC), then cleanup |
| `/api/cron/exchange-rates-refresh` | **Only writer** to ExchangeRate-API → upsert `exchange_rates` (Stage **202.1**); Bearer/`x-cron-secret`; skip if rows <4h; upstream fail → **200** + `keptExisting` + 12h 429 cooldown (**201.113**) |
| `GET /api/v2/exchange-rates` | Reads DB via `getDisplayRateMap` — **no** upstream call (202.1) |
| `/api/cron/referral-*` · financial health monitors |
| `/api/cron/ledger-shadow-reconcile` — ADR-203 Phase 1 status↔ledger shadow |

---

## 4. Внешние интеграции

| Интеграция | Роль | Статус (из паспорта) |
|------------|------|----------------------|
| **YooKassa** (MIR_RU) | Гостевая оплата картой RUB/MIR | **READY** |
| **Mandarin** (CARD_INTL) | Int’l card acquiring scaffold | **PARTIAL** |
| **Tron / USDT TRC-20** | Crypto pay + `verifyTronTransaction` + crypto webhook | **PARTIAL** |
| **Telegram** | Admin topics (system-alerts, optional user-feedback), partner DM, Login Widget (non-RU), notify deep-link | **READY** (ops-зависимо) |
| **Sentry** | Runtime errors (App Router); empty DSN = no-op; no Replay; TG `[SENTRY]` via server beforeSend | **READY** (Stage **202.0**, DSN opt-in) |
| **PostHog** | Product analytics (`NEXT_PUBLIC_POSTHOG_KEY`); ADR-169 SSOT — no Clarity/Webvisor | **READY** (opt-in) |
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
NotificationService     → registry + optional NOTIFICATION_OUTBOX enqueue; drain cron
PushService             → FCM templates + quiet policy
ReputationService       → partner trust / health
```

Основные UI-поверхности: storefront (`/`, `/listings`, PDP, checkout), `/messages`, `/my-bookings`, `/partner/*`, `/admin/*`, `/profile/referral`.
