/**
 * Stage 155.6 / v12.156.0 — Guest golden path: PDP inquiry → next steps → my-bookings → PAID_ESCROW.
 *
 * Requires: E2E_FIXTURE_SECRET, auth setup (partner + renter), partner ACTIVE listing.
 * Resend: dev server should run with E2E_TEST_RUN=1 (playwright webServer env) or RESEND_MOCK=1.
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
    data?: Array<{ id?: string; status?: string }>
  }
  const row = (json.data || []).find((l) => l?.id && String(l.status || '').toUpperCase() === 'ACTIVE')
  return row?.id ? String(row.id) : null
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

    const listingId = await getPartnerListingId(partnerApi, baseURL!)
    test.skip(!listingId, 'Partner has no ACTIVE listing for E2E')

    const renterPage = await renterContext.newPage()
    await renterPage.setViewportSize({ width: 1280, height: 900 })

    try {
      const calResponsePromise = renterPage.waitForResponse(
        (r) =>
          r.url().includes(`/api/v2/listings/${listingId}/calendar`) &&
          r.request().method() === 'GET' &&
          r.ok(),
        { timeout: 120_000 },
      )

      await renterPage.goto(`${baseURL}/listings/${listingId}`, { waitUntil: 'domcontentloaded' })
      await calResponsePromise

      const desktopBookingCard = renterPage.locator('div.hidden.lg\\:block.sticky.top-24')
      const calendarTrigger = desktopBookingCard.getByTestId('platform-calendar-trigger')
      await expect(calendarTrigger).toBeVisible({ timeout: 30_000 })
      await calendarTrigger.click()

      const datePickerDialog = renterPage.getByRole('dialog')
      await expect(datePickerDialog).toBeVisible({ timeout: 20_000 })
      const firstDay = datePickerDialog.locator('button[data-clickable="true"]').first()
      await expect(firstDay).toBeVisible({ timeout: 25_000 })
      const startIso = await firstDay.getAttribute('data-date')
      expect(startIso).toBeTruthy()
      await firstDay.click()
      const endIso = addListingDays(String(startIso), 3)
      const checkoutBtn = datePickerDialog.locator(`button[data-date="${endIso}"]`)
      await expect(checkoutBtn).toBeVisible({ timeout: 15_000 })
      await checkoutBtn.click()

      const specialBtn = desktopBookingCard.getByRole('button', {
        name: /особую цену|special price|запросить особую/i,
      })
      const privateBtn = desktopBookingCard.getByRole('button', {
        name: /приватн|private trip|индивидуал/i,
      })

      if (await specialBtn.isVisible().catch(() => false)) {
        await specialBtn.click()
      } else if (await privateBtn.isVisible().catch(() => false)) {
        await privateBtn.click()
      } else {
        await desktopBookingCard.getByRole('button', { name: /забронировать|book|бронь/i }).first().click()
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
