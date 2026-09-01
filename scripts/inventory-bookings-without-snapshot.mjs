#!/usr/bin/env node
/**
 * Stage 202.25 — inventory bookings missing metadata.fintech_snapshot (ops one-off).
 *
 * Usage:
 *   node --import ./scripts/node-test-alias-register.mjs scripts/inventory-bookings-without-snapshot.mjs
 *
 * Requires: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env.
 */
import { createClient } from '@supabase/supabase-js'
import { countBookingsWithoutSnapshot } from '@/lib/services/finance/fintech-snapshot-freeze.service.js'

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('Missing SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const report = await countBookingsWithoutSnapshot(supabase)

console.log('Stage 202.25 — bookings without valid fintech_snapshot')
console.log('---')
console.log(`Scanned (cap):     ${report.scanned}${report.truncated ? ' (truncated — raise limit in service if needed)' : ''}`)
console.log(`Without snapshot:  ${report.withoutSnapshot}`)
console.log(`Pre-cutover:       ${report.preCutover} (candidate for freeze)`)
console.log(`Post-cutover:      ${report.postCutover} (must be 0 after Stage 131 payment attach)`)
console.log('---')
console.log('Sample pre-cutover (max 5):')
for (const row of report.samples.pre_cutover) {
  console.log(`  ${row.id} status=${row.status} created_at=${row.created_at}`)
}
console.log('Sample post-cutover (max 5):')
for (const row of report.samples.post_cutover) {
  console.log(`  ${row.id} status=${row.status} created_at=${row.created_at}`)
}

if (report.postCutover > 0) {
  process.exitCode = 2
}
