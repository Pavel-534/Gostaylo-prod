/**
 * Stage 155.6 / v12.156.0 — Guest golden path: PDP inquiry → next steps → my-bookings → PAID_ESCROW.
 *
 * Requires: E2E_FIXTURE_SECRET, auth setup (partner + renter), partner ACTIVE listing.
 * Resend: dev server should run with E2E_TEST_RUN=1 (playwright webServer env) or RESEND_MOCK=1.
 */
import path from 'path'
import { test, expect, request as playwrightRequest, type APIRequestContext } from '@playwright/test'
import { E2E_FIXTURE_SECRET, E2E_HEADERS, E2E_ROUTES } from './constants'
import { pickDatesOnDesktopBookingCard } from './helpers/platform-calendar-picker'
import { findFirstValidCalendarSpan } from './helpers/vehicle-calendar-range'

const AUTH_PARTNER = path.resolve(process.cwd(), 'playwright/.auth/partner.json')
const AUTH_RENTER = path.resolve(process.cwd(), 'playwright/.auth/user.json')

async function getPartnerInquiryListingId(
  partnerApi: APIRequestContext,
  baseURL: string,
): Promise<string | null> {
  const meRes = await partnerApi.get(`${baseURL}/api/v2/auth/me`, { failOnStatusCode: false })
  if (!meRes.ok()) return null
  const meJson = (await meRes.json().catch(() => ({}))) as { user?: { id?: string } }
  const partnerId = meJson?.user?.id
  if (!partnerId) return null

  const res = await partnerApi.get(
    `${baseURL}/api/v2/partner/listings?partnerId=${encodeURIComponent(String(partnerId))}&limit=40`,
    { failOnStatusCode: false },
  )
  if (!res.ok()) return null
  const json = (await res.json().catch(() => ({}))) as {
    success?: boolean
    data?: Array<{
      id?: string
      status?: string
      title?: string
      instantBooking?: boolean
      instant_booking?: boolean
      category?: { slug?: string }
      categorySlug?: string
      maxCapacity?: number
      max_capacity?: number
    }>
  }
  const active = (json.data || []).filter((l) => l?.id && String(l.status || '').toUpperCase() === 'ACTIVE')
  if (!active.length) return null

  // Stage 171.41 — golden path requires shared tours listing (special/private CTAs)
  const isTours = (l: (typeof active)[number]) => {
    const slug = String(l.categorySlug || l.category?.slug || '').toLowerCase()
    return slug === 'tours' || slug.includes('tour')
  }
  const tourSeed =
    active.find((l) => /E2E_SEED_TOUR/i.test(String(l.title || ''))) ||
    active.find((l) => isTours(l) && !(l.instantBooking === true || l.instant_booking === true)) ||
    active.find((l) => isTours(l))
  return tourSeed?.id ? String(tourSeed.id) : null
}

async function promoteBookingPaidEscrow(baseURL: string, bookingId: string) {
  const anon = await playwrightRequest.newContext({ baseURL })
  try {
    const res = await anon.post(E2E_ROUTES.promoteBookingPaidEscrow, {
      headers: { [E2E_HEADERS.fixtureSecretHeader]: E2E_FIXTURE_SECRET },
      data: { bookingId },
      failOnStatusCode: false,
    })
    return res
  } finally {
    await anon.dispose()
  }
}

test.describe('Guest inquiry golden path (Wave 1E)', () => {
  test('PDP inquiry → next steps → my-bookings → confirm → PAID_ESCROW', async ({ browser, baseURL }) => {
    test.setTimeout(240_000)
    test.skip(!baseURL, 'baseURL required')
    test.skip(!E2E_FIXTURE_SECRET, 'E2E_FIXTURE_SECRET required')

    const partnerContext = await browser.newContext({ storageState: AUTH_PARTNER })
    const renterContext = await browser.newContext({ storageState: AUTH_RENTER })
    const partnerApi = partnerContext.request
    const renterApi = renterContext.request

    const listingId = await getPartnerInquiryListingId(partnerApi, baseURL!)
    test.skip(!listingId, 'Partner has no ACTIVE tours listing for E2E (seed-e2e-tour)')

    const renterPage = await renterContext.newPage()
    await renterPage.setViewportSize({ width: 1280, height: 900 })

    try {
      const calProbe = await renterPage.request.get(
        `${baseURL}/api/v2/listings/${listingId}/calendar?days=180`,
      )
      expect(calProbe.ok(), `calendar probe ${calProbe.status()}`).toBeTruthy()

      await renterPage.goto(`${baseURL}/listings/${listingId}`, { waitUntil: 'domcontentloaded' })
      await expect(
        renterPage.locator('div.hidden.lg\\:block.sticky.top-24').getByTestId('platform-calendar-trigger'),
      ).toBeVisible({ timeout: 45_000 })
      const calJson = (await calProbe.json().catch(() => ({}))) as {
        data?: { calendar?: Array<{ date?: string; can_check_in?: boolean; status?: string; is_transition?: boolean }> }
      }
      const span = findFirstValidCalendarSpan(calJson?.data?.calendar, 3)
      test.skip(!span, 'No valid 3-day calendar window for partner listing')

      const { desktopBookingCard } = await pickDatesOnDesktopBookingCard(renterPage, 3, {
        closeAfter: false,
        listingId: listingId!,
        knownStartIso: span.startIso,
        knownEndIso: span.endIso,
      })

      await renterPage.evaluate(() => {
        for (const key of Object.keys(localStorage)) {
          if (key.startsWith('guest_next_steps_dismissed_')) localStorage.removeItem(key)
        }
      })

      const specialBtn = desktopBookingCard.getByRole('button', {
        name: /особую цену|special price|запросить особую/i,
      })
      const privateBtn = desktopBookingCard.getByRole('button', {
        name: /приватн|private trip|индивидуал/i,
      })
      // Prefer special/private (stay on PDP + next-steps). Avoid contact CTA — it navigates to /messages.
      const hasSpecial = await specialBtn.isVisible().catch(() => false)
      const hasPrivate = await privateBtn.isVisible().catch(() => false)
      test.skip(!hasSpecial && !hasPrivate, 'Tours listing missing shared inquiry CTAs (special/private)')

      if (hasSpecial) {
        await specialBtn.click()
      } else {
        await privateBtn.click()
      }

      const bookingPost = renterPage.waitForResponse(
        (r) => r.url().includes('/api/v2/bookings') && r.request().method() === 'POST',
        { timeout: 90_000 },
      )

      const confirmModal = renterPage.getByTestId('booking-modal-confirm')
      if (await confirmModal.isVisible({ timeout: 8_000 }).catch(() => false)) {
        await confirmModal.click()
      } else {
        await renterPage
          .getByRole('button', { name: /отправить|submit|подтверд/i })
          .last()
          .click()
      }

      const bookingRes = await bookingPost
      expect(bookingRes.ok(), `POST /api/v2/bookings → ${bookingRes.status()}`).toBeTruthy()
      const bookingJson = (await bookingRes.json().catch(() => ({}))) as {
        success?: boolean
        inquiry?: boolean
        booking?: { id?: string; status?: string }
      }
      expect(bookingJson.success).toBeTruthy()
      if (!bookingJson.inquiry) {
        test.skip(true, 'Partner ACTIVE listing is instant-book (vehicles/exclusive) — seed shared/inquiry listing for golden path')
      }
      const bookingId = String(bookingJson.booking?.id || '')
      expect(bookingId).toBeTruthy()

      await expect(renterPage).toHaveURL(new RegExp(`/listings/${listingId}`), { timeout: 15_000 })
      await expect(renterPage.getByTestId('guest-booking-next-steps')).toBeVisible({ timeout: 20_000 })

      await renterPage.goto(`${baseURL}/my-bookings`, { waitUntil: 'domcontentloaded' })
      const card = renterPage.locator(`[data-booking-card="${bookingId}"]`)
      await expect(card).toBeVisible({ timeout: 30_000 })
      const cardText = (await card.textContent()) || ''
      expect(cardText.toUpperCase()).toMatch(/INQUIRY|PENDING|ЗАПРОС|ОЖИДА/i)

      const confirmRes = await partnerApi.put(`${baseURL}/api/v2/partner/bookings/${bookingId}`, {
        data: { status: 'CONFIRMED' },
        failOnStatusCode: false,
      })
      expect(confirmRes.ok(), `partner confirm → ${confirmRes.status()}`).toBeTruthy()

      const promoteRes = await promoteBookingPaidEscrow(baseURL!, bookingId)
      expect(promoteRes.ok(), `promote PAID_ESCROW → ${promoteRes.status()}`).toBeTruthy()

      await expect
        .poll(async () => {
          const probe = await renterApi.get(`${baseURL}/api/v2/bookings/${bookingId}`, {
            failOnStatusCode: false,
          })
          if (!probe.ok()) return ''
          const j = (await probe.json().catch(() => ({}))) as { data?: { status?: string } }
          return String(j?.data?.status || '').toUpperCase()
        }, { timeout: 45_000 })
        .toBe('PAID_ESCROW')

      await renterPage.goto(`${baseURL}/my-bookings?booking=${encodeURIComponent(bookingId)}`, {
        waitUntil: 'domcontentloaded',
      })
      await expect(renterPage.locator(`[data-booking-card="${bookingId}"]`)).toBeVisible({ timeout: 20_000 })
    } finally {
      await renterContext.close()
      await partnerContext.close()
    }
  })
})
