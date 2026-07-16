import { expect, test } from '@playwright/test'

function jsonResponse(body: unknown, status = 200) {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  }
}

function buildBooking(bookingId: string) {
  return {
    id: bookingId,
    renter_id: null,
    listing_id: 'lst-mock-1',
    status: 'CONFIRMED',
    check_in: '2026-06-01',
    check_out: '2026-06-03',
    price_thb: 5000,
    currency: 'THB',
    commission_rate: 0.05,
    commission_thb: 250,
    rounding_diff_pot: 0,
    taxable_margin_amount: 0,
    pricing_snapshot: {
      fee_split_v2: {
        tax_rate_percent: 0,
      },
    },
    listings: {
      id: 'lst-mock-1',
      title: 'Mock Listing Checkout',
      district: 'Bangkok',
      images: [],
      cover_image: null,
      category_slug: 'property',
      metadata: {},
      base_price_thb: 5000,
    },
    conversation_id: 'conv-mock-1',
  }
}

test.describe('Checkout mock smoke (CARD + CRYPTO)', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/v2/bookings/**/payment-intent**', async (route) => {
      await route.fulfill(
        jsonResponse({
          success: true,
          data: {
            id: 'pi_mock_1',
            allowedMethods: ['CARD', 'CRYPTO'],
          },
        }),
      )
    })

    await page.route('**/api/v2/bookings/**/payment/initiate', async (route) => {
      const req = route.request()
      const body = req.postDataJSON?.() || {}
      const method = String(body?.method || 'CARD').toUpperCase()
      if (method === 'CRYPTO') {
        await route.fulfill(
          jsonResponse({
            success: true,
            data: {
              id: 'pay_crypto_1',
              method: 'CRYPTO',
              metadata: { amount: 150.25 },
            },
          }),
        )
        return
      }
      await route.fulfill(
        jsonResponse({
          success: true,
          data: {
            id: 'pay_card_1',
            method: 'CARD',
            checkoutUrl: '',
          },
        }),
      )
    })

    // E2E UI mock only (127.1) — not a DB UPDATE; real capture uses EscrowService.moveToEscrow
    await page.route('**/api/v2/bookings/**/payment/confirm', async (route) => {
      await route.fulfill(
        jsonResponse({
          success: true,
          data: { status: 'PAID_ESCROW' },
        }),
      )
    })

    await page.route('**/api/v2/payments/verify-tron', async (route) => {
      await route.fulfill(
        jsonResponse({
          success: true,
          status: 'CONFIRMED',
          paymentSettled: { success: true },
          badge: { label: 'Confirmed', labelRu: 'Подтверждено' },
          data: {
            from: 'TMockFromWallet',
            to: 'TMockToWallet',
            amount: 150.25,
            token: 'USDT',
            isCorrectWallet: true,
          },
        }),
      )
    })

    await page.route('**/api/v2/payments/submit-txid', async (route) => {
      await route.fulfill(jsonResponse({ success: true }))
    })

    await page.route('**/api/v2/wallet/me**', async (route) => {
      await route.fulfill(
        jsonResponse({
          success: true,
          data: {
            balances: { internalCreditsThb: 800 },
            policy: { walletMaxDiscountPercent: 30 },
          },
        }),
      )
    })

    await page.route('**/api/v2/exchange-rates**', async (route) => {
      await route.fulfill(
        jsonResponse({
          success: true,
          rateMap: { THB: 1, USD: 35, USDT: 35 },
        }),
      )
    })

    await page.route('**/api/v2/commission**', async (route) => {
      await route.fulfill(
        jsonResponse({
          success: true,
          data: {
            guestServiceFeePercent: 5,
            hostCommissionPercent: 15,
            insuranceFundPercent: 0,
            taxRatePercent: 0,
          },
        }),
      )
    })

    await page.route('**/api/v2/chat/conversations**', async (route) => {
      await route.fulfill(jsonResponse({ success: true, data: [{ id: 'conv-mock-1' }] }))
    })

    await page.route('**/api/v2/bookings/**', async (route) => {
      const url = route.request().url()
      const parts = url.split('/api/v2/bookings/')
      const bookingId = parts[1]?.split('?')[0] || 'b-mock'
      await route.fulfill(
        jsonResponse({
          success: true,
          data: buildBooking(bookingId),
        }),
      )
    })
  })

  async function acceptCheckoutLegalIfNeeded(page: import('@playwright/test').Page) {
    const consent = page.locator('#checkout-legal-consent')
    if (await consent.isVisible().catch(() => false)) {
      // Radix Checkbox — click, not input.check()
      await consent.click()
    }
  }

  test('CARD flow reaches success screen', async ({ page }) => {
    await page.goto('/checkout/b-mock-card', { waitUntil: 'domcontentloaded' })

    await expect(page.getByTestId('checkout-pay-submit')).toBeVisible({ timeout: 30_000 })
    await acceptCheckoutLegalIfNeeded(page)
    await expect(page.getByTestId('checkout-pay-submit')).toBeEnabled({ timeout: 10_000 })
    await page.getByTestId('checkout-pay-submit').click()

    await expect(page.getByRole('link', { name: /my bookings|мои бронирования/i })).toBeVisible({
      timeout: 15000,
    })
  })

  test('CRYPTO flow verifies txid and reaches success screen', async ({ page }) => {
    await page.goto('/checkout/b-mock-crypto', { waitUntil: 'domcontentloaded' })

    await expect(page.getByTestId('checkout-pay-submit')).toBeVisible({ timeout: 30_000 })
    await page.locator('[role="radio"][value="CRYPTO"]').click()
    await acceptCheckoutLegalIfNeeded(page)
    await expect(page.getByTestId('checkout-pay-submit')).toBeEnabled({ timeout: 10_000 })
    await page.getByTestId('checkout-pay-submit').click()

    await expect(page.getByTestId('txid-input')).toBeVisible()
    const txid = 'a'.repeat(64)
    await page.getByTestId('txid-input').fill(txid)
    await page.getByTestId('verify-txid-btn').click()

    await expect(page.getByRole('link', { name: /my bookings|мои бронирования/i })).toBeVisible({
      timeout: 15000,
    })
  })
})
