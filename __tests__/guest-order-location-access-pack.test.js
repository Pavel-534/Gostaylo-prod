/**
 * Stage 196.0-A — guest order location + access pack eligibility
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/guest-order-location-access-pack.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

describe('formatGuestOrderLocation', () => {
  it('joins parts and omits missing country', async () => {
    const { formatGuestOrderLocation } = await import('../lib/orders/format-guest-order-location.js')
    assert.equal(
      formatGuestOrderLocation({ district: 'Rawai', city: 'Phuket', country: 'Thailand' }),
      'Rawai, Phuket, Thailand',
    )
    assert.equal(formatGuestOrderLocation({ district: 'Rawai' }), 'Rawai')
    assert.equal(formatGuestOrderLocation({}), '')
    assert.equal(
      formatGuestOrderLocation({ district: 'Phuket', city: 'Phuket', country: 'Thailand' }),
      'Phuket, Thailand',
    )
  })
})

describe('shouldShowCheckInAccessPack', () => {
  it('shows for paid/check-in statuses and hides unpaid', async () => {
    const { shouldShowCheckInAccessPack } = await import('../lib/orders/check-in-access-pack.js')
    assert.equal(shouldShowCheckInAccessPack('PAID_ESCROW', '2099-01-01'), true)
    assert.equal(shouldShowCheckInAccessPack('CHECKED_IN', '2099-01-01'), true)
    assert.equal(shouldShowCheckInAccessPack('INQUIRY', '2099-01-01'), false)
    assert.equal(shouldShowCheckInAccessPack('PENDING', '2099-01-01'), false)
  })
})
