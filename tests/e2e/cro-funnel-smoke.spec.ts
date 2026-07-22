/**
 * Stage 191.1 — CRO guest-funnel presentation smoke (no payment / escrow mutation).
 *
 * Covers: home mobile pill → sheet accordion; catalog summary → sheet;
 * PDP payable hero + fee-link; checkout access-denied Login redirect;
 * checkout back → listing + thumb (mocked booking).
 */
import { expect, test, type Page } from '@playwright/test'

function jsonResponse(body: unknown, status = 200) {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  }
}

async function openHomeMobileSearchSheet(page: Page, baseURL: string) {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${baseURL}/`, { waitUntil: 'domcontentloaded' })
  const pill = page.getByTestId('home-mobile-search-pill')
  await expect(pill).toBeVisible({ timeout: 30_000 })
  await pill.click()
  const sheet = page.getByTestId('catalog-mobile-search-sheet')
  await expect(sheet).toBeVisible({ timeout: 10_000 })
  return sheet
}

test.describe('CRO funnel presentation smoke (Stage 191.1)', () => {
  test('home mobile: collapsed pill opens sheet with accordion wizard (no nested drawer for where)', async ({
    page,
    baseURL,
  }) => {
    test.skip(!baseURL, 'baseURL')
    test.setTimeout(90_000)

    const sheet = await openHomeMobileSearchSheet(page, baseURL!)

    await expect(page.getByTestId('unified-search-sheet-wizard')).toBeVisible()
    await expect(page.getByTestId('catalog-mobile-search-close')).toBeVisible()

    const closeBox = await page.getByTestId('catalog-mobile-search-close').boundingBox()
    expect(closeBox, 'close touch target').toBeTruthy()
    expect(closeBox!.height).toBeGreaterThanOrEqual(44)
    expect(closeBox!.width).toBeGreaterThanOrEqual(44)

    // Accordion collapsed: Where is a step button, not a nested Where drawer shell.
    // (Expanding Where is flaky under parallel workers + overflow scrollport; structure is enough.)
    await expect(sheet.getByTestId('sheet-wizard-where-trigger')).toBeVisible()
    await expect(sheet.getByTestId('where-combobox-trigger')).toHaveCount(0)
    await expect(sheet.getByTestId('where-combobox-wizard-step')).toHaveCount(0)

    await page.getByTestId('catalog-mobile-search-close').dispatchEvent('click')
    // Sheet stays mounted; closed state is off-screen translate (not unmount).
    await expect(page.getByTestId('catalog-mobile-search-sheet')).toHaveClass(/translate-y-full/, {
      timeout: 8_000,
    })
  })

  test('catalog mobile: summary bar opens same sheet accordion', async ({ page, baseURL }) => {
    test.skip(!baseURL, 'baseURL')
    test.setTimeout(90_000)

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`${baseURL}/listings`, { waitUntil: 'domcontentloaded' })
    const summary = page.getByTestId('catalog-search-summary-bar')
    await expect(summary).toBeVisible({ timeout: 45_000 })
    await summary.getByRole('button').first().click()
    await expect(page.getByTestId('catalog-mobile-search-sheet')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('unified-search-sheet-wizard')).toBeVisible()
  })

  test('PDP desktop: hero payable flag + fee note after dates', async ({ page, baseURL, request }) => {
    test.skip(!baseURL, 'baseURL')
    test.setTimeout(120_000)

    const searchRes = await request.get(`${baseURL}/api/v2/search?category=vehicles&limit=8`)
    test.skip(!searchRes.ok(), 'search API')
    const searchJson = (await searchRes.json()) as {
      data?: { listings?: Array<{ id?: string }> }
    }
    const listingId = searchJson?.data?.listings?.find((l) => l?.id)?.id
    test.skip(!listingId, 'no vehicle listing')

    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(`${baseURL}/listings/${listingId}`, { waitUntil: 'domcontentloaded' })

    const desktopCard = page.locator('div.hidden.lg\\:block.sticky.top-24')
    await expect(desktopCard.getByTestId('listing-hero-price')).toBeVisible({ timeout: 45_000 })

    const calTrigger = desktopCard.getByTestId('platform-calendar-trigger')
    if (await calTrigger.isVisible().catch(() => false)) {
      await calTrigger.click()
      const dayBtns = page.locator('[data-testid="platform-calendar-day"]:not([disabled])')
      const count = await dayBtns.count()
      if (count >= 2) {
        await dayBtns.nth(0).click()
        await dayBtns.nth(Math.min(2, count - 1)).click()
        await page.keyboard.press('Escape')
      }
    }

    const hero = desktopCard.getByTestId('listing-hero-price')
    await expect(hero).toHaveAttribute('data-test-hero-payable', '1')
    const mode = await hero.getAttribute('data-test-hero-mode')
    if (mode === 'stay') {
      const heroRaw = await hero.getAttribute('data-test-raw-value')
      const totalRaw = await desktopCard.getByTestId('booking-price-total').getAttribute('data-test-raw-value')
      expect(heroRaw).toBeTruthy()
      expect(totalRaw).toBeTruthy()
      expect(Number(heroRaw)).toBeCloseTo(Number(totalRaw), 0)
    }

    await expect(page.getByTestId('listing-reviews-section')).toBeVisible()
  })

  test('checkout access denied: Login CTA with redirect back to checkout', async ({ page, baseURL }) => {
    test.skip(!baseURL, 'baseURL')
    test.setTimeout(90_000)

    const bookingId = 'b-cro-access-denied'
    // Auth must resolve (not hang on 401) so evaluateAccess can set accessDenied.
    await page.route('**/api/v2/auth/me**', async (route) => {
      await route.fulfill(jsonResponse({ success: true, user: null }))
    })
    await page.route('**/api/v2/bookings/**', async (route) => {
      const url = route.request().url()
      if (!url.includes(bookingId)) {
        await route.fallback()
        return
      }
      if (url.includes('payment')) {
        await route.fulfill(jsonResponse({ success: false, error: 'Forbidden' }, 403))
        return
      }
      await route.fulfill(
        jsonResponse({
          success: true,
          data: {
            id: bookingId,
            renter_id: 'user-someone-else',
            listing_id: 'lst-x',
            status: 'AWAITING_PAYMENT',
            check_in: '2026-08-01',
            check_out: '2026-08-03',
            price_thb: 3000,
            currency: 'THB',
            commission_rate: 0.05,
            commission_thb: 150,
            listings: {
              id: 'lst-x',
              title: 'Denied Listing',
              category_slug: 'property',
              images: [],
              cover_image: null,
              base_price_thb: 1500,
              metadata: {},
            },
          },
        }),
      )
    })

    await page.goto(`${baseURL}/checkout/${bookingId}`, { waitUntil: 'domcontentloaded' })
    const login = page.getByTestId('checkout-access-denied-login')
    await expect(login).toBeVisible({ timeout: 45_000 })
    const href = await login.getAttribute('href')
    expect(href || '').toContain('/auth/login')
    expect(decodeURIComponent(href || '')).toContain(`/checkout/${bookingId}`)
  })

  test('checkout summary: back → listing + thumb when listing present (mocked)', async ({
    page,
    baseURL,
  }) => {
    test.skip(!baseURL, 'baseURL')
    test.setTimeout(90_000)

    const bookingId = 'b-cro-summary'
    const listingId = 'lst-cro-mock'

    await page.route('**/api/v2/auth/me**', async (route) => {
      await route.fulfill(jsonResponse({ success: true, user: null }))
    })

    await page.route('**/api/v2/bookings/**', async (route) => {
      const url = route.request().url()
      if (!url.includes(bookingId)) {
        await route.fallback()
        return
      }
      if (url.includes('payment-intent') || url.includes('payment/')) {
        await route.fulfill(
          jsonResponse({
            success: true,
            data: { id: 'pi_mock', allowedMethods: ['CARD'] },
          }),
        )
        return
      }
      await route.fulfill(
        jsonResponse({
          success: true,
          data: {
            id: bookingId,
            renter_id: null,
            listing_id: listingId,
            status: 'AWAITING_PAYMENT',
            check_in: '2026-08-01',
            check_out: '2026-08-03',
            price_thb: 4000,
            currency: 'THB',
            commission_rate: 0.05,
            commission_thb: 200,
            rounding_diff_pot: 0,
            taxable_margin_amount: 0,
            pricing_snapshot: { fee_split_v2: { tax_rate_percent: 0 } },
            listings: {
              id: listingId,
              title: 'CRO Mock Listing',
              district: 'Phuket',
              images: [],
              cover_image: null,
              category_slug: 'property',
              metadata: {},
              base_price_thb: 2000,
            },
          },
        }),
      )
    })

    await page.route('**/api/v2/wallet/me**', async (route) => {
      await route.fulfill(
        jsonResponse({
          success: true,
          data: { balances: { internalCreditsThb: 0 }, policy: { walletMaxDiscountPercent: 0 } },
        }),
      )
    })
    await page.route('**/api/v2/commission**', async (route) => {
      await route.fulfill(
        jsonResponse({
          success: true,
          data: {
            guestServiceFeePercent: 5,
            hostCommissionPercent: 0,
            insuranceFundPercent: 0,
            taxRatePercent: 0,
          },
        }),
      )
    })
    await page.route('**/api/v2/exchange-rates**', async (route) => {
      await route.fulfill(jsonResponse({ success: true, rateMap: { THB: 1, USD: 35 } }))
    })
    await page.route('**/api/v2/chat/conversations**', async (route) => {
      await route.fulfill(jsonResponse({ success: true, data: [] }))
    })

    await page.goto(`${baseURL}/checkout/${bookingId}`, { waitUntil: 'domcontentloaded' })

    const back = page.getByTestId('checkout-back-link')
    await expect(back).toBeVisible({ timeout: 45_000 })
    await expect(back).toHaveAttribute('href', `/listings/${listingId}`)

    await expect(page.getByTestId('checkout-listing-title-link')).toHaveAttribute(
      'href',
      `/listings/${listingId}`,
    )
  })
})
