import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  mapPartnerBookingDetailResponse,
  fetchPartnerBookingDetailApi,
} from '../lib/partner/partner-booking-detail.js'

describe('mapPartnerBookingDetailResponse', () => {
  it('builds _unified order from API booking row', () => {
    const raw = {
      id: 'booking-abc',
      status: 'PAID_ESCROW',
      guestPayableThb: 12000,
      checkIn: '2026-08-01T00:00:00.000Z',
      checkOut: '2026-08-05T00:00:00.000Z',
      createdAt: '2026-07-01T10:00:00.000Z',
      listing: {
        title: 'Sea view condo',
        category: { slug: 'apartments' },
      },
    }

    const mapped = mapPartnerBookingDetailResponse(raw)
    assert.ok(mapped)
    assert.equal(mapped.id, 'booking-abc')
    assert.equal(mapped._unified.id, 'booking-abc')
    assert.equal(mapped._unified.status, 'PAID_ESCROW')
    assert.equal(mapped._unified.total_price, 12000)
    assert.equal(mapped._unified.currency, 'THB')
    assert.equal(mapped._unified.type, 'home')
    assert.ok(mapped._unified.dates.check_in)
    assert.ok(mapped._unified.dates.check_out)
  })

  it('infers transport type from category slug', () => {
    const mapped = mapPartnerBookingDetailResponse({
      id: 'b2',
      status: 'CONFIRMED',
      listing: { category: { slug: 'vehicle-rental' } },
    })
    assert.equal(mapped._unified.type, 'transport')
  })

  it('returns null for empty payload', () => {
    assert.equal(mapPartnerBookingDetailResponse(null), null)
    assert.equal(mapPartnerBookingDetailResponse(undefined), null)
  })
})

describe('fetchPartnerBookingDetailApi', () => {
  it('maps successful API response', async () => {
    const mockFetch = async () => ({
      ok: true,
      json: async () => ({
        status: 'success',
        data: {
          id: 'bk-99',
          status: 'COMPLETED',
          priceThb: 5000,
          listing: { title: 'Tour', category: { slug: 'tours' } },
        },
      }),
    })

    const booking = await fetchPartnerBookingDetailApi('bk-99', mockFetch)
    assert.equal(booking.id, 'bk-99')
    assert.equal(booking._unified.type, 'activity')
    assert.equal(booking._unified.total_price, 5000)
  })

  it('throws on API error', async () => {
    const mockFetch = async () => ({
      ok: false,
      json: async () => ({ status: 'error', error: 'Booking not found' }),
    })

    await assert.rejects(
      () => fetchPartnerBookingDetailApi('missing', mockFetch),
      /Booking not found/,
    )
  })
})
