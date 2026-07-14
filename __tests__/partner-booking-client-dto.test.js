/**
 * Partner booking PII sanitize + i18n {count}
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/partner-booking-client-dto.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

describe('sanitizePartnerBookingForClient', () => {
  it('strips guest phone, email, and renter email', async () => {
    const { sanitizePartnerBookingForClient } = await import('../lib/partner/partner-booking-client-dto.js')
    const input = {
      id: 'b-1',
      guestName: 'Alex',
      guestPhone: '+79991234567',
      guestEmail: 'alex@example.com',
      renter: {
        id: 'u-1',
        firstName: 'Alex',
        lastName: 'K',
        email: 'alex@example.com',
      },
    }
    const out = sanitizePartnerBookingForClient(input)
    assert.equal(out.guestPhone, null)
    assert.equal(out.guestEmail, null)
    assert.deepEqual(out.renter, { id: 'u-1', firstName: 'Alex', lastName: 'K' })
    assert.equal(out.renter.email, undefined)
  })
})
