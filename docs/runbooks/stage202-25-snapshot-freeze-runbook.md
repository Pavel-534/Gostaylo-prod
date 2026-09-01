# Stage 202.25 — Snapshot freeze + insurance SSOT (ops runbook)

Owner sign-off: **Strategy C — inventory + freeze** (2026-09-01).

## Scope

- Pre-cutover bookings without `metadata.fintech_snapshot` → frozen canon (no ledger recalc).
- Post-cutover bookings without snapshot → code **fail-closed** on accrual resolve.
- Insurance % editable in **FinTech panel** (`system_fintech_settings.insurance_fund_percent`).

## Pre-deploy (FannRent / staging)

1. Apply migration: `migrations/stage202_25_insurance_fund_percent.sql`
2. Run inventory:

```bash
node --import ./scripts/node-test-alias-register.mjs scripts/inventory-bookings-without-snapshot.mjs
```

Record:

- `preCutover` — expected freeze candidates
- `postCutover` — **must be 0** if payment attach works (Stage 131)

## Deploy

Deploy app with Stage 202.25 code (resolve + insurance + panel).

## Post-deploy freeze (service_role)

Use Node REPL or one-off admin script calling:

```js
import { createClient } from '@supabase/supabase-js'
import { freezeBookingsWithoutSnapshot } from '@/lib/services/finance/fintech-snapshot-freeze.service.js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const dry = await freezeBookingsWithoutSnapshot(supabase, { dryRun: true })
console.log(dry) // updated = N candidates
const applied = await freezeBookingsWithoutSnapshot(supabase, { dryRun: false })
console.log(applied)
```

Verify: `applied.updated ===` pre-deploy `preCutover` count.

## Smoke (8 points)

1. `/api/v2/referral/me/engagement` — unchanged
2. FinTech calculator 35K / 15% guest fee: insurance **26.25 THB** (0.5% × 5,250 margin)
3. FinTech panel: change insurance 0.5% → 0.7%, preview updates
4. New booking post-deploy: snapshot on payment initiate; resolve → `snapshot`
5. Old COMPLETED pre-cutover: resolve → `frozen_default_pre_cutover` or `snapshot_frozen` after freeze
6. Waterfall smoke / ADR reference still passes
7. Stages 202.21–202.26 unaffected
8. No new money write-path audit entries (config-only)

## Rollback note

Frozen snapshots are metadata-only; rollback code restores live resolve but **does not** remove frozen flags. Do not re-run freeze after rollback without dry-run review.
