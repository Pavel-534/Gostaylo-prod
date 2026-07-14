/**
 * Partner bookings tab filter SSOT
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/partner-bookings-tabs.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

describe('partner-bookings-tabs', () => {
  it('maps status to tab buckets', async () => {
    const {
      partnerBookingTabForStatus,
      filterPartnerBookingsByTab,
      countPartnerBookingsByTab,
      tabForPartnerBookingDeepLink,
    } = await import('../lib/booking/partner-bookings-tabs.js')

    assert.equal(partnerBookingTabForStatus('PENDING'), 'action_required')
    assert.equal(partnerBookingTabForStatus('PAID_ESCROW'), 'active')
    assert.equal(partnerBookingTabForStatus('COMPLETED'), 'completed')
    assert.equal(partnerBookingTabForStatus('CANCELLED'), 'cancelled')

    const rows = [
      { id: '1', status: 'PENDING' },
      { id: '2', status: 'PAID_ESCROW' },
      { id: '3', status: 'COMPLETED' },
    ]
    assert.equal(filterPartnerBookingsByTab(rows, 'action_required').length, 1)
    assert.equal(filterPartnerBookingsByTab(rows, 'active').length, 1)
    assert.equal(countPartnerBookingsByTab(rows).all, 3)
    assert.equal(tabForPartnerBookingDeepLink({ status: 'PENDING' }), 'action_required')
  })
})
