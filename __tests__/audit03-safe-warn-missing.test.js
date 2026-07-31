/**
 * AUDIT_03 safe WARN/MISSING unit checks.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/audit03-safe-warn-missing.test.js
 */
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

describe('AUDIT_03 W3.12 cron secret timingSafeEqual', () => {
  it('rejects different lengths and accepts equal', async () => {
    const { secretsTimingSafeEqual } = await import('../lib/cron/secrets-timing-safe-equal.js')
    assert.equal(secretsTimingSafeEqual('abc', 'abcd'), false)
    assert.equal(secretsTimingSafeEqual('secret', 'secret'), true)
    assert.equal(secretsTimingSafeEqual('secret', 'secreX'), false)
    assert.equal(secretsTimingSafeEqual('', ''), false)
  })
})

describe('AUDIT_03 W3.8 invalid TZ → Bangkok', () => {
  it('falls back to Asia/Bangkok for bogus metadata.timezone', async () => {
    const { resolveListingTimeZoneFromMetadata } = await import('../lib/geo/listing-timezone-ssot.js')
    assert.equal(
      resolveListingTimeZoneFromMetadata({ timezone: 'Not/A_Real_Zone' }, { listingId: 'lst-test' }),
      'Asia/Bangkok',
    )
    assert.equal(
      resolveListingTimeZoneFromMetadata({ timezone: 'Europe/Moscow' }),
      'Europe/Moscow',
    )
  })
})

describe('AUDIT_03 M3.7 alert severity defaults', () => {
  it('defaults to WARN and keeps CRITICAL ceiling separate', async () => {
    const { resolveSystemAlertSeverity, classifySystemAlert } = await import(
      '../lib/services/system-alert-notify.js'
    )
    assert.equal(resolveSystemAlertSeverity(undefined, 'GENERAL'), 'WARN')
    assert.equal(resolveSystemAlertSeverity('CRITICAL', 'GENERAL'), 'CRITICAL')
    assert.equal(classifySystemAlert('PRICE_MISMATCH on listing'), 'PRICE_TAMPERING')
  })
})
