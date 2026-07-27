/**
 * Stage 196.0-B — dual-channel auth redirect + booking draft dates
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/auth-redirect-booking-draft.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

describe('auth-redirect dual channel', () => {
  it('buildAuthEntryHref encodes redirect query', async () => {
    const { buildAuthEntryHref, sanitizeAuthReturnPath } = await import('../lib/auth/auth-redirect.js')
    assert.equal(buildAuthEntryHref('login'), '/auth/login')
    const href = buildAuthEntryHref('login', '/listings/abc?checkIn=2026-08-01&checkOut=2026-08-05&guests=2')
    assert.ok(href.startsWith('/auth/login?redirect='))
    assert.ok(href.includes(encodeURIComponent('/listings/abc?checkIn=2026-08-01&checkOut=2026-08-05&guests=2')))
    assert.equal(sanitizeAuthReturnPath('/auth/login'), null)
    assert.equal(sanitizeAuthReturnPath('https://evil.example/'), null)
  })

  it('resolvePostAuthRedirect prefers query over storage semantics', async () => {
    const { readRedirectFromAuthQuery, resolvePostAuthRedirect } = await import(
      '../lib/auth/auth-redirect.js'
    )
    const fromQ = readRedirectFromAuthQuery(
      '?redirect=' + encodeURIComponent('/listings/x?checkIn=2026-08-01&checkOut=2026-08-03&guests=2'),
    )
    assert.equal(fromQ, '/listings/x?checkIn=2026-08-01&checkOut=2026-08-03&guests=2')
    assert.equal(
      resolvePostAuthRedirect({
        search: '?redirect=' + encodeURIComponent('/my-bookings'),
        fallback: '/profile/',
      }),
      '/my-bookings',
    )
    assert.equal(resolvePostAuthRedirect({ search: '', fallback: '/profile/' }), '/profile/')
  })
})

describe('booking-modal-draft dates', () => {
  it('builds payload with dates and restores when URL missing', async () => {
    const {
      buildBookingModalDraftPayload,
      buildListingBookingReturnHref,
      resolveDraftBookingDatesWhenUrlMissing,
    } = await import('../lib/listing/booking-modal-draft.js')

    const payload = buildBookingModalDraftPayload({
      guests: 3,
      checkIn: '2026-08-01',
      checkOut: '2026-08-05',
      checkInTime: '10:00',
      checkOutTime: '18:00',
      includeTimes: true,
    })
    assert.equal(payload.v, 2)
    assert.equal(payload.checkIn, '2026-08-01')
    assert.equal(payload.checkOut, '2026-08-05')
    assert.equal(payload.guests, 3)
    assert.equal(payload.checkInTime, '10:00')

    const href = buildListingBookingReturnHref({
      pathname: '/listings/abc',
      searchParams: { toString: () => '' },
      checkIn: '2026-08-01',
      checkOut: '2026-08-05',
      guests: 2,
    })
    assert.equal(href, '/listings/abc?checkIn=2026-08-01&checkOut=2026-08-05&guests=2')

    assert.equal(
      resolveDraftBookingDatesWhenUrlMissing({
        draft: payload,
        urlCheckIn: '2026-08-01',
        urlCheckOut: '2026-08-05',
      }),
      null,
    )
    const restored = resolveDraftBookingDatesWhenUrlMissing({
      draft: payload,
      urlCheckIn: '',
      urlCheckOut: '',
    })
    assert.deepEqual(restored, {
      checkIn: '2026-08-01',
      checkOut: '2026-08-05',
      guests: 3,
      checkInTime: '10:00',
      checkOutTime: '18:00',
    })
  })
})
