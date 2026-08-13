/**
 * Stage 201.09 — test ledger/booking self-clean (no live-money DELETE).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-09-test-ledger-self-clean.test.js
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import { isNeverPaidCleanupBooking } from '../lib/e2e/never-paid-booking-cleanup.js'
import { resolveCleanupTestDataDryRun } from '../lib/cron/cleanup-test-data-dry-run.js'

const root = process.cwd()
function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 201.09 — never-paid booking predicate', () => {
  const today = '2026-08-13'

  it('always allows CANCELLED (never captured)', () => {
    assert.equal(isNeverPaidCleanupBooking({ status: 'CANCELLED', check_out: '2027-01-01' }, today), true)
  })

  it('allows stale unpaid after check-out, not future unpaid', () => {
    assert.equal(
      isNeverPaidCleanupBooking({ status: 'INQUIRY', check_out: '2026-06-27' }, today),
      true,
    )
    assert.equal(
      isNeverPaidCleanupBooking({ status: 'AWAITING_PAYMENT', check_out: '2026-08-20' }, today),
      false,
    )
    assert.equal(isNeverPaidCleanupBooking({ status: 'PAID_ESCROW', check_out: '2026-01-01' }, today), false)
  })
})

describe('Stage 201.09 — cleanup wiring', () => {
  it('purges test ledger via RPC then merges never-paid booking ids', () => {
    const src = read('lib/e2e/cleanup-test-data.service.js')
    assert.match(src, /purgeTestLedgerRows/)
    assert.match(src, /scope: 'markers'/)
    assert.match(src, /fetchNeverPaidCleanupBookingIds/)
    const cron = read('app/api/cron/cleanup-test-data/route.js')
    assert.match(cron, /maxProfiles: dryRun \? 0 : 80/)
  })

  it('user cleanup deletes money-status smoke bookings only after successful purge', () => {
    const src = read('lib/e2e/cleanup-test-users.service.js')
    assert.match(src, /purgeTestLedgerRows/)
    assert.match(src, /partitionBookingsForLedgerSafeCleanup/)
    assert.match(src, /referral_attributions/)
    assert.match(src, /resolveAuthUserIds/)
  })

  it('cron execute: Vercel header or dryRun=false; path has no query string', () => {
    const vercel = JSON.parse(read('vercel.json'))
    const paths = (vercel.crons || []).map((c) => c.path)
    assert.ok(paths.includes('/api/cron/cleanup-test-data'))
    assert.equal(paths.some((p) => String(p).includes('cleanup-test-data?')), false)

    const fake = (url, headers = {}) => ({
      url,
      headers: { get: (k) => headers[k] ?? null },
    })
    assert.equal(resolveCleanupTestDataDryRun(fake('https://x/api/cron/cleanup-test-data')), true)
    assert.equal(
      resolveCleanupTestDataDryRun(
        fake('https://x/api/cron/cleanup-test-data', { 'x-vercel-cron': '1' }),
      ),
      false,
    )
    assert.equal(
      resolveCleanupTestDataDryRun(fake('https://x/api/cron/cleanup-test-data?dryRun=false')),
      false,
    )
  })

  it('stale unpaid past checkout is cancelled from cleanup-drafts with cancel scope', () => {
    const drafts = read('app/api/cron/cleanup-drafts/route.js')
    assert.match(drafts, /processStaleUnpaidPastCheckout/)
    const expiry = read('lib/booking/checkout-hold-expiry.js')
    assert.match(expiry, /auto_expired_past_checkout_unpaid/)
    assert.match(expiry, /bookingStatusScope: 'cancel'/)
  })

  it('RPC stays service_role; markers do not treat unpaid status as test money', () => {
    const sql = read('migrations/stage201_09_purge_test_ledger.sql')
    assert.match(sql, /purge_test_ledger_rows/)
    assert.match(sql, /SECURITY DEFINER/)
    assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.purge_test_ledger_rows\(text\) TO service_role/)
    assert.match(sql, /airento\.purge_test_ledger/)
    const tighten = read('migrations/stage201_09b_purge_test_ledger_markers_tighten.sql')
    assert.equal(/status IN \('CANCELLED'/.test(tighten), false)
  })
})
