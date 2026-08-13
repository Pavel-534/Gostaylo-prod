/**
 * Stage 201.10 — leftover demo profiles + e2e tank reversals.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-10-prelaunch-demo-profile-cleanup.test.js
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isTestProfileRow } from '../lib/e2e/test-user-markers.js'
import { isTestTankLedgerRow } from '../lib/e2e/test-marketing-referral-markers.js'

describe('Stage 201.10 — leftover demo / seed profiles', () => {
  it('keeps team and early real guests', () => {
    assert.equal(isTestProfileRow({ id: 'user-mmhsxted-zon', email: '86boa@mail.ru', role: 'PARTNER' }), false)
    assert.equal(isTestProfileRow({ id: 'admin-777', email: 'pavel_534@mail.ru', role: 'ADMIN' }), false)
    assert.equal(
      isTestProfileRow({ id: 'user-mmq8fm4a-n1s', email: 'pavel29031983@gmail.com', role: 'RENTER' }),
      false,
    )
    assert.equal(
      isTestProfileRow({ id: 'user-mna486m2-c3g', email: 'belomestnovila217@gmail.com', role: 'RENTER' }),
      false,
    )
    assert.equal(
      isTestProfileRow({ id: 'user-mol13reo-06w', email: 'maksim.b.90@internet.ru', role: 'PARTNER' }),
      false,
    )
  })

  it('flags disposable-domain and seed ids including test ADMIN', () => {
    assert.equal(isTestProfileRow({ id: 'partner-test', email: 'partner@test.com', role: 'PARTNER' }), true)
    assert.equal(isTestProfileRow({ id: 'partner-1', email: 'partner@funnyrent.com', role: 'PARTNER' }), true)
    assert.equal(isTestProfileRow({ id: 'moderator-1', email: 'assistant@test.com', role: 'ADMIN' }), true)
    assert.equal(
      isTestProfileRow({ id: 'user-phantom-g-mqfazu0u', email: 'g@test.invalid', role: 'RENTER' }),
      true,
    )
    assert.equal(
      isTestProfileRow({
        id: 'usr-stage152-verify-partner',
        email: 'usr-stage152-verify-partner@t.invalid',
        role: 'PARTNER',
      }),
      true,
    )
    assert.equal(
      isTestProfileRow({ id: 'u1', email: 'test-prod-1772803267@example.com', role: 'RENTER' }),
      true,
    )
  })

  it('flags e2e dispute tank reversals with no booking_id', () => {
    assert.equal(
      isTestTankLedgerRow({
        id: 'mpt-1',
        booking_id: null,
        entry_type: 'host_activation_reversal',
        metadata: { trigger: 'e2e_dispute_resolved' },
      }),
      true,
    )
    assert.equal(
      isTestTankLedgerRow({
        id: 'mpt-live',
        booking_id: 'b-real',
        entry_type: 'host_activation_bonus_debit',
        metadata: { trigger: 'booking_completed' },
      }),
      false,
    )
  })
})
