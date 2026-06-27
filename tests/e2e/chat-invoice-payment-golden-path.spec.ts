/**
 * Stage 173.1 / 174.1 — Chat invoice payment golden path:
 * contactInquiry (API) → INQUIRY → host invoice (Special Offer) → guest pay → PAID_ESCROW.
 *
 * Requires: E2E_FIXTURE_SECRET, auth setup (partner + renter).
 * Payment completion: internal fixture promote-booking-paid-escrow (no webhook secret).
 */
import path from 'path'
import { test, expect, request as playwrightRequest, type APIRequestContext } from '@playwright/test'
import { E2E_FIXTURE_SECRET, E2E_HEADERS, E2E_ROUTES } from './constants'

const AUTH_PARTNER = path.resolve(process.cwd(), 'playwright/.auth/partner.json')
const AUTH_RENTER = path.resolve(process.cwd(), 'playwright/.auth/user.json')

function addListingDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

async function pickAvailableStayRange(
  api: APIRequestContext,
  baseURL: string,
  listingId: string,
  spanNights = 3,
): Promise<{ checkIn: string; checkOut: string; clientQuotedSubtotalThb: number; clientQuotedGuestTotalThb: number } | null> {
  const calRes = await api.get(`${baseURL}/api/v2/listings/${listingId}/calendar?days=180`, {
    failOnStatusCode: false,
  })
  if (!calRes.ok()) return null
  const calJson = (await calRes.json().catch(() => ({}))) as {
    data?: {
      minStay?: number
      calendar?: Array<{ date?: string; can_check_in?: boolean; remaining_spots?: number }>
    }
  }
  const minStay = Math.max(1, parseInt(String(calJson.data?.minStay ?? 1), 10) || 1)
  const nights = Math.max(spanNights, minStay)
  const rows = calJson.data?.calendar || []
  const calMap = new Map(rows.map((d) => [String(d?.date || ''), d]))
  const candidates = rows.filter(
    (d) =>
      d?.can_check_in &&
      d?.date &&
      (d.remaining_spots ?? 1) >= 1 &&
      (d.blocked_units ?? 0) === 0,
  )
  for (let i = 2; i < candidates.length; i++) {
    const checkIn = String(candidates[i].date)
    const checkOut = addListingDays(checkIn, nights)
    let cursor = checkIn
    let nightsOk = true
    while (cursor < checkOut) {
      const day = calMap.get(cursor)
      if (
        !day ||
        (day.remaining_spots ?? 0) < 1 ||
        (day.blocked_units ?? 0) > 0
      ) {
        nightsOk = false
        break
      }
      cursor = addListingDays(cursor, 1)
    }
    if (!nightsOk) continue
    const availRes = await api.get(
      `${baseURL}/api/v2/listings/${listingId}/calendar?checkIn=${encodeURIComponent(checkIn)}&checkOut=${encodeURIComponent(checkOut)}&guests=1`,
      { failOnStatusCode: false },
    )
    if (!availRes.ok()) continue
    const availJson = (await availRes.json().catch(() => ({}))) as { available?: boolean }
    if (!availJson.available) continue

    const quoteRes = await api.get(
      `${baseURL}/api/v2/listings/${listingId}/booking-quote?checkIn=${encodeURIComponent(checkIn)}&checkOut=${encodeURIComponent(checkOut)}&guestsCount=1&currency=THB`,
      { failOnStatusCode: false },
    )
    if (!quoteRes.ok()) continue
    const quoteJson = (await quoteRes.json().catch(() => ({}))) as {
      success?: boolean
      data?: { clientQuotedSubtotalThb?: number; clientQuotedGuestTotalThb?: number }
    }
    const sub = quoteJson?.data?.clientQuotedSubtotalThb
    const total = quoteJson?.data?.clientQuotedGuestTotalThb
    if (!quoteJson.success || sub == null || total == null) continue

    return {
      checkIn,
      checkOut,
      clientQuotedSubtotalThb: Math.round(Number(sub)),
      clientQuotedGuestTotalThb: Math.round(Number(total)),
    }
  }
  return null
}

async function getPartnerListingId(partnerApi: APIRequestContext, baseURL: string): Promise<string | null> {
  const meRes = await partnerApi.get(`${baseURL}/api/v2/auth/me`, { failOnStatusCode: false })
  if (!meRes.ok()) return null
  const meJson = (await meRes.json().catch(() => ({}))) as { user?: { id?: string } }
  const partnerId = meJson?.user?.id
  if (!partnerId) return null

  const res = await partnerApi.get(
    `${baseURL}/api/v2/partner/listings?partnerId=${encodeURIComponent(String(partnerId))}&limit=10`,
    { failOnStatusCode: false },
  )
  if (!res.ok()) return null
  const json = (await res.json().catch(() => ({}))) as {
    success?: boolean
    data?: Array<{ id?: string; status?: string; categorySlug?: string }>
  }
  const active = (json.data || []).filter(
    (l) => l?.id && String(l.status || '').toUpperCase() === 'ACTIVE',
  )
  const accommodation =
    active.find((l) => {
      const slug = String(l.categorySlug || '').toLowerCase()
      return slug && slug !== 'vehicles' && slug !== 'tours'
    }) || active[0]
  return accommodation?.id ? String(accommodation.id) : null
}

async function promoteBookingPaidEscrow(baseURL: string, bookingId: string) {
  const anon = await playwrightRequest.newContext({ baseURL })
  try {
    return await anon.post(E2E_ROUTES.promoteBookingPaidEscrow, {
      headers: { [E2E_HEADERS.fixtureSecretHeader]: E2E_FIXTURE_SECRET },
      data: { bookingId },
      failOnStatusCode: false,
    })
  } finally {
    await anon.dispose()
  }
}

test.describe('Chat invoice payment golden path (Stage 173.1 / 174.1)', () => {
  test('contactInquiry → host invoice → checkout initiate → fixture → PAID_ESCROW', async ({
    browser,
    baseURL,
  }) => {
    test.setTimeout(300_000)
    test.skip(!baseURL, 'baseURL required')
    test.skip(!E2E_FIXTURE_SECRET, 'E2E_FIXTURE_SECRET required')

    const partnerContext = await browser.newContext({ storageState: AUTH_PARTNER })
    const renterContext = await browser.newContext({ storageState: AUTH_RENTER })
    const partnerApi = partnerContext.request
    const renterApi = renterContext.request

    const listingId = await getPartnerListingId(partnerApi, baseURL!)
    test.skip(!listingId, 'Partner has no ACTIVE listing for E2E')

    const stayRange = await pickAvailableStayRange(renterApi, baseURL!, listingId, 3)
    test.skip(!stayRange, 'No available 3-night window on partner listing')

    const renterPage = await renterContext.newPage()
    await renterPage.setViewportSize({ width: 1280, height: 900 })

    let conversationId = ''
    let bookingId = ''
    let invoiceId = ''

    try {
      const meRes = await renterApi.get(`${baseURL}/api/v2/auth/me`, { failOnStatusCode: false })
      expect(meRes.ok(), 'renter auth/me').toBeTruthy()
      const meJson = (await meRes.json().catch(() => ({}))) as { user?: { id?: string } }
      const renterId = meJson?.user?.id
      expect(renterId).toBeTruthy()

      const bookingRes = await renterApi.post(`${baseURL}/api/v2/bookings`, {
        data: {
          listingId,
          renterId,
          checkIn: stayRange!.checkIn,
          checkOut: stayRange!.checkOut,
          guestsCount: 1,
          contactInquiry: true,
          currency: 'THB',
          specialRequests: '[E2E_TEST_DATA] Stage 173.1 chat invoice golden path',
          clientQuotedSubtotalThb: stayRange!.clientQuotedSubtotalThb,
          clientQuotedGuestTotalThb: stayRange!.clientQuotedGuestTotalThb,
          uiLocale: 'en',
        },
        failOnStatusCode: false,
      })
      const bookingBody = await bookingRes.json().catch(() => ({}))
      expect(
        bookingRes.ok(),
        `POST /api/v2/bookings → ${bookingRes.status()} ${JSON.stringify(bookingBody).slice(0, 400)}`,
      ).toBeTruthy()
      const bookingJson = bookingBody as {
        success?: boolean
        inquiry?: boolean
        booking?: { id?: string; status?: string }
        conversationId?: string
      }
      expect(bookingJson.success).toBeTruthy()
      expect(bookingJson.inquiry).toBeTruthy()
      bookingId = String(bookingJson.booking?.id || '')
      conversationId = String(bookingJson.conversationId || '')
      expect(bookingId).toBeTruthy()
      expect(conversationId).toBeTruthy()

      await renterPage.goto(`${baseURL}/messages/${conversationId}`, { waitUntil: 'domcontentloaded' })
      await expect(renterPage).toHaveURL(new RegExp(`/messages/${conversationId}`), { timeout: 30_000 })

      const invoiceAmount = 12500
      const invoiceRes = await partnerApi.post(`${baseURL}/api/v2/chat/invoice`, {
        data: {
          conversationId,
          bookingId,
          amount: invoiceAmount,
          currency: 'THB',
          paymentMethod: 'CARD',
          description: '[E2E_TEST_DATA] Stage 173.1 chat invoice golden path',
        },
        failOnStatusCode: false,
      })
      const invoiceBody = await invoiceRes.json().catch(() => ({}))
      expect(
        invoiceRes.ok(),
        `POST /api/v2/chat/invoice → ${invoiceRes.status()} ${JSON.stringify(invoiceBody).slice(0, 400)}`,
      ).toBeTruthy()
      const invoiceJson = invoiceBody as {
        success?: boolean
        invoice?: { id?: string }
      }
      expect(invoiceJson.success).toBeTruthy()
      invoiceId = String(invoiceJson.invoice?.id || '')
      expect(invoiceId).toBeTruthy()

      await expect
        .poll(async () => {
          const probe = await renterApi.get(`${baseURL}/api/v2/bookings/${bookingId}`, {
            failOnStatusCode: false,
          })
          if (!probe.ok()) return ''
          const j = (await probe.json().catch(() => ({}))) as { data?: { status?: string } }
          return String(j?.data?.status || '').toUpperCase()
        }, { timeout: 30_000 })
        .toBe('AWAITING_PAYMENT')

      await renterPage.reload({ waitUntil: 'domcontentloaded' })
      const invoicePayBtn = renterPage.getByTestId('invoice-bubble-pay').last()
      await expect(invoicePayBtn).toBeVisible({ timeout: 30_000 })
      await invoicePayBtn.click()

      const payMethodDialog = renterPage
        .getByRole('dialog')
        .filter({ hasText: /payment method|способ оплаты|支付方式|วิธีชำระ/i })
      await expect(payMethodDialog).toBeVisible({ timeout: 15_000 })
      await payMethodDialog
        .getByRole('button')
        .filter({ hasText: /card|карт|银行卡|บัตร/i })
        .first()
        .click()

      await expect(renterPage).toHaveURL(new RegExp(`/checkout/${bookingId}`), { timeout: 30_000 })

      const initiateRes = await renterApi.post(
        `${baseURL}/api/v2/bookings/${bookingId}/payment/initiate`,
        {
          data: { method: 'CARD', invoiceId, acceptedLegalTerms: true },
          failOnStatusCode: false,
        },
      )
      const initiateBody = await initiateRes.json().catch(() => ({}))
      expect(
        initiateRes.ok(),
        `payment/initiate → ${initiateRes.status()} ${JSON.stringify(initiateBody).slice(0, 400)}`,
      ).toBeTruthy()
      const initiateJson = initiateBody as {
        success?: boolean
        data?: { intentId?: string; id?: string; amountThb?: number }
      }
      expect(initiateJson.success).toBeTruthy()

      const promoteRes = await promoteBookingPaidEscrow(baseURL!, bookingId)
      expect(promoteRes.ok(), `promote-booking-paid-escrow → ${promoteRes.status()}`).toBeTruthy()

      await expect
        .poll(async () => {
          const probe = await renterApi.get(`${baseURL}/api/v2/bookings/${bookingId}`, {
            failOnStatusCode: false,
          })
          if (!probe.ok()) return ''
          const j = (await probe.json().catch(() => ({}))) as { data?: { status?: string } }
          return String(j?.data?.status || '').toUpperCase()
        }, { timeout: 60_000 })
        .toBe('PAID_ESCROW')

      await renterPage.goto(`${baseURL}/messages/`, { waitUntil: 'domcontentloaded' })
      await expect
        .poll(async () => {
          const res = await renterApi.get(
            `${baseURL}/api/v2/chat/conversations?enrich=1&limit=50`,
            { failOnStatusCode: false },
          )
          if (!res.ok()) return false
          const j = (await res.json().catch(() => ({}))) as {
            data?: Array<{ id?: string; booking?: { status?: string; id?: string } }>
          }
          const row = (j.data || []).find((c) => String(c.id) === conversationId)
          return (
            String(row?.booking?.id || '') === bookingId &&
            String(row?.booking?.status || '').toUpperCase() === 'PAID_ESCROW'
          )
        }, { timeout: 30_000 })
        .toBeTruthy()
    } finally {
      await renterContext.close()
      await partnerContext.close()
    }
  })
})
