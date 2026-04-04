# Architectural Decisions — GoStayLo / Super App

## Единственный источник истины (SSOT)

- **Этот файл (`ARCHITECTURAL_DECISIONS.md` в корне репозитория)** — канонический манифест проекта: стек, золотые правила, порядок ревью.
- **`.cursorrules`** — только короткий «указатель» для Cursor: напоминание открыть этот файл и не дублировать политики. **При любом расхождении побеждает только `ARCHITECTURAL_DECISIONS.md`.**
- Менять архитектурные правила нужно **здесь**; затем при необходимости сжато обновить `.cursorrules` (если добавились новые жёсткие триггеры для агента).

---

## Перед задачей (команда: человек + AI)

Перед выполнением **любой** нетривиальной задачи сверяйся с этим документом. Если в коде встречается или предлагается хардкод вроде **15%** комиссии или **35.5** для курса — **не добавляй и не размножай**: бери данные из **`system_settings`**, **`exchange_rates`**, **`profiles`**, полей **бронирования** (снимок на момент создания), **`JWT_SECRET` / FX-ключей из env** и существующих хелперов (`PricingService`, `currency-helper`, `getJwtSecret` и т.д.). Исключение — один согласованный last-resort fallback в общем модуле (см. Golden rule §2).

---

This document is the **project manifesto**: how we build, what is allowed, and what to fix when drift appears.

---

## Current tech stack (high level)

| Layer | Choice |
|--------|--------|
| **App** | Next.js (App Router), React |
| **Database** | PostgreSQL via **Supabase** (REST + `supabase-js` / service role on server) |
| **Auth** | Custom JWT in HttpOnly cookie (`gostaylo_session`), bcrypt passwords in `profiles` |
| **ORM / schema** | **Prisma `schema.prisma`** as **documentation and typing reference** for tables/enums — **not** the primary runtime data layer |
| **Realtime / storage** | Supabase (where configured): Realtime, Storage |
| **Email** | Resend (when `RESEND_API_KEY` is set) |
| **FX (partial)** | ExchangeRate-API v6 (via env keys), `exchange_rates` table, helpers in `lib/services/currency-helper.js` |
| **Deploy** | Typical: Vercel + Supabase project |

---

## Golden rules

### 1. Database: Supabase first; Prisma for schema docs only

- **All production reads/writes** go through **Supabase** (`@/lib/supabase`, `supabaseAdmin`, or REST from server routes).
- **`prisma/schema.prisma`** stays aligned with the real Supabase schema and enums, but **do not introduce new Prisma Client queries** for product features unless ADR explicitly allows it.
- **`lib/prisma.js` was removed** — runtime data access uses Supabase only; Prisma remains as **`schema.prisma` documentation** (see Golden rule §1).

### 2. No hardcoded commissions or exchange rates

- **Commissions** must come from **`profiles.custom_commission_rate`**, **`system_settings`** (e.g. `general.defaultCommissionRate`), or **values snapshotted on the booking row** — not magic numbers in UI or payment stubs.
- **Exchange rates** must come from **`exchange_rates`** and/or the **approved FX service** using **env-provided API keys** — not literals like `35.5` in payment or display code.
- **Allowed exception (temporary):** a single, documented **last-resort fallback** in one shared module (e.g. when DB and API both fail), logged and monitored — never scattered copy-paste defaults.

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
- **All browser image uploads** that end up in product Storage must go through **`lib/services/image-upload.service.js`** (compression to WebP, resize, then `POST /api/v2/upload`) so behavior stays consistent; new buckets must be allowlisted in **`app/api/v2/upload/route.js`**.

### 8. Calendar blocking (single source of truth)

- **Manual blocks, iCal imports, and availability checks** must use **`calendar_blocks`** together with **`CalendarService`** / booking overlap rules. Do not add parallel block tables for product flows; **`availability_blocks`** is legacy and must not be written from partner APIs.

---

## Review cadence

Re-read this file when:

- Adding a new **payment**, **payout**, or **FX** path.
- Touching **bookings**, **calendar**, or **commissions**.
- Introducing a new **data access** pattern.

---

*SSOT: this file only. Cursor entrypoint: `.cursorrules`.*
