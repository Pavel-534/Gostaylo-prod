# Миграции Supabase (Airento — white-label platform)

## Обязательный порядок для новой таблицы в `public`

После **2026-10-30** Supabase не выдаёт `anon` / `authenticated` / `service_role` доступ к новым таблицам автоматически. Без шага **GRANT** Data API вернёт `42501 permission denied`.

| Шаг | Действие |
|-----|----------|
| 1 | `CREATE TABLE` (типы FK: **`profiles.id` = TEXT** в проде) |
| 2 | **`GRANT`** — явно по ролям (см. шаблон) |
| 3 | **`ALTER TABLE … ENABLE ROW LEVEL SECURITY`** |
| 4 | **`CREATE POLICY`** — кто какие строки видит |

Шаблон: **`_template_new_public_table.sql`**

## Профили доступа

| Профиль | GRANT | RLS |
|---------|-------|-----|
| **Backend-only** (`payouts`, `ledger_*`, outbox) | только `service_role` | включён, без политик для anon |
| **User-scoped** (`user_push_tokens`, `favorites`) | `authenticated` + `service_role` | `user_id = current_profile_id()` |
| **Public catalog** (`categories`) | `SELECT` для anon + staff write через `is_admin()` | активные строки / staff |
| **Listing owner** (`seasonal_prices`, `calendar_blocks`) | обычно только API (`service_role`) | join на `listings.owner_id` |

Приложение в основном ходит через **`supabaseAdmin`** (service role) в `app/api/**` — RLS обходит, но **anon key в браузере** всё равно должен быть закрыт политиками.

## Stage 203 — AUDIT_LEDGER_01 first-posting blockers (порядок)

Применяйте **строго по номеру** (FK detach → затем append-only, иначе stamp UPDATE не пройдёт whitelist):

| # | Файл | Что |
|---|------|-----|
| 1 | `stage203_01_seed_dispute_hold_account.sql` | Seed `la-sys-dispute-hold` / `DISPUTE_HOLD_RESERVE` (C-L2) |
| 2 | `stage203_02_ledger_fk_no_cascade.sql` | `booking_id` FK `ON DELETE SET NULL` + `deleted_booking_id` stamp (C-L3) |
| 3 | `stage203_03_ledger_append_only.sql` | Append-only triggers + RLS re-assert + GRANT SELECT/INSERT only (C-L4) |
| 4 | `stage203_04_revoke_ledger_truncate.sql` | REVOKE TRUNCATE (bypass row triggers) — apply if 203.03 already ran without it |

**Не применять 203.03 до 203.02.** Dual-SSOT / RPC fee-split — вне этого stage.

Cleanup E2E: не удаляет `PAID_ESCROW`/`THAWED`/… брони и не DELETE `ledger_*` rows (`lib/e2e/cleanup-test-users.service.js`).

## Stage 201 — AUDIT_02 money RPCs (порядок)

Независимые объекты (нет shared race). Применяйте **по номеру**:

| # | Файл | Что |
|---|------|-----|
| 1 | `stage201_01_adjust_held_referral_balance_atomic.sql` | Held referral balance RPC |
| 2 | `stage201_02_payout_batch_settle_single_flight.sql` | Settle try_claim / release (metadata CAS) |
| 3 | `stage201_03_payout_batch_settle_lock_refresh.sql` | Heartbeat refresh + TTL default 1800s |

Можно атомарно в одном SQL-транзактном прогоне (один `psql` session) или последовательно. `CREATE OR REPLACE` — идемпотентно.

## Уже применено в проекте

- **Stage 121.0** — `stage121_0_rls_security_sweep.sql` (Security Advisor: RLS на открытых таблицах)
- **Stage 94 / 051** — core `profiles`, `listings`, `bookings`

## Security Advisor

[Dashboard → Advisors → Security](https://supabase.com/dashboard/project/vtzzcdsjwudkaloxhvnw/advisors/security)

## Документация Supabase

- [Changelog: explicit grants](https://supabase.com/changelog) (апрель–октябрь 2026)
- [Database Linter](https://supabase.com/docs/guides/database/database-linter)
