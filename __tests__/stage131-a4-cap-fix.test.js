/**
 * Stage 131.A4 — program cap priorities (race, self-block, counter alignment).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage131-a4-cap-fix.test.js
 */
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

function read(relPath) {
  return fs.readFileSync(path.join(process.cwd(), relPath), 'utf8')
}

describe('Stage 131.A4 — cap priorities', () => {
  it('1. Race fix: cap service uses atomic RPC with fallback', () => {
    const src = read('lib/services/marketing/referral-program-cap.service.js')
    assert.match(src, /atomicCapReserve/)
    assert.match(src, /referral_program_cap_reserve/)
    assert.match(src, /\.rpc\('referral_program_cap_reserve'/)
    assert.match(src, /atomic:\s*true/)
    assert.match(src, /RPC fallback/)
  })

  it('2. Migration uses FOR UPDATE on referral_ledger rows', () => {
    const sql = read('migrations/stage131_a4_referral_program_cap_reserve.sql')
    assert.match(sql, /FOR UPDATE/)
    assert.match(sql, /status IN \('pending', 'earned', 'earned_held'\)/)
    assert.match(sql, /referral_type = 'guest_booking'/)
    assert.match(sql, /created_at >= p_utc_month_start/)
    assert.match(sql, /GRANT EXECUTE/)
    assert.match(sql, /service_role/)
  })

  it('3. Cancel removes pending from spend (cancelPendingLedgerForBooking exists)', () => {
    const src = read('lib/services/marketing/referral-ledger.service.js')
    assert.match(src, /cancelPendingLedgerForBooking/)
    assert.match(src, /\.eq\('status', REFERRAL_STATUSES\.PENDING\)/)
    assert.match(src, /status: REFERRAL_STATUSES\.CANCELED/)
  })

  it('4. Lifecycle hook reverts ledger on cancel (self-unblock)', () => {
    const src = read('lib/services/marketing/referral-lifecycle-hook.js')
    assert.match(src, /revertReferralLedgerForBooking/)
  })

  it('5. Counter alignment: gate and alert use same statuses', () => {
    const capSrc = read('lib/services/marketing/referral-program-cap.service.js')
    const notifySrc = read('lib/services/marketing/referral-notification.service.js')

    assert.match(capSrc, /REFERRAL_STATUSES\.PENDING[\s\S]*REFERRAL_STATUSES\.EARNED[\s\S]*REFERRAL_STATUSES\.EARNED_HELD/)
    assert.match(notifySrc, /sumMonthlyReservedSpendThb/)
    assert.match(notifySrc, /in.*pending.*earned.*earned_held/si)
    assert.match(notifySrc, /referral_type.*guest_booking/s)
    assert.match(notifySrc, /created_at/)

    assert.doesNotMatch(notifySrc, /function sumMonthlyEarnedThb/)
  })

  it('6. Admin snapshot exposes both reserved and paid actual', () => {
    const src = read('lib/admin/referral-accounting-snapshot.js')
    assert.match(src, /monthlyReservedSpendThb/)
    assert.match(src, /monthlyPaidActualThb/)
    assert.match(src, /resolveReferralSpendAlertFlags\(monthlyReservedSpendThb/)
  })

  it('7. New month reset: cap gate uses monthStartUtcIso', () => {
    const src = read('lib/services/marketing/referral-program-cap.service.js')
    assert.match(src, /monthStartUtcIso/)
    assert.match(src, /getUTCFullYear.*getUTCMonth/)
  })

  it('8. sumMonthlyPaidActualThb exists for actual payout tracking', () => {
    const src = read('lib/services/marketing/referral-notification.service.js')
    assert.match(src, /export async function sumMonthlyPaidActualThb/)
    assert.match(src, /eq\('status', 'earned'\)/)
    assert.match(src, /gte\('earned_at'/)
  })
})
