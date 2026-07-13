/**
 * ADR-181.4 — listing financial lock (active bookings)
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/listing-financial-lock.test.js
 */

const { describe, it, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert/strict')

const BASE_EXISTING = {
  id: 'listing-1',
  base_currency: 'THB',
  base_price_thb: 1500,
  country_code: 'TH',
  region_code: 'TH-PHK',
  city_code: 'phuket-city',
  metadata: {
    base_price_asset: {
      amount: 1500,
      currency: 'THB',
      rate_thb_per_unit_mid: 1,
      converted_at: '2026-07-01T00:00:00.000Z',
    },
  },
}

function mockSupabaseWithBookingCount(count, { error = null } = {}) {
  const chain = {
    eq() {
      return chain
    },
    in() {
      return chain
    },
    select() {
      return chain
    },
    then(resolve) {
      resolve({ count, error })
      return Promise.resolve({ count, error })
    },
  }
  return {
    from() {
      return chain
    },
  }
}

describe('listing-financial-lock (ADR-181.4)', () => {
  let prevLockFlag

  beforeEach(() => {
    prevLockFlag = process.env.LISTING_BASE_CURRENCY_LOCK
    process.env.LISTING_BASE_CURRENCY_LOCK = '1'
  })

  afterEach(() => {
    if (prevLockFlag === undefined) {
      delete process.env.LISTING_BASE_CURRENCY_LOCK
    } else {
      process.env.LISTING_BASE_CURRENCY_LOCK = prevLockFlag
    }
  })

  describe('status-sets', () => {
    it('LISTING_FINANCIAL_LOCK_BLOCKING_STATUSES includes PENDING and excludes INQUIRY', async () => {
      const {
        LISTING_FINANCIAL_LOCK_BLOCKING_STATUSES,
        isListingFinancialLockBlockingStatus,
      } = await import('@/lib/booking/status-sets.js')

      assert.ok(LISTING_FINANCIAL_LOCK_BLOCKING_STATUSES.includes('PENDING'))
      assert.ok(LISTING_FINANCIAL_LOCK_BLOCKING_STATUSES.includes('CONFIRMED'))
      assert.ok(LISTING_FINANCIAL_LOCK_BLOCKING_STATUSES.includes('AWAITING_PAYMENT'))
      assert.ok(LISTING_FINANCIAL_LOCK_BLOCKING_STATUSES.includes('PAID_ESCROW'))
      assert.ok(LISTING_FINANCIAL_LOCK_BLOCKING_STATUSES.includes('CHECKED_IN'))
      assert.equal(isListingFinancialLockBlockingStatus('pending'), true)
      assert.equal(isListingFinancialLockBlockingStatus('INQUIRY'), false)
      assert.equal(isListingFinancialLockBlockingStatus('THAWED'), false)
      assert.equal(isListingFinancialLockBlockingStatus('READY_FOR_PAYOUT'), false)
      assert.equal(isListingFinancialLockBlockingStatus('COMPLETED'), false)
      assert.equal(isListingFinancialLockBlockingStatus('CANCELLED'), false)
    })
  })

  describe('detectAttemptedListingFinancialChange', () => {
    it('no-op when only title changes', async () => {
      const { detectAttemptedListingFinancialChange } = await import(
        '@/lib/listing/listing-financial-lock.js'
      )
      const result = detectAttemptedListingFinancialChange({
        existing: BASE_EXISTING,
        body: { title: 'New title' },
      })
      assert.equal(result.attempted, false)
    })

    it('detects explicit baseCurrency change', async () => {
      const { detectAttemptedListingFinancialChange } = await import(
        '@/lib/listing/listing-financial-lock.js'
      )
      const result = detectAttemptedListingFinancialChange({
        existing: { ...BASE_EXISTING, base_currency: 'RUB', country_code: 'RU', region_code: 'RU-KDA' },
        body: { baseCurrency: 'THB' },
      })
      assert.equal(result.attempted, true)
      assert.equal(result.changes.currency, true)
    })

    it('detects basePriceThb amount change', async () => {
      const { detectAttemptedListingFinancialChange } = await import(
        '@/lib/listing/listing-financial-lock.js'
      )
      const result = detectAttemptedListingFinancialChange({
        existing: BASE_EXISTING,
        body: { basePriceThb: 2000 },
      })
      assert.equal(result.attempted, true)
      assert.equal(result.changes.basePrice, true)
    })

    it('allows same basePriceThb within epsilon', async () => {
      const { detectAttemptedListingFinancialChange } = await import(
        '@/lib/listing/listing-financial-lock.js'
      )
      const result = detectAttemptedListingFinancialChange({
        existing: BASE_EXISTING,
        body: { basePriceThb: 1500 },
      })
      assert.equal(result.attempted, false)
    })

    it('detects geo-driven currency change (RU→TH)', async () => {
      const { detectAttemptedListingFinancialChange } = await import(
        '@/lib/listing/listing-financial-lock.js'
      )
      const result = detectAttemptedListingFinancialChange({
        existing: {
          ...BASE_EXISTING,
          base_currency: 'RUB',
          country_code: 'RU',
          region_code: 'RU-KDA',
          city_code: 'sochi',
          metadata: {
            base_price_asset: {
              amount: 2000,
              currency: 'RUB',
              rate_thb_per_unit_mid: 0.45,
              converted_at: '2026-07-01T00:00:00.000Z',
            },
          },
        },
        body: { country: 'TH', region: 'TH-PHK', city: 'phuket-city' },
      })
      assert.equal(result.attempted, true)
      assert.equal(result.changes.currency, true)
      assert.equal(result.changes.geoMayRecalcPrice, true)
      assert.equal(result.changes.basePrice, true)
    })
  })

  describe('checkListingFinancialLock', () => {
    it('returns locked when active booking count > 0', async () => {
      const { checkListingFinancialLock } = await import('@/lib/listing/listing-financial-lock.js')
      const supabase = mockSupabaseWithBookingCount(2)
      const lock = await checkListingFinancialLock(supabase, 'listing-1')
      assert.equal(lock.locked, true)
      assert.equal(lock.activeBookingCount, 2)
    })

    it('returns unlocked when no blocking bookings', async () => {
      const { checkListingFinancialLock } = await import('@/lib/listing/listing-financial-lock.js')
      const supabase = mockSupabaseWithBookingCount(0)
      const lock = await checkListingFinancialLock(supabase, 'listing-1')
      assert.equal(lock.locked, false)
      assert.equal(lock.activeBookingCount, 0)
    })

    it('skips when LISTING_BASE_CURRENCY_LOCK=0', async () => {
      process.env.LISTING_BASE_CURRENCY_LOCK = '0'
      const { checkListingFinancialLock } = await import('@/lib/listing/listing-financial-lock.js')
      const supabase = mockSupabaseWithBookingCount(99)
      const lock = await checkListingFinancialLock(supabase, 'listing-1')
      assert.equal(lock.locked, false)
      assert.equal(lock.lockDisabled, true)
    })
  })

  describe('assertListingFinancialEditAllowed', () => {
    it('allows currency change when no active bookings', async () => {
      const { assertListingFinancialEditAllowed } = await import(
        '@/lib/listing/listing-financial-lock.js'
      )
      const supabase = mockSupabaseWithBookingCount(0)
      const result = await assertListingFinancialEditAllowed(supabase, 'listing-1', {
        existing: BASE_EXISTING,
        body: { baseCurrency: 'USD' },
      })
      assert.equal(result.allowed, true)
    })

    it('rejects price change when PENDING booking exists', async () => {
      const { assertListingFinancialEditAllowed, LISTING_ASSET_LOCKED_ACTIVE_BOOKINGS } =
        await import('@/lib/listing/listing-financial-lock.js')
      const supabase = mockSupabaseWithBookingCount(1)

      await assert.rejects(
        () =>
          assertListingFinancialEditAllowed(supabase, 'listing-1', {
            existing: BASE_EXISTING,
            body: { basePriceThb: 2500 },
            partnerId: 'partner-1',
          }),
        (err) => {
          assert.equal(err.code, LISTING_ASSET_LOCKED_ACTIVE_BOOKINGS)
          assert.equal(err.status, 400)
          assert.equal(err.details.activeBookingCount, 1)
          assert.equal(err.details.attemptedChanges.basePrice, true)
          return true
        },
      )
    })

    it('allows price change when only COMPLETED bookings (count=0 in lock query)', async () => {
      const { assertListingFinancialEditAllowed } = await import(
        '@/lib/listing/listing-financial-lock.js'
      )
      const supabase = mockSupabaseWithBookingCount(0)
      const result = await assertListingFinancialEditAllowed(supabase, 'listing-1', {
        existing: BASE_EXISTING,
        body: { basePriceThb: 2500 },
      })
      assert.equal(result.allowed, true)
    })

    it('rejects geo change that forces currency when CONFIRMED booking exists', async () => {
      const { assertListingFinancialEditAllowed, LISTING_ASSET_LOCKED_ACTIVE_BOOKINGS } =
        await import('@/lib/listing/listing-financial-lock.js')
      const supabase = mockSupabaseWithBookingCount(3)

      await assert.rejects(
        () =>
          assertListingFinancialEditAllowed(supabase, 'listing-1', {
            existing: {
              ...BASE_EXISTING,
              base_currency: 'RUB',
              country_code: 'RU',
              region_code: 'RU-KDA',
              city_code: 'sochi',
            },
            body: { country: 'TH', region: 'TH-PHK', city: 'phuket-city' },
          }),
        (err) => {
          assert.equal(err.code, LISTING_ASSET_LOCKED_ACTIVE_BOOKINGS)
          assert.equal(err.details.attemptedChanges.geoMayRecalcPrice, true)
          return true
        },
      )
    })

    it('allows non-financial PATCH when bookings exist', async () => {
      const { assertListingFinancialEditAllowed } = await import(
        '@/lib/listing/listing-financial-lock.js'
      )
      const supabase = mockSupabaseWithBookingCount(5)
      const result = await assertListingFinancialEditAllowed(supabase, 'listing-1', {
        existing: BASE_EXISTING,
        body: { description: 'Updated description only' },
      })
      assert.equal(result.allowed, true)
      assert.equal(result.attempt.attempted, false)
    })

    it('skips lock enforcement when flag disabled', async () => {
      process.env.LISTING_BASE_CURRENCY_LOCK = '0'
      const { assertListingFinancialEditAllowed } = await import(
        '@/lib/listing/listing-financial-lock.js'
      )
      const supabase = mockSupabaseWithBookingCount(10)
      const result = await assertListingFinancialEditAllowed(supabase, 'listing-1', {
        existing: BASE_EXISTING,
        body: { basePriceThb: 9999 },
      })
      assert.equal(result.allowed, true)
      assert.equal(result.lockDisabled, true)
    })
  })
})
