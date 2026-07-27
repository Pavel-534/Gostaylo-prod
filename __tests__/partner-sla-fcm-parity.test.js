/**
 * Wave H5 — Partner SLA FCM parity (templates + deep link payload)
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/partner-sla-fcm-parity.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

describe('partnerBookingsListPath highlight deep link', () => {
  it('includes booking id and highlight=true', async () => {
    const { partnerBookingsListPath } = await import('../lib/email/booking-routes.js')
    assert.equal(
      partnerBookingsListPath('bk-42'),
      '/partner/bookings?booking=bk-42&highlight=true',
    )
  })
})

describe('buildPartnerLifecyclePushData', () => {
  it('builds listing · dates · guest + deepLink fields', async () => {
    const { buildPartnerLifecyclePushData } = await import(
      '../lib/services/push/partner-lifecycle-push.js'
    )
    const data = buildPartnerLifecyclePushData({
      booking: {
        id: 'bk-1',
        check_in: '2026-08-01',
        check_out: '2026-08-05',
        guest_name: 'Alex Guest',
      },
      listing: { title: 'Villa Horizon' },
    })
    assert.equal(data.listing, 'Villa Horizon')
    assert.equal(data.guest, 'Alex Guest')
    assert.equal(data.bookingId, 'bk-1')
    assert.match(data.link, /\/partner\/bookings\?booking=bk-1&highlight=true/)
    assert.equal(data.url, data.link)
    assert.equal(data.deepLink, data.link)
    assert.ok(String(data.dates).includes('—'))
  })
})

describe('partner lifecycle push templates', () => {
  it('renders BOOKING_REQUEST / PAYMENT_COMPLETED / CANCEL_REQUESTED / SLA_EXPIRING_SOON', async () => {
    const {
      buildRenderedPushNotification,
      buildPushDataStrings,
    } = await import('../lib/services/push/push-templates.js')
    const { buildPartnerLifecyclePushData } = await import(
      '../lib/services/push/partner-lifecycle-push.js'
    )

    const base = buildPartnerLifecyclePushData({
      booking: {
        id: 'bk-9',
        check_in: '2026-09-10',
        check_out: '2026-09-12',
        guest_name: 'Mila',
      },
      listing: { title: 'Condo Sea' },
    })

    const cases = [
      {
        key: 'BOOKING_REQUEST',
        titleRu: 'Новый запрос на бронирование',
        titleEn: 'New booking request',
      },
      {
        key: 'PAYMENT_COMPLETED',
        titleRu: 'Срочно: подтвердите заезд',
        titleEn: 'Urgent: confirm check-in',
      },
      {
        key: 'CANCEL_REQUESTED',
        titleRu: 'Запрос на отмену бронирования',
        titleEn: 'Booking cancel requested',
      },
      {
        key: 'SLA_EXPIRING_SOON',
        titleRu: 'SLA под угрозой',
        titleEn: 'SLA at risk',
      },
    ]

    for (const c of cases) {
      const ru = buildRenderedPushNotification(c.key, base, 'ru')
      assert.equal(ru.ok, true, c.key)
      assert.equal(ru.title, c.titleRu)
      assert.match(ru.body, /Condo Sea/)
      assert.match(ru.body, /Mila/)

      const en = buildRenderedPushNotification(c.key, base, 'en')
      assert.equal(en.ok, true)
      assert.equal(en.title, c.titleEn)

      const dataStrings = buildPushDataStrings(c.key, base, false)
      assert.match(dataStrings.link, /\/partner\/bookings\?booking=bk-9&highlight=true/)
      assert.equal(dataStrings.url, dataStrings.link)
      assert.equal(dataStrings.deepLink, dataStrings.link)
    }
  })
})
