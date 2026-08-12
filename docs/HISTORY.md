# История изменений (Stage chronology)

> Таблица Stage (индекс). Подробный исторический проз — [`archive/reports/TECHNICAL_MANIFESTO_STAGE_LOG.md`](./archive/reports/TECHNICAL_MANIFESTO_STAGE_LOG.md) и [`archive/ARCHITECTURAL_PASSPORT_ARCHIVE.md`](./archive/ARCHITECTURAL_PASSPORT_ARCHIVE.md).  
> Живой code-truth — [`TECHNICAL_MANIFESTO.md`](./TECHNICAL_MANIFESTO.md) (без километрового changelog).  
> Номера без строки в таблице — в конце файла.

| Stage | Дата | Краткое описание | Статус |
|-------|------|------------------|--------|
| 200.113 | 2026-08-12 | Partner empty states: WorkspaceEmptyState on listings/reviews/promo (no API change) | Done |
| 200.112 | 2026-08-12 | Partner i18n sweep: guest-review UI + promo flash/settings save toasts (no API change) | Done |
| 200.111 | 2026-08-12 | Partner listings list: section rhythm + hub mint stats (no listing patch/delete API change) | Done |
| 200.110 | 2026-08-12 | Partner promo: section rhythm + field labels + hub mint (no promo-codes API change) | Done |
| 200.109 | 2026-08-12 | Partner master calendar: section rhythm + hub mint on education (no calendar/iCal API change) | Done |
| 200.108 | 2026-08-12 | Partner reviews + guest-review: section rhythm + hub mint (no review API change) | Done |
| 200.107 | 2026-08-12 | Wizard Calendar step: PARTNER_SECTION titles for sync/blocks/seasons (no calendar API change) | Done |
| 200.106 | 2026-08-12 | Partner settings: section titles/dividers + field labels + hub mint (no save/auth API change) | Done |
| 200.105 | 2026-08-12 | Partner finances + payout-profiles: section titles/dividers + hub mint surface (no ledger/payout API change) | Done |
| 200.104 | 2026-08-12 | Partner dashboard: section titles/dividers + hub mint surface on metrics (no analytics API change) | Done |
| 200.103 | 2026-08-12 | Partner bookings list: hub mint card surface + section titles/dividers (no FSM/price change) | Done |
| 200.102 | 2026-08-12 | Dark Mode Input contrast: raise `--input`/`--border` tokens + brand-mint focus on Input/Textarea/Select | Done |
| 200.101 | 2026-08-12 | Wizard Photos+Preview: PartnerSectionDivider / TITLE / FIELD + flat rhythm (no upload/preview logic change) | Done |
| 200.100 | 2026-08-12 | Safe polish: RU plurals, cancellation section title, trust text-xs, shorter geo helpers | Done |
| 200.99 | 2026-08-12 | Stay arrival hours in wizard + soft early/late on-request (informational only) | Done |
| 200.98 | 2026-08-11 | Wizard sticky CTA bar: equal vertical padding (fix safe-area-pb override) | Done |
| 200.97 | 2026-08-11 | Tighter wizard bottom clearance; clearer mint PartnerSectionDivider (2px /40–55%) | Done |
| 200.96 | 2026-08-11 | Live wizard preview L1 price; in-app view-on-site; PDP same-currency hero | Done |
| 200.95 | 2026-08-11 | Wizard scroll clearance (Tailwind env comma + scroll-pad); Basics/Pricing PartnerSectionDivider SSOT; RU genitive | Done |
| 200.94 | 2026-08-11 | Partner section rhythm: wizard padding fix, mint PartnerSectionDivider (Location/Calendar), listing card accent | Done |
| 200.93 | 2026-08-11 | Wizard calendar step: auto-ensure draft + soft-load serverListing (no form wipe) | Done |
| 200.92 | 2026-08-11 | Wizard 6 steps: Calendar = step 5 (OTA/blocks/seasons); Preview = 6; no global calendar tail | Done |
| 200.91 | 2026-08-11 | Partner listings RQ: fresh price after wizard save (refetchType all + refetchOnMount + L1 seed) | Done |
| 200.90 | 2026-08-11 | Wizard: clearing street no longer bleeds house number into street field | Done |
| 200.89 | 2026-08-11 | Wizard street+house one row; street suggest without house needle; auto-pin on house blur | Done |
| 200.88 | 2026-08-11 | FX markup for pay=THB × base≠THB (+ currency matrix); intent/capture/price_paid include THB surcharge; partner netto untouched | Done |
| 200.87 | 2026-08-11 | Wizard edit save: invalidate list cache (price), keep street/house in metadata, redirect to listings | Done |
| 200.86 | 2026-08-11 | Listing price UX: no 100 THB draft seed; draft save without pin; same-currency guest=L1×fee; admin L1 not ฿; currency locked to country | Done |
| 200.84 | 2026-08-11 | Wizard geo: Nominatim UI lang + street/house→pin (city viewbox); Irkutsk seed; partner map hints | Done |
| 200.83 | 2026-08-10 | Wizard location UX: derived region (no hub Select), street suggest→pin, district optional, RU-ZAB/Chita seed | Done |
| 189.37 | 2026-08-10 | Push resume: throttled re-check + FCM sync if granted after OS settings | Done |
| 189.36 | 2026-08-10 | Profile PWA: «Приложение установлено» + push block CTA/settings after deny | Done |
| 210.71 | 2026-08-10 | ADR-210 Slice 7.1: Concierge UX polish (fences, mapping select, checklist, existing-partner notify) | Done |
| 210.7 | 2026-08-10 | ADR-210 Slice 7: admin `/admin/concierge` import UI + batch journal | Done |
| 210.6 | 2026-08-10 | ADR-210 Slice 6: mapping profiles + validate-payload + AI extract prompt | Done |
| 210.5 | 2026-08-10 | ADR-210 Slice 5: partner Concierge welcome + badge + review CTA | Done |
| 210.4 | 2026-08-10 | ADR-210 Slice 4: Concierge media rehost + Drive ops playbook | Done |
| 210.3 | 2026-08-10 | ADR-210 Slice 3: claim invites + `/claim` + claim-partner (RU OTP) | Done |
| 210.2 | 2026-08-10 | ADR-210 Slice 2: admin Concierge partners + ingest APIs (shadow + drafts) | Done |
| 210.1 | 2026-08-10 | ADR-210 Slice 1: Concierge schema (shadow/batches/claim) + cleanup-drafts skip guard | Done |
| 200.82 | 2026-08-10 | M1.1 Push after login: PushClientInit on storefront+partner; gesture Soft CTA; unregister on logout | Done |
| 200.81 | 2026-08-09 | PWA install UX: 5d/30d soft snooze, settings (renter+partner), CLS banner, airento_pwa_* migrate | Done |
| 189.35 | 2026-08-09 | DAL: restore `ru.airento.app` SHA + keep Cap second statement in assetlinks.json | Done |
| 189.34 | 2026-08-09 | Docs: mobile platforms deep audit (PWA/TWA/Cap) + 2–4w plan (no code) | Done |
| 200.80 | 2026-08-09 | PENDING partner-SLA calm deadline copy (no live ticker) on guest next-steps | Done |
| 189.33 | 2026-08-09 | iOS standalone tabbar safe pad trim -10px → -16px | Done |
| 200.79 | 2026-08-09 | P1: Instant×iCal guard + exclusive ack; soft-hold audit; checkout trust block | Done |
| 200.78 | 2026-08-09 | P0 booking funnel UX: CONFIRMED next-steps Pay; partner Instant toggle; confirm TG/push checkout; MIR default | Done |
| 200.77 | 2026-08-09 | Checkout invoice guest breakdown (honest lines); PDP isBookingPayable; PAYMENT_RECEIVED claim | Done |
| 200.76 | 2026-08-09 | Checkout payment UX: USDT SSOT amount/wallet, return-poll Strict Mode, TXID settle poll | Done |
| 189.32 | 2026-08-09 | iOS standalone tabbar safe pad trim -6px → -10px | Done |
| 189.31 | 2026-08-09 | PWA iOS polish: Home Screen/share title = brand; iOS standalone tabbar -6px safe pad | Done |
| 200.75 | 2026-08-08 | Pre-launch: crypto wallet fail-closed; root error/404 shells; acquiring 10s timeouts | Done |
| 200.74 | 2026-08-08 | Notification registry hygiene: wire orphans / dead marks; email HTML escape; outbox verify | Done |
| 200.73 | 2026-08-08 | Guest i18n SSOT: checkout credits, ask-provider placeholders, booking RU/EN ternaries | Done |
| 200.72 | 2026-08-08 | Resend via EmailService (auth/admin); emergency SMS honesty; check-in escrow copy | Done |
| 200.71 | 2026-08-08 | SEO: PDP true 404 + noindex; apex canonical home/PDP; sitemap/robots getPublicSiteUrl | Done |
| 200.70 | 2026-08-08 | Acquiring fail-closed amount; Mandarin GET verify parity; stable CARD_INTL Idempotency-Key | Done |
| 200.69 | 2026-08-08 | Crypto settle SSOT: verify-tron + webhook share settleCryptoPayment; 2xx same-booking replay; prod header-only secret | Done |
| 200.68 | 2026-08-08 | PWA edge fixes: chat haptic only on successful send; messages PTR enabled after scroll ref | Done |
| 200.67 | 2026-08-08 | PWA native UX: useHaptic + usePullToRefresh; wired on moderation, partner approve, checkout, chat, bookings/messages feeds | Done |
| 200.65 | 2026-08-08 | Wave 6 storefront redirect debt: `/dashboard`, `/dashboard/renter` — inventory 116/116 | Done |
| 200.64 | 2026-08-08 | Admin Wave 5F mobile-flat: system, security, health, audit, privacy, settings/legal | Done |
| 200.63 | 2026-08-08 | Admin Wave 5E-2 mobile-flat: analytics, budget, payouts ops, fraud, ROI, audit | Done |
| 200.62 | 2026-08-07 | Admin Wave 5E-1 mobile-flat: marketing hub, promos, campaigns, rules, attribution | Done |
| 200.61 | 2026-08-07 | Admin Wave 5D mobile-flat: categories, location suggestions, staff messages | Done |
| 200.60 | 2026-08-07 | Admin Wave 5C mobile-flat: FinTech finances, ledger, intelligence, payouts | Done |
| 200.59 | 2026-08-07 | Admin Wave 5B mobile-flat: users, partners, disputes, reviews, waitlist | Done |
| 200.58 | 2026-08-07 | Admin Wave 5A mobile-flat: dashboard, moderation, bookings | Done |
| 200.57 | 2026-08-07 | Auth Wave 4 mobile-flat: auth shells + marketing/legal | Done |
| 200.56 | 2026-08-07 | Chat Wave 3 mobile-flat: messages hall + thread chrome | Done |
| 200.53.3 | 2026-08-07 | Partner calendar bulk SoT: 3 DB queries for N listings + in-memory buildCalendar | Done |
| 200.53.2 | 2026-08-07 | Partner calendar perf: parallel builds, seasonal range filter, month skeleton/prefetch | Done |
| 200.55 | 2026-08-06 | Guest Wave 2B mobile-flat: favorites, profile/wallet/settings, `/u`, reviews | Done |
| 200.54 | 2026-08-06 | Guest Wave 2A mobile-flat: home → listings → PDP → checkout → my-bookings | Done |
| 200.53.1 | 2026-08-06 | Partner calendar month/overview: keepPreviousData, no full-page spinner | Done |
| 200.53 | 2026-08-06 | Partner Hub mobile-flat Wave 1 (all hub routes) | Done |
| 200.52 | 2026-08-06 | Wizard mobile flat Phase 1–2 accepted; PRODUCT_UI_INVENTORY | Done |
| 200.51 | 2026-08-06 | Wizard geo cascade: camera follows country/city; pin cleared not auto-set | Done |
| 200.50 | 2026-08-06 | Wizard mobile action bar + pin-conflict overflow layout | Done |
| 200.49 | 2026-08-06 | Wizard preview L1→THB mid before guest retail FX | Done |
| 201.03 | 2026-07-31 | Settle lock heartbeat refresh + TTL 1800s; AUDIT_02 closed (`v1.0.1-audit02`) | Done |
| 201.02 | 2026-07-31 | Concierge settle single-flight (metadata CAS) | Done |
| 201.01 | 2026-07-31 | Atomic held referral balance RPC | Done |
| 3 | — | Payment adapters over Intent: добавлен adapter registry `lib/services/payment-adapters`: `CARD_INTL` (Mandarin-ready s | Active |
| 3.1 | — | Production hardening: `POST /api/webhooks/payments/confirm` валидирует подпись отдельно по адаптеру (`x-mandarin-signa | Active |
| 10.0 | — | Test completion + Unified Order | Active |
| 11.0 | — | Unified My Bookings UI | Active |
| 11.1 | — | UnifiedOrderCard across roles | Active |
| 12.0 | — | Stability, Revenue Protection & UI Cleanup | Active |
| 13.0 | — | Order Timeline & Smart Lifecycle | Active |
| 14.0 | — | Unified Dispute & Moderation Engine | Active |
| 14.1 | — | Admin Dispute Center & Resolution Console | Active |
| 15.0 | — | Trust graph & public reputation | Active |
| 16.0 | — | Reputation ranking, partner health, recency | Active |
| 17.0 | — | Response SLA, performance logs, search boost | Active |
| 18.0 | — | Репутация: единый сервис + «конституция» репо | Active |
| 19.0 | — | Reputation modular split, TOP guest-review floor, proactive nudges | Active |
| 20.0 | — | Fair SLA quiet hours + mediation gate (disputes) | Active |
| 21.0 | — | Emergency bypass, IANA TZ on listings, push quiet SSOT, mediation cron | Active |
| 22.0 | — | Emergency protocol: friction, rate limit, admin audit | Active |
| 23.0 | — | Incident response: Telegram pulse, support escalation, SMS stub | Active |
| 24.0 | — | Super-App terminology + smart emergency visibility | Active |
| 25.0 | — | Super-App copy + category-aware emergency checklist | Active |
| 26.0 | — | Category intelligence (wizard, SuccessGuide, reviews) | Active |
| 27.0 | — | Динамические критерии отзывов + SLA/календарь по доминирующей категории | Active |
| 28.0 | — | Унифицированные отзывы + детализация цены + кэш reputation-health | Active |
| 29.0 | — | SSOT детализации цены: строки чекаута (без invoice-path) строятся через `buildGuestPriceBreakdownFromCheckoutTotals` | Active |
| 30.0 | — | `partner_trust` везде: `attachPartnerTrustToBookings` (`lib/booking/attach-partner-trust-to-bookings | Active |
| 31.0 | — | промо-владелец + usage + визуальный check-in: таблица `promo_codes`: `created_by_type` (`PLATFORM` \\| `PARTNER | Active |
| 32.0 | — | маркетинг + партнёрские промо + откат usage: `POST /api/v2/partner/promo-codes` — только `PARTNER`, `partner | Active |
| 33.0 | — | scoped promo + каталог + lightbox: колонка `promo_codes | Active |
| 34.0 | — | Flash Sale + FOMO UI: колонка `promo_codes | Active |
| 35.0 | — | SSOT alignment + marketing transparency: `PricingService | Active |
| 36.0 | — | Marketing Reach & Automation: введён единый движок применимости промо `lib/promo/promo-engine | Active |
| 37.0 | — | Telegram delivery + reminder dedup: `MarketingNotificationsService` подключён к реальному Telegram-боту через существу | Active |
| 38.0 | — | Idempotent reminder lock + social proof + `/promo` + request memo: дедуп Flash reminder переведён на атомарный сло | Active |
| 39.0 | — | «Горячий» Flash UI + аналитика продлений + coach в `/promo`: канон фаз плашки — `lib/listing/flash-hot-strip | Active |
| 40.0 | — | маркетинговый SSOT + hardening (финал блока): дефолтные строки Flash social proof — `lib/constants/marketing | Active |
| 41.0 | — | админ-пульт + i18n гостя + календарь: `/admin/marketing` — секция UI Copywriting → `GET/PUT /api/admin/marke | Active |
| 42.1 | — | Locale SSOT + надёжность поиска: единый модуль `lib/i18n/locale-resolver | Active |
| 42.2 | — | Batch Availability + API hygiene: добавлена миграция `prisma/migrations/010_stage42_batch_availability_check | Active |
| 42.3 | — | Pricing precision for batch search: RPC `batch_check_listing_availability` расширен сезонной сеткой `price_grid` | Active |
| 43.0 | — | Search SQL-first filters + instant-booking SSOT: миграция `prisma/migrations/011_stage43_search_sql_filters | Active |
| 44.0 | — | Trust layer + guest review aggregates + visual amenities: миграция `prisma/migrations/012_stage44_listing_review_agg | Active |
| 45.1 | — | Stability & safety overhaul (P0): миграция `prisma/migrations/013_stage45_atomic_booking_numeric_filters | Active |
| 45.2 | — | Global scalability + wallet foundation: миграция `prisma/migrations/014_stage45_timezone_ssot | Active |
| 45.3 | — | Financial single truth + map abstraction: `buildBookingFinancialSnapshotFromRow` дополняет партнёрские поля `gro | Active |
| 46.0 | — | Partner financial transparency (standard): один и тот же read-model на списке и в деталях: `GET /api/v2/partner/book | Active |
| 46.1 | — | Partner Master Calendar SSOT + i18n: `GET /api/v2/partner/calendar` больше не содержит локального `processCalendar | Active |
| 47.0 | — | Ecosystem notifications + chat→finance + PDF Unicode: `NEW_BOOKING_REQUEST`: FCM партнёру (`BOOKING_REQUEST` / | Active |
| 47.1 | — | Multilingual push + payout gate (stub): `PushService`: `normalizePushUiLang`, `pickLocalizedTemplateStrings` | Active |
| 47.2 | — | Thaw vs review decouple + neutral copy: при `THAWED` только `PARTNER_FUNDS_THAWED_AVAILABLE` (FCM `FUNDS_THA | Active |
| 48.0 | — | Payout KYC + financial category field + production hygiene: вывод средств (`POST /api/v2/partner/payouts/request` | Active |
| 49.0 | — | Taxonomy doc + tour badge + brand SSOT + cron module: раздел паспорта «Category SSOT & Business Logic Mapping» (та | Active |
| 50.0 | — | финальный цикл отчётности: CSV на `/partner/finances` включает колонку `category_slug` (заголовок i18n `part | Active |
| 051 | 2026-05 | RLS cleanup & standardization, 2026-05 | Active |
| 67.0 | — | вертикаль для визарда/реестра/поиска), `parent_id` (Stage 68 | Active |
| 69.0 | — | JSONB `{ru,en,zh,th}`, публичный API `nameI18n`, резолв имён `lib/category-display-name | Active |
| 69.1 | — | копирайт под заголовком каталога для родительских категорий + SEO-снимок), `is_coming_soon` + `is_preview_only` | Active |
| 70.1 | — | 70.2 PDP + Stage 171.24 RSC P0) | Active |
| 70.3–70.4 | — | декомпозиция карточки: `components/orders/card-parts/` — `OrderCardHeader`, `OrderCardFinancials` + `Ord | Active |
| 71.2 | 2026-04 | Referral UX & Security Shield (2026-04) | Active |
| 71.3 | 2026-04 | Marketing Cockpit & Global Boost (2026-04) | Active |
| 71.4 | 2026-04 | Audit Trail & Visual Hype (2026-04) | Active |
| 71.5 | 2026-04 | Financial Wallet Core & Smart Boost (2026-04) | Active |
| 71.6 | 2026-04 | Financial SSOT map, expiry & wallet audit (2026-04) | Active |
| 71.7 | 2026-04 | Referral financial SSOT documentation & cancel integrity (2026-04) | Active |
| 72.2 | 2026-04 | Universal referral engine foundation & payout verification (2026-04) | Active |
| 72.3 | 2026-04 | Partner activation wiring, payout admin and safety gates (2026-04) | Active |
| 72.4 | 2026-04 | Financial retention & payout buckets (2026-04) | Active |
| 72.5 | 2026-04 | Ambassador tiers, ROI dashboard and tier-aware retention (2026-04) | Active |
| 72.6 | 2026-04 | Cohort ROI, tier downgrade grace, referral persistence for OAuth prep (2026-04) | Active |
| 72.6b | 2026-04 | Referral team list & unified wallet UI (2026-04) | Active |
| 73.1 | 2026-04 | Header wallet, activity feed, team unread (2026-04) | Active |
| 73.2 | 2026-04 | Localization, wallet refresh, activity paging, ambassador stats (2026-04) | Active |
| 73.3 | 2026-04 | Referral team events SSOT, TZ/month goal, QR marketing kit (2026-04) | Active |
| 73.4 | 2026-04 | Ambassador PDF card, share copy, feed name hygiene (2026-04) | Active |
| 73.5 | 2026-04 | Referral feed trigger & index (2026-04) | Active |
| 73.6 | 2026-04 | Referral stats TZ SSOT, DD.MM.YYYY, guard alignment | Active |
| 73.7 | 2026-04 | Silent growth: TZ seed, Stories asset, feed icons, mobile order (2026-04) | Active |
| 74.1 | 2026-04 | Leaderboard, L1/L2 insights, Stories tier line (2026-04) | Active |
| 74.2 | 2026-04 | Global UTC leaderboard (admin), RPC, badges, dual Stories (2026-04) | Active |
| 74.3 | 2026-04 | Social landings: `/u/[id]` + short URL QR (2026-04) | Active |
| 74.4 | 2026-04 | Dynamic `{brand}` + соц. доказательство `/u` + SEO | Active |
| 75.1 | 2026-04 | 75.2 — Referral gamification, UX merge, API cleanup | Active |
| 75.1–75.2 | 2026-04 | Referral gamification, UX merge, API cleanup (2026-04) | Active |
| 75.3 | 2026-04 | Metrics alignment & support (2026-04) | Active |
| 76.1 | 2026-04 | Ambassador FX UI + geo teaser (2026-04) | Active |
| 76.2 | 2026-04 | Currency monolith (2026-04) | Active |
| 77.8 | 2026-04 | Booking atomic lock hotfix (2026-04) | Active |
| 77.9 | 2026-04 | Daily guard for system alerts (2026-04) | Active |
| 78 | 2026-05 | Legal consent & white-label copy (2026-05) | Active |
| 79 | 2026-05 | Supabase OAuth (Google), 2026-05 | Active |
| 83.0 | — | smart visibility), связь `listings | Active |
| 85.0 | — | Dynamic Category Visibility: публичные UI-точки выбора категорий (`HomeHeroLuxe`, `UnifiedSearchBar`, partner wizard ч | Active |
| 85.5 | 2026-05 | Универсальный профиль спецификаций карточек (Stay, Transport, Yacht, Tour), 2026-05 | Active |
| 86.0 | 2026-05 | JSON-LD для ИИ/генеративного поиска (WebSite SearchAction + PDP `@graph`), 2026-05 | Active |
| 87.0 | 2026-05 | Локализация SEO-графа и trust-слой на карточках, 2026-05 | Active |
| 87.1 | 2026-05 | Trust-слой синхронизирован с картой и телеметрией выдачи, 2026-05 | Active |
| 88.0 | 2026-05 | Визуальная отделка карты и карточек каталога + промо верификации партнёра, 2026-05 | Active |
| 89.0 | 2026-05 | Кластеры на карте поиска и мониторинг «Verified» по городам, 2026-05 | Active |
| 90.0 | 2026-05 | Админ-верификация профиля (KYC) и SEO гео-паритет RU/TH, 2026-05 | Active |
| 90.1 | 2026-05 | Защита Admin API и автоматическая выдача VERIFIED при одобрении заявки, 2026-05 | Active |
| 90.2 | 2026-05 | Журнал действий персонала и полировка UX каталога, 2026-05 | Active |
| 92.0 | 2026-05 | SSOT верификации `gostaylo_session` (Node), 2026-05 | Active |
| 93.0 | 2026-05 | Logout + OAuth sync edge cases, 2026-05 | Active |
| 94.0 | 2026-05 | `auth.users` → `profiles` trigger + core RLS | Active |
| 94b | 2026-05 | Admin `system_settings` API + `is_admin` safety net, 2026-05 | Active |
| 95.0 | 2026-05 | Storage RLS + unified upload, 2026-05 | Active |
| 95.1 | 2026-05 | Image processor SSOT + storage orphan cleanup, 2026-05 | Active |
| 95.2 | 2026-05 | Thumbnails + bounded storage cleanup, 2026-05 | Active |
| 96.0 | 2026-05 | Partner wizard upload + delete + public stats, 2026-05 | Active |
| 98 | — | 100: cron `/api/cron/promote-ready-for-payout`; admin FinTech `/admin/settings/finances` (см | Active |
| 102.1 | 2026-05 | Legal block neutral copy (2026-05) | Active |
| 102.2 | 2026-05 | Partner legal document + booking terms stamp (2026-05) | Active |
| 102.3 | 2026-05 | Admin legal console + payout settlement PDF (2026-05) | Active |
| 102.4 | 2026-05 | Legal polish: drafts, partner docs, bank ZIP (2026-05) | Active |
| 103 | 2026-05 | Soft launch E2E smoke + owner UX (2026-05) | Active |
| 107.1 | — | 107.2, уточнение **110.1**) | Active |
| 108.1 | 2026-05 | P0 риски перед реальными платежами (2026-05) | Active |
| 108.2 | 2026-05 | Консолидация и уборка (2026-05) | Active |
| 108.3 | 2026-05 | Прозрачность cron и чат (2026-05) | Active |
| 108.4 | 2026-05 | Статусы и schema 103.2 | Active |
| 108.5 | 2026-05 | Финальная уборка блока 108 (2026-05) | Active |
| 109.0 | — | композиция): | Active |
| 109.3 | — | композиция) | Active |
| 110.4 | — | chat / 110.5–110.7) | Active |
| 111.0 | 2026-05-21 | Pre-Launch Cleanup (2026-05-21) | Active |
| 111.1 | 2026-05-21 | Final Pre-Launch Cleanup (2026-05-21) | Active |
| 111.1b | 2026-05-21 | Booking create security SSOT (2026-05-21) | Active |
| 111.2 | 2026-05-21 | Final cleanup before Stage 112 (2026-05-21) | Active |
| 112.0 | 2026-05-20 | Pre-Launch Hardening (2026-05-20) | Active |
| 112.1 | 2026-05-20 | Final Pre-Launch Optimization (2026-05-20) | Active |
| 112.2 | 2026-05-20 | Final Pre-Launch Optimization (2026-05-20) | Active |
| 112.3 | 2026-05-20 | Final Pre-Launch Optimization (2026-05-20) | Active |
| 113.0 | 2026-05-21 | API client performance (2026-05-21) | Active |
| 113.1 | 2026-05-21 | Pre-deploy micro cleanup (2026-05-21) | Active |
| 128.0 | — | Foundation | Active |
| 128.x | 2026-06-01 | Client-Side Data Layer (TanStack Query) | Active |
| 128.1 | — | Public catalog + home (Iteration 1) | Active |
| 128.2 | — | Unified categories + PDP prefetch (Iteration 1b) | Active |
| 128.3 | — | FX + featured + profiles (Iteration 2) | Active |
| 128.4 | — | Closure & PAUSE | Deprecated |
| 129.0 | 2026-06-01 | Design System Foundation (UI-0) (2026-06-01) | Active |
| 129.1 | 2026-06-01 | Emergency Brand SSOT Fix (2026-06-01) | Active |
| 149.2 | — | окно checkout блокирует ночи; RPC `create_booking_atomic_v1` (`stage149_2_awaiting_payment_occupying | Active |
| 164 | — | 165): RPC `listings_geo_drift_scan_v1`; cron `POST /api/cron/geo-drift-detector` (`runFullAudit`); CRITICAL si | Active |
| 168.1 | 2026-06-18 | Data Subject Rights (DSAR + erasure) (2026-06-18) | Active |
| 168.2 | 2026-06-18 | Operational Security (2026-06-18) | Active |
| 171.5 | — | visibility + sticky: список `app/partner/listings/page | Active |
| 171.6 | — | data + DS: `lib/hooks/use-partner-listings | Active |
| 171.7 | — | wizard scroll SSOT: `StepCalendarSection` внутри `ListingWizardPageInner`; `EditPartnerListingView` — толь | Active |
| 171.8 | — | liquid compact header (desktop `sm+`): `useWorkspaceScrollTrigger`, `WORKSPACE_SCROLL_ATTR`, compact step bar | Active |
| 171.9 | — | desktop polish + mobile audit (plan): gates зафиксированы в манифесте; реализация — §171 | Active |
| 171.10 | — | chrome extract: `ListingWizardPageInner` → `chrome/` (header, step nav, footer) без смены UX | Active |
| 171.11 | — | mobile App-UX: `components/chrome/` — slim fixed header (step label, `PartnerNotificationFeed`, save), dot ste | Active |
| 171.12 | — | step mobile polish (`< sm`): `wizard-step-layout | Active |
| 171.25 | 2026-07-15 | Route groups & provider split (2026-07-15) | Active |
| 171.26 | 2026-07-15 | Catalog server bootstrap (2026-07-15, P0 | Active |
| 171.27 | 2026-07-15 | Home server bootstrap (2026-07-15) | Active |
| 171.28 | 2026-07-15 | SW precache trim (2026-07-15, IOS-P0-02) | Active |
| 171.29 | 2026-07-15 | Chat unread-count endpoint (2026-07-15) | Active |
| 171.30 | 2026-07-15 | PDP layout unification (2026-07-15, P0 | Active |
| 171.31 | 2026-07-15 | Provider chunk split (2026-07-15, P1) | Active |
| 171.32 | 2026-07-15 | PWA focus refetch guard (2026-07-15, IOS-P1-02) | Active |
| 171.33 | 2026-07-15 | Listings/checkout i18n lazy split (2026-07-15) | Active |
| 171.34 | 2026-07-15 | Auth modal lazy (2026-07-15) | Active |
| 171.35 | 2026-07-15 | Order-flow i18n lazy split (2026-07-15) | Active |
| 171.36 | 2026-07-15 | Common / auth i18n lazy split (2026-07-15) | Active |
| 171.37 | 2026-07-15 | Errors + renter-review i18n lazy split (2026-07-15, final i18n pass) | Active |
| 171.38 | 2026-07-15 | Client i18n slice bootstrap (2026-07-15, P0) | Active |
| 172.0 | — | Deal Context SSOT (ADR-172): аудит «Listing → Chat → Invoice» | Active |
| 172.1 | — | Chat invoice booking gate (ADR-172 Wave 1): `POST /api/v2/chat/invoice` — `booking_id` обязателен для новых счетов (из | Active |
| 172.1.5 | — | SendInvoiceDialog UI/i18n (ADR-172 Wave 1 | Active |
| 172.1.6 | — | Invoice i18n polish + date validation (ADR-172 Wave 1 | Active |
| 172.2.0 | — | PDP contact → inquiry (ADR-172 Wave 2): при выбранных датах на PDP кнопка «Написать» → `POST /api/v2/bookings` с `cont | Active |
| 172.3.0 | — | sessionStorage liquidation (ADR-172 Wave 3): удалены writes `gostaylo_chat_prefill_*` / `gostaylo_chat_context_listing | Deprecated |
| 172.5.0 | — | Payment UI i18n + inbox deal badges (ADR-172 Wave 5 / epic closure): `InvoiceBubble` payment-method dialog — `invoiceB | Active |
| 173.1.0 | — | Stabilization sprint (ADR-173): chat invoice = Special Offer — `syncBookingForPayableChatInvoice` on successful invoic | Active |
| 174.1.0 | — | i18n sweep (ADR-174): inbox/checkout/PDP → `getUIText` (RU/EN/TH/ZH); `chatListPreview_*` keys in `chat-ui | Active |
| 176.0.0 | — | Content Guard (instant publish): миграция `migrations/stage176_0_review_content_guard | Active |
| 176.1.0 | — | Admin moderation + partner reply guard: миграция `stage176_1_review_moderation_admin | Active |
| 176.2.0 | — | Mobile UX (reviews & moderation): `components/review-modal | Active |
| 181.0 | — | ADR-181) | Active |
| 185.1 | — | bookings UX rescue: compact partner price block; INQUIRY i18n; dialog z-index above sheet; list quick decline; scrolla | Active |
| 189.0 | 2026-07-16 | Immersive Dynamic Auth (2026-07-16) | Active |
| 189.1 | 2026-07-16 | Account linking & gateways (2026-07-16) | Active |
| 189.2 | 2026-07-16 | Dual-route SMS gateways (2026-07-16) | Active |
| 189.3 | 2026-07-16 | PWA & Mobile App Shell Polish (2026-07-16) | Active |
| 189.3b | — | PWA iOS deep polish backlog (was 189.3 polish on main) | Active |
| 189.3.1 | 2026-07-17 | Smart Auth Gateway + Immersive Auth polish (2026-07-17) | Active |
| 194.0 | 2026-07-27 | A — Partner Cabinet Mobile UX & Token Alignment | Active |
| 194.0-A | 2026-07-27 | Partner Cabinet Mobile UX & Token Alignment (2026-07-27) | Active |
| 194.0-B | 2026-07-27 | Calendar Host Simplicity (2026-07-27) | Active |
| 194.0-C | 2026-07-27 | Listing Wizard & Onboarding Polish (2026-07-27) | Active |
| 194.0-D | 2026-07-27 | Mobile Smoke & Residual Cleanup (2026-07-27) | Active |
| 195.0 | 2026-07-27 | Renter Cabinet Visual & Touch Polish (2026-07-27) | Active |
| 196.0 | 2026-07-27 | B — Dual-channel Auth Redirect & Draft Dates | Active |
| 196.0-A | 2026-07-27 | Day-of Fulfillment & Location SSOT (2026-07-27) | Active |
| 196.0-B | 2026-07-27 | Dual-channel Auth Redirect & Draft Dates (2026-07-27) | Active |
| 196.0-C | 2026-07-27 | ThreadTripStrip & Order Deep-links (2026-07-27) | Active |
| 197.0 | 2026-07-27 | Wave H0 Checkout Sticky Pay & Hold Timer (2026-07-27) | Active |
| 197.0.2 | 2026-07-27 | Unpaid checkout retention | Active |
| 197.1 | 2026-07-28 | Checkout promo reprice & payment docs (2026-07-28) | Active |
| 198 | 2026-07-30 | Wave I.0 Pre-Live Operations | Active |
| 199 | 2026-07-30 | Wave I.1 Price Truth | Active |
| 199.1 | 2026-07-30 | Wave I.2 Convert Loop | Active |
| 199.2 | 2026-07-30 | Wave I.3 Supply Quality | Active |
| 199.3 | 2026-07-30 | Wave I.4 One Surface | Active |
| 199.4 | 2026-07-30 | Wave I.4 Final Polish | Active |
| 200 | 2026-07-30 | Wave J.1 Operational Reliability | Active |
| 200.2 | 2026-07-30 | Mobile header densify (2026-07-30) | Active |
| 200.3 | 2026-07-30 | Locale switcher SSOT (2026-07-30) | Active |
| 200.4 | 2026-07-30 | PWA brand icons & splash (2026-07-30) | Active |
| 200.5 | 2026-07-30 | Partner calendar promo trust (2026-07-30) | Active |
| 200.6 | 2026-07-30 | Home mobile hero densify (2026-07-30) | Active |
| 200.7 | 2026-07-30 | Catalog mobile densify (2026-07-30) | Active |
| 200.8 | 2026-07-30 | Calendar overlay + PDP hero price (2026-07-30) | Active |
| 200.9 | 2026-07-30 | Messages chrome + voice (2026-07-30) | Active |
| 200.10 | 2026-07-30 | Referral share links + QR (2026-07-30) | Active |
| 200.11 | 2026-07-30 | Partner sidebar densify (2026-07-30) | Active |
| 200.12 | 2026-07-30 | Guest fee label + recommendation rail 2-up (2026-07-30) | Active |
| 200.13 | 2026-07-31 | Optimistic shell nav (2026-07-31) | Active |
| 200.14 | 2026-07-31 | Optimistic chrome Phase 1 (2026-07-31) | Active |
| 200.15 | 2026-07-31 | Optimistic catalog → PDP (2026-07-31) | Active |
| 200.16 | 2026-07-31 | Optimistic secondary CTAs (2026-07-31) | Active |
| 200.17 | 2026-07-31 | Soft back-nav + catalog scroll memory (2026-07-31) | Active |
| 200.18 | 2026-07-31 | Dock exclusive pending + Search/View-all (2026-07-31) | Active |
| 200.19 | 2026-07-31 | PDP map cooperative overlay clip (2026-07-31) | Active |
| 200.20 | 2026-08-04 | Listing wizard P0 UX polish (draft after category, honest locales, brand touch) | Done |
| 200.21 | 2026-08-04 | Stage 200.21: Draft hygiene, resume draft banner, category picker i18n | Done |
| 200.22 | 2026-08-04 | Draft cleanup tiered TTL (empty 7d / contentful 30d) | Done |
| 200.23 | 2026-08-04 | Listing wizard P2: soft publish + Incomplete badge + AI Translate | Done |
| 200.24 | 2026-08-04 | Admin UX P0/P1: sidebar blur fix, moderation dialog, RU CTAs | Done |
| 200.25 | 2026-08-04 | Admin UX P2: RU menu/dashboard shell + category display names | Done |
| 200.26 | 2026-08-04 | Moderation content edit (update) + wizard scroll-to-top on step | Done |
| 200.27 | 2026-08-04 | Wizard: currency symbol SSOT + MapPicker height/country TZ | Done |
| 200.28 | 2026-08-05 | Wizard quality UX: 2 photos, desc=40, vertical health, Next hints | Done |
| 200.29 | 2026-08-05 | Wizard: 1 photo + red required-field highlight / scroll on Next | Done |
| 200.30 | 2026-08-05 | Wizard: map pin → country/region/city + TZ + baseCurrency SSOT | Done |
| 200.31 | 2026-08-05 | MapPicker: pan/pinch vs pin-lock + Leaflet gesture sync | Done |
| 200.32 | 2026-08-05 | Partner L1 currency display + seasonal {{unit}} + DayPicker mobile | Done |
| 200.33 | 2026-08-05 | Seasonal prices: asset currency → THB ledger + metadata snapshot | Done |
| 200.34 | 2026-08-05 | Wizard: remove broken Airbnb quick-import card | Done |
| 200.35 | 2026-08-05 | Geo foundation: geo_locations extend + nominatim_cache + GeoService | Done |
| 200.36 | 2026-08-05 | Wizard map-first Location + anti-coerce + geo suggest/provisional APIs | Done |
| 200.37 | 2026-08-05 | Catalog search/map/display → geo_locations SSOT (no Phuket exceptionalism) | Done |
| 200.38 | 2026-08-05 | Delete country-presets.js; launch-geo-index + GeoService only | Done |
| 200.39 | 2026-08-05 | Geo UX polish: map re-fit, bbox URL, labels, SEO worldwide | Done |
| 200.40 | 2026-08-05 | Partner mobile calendar: month grid, chrome polish, compact promo | Done |
| 200.41 | 2026-08-05 | Partner mobile calendar: 3-month occupancy overview (heatmap) | Done |
| 200.43 | 2026-08-05 | Wizard Location: cascade-first UX (search/map secondary) | Done |
| 200.44 | 2026-08-05 | Wizard place TZ (tz-lookup pin) + country currency sync | Done |
| 200.45 | 2026-08-05 | Wizard country/city typeahead + provisional name normalize | Done |
| 200.46 | 2026-08-06 | Wizard pin↔country conflict UX + city blur/Enter commit | Done |
| 200.47 | 2026-08-06 | Non-launch currency map (USD fallback) + provisional visibility | Done |
| 200.48 | 2026-08-06 | Wizard Location geo e2e (DE + TH/RU + mobile typeahead) | Done |

## Пробелы в паспорте

Целые номера Stage (1–200), для которых в паспорте нет ни одной записи `Stage N` / `Stage N.x`. Детали могут быть в `docs/TECHNICAL_MANIFESTO.md`, миграциях или git history:

1, 2, 4, 5, 6, 7, 8, 9, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 68, 80, 81, 82, 84, 91, 97, 99, 100, 101, 104, 105, 106, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144, 145, 146, 147, 148, 150, 151, 152, 153, 154, 155, 156, 157, 158, 159, 160, 161, 162, 163, 165, 166, 167, 169, 170, 175, 177, 178, 179, 180, 182, 183, 184, 186, 187, 188, 190, 191, 192, 193

Ранние стадии 1–9 в паспорте часто описаны как §0.0b–0.0k (modular split), без заголовка «Stage N.0».
