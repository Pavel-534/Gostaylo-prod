# Architectural Decisions — GoStayLo / Super App

## Единственный источник истины (SSOT)

- **Этот файл (`ARCHITECTURAL_DECISIONS.md` в корне репозитория)** — канонический манифест проекта: стек, золотые правила, порядок ревью.
- **`docs/TECHNICAL_MANIFESTO.md`** и **`docs/ARCHITECTURAL_PASSPORT.md`** — снимок кода и архитектуры; их нужно обновлять при изменении API/БД/поведения (см. **`AGENTS.md`**, **`.cursor/rules/gostaylo-docs-constitution.mdc`**, чеклист в **`.github/pull_request_template.md`**).
- **`.cursorrules`** + **`.cursor/rules/*.mdc`** — указатели для Cursor; политики не дублировать длинно. **При любом расхождении побеждает только `ARCHITECTURAL_DECISIONS.md`.**
- Менять архитектурные правила нужно **здесь**; затем при необходимости сжато обновить `.cursorrules` / правило в `.cursor/rules/` (если добавились новые жёсткие триггеры для агента).

---

## Перед задачей (команда: человек + AI)

Перед выполнением **любой** нетривиальной задачи сверяйся с этим документом. Если в коде встречается или предлагается хардкод вроде **15%** комиссии или **35.5** для курса — **не добавляй и не размножай**: бери данные из **`system_settings`**, **`exchange_rates`**, **`profiles`**, полей **бронирования** (снимок на момент создания), **`JWT_SECRET` / FX-ключей из env** и существующих хелперов (`PricingService`, **`lib/services/currency.service.js`**, `getJwtSecret` и т.д.). Числовые аварии только через **`lib/services/currency-last-resort.js`** + env / опциональное поле `general.fallbackThbPerUsdt` (см. Golden rule §2).

**Явный отказ от магических чисел в прод-коде CurrencyService:** запрещено снова вводить в **`currency.service.js`** (и размножать по UI) фиксированные курсы вроде **35.5** THB/USDT и фиксированный множитель **1.02** для чат-счетов. Канон: **`exchange_rates`** + API/env/`general.fallbackThbPerUsdt` для USDT; для чата — **`general.chatInvoiceRateMultiplier`** (админка) → **`CHAT_INVOICE_RATE_MULTIPLIER`** → единственный числовой дефолт множителя в **`platformDefaultChatInvoiceRateMultiplier()`** внутри **`currency-last-resort.js`**.

---

This document is the **project manifesto**: how we build, what is allowed, and what to fix when drift appears.

---

## Current tech stack (high level)

| Layer | Choice |
|--------|--------|
| **App** | Next.js (App Router), React |
| **Database** | PostgreSQL via **Supabase** (REST + `supabase-js` / service role on server) |
| **Auth** | Основное SSO приложения — custom JWT (**`gostaylo_session`**), bcrypt в **`profiles`**; дополнительно **OAuth (Google)** через Supabase Auth на клиенте, PKCE **`/auth/callback/`**, мост **`profiles.auth_user_id`** (**Stage 79.0**) — финальная сессия приложения те же JWT+`profiles`. |
| **ORM / schema** | **Prisma `schema.prisma`** as **documentation and typing reference** for tables/enums — **not** the primary runtime data layer |
| **Realtime / storage** | Supabase (where configured): Realtime, Storage |
| **Email** | Resend (when `RESEND_API_KEY` is set) |
| **FX / комиссия (канон)** | **`lib/services/currency.service.js`** (`getDisplayRateMap`, `resolveThbPerUsdt`, `resolveDefaultCommissionPercent`, `getEffectiveRate`, `resolveChatInvoiceRateMultiplier` для чат-счетов). Числовые фолбэки split-fee — **`lib/config/platform-split-fee-defaults.js`** (**`PLATFORM_SPLIT_FEE_DEFAULTS`**, реэкспорт из `currency.service`). **`lib/services/currency-last-resort.js`** — env / `general.fallbackThbPerUsdt`, **`CHAT_INVOICE_RATE_MULTIPLIER`**, платформенный дефолт множителя чата — без литералов курсов/комиссий в `currency.service`. Таблица **`exchange_rates`**, ExchangeRate-API v6. |
| **Deploy** | Typical: Vercel + Supabase project |

---

## Auth API JSON errors (SSOT)

- Эндпоинты **`/api/v2/auth/*`** при ошибке отдают **`{ success: false, error_code: "AUTH_…" }`** (и опциональные машиночитаемые поля вроде **`requiresVerification`**, **`retryAfter`**) — **без локализованного поля `error`** для отображения в UI.
- Для онбординга **`POST /api/v2/referral/validate`** использует тот же контракт: **`error_code`** (в т.ч. префикс **`REFERRAL_*`** из **`ReferralGuardService`**).
- **`POST /api/v2/promo-codes/validate`** при ошибке отдаёт **`{ success: false, valid: false, error_code: "PROMO_…" }`** (опционально **`min_amount_thb`**, **`retryAfter`**) — **без локализованного поля `error`**. Константы: **`lib/promo/promo-error-codes.js`** (`PromoErrorCode`, **`promoErrorJson`**). Тексты UI: **`lib/translations/slices/promo-errors.js`**, разрешение через **`getAuthErrorMessage(code, language, extras?)`** (плейсхолдер **`{minAmount}`** для **`PROMO_MIN_AMOUNT_NOT_MET`** при **`extras.minAmountThb`**).
- Канон списка констант auth: **`lib/auth/auth-error-codes.js`** (`AuthErrorCode`, **`authErrorJson`**). Тексты для пользователя — **`lib/translations/slices/auth-errors.js`** + **`promo-errors.js`** (мердж в **`translation-state`**), разрешение через **`getAuthErrorMessage`** в **`lib/translations/index.js`**.
- Лимитер: для **`rateLimitCheck(..., 'auth')`** тело 429 — **`error_code: AUTH_RATE_LIMITED`**. Для **`promo_validate`** ответ 429 на **`POST /api/v2/promo-codes/validate`** — **`error_code: PROMO_RATE_LIMITED`** (без legacy-поля **`error`**). Для прочих не-auth типов лимитера по-прежнему может присутствовать legacy-поле **`error`**.
- Серверные гейты (**`lib/security/access-guard.js`** — **`requireAccess`**, **`lib/api/api-guard.js`**, **`requirePartnerSession`** в **`lib/services/session-service.js`**) при отказе отдают **`authErrorJson`** с **`error_code`** из того же **`AuthErrorCode`** (без отдельного человекочитаемого поля **`error`** в JSON). Клиенты, которые парсят только строку **`error`**, нужно переводить на **`error_code`** + **`getAuthErrorMessage`**.

### Проверка JWT приложения (`gostaylo_session` и односекретные токены)

- SSOT верификации: **`lib/auth/verify-app-session-jwt.js`** — **`verifyAppSessionJwt(token, secret)`** с **`jsonwebtoken.verify(..., { algorithms: ['HS256'] })`** (совместимо с **`lib/auth/app-session-issue.js`**).
- Читать сессию из cookie на Route Handlers: **`getSessionPayload()`** / **`requirePartnerSession()`** в **`lib/services/session-service.js`**; для админских health/security-хелперов — **`verifyAppSessionJwt`** + **`tryGetJwtSecret()`** из **`lib/auth/jwt-secret.js`**. Новые маршруты **не** должны вызывать «голый» **`jwt.verify`** для **`gostaylo_session`**.
- Edge **`middleware.ts`** по-прежнему может использовать **`jose`** для тех же HS256-токенов — это отдельный рантайм; не смешивать с Node-SSOT без причины.
- **Logout:** **`POST /api/v2/auth/logout`** сбрасывает **`gostaylo_session`** и sidecar-куки **`gostaylo_pending_ref`** / **`gostaylo_oauth_legal`** (**`clearAuthSidecarCookies`**). Клиентский **`signOut`** (`lib/auth.js`) после ответа сервера вызывает **`clearBrowserPersistedAuthState`** (**`lib/auth/browser-auth-cleanup.js`**): **`invalidateAllClientRequests`**, **`clearClientQueryCache`** (TanStack Query — Stage 128.0), **`localStorage`** / **`sb-*-auth-token`**, затем Supabase **`auth.signOut({ scope: 'local' })`**. Все UI-выходы идут через **`signOut`** / **`useAuth().logout`**.

### Политика пароля (регистрация и сброс)

- SSOT: **`lib/auth/password-policy.js`** — **`AUTH_PASSWORD_MIN_LENGTH = 8`**, **`AUTH_PASSWORD_COMPLEXITY_RE`**: минимум одна буква (латиница **`A–Za–z`** или кириллица) и одна цифра.
- **`POST /api/v2/auth/register`** и **`POST /api/v2/auth/reset-password`** используют эту политику; UI (**`AuthModal`**, **`/reset-password`**) синхронизирован с тем же правилом.

### White-label копии главной (`/`)

- SSOT: **`lib/config/home-page-copy.js`** — функции **`getHomeHeroTitleRaw`**, **`getHomeTopListingsTitleRaw`**, **`resolveHomeCopy`** + константа **`HOME_COPY_AUTO_TOKEN`** (`'AUTO'`). Env-переменные — **`NEXT_PUBLIC_HOME_HERO_TITLE`**, **`NEXT_PUBLIC_HOME_TOP_LISTINGS_TITLE`**.
- Поддерживаемые значения env:
  - **пусто/whitespace** → `null`, UI блок не рендерится;
  - **`AUTO`** (case-insensitive) → клиент берёт перевод через **`getUIText(key, language)`**: `heroTitle` для hero и `topListingsTitle` для секции «Топ объекты»; меняется при переключении языка (RU/EN/ZH/TH);
  - **любая иная строка** — используется как есть (фиксированная white-label-копия).
- **`HomeHeroLuxe`** — Airy Premium: единая 60-px геометрия (Where / Dates / Guests / Search CTA — `h-[60px] rounded-2xl border-slate-200`, focus-ring Teal `#006666`), единый шрифт `text-base font-medium text-slate-900`, отдельные внутренние «лейблы» в полях убраны; категории показаны только как pill-фильтры внутри блока поиска. Дублирующая секция **`CategoryBar`** на главной удалена (компонент сохранён в `components/home/` для возможного переиспользования).
- Вертикальный ритм main-секций: **`py-12 sm:py-16`** (Hero pb / TopListingsGrid / PartnerCTA / HowItWorks).
- Скелетон **`ListingCardSkeleton`** 1:1 совпадает с реальной карточкой `TopListingsGrid` (`rounded-2xl`, `border-slate-200`, image `h-44 sm:h-48`, content `p-5`, gap-8) — нет CLS при появлении данных.

### Таблица `error_code` (основные)

| `error_code` | Типичный HTTP |
|--------------|---------------|
| `AUTH_RATE_LIMITED` | 429 |
| `AUTH_INVALID_JSON` | 400 |
| `AUTH_JWT_NOT_CONFIGURED` | 500 |
| `AUTH_DATABASE_NOT_CONFIGURED` | 500 |
| `AUTH_MISSING_CREDENTIALS` | 400 |
| `AUTH_INVALID_CREDENTIALS` | 401 |
| `AUTH_ACCOUNT_SUSPENDED` | 403 |
| `AUTH_EMAIL_NOT_VERIFIED` | 403 (+ `requiresVerification`) |
| `AUTH_EMAIL_REQUIRED` | 400 |
| `AUTH_LEGAL_TERMS_NOT_ACCEPTED` | 400 |
| `AUTH_PASSWORD_TOO_SHORT` | 400 (регистрация, мин. 8 символов) |
| `AUTH_PASSWORD_REQUIREMENTS` | 400 |
| `AUTH_EMAIL_TAKEN` | 400 |
| `AUTH_REFERRAL_VALIDATION_FAILED` | 400 |
| `AUTH_DATABASE_ERROR` | 500 |
| `AUTH_EMAIL_SEND_FAILED` | (письмо верификации; также **`email_error_code`** при `success: true`) |
| `AUTH_NOT_AUTHENTICATED` | 401 |
| `AUTH_ACCESS_FORBIDDEN` | 403 (роль/зона; партнёрский guard) |
| `API_BOOKING_ID_REQUIRED` | 400 |
| `API_BOOKING_NOT_FOUND` | 404 |
| `AUTH_PROFILE_VALIDATION_FAILED` | 400 (опционально **`detail`**) |
| `AUTH_PROFILE_NOT_FOUND` | 404 |
| `AUTH_INTERNAL` | 500 |
| `AUTH_EMAIL_SERVICE_NOT_CONFIGURED` | 500 |
| `AUTH_RESET_TOKEN_REQUIRED` | 400 |
| `AUTH_PASSWORD_TOO_SHORT_RESET` | 400 (сброс пароля, мин. 8 символов) |
| `AUTH_OAUTH_UNAVAILABLE` | (клиент: OAuth не сконфигурирован; тост в модалке входа) |
| `AUTH_RESET_TOKEN_INVALID` | 400 |
| `AUTH_RESET_TOKEN_WRONG_TYPE` | 400 |
| `AUTH_PASSWORD_RESET_FAILED` | 500 |
| `AUTH_REALTIME_TOKEN_UNAVAILABLE` | 503 |
| `AUTH_REALTIME_DECODE_FAILED` | 500 |
| `REFERRAL_CODE_REQUIRED`, `REFERRAL_CODE_NOT_FOUND`, … | 4xx/429 из гейта рефералов |
| `PROMO_CODE_REQUIRED`, `PROMO_NOT_FOUND`, `PROMO_EXPIRED`, `PROMO_USAGE_LIMIT_REACHED` | 400 |
| `PROMO_LISTING_REQUIRED_FOR_ALLOWLIST`, `PROMO_LISTING_OWNER_REQUIRED`, `PROMO_NOT_VALID_FOR_LISTING` | 400 |
| `PROMO_MIN_AMOUNT_NOT_MET` (+ **`min_amount_thb`**) | 400 |
| `PROMO_INVALID` | 400 |
| `PROMO_RATE_LIMITED` (+ **`retryAfter`**) | 429 |
| `PROMO_INTERNAL` | 500 |

---

## Golden rules

### 1. Database: Supabase first; Prisma for schema docs only

- **All production reads/writes** go through **Supabase** (`@/lib/supabase`, `supabaseAdmin`, or REST from server routes).
- **`prisma/schema.prisma`** stays aligned with the real Supabase schema and enums, but **do not introduce new Prisma Client queries** for product features unless ADR explicitly allows it.
- **`lib/prisma.js` was removed** — runtime data access uses Supabase only; Prisma remains as **`schema.prisma` documentation** (see Golden rule §1).
- **SQL migrations / new tables (TEXT vs UUID):** In production Supabase (**FannyRent**), **`profiles.id`** and domain keys such as **`listings.id`**, **`bookings.id`**, **`conversations.id`** are **`TEXT`**, not native **`uuid`**. Any new column that references them (e.g. `user_id`, `listing_id`) must use **`TEXT`** in raw SQL unless you have verified the parent column type in Supabase; otherwise FK creation fails with **42804**. Canonical write-up: **`docs/TECHNICAL_MANIFESTO.md` §0** and **`docs/ARCHITECTURAL_PASSPORT.md`** §2 intro.

### 2. No hardcoded commissions or exchange rates

- **Commissions** must come from **`profiles.custom_commission_rate`**, **`system_settings`** (e.g. `general.defaultCommissionRate`), **`DEFAULT_COMMISSION_PERCENT`** env, or **values snapshotted on the booking row** — not magic numbers in UI or payment stubs. В **`currency.service.js`** нет числовых запасных констант: при полном отсутствии источников выбрасывается **ошибка** с понятным логом.
- **Split-fee numeric fallbacks** (гостевой сервисный %, резервный/страховой фонд и связанные поля, когда в **`system_settings.general`** нет валидных значений): единственный канон — **`PLATFORM_SPLIT_FEE_DEFAULTS`** в **`lib/config/platform-split-fee-defaults.js`** (реэкспорт из **`lib/services/currency.service.js`** для обратной совместимости). Потребляют **`PricingService`**, **`GET /api/v2/commission`**, **`hooks/use-commission.js`**, сиды/админка при инициализации. Не дублировать те же числа литералами в других модулях.
- **Exchange rates** must come from **`exchange_rates`** and/or the **approved FX service** using **env-provided API keys** — не вносить литералы курсов в `currency.service.js`. Аварийный порядок: **`FALLBACK_THB_PER_USDT`** env и/или **`system_settings.general.fallbackThbPerUsdt`** (см. **`currency-last-resort.js`**).
- **Розничный множитель валюты (витрина + чат THB↔USDT):** **`system_settings.general.chatInvoiceRateMultiplier`** (админка `/admin/settings`) → env **`CHAT_INVOICE_RATE_MULTIPLIER`** → дефолт в **`currency-last-resort.js`**. После сборки «сырых» курсов **`getDisplayRateMap`** делит `rate_to_thb` на этот множитель (гость видит цену в валюте с спредом); **`getEffectiveRate`** для чат-счетов USDT умножает курс на тот же множитель. В **`currency.service.js`** нет литерала множитора — только чтение настроек.
- **Курсы THB/USDT и кресты:** не использовать в проде захардкоженные значения вроде **35.5** — только **`exchange_rates`**, утверждённый FX API с ключом из env и цепочка **`currency-last-resort.js`** / **`general.fallbackThbPerUsdt`**.
- **Allowed exception:** единый модуль **`currency-last-resort.js`** читает только **env / JSON settings**, без дублирования магических чисел по проекту.

### 3. Booking logic lives in service layers

- **Availability, pricing, creation, status transitions, and calendar side-effects** must be implemented in **dedicated services** (e.g. `CalendarService`, `BookingService`, `PricingService`, `EscrowService`) and called from route handlers.
- **API routes** should validate input, auth, and delegate; **avoid** duplicating night-overlap rules, seasonal price rules, or commission math across multiple files.

### 4. Mock / fake code: report and schedule removal

- Any **mock payment**, **in-memory “DB”**, **demo fallbacks**, or **placeholder API keys** discovered during work must be:
  1. **Reported** (ticket / doc / PR description),
  2. **Guarded** behind explicit env flags or `NODE_ENV` where it must remain short-term,
  3. **Scheduled for removal** with an owner and target date.
- **Production** must not depend on mock branches without a deliberate, reviewed exception.

### 5. Security configuration

- **`JWT_SECRET`** is **mandatory** in every deployed environment; the app must **fail loudly** (500 + clear message) if it is missing — never ship with an implicit default secret.

### 6. Environment variables

- **Document** all required secrets in **`.env.example`** (without real values).
- Prefer **one canonical name** per integration (e.g. FX: align `EXCHANGE_RATE_KEY` / `EXCHANGE_API_KEY` in docs and code).

### 7. Display names and image uploads (privacy & consistency)

- **All user-facing name formatting** that shows a person to another user (reviews, chat labels, invoice sender, typing indicator, etc.) must use **`lib/utils/name-formatter.js`** (`formatPrivacyDisplayName`, `formatPrivacyDisplayNameForParticipant`, `formatReviewerInitial`) so display stays **first name + last initial**, with **`stripLegacyModeratorMarker`** applied via that module — do not reimplement ad hoc.
- **All browser/server image ingestion** into product Storage must follow **`lib/services/media/media-profiles.js`** (канонические профили **`listing_photo` / `dispute_media` / `chat_image` / `kyc_document`**) + клиент **`lib/services/media/compress-image-browser.js`** (`compressImageForBrowser`) + сервер **`lib/services/media/media-upload.service.js`** (`processImageBufferToWebp` через **`sharp`**) и затем **`POST /api/v2/upload`**. В `'use client'` не импортировать **`media-upload.service.js`** (sharp / Node builtins). Обёртки уровня листингов (`lib/services/image-upload.service.js`) только вызывают этот пайплайн и API загрузки. Новые buckets — только с allowlist в **`app/api/v2/upload/route.js`** и строкой профиля в **`BUCKET_DEFAULT_PROFILE`** в **`media-profiles.js`**.

### 7a. Dynamic product brand in UI copy (SSOT)

- **Запрещено** вшивать торговое / продуктовое имя платформы литералами в строки **`lib/translations/**`** (и любые другие i18n-срезы). Используйте только плейсхолдер **`{brand}`**; подстановка значения — **`getSiteDisplayName()`** из **`lib/site-url.js`** (**`NEXT_PUBLIC_SITE_NAME`** / **`SITE_DISPLAY_NAME`**, см. комментарий в модуле). На клиенте **`getUIText`** уже выполняет **`injectBrand`** для `{brand}`.
- Для имён людей, чисел и прочего контекста — отдельные плейсхолдеры (**`{name}`**, **`{count}`** и т.д.) и **`.replace(...)`** в компоненте или данные с API; не смешивать с литералом бренда.

### 8. Calendar blocking (single source of truth)

- **Manual blocks, iCal imports, and availability checks** must use **`calendar_blocks`** together with **`CalendarService`** / booking overlap rules. Do not add parallel block tables for product flows; **`availability_blocks`** is legacy and must not be written from partner APIs.

### 9. Anti-disintermediation in chat (commission protection)

- **Direct contact exchange in product chat is forbidden by policy** for renter/partner dialogs: phone numbers, emails, messenger handles/links (WhatsApp/Telegram/etc.), and obfuscated variants (spaces, dots, words like "at", mixed scripts).
- Enforcement must be **layered** and **server-first**: primary guard in **`POST /api/v2/chat/messages`**, optional client pre-warning only as UX helper.
- Moderation behavior must be **risk-based**, not binary-only:
  1. redact/block message fragment,
  2. show user-safe explanation,
  3. log structured security event,
  4. escalate repeat attempts to admin tooling/alerts.
- **Server modes (ENV `CONTACT_SAFETY_MODE`):** default **`ADVISORY`** everywhere when unset (Stage 116.1b, SSOT `lib/contact-safety-mode.js`). **`ADVISORY`** — детектор + предупреждение (`lib/chat/show-contact-safety-warning.js`) + страйки, текст не маскируется; **`REDACT`** — mask on write/read; **`BLOCK`** — **403**. Read-path mask only when mode is REDACT/BLOCK: `resolve-message-contact-mask.js`. Strikes: `profiles.contact_leak_strikes` (RPC `increment_contact_leak_strikes`, not for ADMIN/MODERATOR). At strikes ≥ **`strikeThreshold`**: search demotion via `lib/contact-safety/partner-search-penalty.js` in `sortListingsByReputationRanking` (featured suppressed for penalized owners; toggle `general.chatSafety.searchRankPenaltyEnabled`). Admin: **`GET /api/v2/admin/contact-leak-dashboard`**, **`PATCH /api/v2/admin/users/[id]/contact-strikes`**, UI **`/admin/security`**. Auto-shadowban only if **`chatSafety.autoShadowbanEnabled`**.
- Any future change that weakens contact protection in chat requires explicit update in this SSOT + mirrored updates in **`docs/TECHNICAL_MANIFESTO.md`** and **`docs/ARCHITECTURAL_PASSPORT.md`**.

### 10. Listing categories (universal rental) — SSOT map (no silent drift)

- **Canonical row:** **`categories.slug`** + optional **`categories.wizard_profile`** (Stage 67.0 TEXT) + optional **`categories.parent_id`** (Stage 68.0 UUID self-FK) + optional **`categories.name_i18n`** (Stage 69.0 JSONB locale map) referenced by **`listings.category_id`** (листинги остаются на **листовой** категории; поиск по **родительскому** slug расширяется на детей). Prefer **`wizard_profile`** in admin for vertical behavior; code falls back to slug heuristics when the column is null; при пустом профиле у потомка UI/интервал транспорта может наследовать профиль предка (**`effectiveCategoryWizardProfileRaw`**). Display names: prefer **`name_i18n[lang]`** via **`resolveCategoryDisplayName`**; optional normalized table **`category_i18n`** is reserved (see **`migrations/stage69_category_i18n_table_placeholder.sql`**). Do not invent parallel category tables (`listing_categories` is not canonical for new reads).
- **Resolve id → slug (server):** **`resolveListingCategorySlug`** in **`lib/services/booking/query.service.js`** (Supabase read). **Snapshot on booking:** **`bookings.metadata.listing_category_slug`** is written when entering escrow (**`EscrowService.moveToEscrow`**) so thaw and downstream flows do not depend on join shape alone.
- **Slug predicates (no DB):** **`lib/listing-category-slug.js`** — transport aliases to **`vehicles`**, **`isTourListingCategory`**, **`isYachtLikeCategory`**, **`showsPropertyInteriorSpecs`**.
- **Escrow thaw time (financial bucket):** **`lib/escrow-thaw-rules.js`** — **`getEscrowThawBucketFromCategorySlug`** (читает **`lib/config/category-behavior.js`**) + **`computeEscrowThawAt`**. **Important:** tours / `tour*` slugs map to thaw bucket **`service`** (start + 2h), not a separate thaw type. Changing this requires an explicit ADR and regression on **`escrow_thaw_at`** / cron thaw.
- **Wizard / reviews UX (four logical types):** **`lib/partner/listing-service-type.js`** — **`inferListingServiceTypeFromCategorySlug`** (реестр **`lib/config/category-behavior.js`**) exposes **`tour`** separately from **`service`** for metadata defaults and copy. This is **intentionally different** from the thaw bucket for tours; do not merge the two models without review.
- **Copy that must match thaw buckets:** **`lib/notification-category-terminology.js`** — bucket через **`getEscrowThawBucketFromRegistry`** (**`lib/config/category-behavior.js`**), без прямого импорта **`escrow-thaw-rules`**.
- **Separate heuristics (sync when adding categories):** задайте **`wizard_profile`** в БД для новой вертикали; при отсутствии колонки или редких slug’ах расширяйте **`lib/config/category-behavior.js`** / **`lib/listing-category-slug.js`**. **`lib/listing-location-privacy.js`** и **`lib/partner-calendar-filters.js`** по-прежнему через реестр. When **`categories`** gains a new slug without **`wizard_profile`**, update overrides if map/privacy/calendar grouping still differs from heuristics.
- **Full file index and checklist:** **`docs/ARCHITECTURAL_PASSPORT.md`** §**0.0d-cat** (Stage 47.3 doc).

---

## LIVE PRODUCT STATE

Операционное поведение продуктовых модулей **как в коде сейчас** (канон для аудита; при расхождении с чатами править код или этот раздел).

### Pricing & Discounts (длительность)

- **Где хранится:** `listings.metadata.discounts` — канонический ввод партнёра: **`{ "weekly": 7, "monthly": 20 }`** (7 и 30 ночей соответственно); дополнительно поддерживаются **legacy**-ключи `N_days` / `N` (см. `parseDurationDiscountTiers` в `lib/services/pricing.service.js`).
- **Когда считается:** процент скидки применяется к **субтоталу после ночных/сезонных ставок** (не к базе за одну ночь в отрыве от дат). «Лучший» подходящий порог (max % среди tier’ов с `nights >= minNights`) побеждает.
- **Партнёрский ввод:** форма «Скидки за длительность» (`PartnerListingDurationDiscountFields`) на `/partner/listings/new` и `/partner/listings/[id]` пишет **`weekly` / `monthly`** (через `applyDurationDiscountField` / `duration-discount-helpers`).
- **Публичный UI:** блок **«Special offers»** (`DurationDiscountOffersBlock` в `components/listing/BookingWidget.jsx`) показывает настроенные уровни **до** выбора дат (включая legacy-пороги **3+, 5+** и т.д., не только 7/30); после выбора дат — разбивка цены, строка скидки за длительность и усиленная строка **«Итого»**, если применилась скидка (длительность или сезонная скидка по ставкам).
- **Транспорт, яхты и туры (подписи):** **`getListingRentalPeriodMode`** в `lib/listing-booking-ui.js` — режим **`day`** для **vehicles**, **yacht/boat** в slug и **tours** / подстроки **tour**; в виджете бронирования — **сутки/дни**, не «ночи».
- **Туры — размер группы и дни в БД:** лимит гостей задаётся в **`listings.metadata.group_size_min` / `group_size_max`**; при создании брони **`POST /api/v2/bookings`** для `categories.slug === 'tours'` проверяется **`guestsCount`**, а не длина периода против min/max дней. Колонки **`min_booking_days` / `max_booking_days`** для туров в партнёрском потоке выставляются в **1 / 730** (не семантика «группа»). Миграция старых значений из колонок в metadata: **`mergeTourGroupMetadataFromListingColumns`** в **`lib/partner/listing-wizard-metadata.js`**. Подробная таблица — **`docs/TECHNICAL_MANIFESTO.md`** §3.
- **Чат:** отправка сообщений с клиента — **`POST /api/v2/chat/messages`**. Роута **`/api/messages`** в App Router нет; системные сообщения о статусе брони пишет сервер через **`syncBookingStatusToConversationChat`** (**`lib/booking-status-chat-sync.js`**), а не отдельный устаревший HTTP-вызов с фронта.

### Promo Applicability ADR (Stage 36.0)

- **Единый движок применимости:** `lib/promo/promo-engine.js` — канон для `isCodeApplicable`, `promoIsActiveAt`, `calculatePromoDiscountAmount`. Любая новая проверка применимости/скидки добавляется только сюда, а не в route/UI.
- **Кто использует канон:** `PricingService.validatePromoCode`, `CalendarService` (маркетинговый слой дня), `lib/promo/catalog-promo-badges.js`, а также partner calendar API (`GET /api/v2/partner/calendar`) через тот же движок.
- **Базовые ограничения (одинаковы везде):** `is_active`, `max_uses/current_uses`, `valid_until`, scope по `created_by_type` (`PARTNER` требует `partner_id === listing.owner_id`), allowlist по `allowed_listing_ids`.
- **Контекстные ограничения:** для каталога действует «conservative mode» (глобальные PLATFORM-коды без allowlist не показываются как бейдж в листинге); для календарных дневных индикаторов включена проверка покрытия даты (`targetDate` должен входить в окно действия промо до конца суток).
- **Операционный слой (alpha):** при создании partner Flash Sale логируется событие в `MarketingNotificationsService`; крон `GET/POST /api/cron/flash-sale-reminder` готовит уведомление партнёру за 1 час до конца с KPI `N` созданных броней (`promo_code_used`).
- **Delivery + anti-spam (Stage 37.0):** reminder доставляется партнёру через Telegram adapter (`sendTelegramMessagePayload`) с inline CTA на quick-action продление; дедуп регулируется в `promo_codes.metadata.last_reminder_sent_at` (окно блокировки 45 минут). Любые новые каналы/триггеры обязаны уважать это окно или расширять policy в этом ADR.

### Financial Model v2.0 (Stage 97.0 — ADR-097)

- **ADR:** **`docs/ADR/097-financial-model-v2.md`** — Pricing Profiles, RU/KG internal split, Netto/Brutto, batch payouts.
- **Миграция (схема):** **`database/migrations/053_financial_model_v2.sql`** — таблицы **`pricing_profiles`**, **`pricing_profile_assignments`**, **`payout_batches`**, **`payout_batch_items`**; колонки RUB на **`ledger_entries`**; FK **`pricing_profile_id`** на **`profiles`** / **`listings`**. **`database/migrations/054_add_ready_for_payout_status.sql`** — enum **`booking_status`**: **`READY_FOR_PAYOUT`** (после 24h hold, до пула).
- **Движок (код, Stage 97.0.2+):** **`lib/pricing-engine/`** — **`PricingEngine.computeFinalBreakdown`**, snapshot **`pricing_snapshot.v = 2`**. Проценты **только** из строк **`pricing_profiles`** + **`system_settings.general.default_pricing_profile_id`**; в БД **`ru_agent_share_pct + kr_service_share_pct = guest_fee_pct`** (по умолчанию 7+8=15). Production: **`PRICING_ENGINE_V2=true`** (см. **`docs/PRODUCTION_ENV.md`**).
- **Конфиденциальность:** поля **`ru_fee_thb`**, **`kr_fee_thb`**, **`fx_markup_thb`**, **`platform_margin_pool_thb`** — **только админка и compliance**; партнёр/гость видят **Netto** и итог Brutto через **`toPartnerVisibleBreakdown`**.
- **RUB acquiring:** гость платит в RUB; учёт в THB. SSOT суммы для PSP — **`lib/services/payment-adapters/acquirer-charge-amount.js`**; флаги **`PAYMENT_ACQUIRER_RUB_ENABLED`**, **`PAYMENT_ACQUIRER_RUB_SHADOW`**. Курсовой **спред** — **`fx_markup_thb`** в snapshot (двусторонний: markup в профиле + customer rate в **`PricingEngine.applyFxQuote`**).

### Concierge Launch — ручной treasury на soft launch (Stage 100.3–100.5)

**Контекст:** первый production-трафик; автоматических исходящих банковских API нет.

**Решение:**

1. **Входящие платежи** — штатные webhooks + ledger (`move_to_escrow_and_post_ledger_v1`); RUB в эквайринге, THB в книге.
2. **Исходящие выплаты партнёрам** — только после явных шагов оператора в **`/admin/settings/finances`**: сверка → пул (DRAFT) → Lock → CSV для банка → физический перевод → **`PATCH` `action: settled`** (**`PayoutBatchService.markBatchSettled`**: ledger **`PARTNER_PAYOUT_OBLIGATION_SETTLED`**, брони **`COMPLETED`**, sync балансов).
3. **Cron `payout-batch-pools`** на Concierge **выключен**; **`promote-ready-for-payout`** и **`escrow-thaw`** — по runbook (внешний hourly cron на Hobby).
4. **Партнёр** видит балансы и может подать **`POST /api/v2/partner/payouts`**; исполнение — staff вручную (не stub **`/payouts/request`**).
5. **Compliance / бухгалтерия** — реестр **`GET /api/admin/finances/compliance-export`** (SSOT **`lib/admin/compliance-registry-csv.js`**); период по **дате оплаты**.
6. **Исходящий FX партнёра (Stage 100.6):** THB в ledger неизменен; сумма перевода — **`amount_in_payout_currency`** + **`payout_currency`**. SSOT конвертации — **`lib/partner/partner-payout-fx.js`**; RUB — mid **`exchange_rates`** минус выплатной спред (**`PARTNER_PAYOUT_FX_RUB_SPREAD_PCT`**, default 1.75); USDT — mid без спреда. Резерв available = сумма PENDING/PROCESSING **`payouts`** (gross THB), без UPDATE **`profiles.available_balance_thb`**.

**Операционные доки (не SSOT политики):** **`docs/CONCIERGE_LAUNCH_TREASURY_RUNBOOK.md`**, **`docs/PRE_LAUNCH_CHECKLIST.md`**, **`docs/SOFT_LAUNCH_PLAN.md`**, **`docs/CRON_EXTERNAL_FINANCIAL.md`**.

**Откат:** отключить **`PRICING_ENGINE_V2`**; не вызывать **`settled`** без фактического банковского перевода; при ошибочном пуле — не Lock, править DRAFT по runbook.

### Currency System

- **Канон:** один серверный модуль **`lib/services/currency.service.js`** (курсы, USDT, дефолтная комиссия, **`getEffectiveRate`** с **`resolveChatInvoiceRateMultiplier`** для счетов в чате). Устаревший реэкспорт **`currency-helper.js`** удалён — импорты только из **`currency.service.js`**.
- **Last-resort без литералов в CurrencyService:** **`lib/services/currency-last-resort.js`** — `FALLBACK_THB_PER_USDT`, `DEFAULT_COMMISSION_PERCENT`, `CHAT_INVOICE_RATE_MULTIPLIER`, опционально **`general.fallbackThbPerUsdt`** в `system_settings`; дефолт множителя чата — **`platformDefaultChatInvoiceRateMultiplier`**.
- **Источник истины для курсов отображения:** таблица **`exchange_rates`** в Supabase (`rate_to_thb` = сколько THB за **1** единицу валюты). Символы и список валют селектора: `lib/currency.js` (`CURRENCIES`), API: `GET /api/v2/exchange-rates` (`app/api/v2/exchange-rates/route.js`).
- **Серверный TTL «свежести» БД:** `EXCHANGE_RATES_DB_TTL_MS` = **2 часа** в `lib/services/currency.service.js` — пока строки не старше TTL, внешний **ExchangeRate-API** не дергается; при необходимости обновления выполняется запрос и **upsert** в `exchange_rates` (ключи `EXCHANGE_RATE_KEY` / `EXCHANGE_API_KEY`).
- **Клиент:** `fetchExchangeRates()` в `lib/client-data.js` ходит на тот же API и кеширует `rateMap` в **localStorage** с TTL, **согласованным с 2 часами** (тот же горизонт, что и серверный TTL БД), чтобы не долбить `/api/v2/exchange-rates` на каждом монтировании.
- **Синхронизация валют профиля (Stage 76.2):** `profiles.referral_display_currency` и `profiles.preferred_currency` должны меняться синхронно (единая валюта пользователя для реферального кабинета и остального профиля). Канон записи — `PATCH /api/v2/profile/me`.
- **Отображение сумм:** `formatPrice` в **`lib/currency.js`** использует только переданный **`exchangeRates`** (как `rateMap` с API); в модуле **нет** захардкоженной таблицы курсов для отображения (удалены неиспользуемые `convertFromThb` / `convertToThb` с литералами).

### Calendar & Timezones

- **Календарные даты листингов (день без времени):** канонический TZ — **таймзона листинга** (приоритет: `listings.metadata.timezone` IANA → fallback по стране/региону → env default `LISTING_DATE_TZ` / `NEXT_PUBLIC_LISTING_DATE_TZ`). JS и SQL-расчёты доступности обязаны использовать один и тот же резолвер (Stage 45.2: `lib/geo/listing-timezone-ssot.js` + SQL `resolve_listing_timezone_v1`).
- **Доступность и блокировки:** единая модель **`calendar_blocks`** + `CalendarService` (см. Golden rule §8); устаревший путь **`availability_blocks`** не использовать для записи из партнёрских API.
- **iCal (прод, синхронизация внешних календарей → `calendar_blocks`):** единый модуль **`lib/services/ical-calendar-blocks-sync.js`** (разбор VEVENT с unfold строк, all-day и datetime, запись в **`calendar_blocks`**, логи **`ical_sync_logs`**). Его вызывают **`GET/POST /api/cron/ical-sync`** (Vercel Cron по **`vercel.json`**), **`app/api/ical/sync/route.js`**, **`app/api/v2/admin/ical/route.js`**; включение источников — **`isIcalSyncSourceEnabled`**. **Экспорт** подписного `.ics` для гостя: **`app/api/v2/listings/[id]/ical/route.js`** (`X-WR-TIMEZONE:Asia/Bangkok`). Файл **`lib/services/ical-sync.service.js`** **удалён** (был не подключён к роутам; дублировал логику).
- **Операционные кроны** (время в комментариях к route): payouts / check-in reminder завязаны на **Bangkok** как продуктовый локальный день.
- **Реферальная статистика (кабинет пользователя):** календарные месяц/год, sparklines и прогресс **цели месяца** по заработанным бонусам — в **IANA-таймзоне профиля** `profiles.iana_timezone`, с нормализованным fallback **`UTC`** при пустом/невалидном значении. Резолвер SSOT: **`resolveReferralStatsTimeZone`** в **`lib/referral/resolve-referral-stats-timezone.js`**. Не путать с таймзоной листинга (см. абзац о календарных датах листинга выше). Лимит регистраций по коду (**`ReferralGuardService`**, «текущий месяц») использует **тот же** календарь, что и статистика реферера (начало месяца в TZ реферера). **Админ-аналитика cohort ROI** (`ReferralPnlService.buildCohortRoiSeries`) по-прежнему бьёт когорты по **UTC**-месяцу — глобальная сопоставимость рядов; не смешивать с кабинетом пользователя.
- **Тихая подстановка TZ на реферальной странице:** если **`iana_timezone`** пуста, клиент **`/profile/referral`** один раз (без тостов) записывает **`Intl.DateTimeFormat().resolvedOptions().timeZone`** через **`PATCH /api/v2/profile/me`**, затем перезагружает данные; серверная логика остаётся на **`resolveReferralStatsTimeZone`** после появления валидного значения в профиле.
- **Формат дат в UI/PDF реферальной программы:** отображение **DD.MM.YYYY** (и дата+время в том же стиле) — **`lib/referral/format-referral-datetime.js`**; для подписи периода по **календарю в IANA TZ** — **`formatReferralDateDdMmYyyyInTimeZone`**.
- **Лидерборд рефералов (кабинет):** **`GET /api/v2/referral/leaderboard`** показывает топ по заработку за **текущий календарный месяц** в **той же TZ**, что и **`resolveReferralStatsTimeZone`**. Имена в ответе **маскируются** (**`maskReferralLeaderboardName`**), не AS IS из профиля.
- **Глобальный лидерборд (админка):** **`GET /api/v2/admin/referral/leaderboard`** — календарный месяц строго в **UTC**, полные имена и ссылки на **`/admin/users/:id`**; агрегация суммы earned — SSOT в БД (**`referral_ledger_leaderboard_for_period`**), не полная выгрузка ledger в Node.

### Booking Snapshots (расчёт в БД)

- **Колонка:** `bookings.pricing_snapshot` (**JSONB**), миграция `database/migrations/017_booking_pricing_snapshot.sql`.
- **Содержимое (v1):** строится `buildBookingPricingSnapshot` в `lib/booking-pricing-snapshot.js` при создании брони в `BookingService` — ночи, субтоталы, блок `duration_discount` (процент, сумма THB, порог ночей, подписи ru/en), опционально `promo`.
- **Назначение:** зафиксировать детальный расчёт на момент бронирования для чеков, споров и истории; не подменять задним числом расчёт из текущих `metadata` листинга.

### Locale & `preferred_language` ADR (Stage 42.1)

- **Канон UI-локали (веб + серверные уведомления + Telegram):** функция **`resolveUserLocale(profile)`** в **`lib/i18n/locale-resolver.js`** — порядок **`profiles.preferred_language`** → **`profiles.language`** → нормализация к одному из **`ru` \| `en` \| `zh` \| `th`** (список **`SUPPORTED_UI_LANGUAGES`**). Не дублировать приоритет в маркетинге/боте вручную.
- **Запись выбора пользователя с сайта:** при смене языка в **`I18nProvider`** (авторизованный пользователь) — debounced **`PATCH /api/v2/profile/me`** с телом **`{ preferred_language }`** (сессия та же, что у **`/api/v2/auth/me`**). Пакетное обновление профиля в настройках по-прежнему может использовать **`PATCH /api/v2/auth/me`** с тем же полем **`preferred_language`** (валидация кодов — та же).
- **Telegram-бот:** **`resolveTelegramLanguageForChat`** запрашивает **`preferred_language`** и **`language`**; тексты **zh/th** до отдельных пакетов совпадают с **en**; подписи inline-меню для **zh/th** — как у **en** (см. **`telegramMenuButtonLocale`**). Хардкод **`lang = 'ru'`** в кронах/уведомлениях для локализуемых строк **запрещён** — только резолвер по профилю.
- **Поиск с датами:** при исключении листинга из-за **ошибки** вызова **`CalendarService.checkAvailability`** листинг **не** попадает в выдачу (консервативное поведение против овербукинга).

### Профили, публичная идентичность и приватность

- **Источник данных сессии (рентер / партнёр / общий UI):** серверный **`GET` / `PATCH /api/v2/auth/me`** читает и обновляет строку в **`profiles`** (JWT из cookie `gostaylo_session`). Клиент после успешных ответов обновляет **`localStorage['gostaylo_user']`** и должен диспатчить **`gostaylo-refresh-session`** (и при необходимости опираться на **`auth-change`**) чтобы шапка сайта, сайдбар партнёра и портал рентера подхватывали **аватар** и поля профиля без перезагрузки страницы.
- **Публичная карточка пользователя:** маршрут **`/u/[id]`** (App Router) показывает **только** то, что отдаёт **`GET /api/v2/profiles/[id]/public`**: отображаемое имя (канон — правила приватности из **`lib/utils/name-formatter.js`**, без email в публичном API), **аватар** (URL из БД прогоняется через **`toPublicImageUrl`** / `/_storage/…` на клиенте), **дата регистрации** (месяц/год), **флаг верификации** (`is_verified` / статус), блок **отзывов**. **Email и телефон на публичной странице не отображаются и не отдаются этим API.** Профили с ролью вне **RENTER / PARTNER / USER** публичным эндпоинтом **не раскрываются** (404).
- **Отзывы на публичной странице:** для **партнёра** — **`GET /api/v2/reviews?partner_id=`** (отзывы по всем его листингам). Для **рентера** — **`GET /api/v2/reviews?reviewer_id=`** (отзывы, где `user_id` совпадает с профилем). **Важно:** если у партнёра **нет** листингов, API возвращает **пустой список**, а не все отзывы платформы (защита от утечки данных).
- **Листинг (владелец в JSON):** в **`GET /api/v2/listings/[id]`** в объект **`owner`** попадают **`email` и `phone` только** если запрос идёт от **владельца этого листинга** или **ADMIN/MODERATOR** (проверка по сессии). Иначе в ответе остаются только публичные поля (имя, аватар, верификация и т.д.).
- **Связь с пользователем без утечки контактов:** с публичного профиля контакт возможен только через **«Написать в чат»** → **`POST /api/v2/chat/conversations/from-profile`** с телом **`{ targetUserId, language }`**. Поддерживаются пары **(рентер или staff-роль) ↔ партнёр** и **партнёр ↔ рентер**; у стороны с ролью **partner** в диалоге должен существовать хотя бы один листинг со статусом **ACTIVE** (используется как опора для той же модели `conversations`, что и инквайри с листинга). Текст первого сообщения зависит от **`language`** (ru/en/zh/th).
- **Аватары (загрузка):** файлы уходят в **`POST /api/v2/upload`** с бакетом **`listing-images`** и префиксом пути **`avatars/{userId}/`**; в **`profiles.avatar`** сохраняется **публичный URL** объекта в Storage. Опционально в allowlist добавлен бакет **`avatars`** (изображения только). Отображение везде через **`toPublicImageUrl`** для единообразия с остальным медиа.
- **UI-навигация к профилю:** в **`components/listing/ListingInfo.jsx`** клик по **фото/имени хозяина** ведёт на **`/u/{owner.id}`** (при наличии `owner.id`).
- **Экраны настроек:** **рентер** — **`/renter/settings`** (имя, фото, часть notification preferences); **партнёр** — **`/partner/settings`** (фото, телефон, prefs). Локализация новых строк — **`lib/translations/ui.js`** (в т.ч. ключи **`publicProfile*`**).

---

## Completed roadmap items (reference)

- **Category Unification & Tours Logic Fix** — **COMPLETED** (see **`ROADMAP.md`** §1.3, **`docs/TECHNICAL_MANIFESTO.md`** §3.1–3.2).

---

## Review cadence

Re-read this file when:

- Adding a new **payment**, **payout**, or **FX** path.
- Touching **bookings**, **calendar**, or **commissions**.
- Introducing a new **data access** pattern.
- Changing **profiles**, **public `/u/[id]`**, **chat entry from profile**, or **PII exposed on listing/review APIs**.

---

*SSOT: this file only. Cursor entrypoint: `.cursorrules`.*

## ADR-128: Stage 128.0 — Client-Side Data Layer (TanStack Query Foundation)

**Status:** Iteration 0 **Done** (2026-06-01); Iterations 1+ planned  
**Date:** 2026-05-17 (opened), 2026-06-01 (Iteration 0 shipped)  
**Author:** Pavel + engineering

### Context
В проекте уже частично используется TanStack Query (`AppQueryProvider`, partner/wallet hooks), но основная публичная часть (Главная, Каталог) работает на самодельных кэшах (`useEffect` + `searchCache` Map + `dedupeClientRequest`). При logout TanStack Query **не** очищался — риск показа wallet/inbox/partner-данных следующему пользователю на том же браузере.

### Decision (Iteration 0 — shipped)
1. **`clearClientQueryCache()`** в **`lib/query-client.js`**, вызывается из **`clearBrowserPersistedAuthState`** (единая точка с dedupe). Все выходы: **`signOut`** → cleanup; UI: **`useAuth().logout`**, partner/admin layouts, renter profile.
2. **`lib/query-keys.js`** — SSOT factory **`queryKeys`** + **`queryScopeId`** / **`PUBLIC_SCOPE`** для будущей миграции (существующие ключи в хуках пока не переносились).
3. **`lib/api/query-fetch.js`** — **`queryFetchJson`**, **`QueryFetchError`** (`credentials: 'include'`, `cache: 'no-store'`, контракт `{ success, data, error_code }`).

**Не тронуто в 128.0:** каталог, главная, checkout, платежи, удаление `searchCache` / dedupe TTL.

### Next (Iteration 1+)
- Публичный каталог + home на RQ (см. **`docs/proposals/TANSTACK_QUERY_MIGRATION_PLAN.md`**).
- Постепенный перенос legacy ключей (`['wallet-me']`, `partnerBookingsKeys` в хуках) на **`queryKeys`**.
- Новые authenticated `queryFn` — через **`queryFetchJson`** + scoped keys.

### Why
- Безопасность данных (приоритет №1)
- Единая конвенция перед массовой миграцией
- Минимальный diff перед MIR / каталог-итерацией
