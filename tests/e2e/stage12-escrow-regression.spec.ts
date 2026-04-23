import path from 'path'
import { expect, request as playwrightRequest, test, type APIRequestContext } from '@playwright/test'
import { E2E_FIXTURE_SECRET, E2E_HEADERS, E2E_ROUTES } from './constants'

const AUTH_DIR = path.join(process.cwd(), 'playwright', '.auth')

type PendingFixtureResponse = {
  success?: boolean
  data?: { bookingId?: string }
}

async function createPendingBooking(baseURL: string): Promise<string> {
  const anon = await playwrightRequest.newContext({ baseURL })
  try {
    const res = await anon.post(E2E_ROUTES.pendingChatBookingFixture, {
      headers: {
        [E2E_HEADERS.fixtureSecretHeader]: E2E_FIXTURE_SECRET,
      },
      failOnStatusCode: false,
    })
    expect(res.ok(), `pending fixture booking -> ${res.status()}`).toBeTruthy()
    const body = (await res.json().catch(() => ({}))) as PendingFixtureResponse
    expect(body?.success).toBeTruthy()
    const bookingId = String(body?.data?.bookingId || '')
    expect(bookingId).toBeTruthy()
    return bookingId
  } finally {
    await anon.dispose()
  }
}

test.describe('Stage 12.0 escrow regression', () => {
  test('booking creation -> escrow move -> payment confirm is stable', async ({ baseURL }) => {
    test.skip(!baseURL, 'baseURL is required')
    test.skip(!E2E_FIXTURE_SECRET, 'E2E_FIXTURE_SECRET is required')

    const adminApi = await playwrightRequest.newContext({
      baseURL,
      storageState: path.join(AUTH_DIR, 'admin.json'),
    })
    const renterApi = await playwrightRequest.newContext({
      baseURL,
      storageState: path.join(AUTH_DIR, 'user.json'),
    })

    try {
      const bookingId = await createPendingBooking(String(baseURL))

      const before = await renterApi.get(`/api/v2/bookings/${bookingId}`, { failOnStatusCode: false })
      expect(before.status()).toBe(200)
      const beforeJson = (await before.json().catch(() => ({}))) as {
        data?: { status?: string }
      }
      expect(String(beforeJson?.data?.status || '').toUpperCase()).toBe('PENDING')

      const confirmByAdmin = await adminApi.put(`/api/v2/bookings/${bookingId}`, {
        data: { status: 'CONFIRMED', reason: 'stage12-escrow-regression' },
        failOnStatusCode: false,
      })
      expect(confirmByAdmin.status(), 'PENDING -> CONFIRMED').toBe(200)

      const pay = await renterApi.post(`/api/v2/bookings/${bookingId}/payment/confirm`, {
        data: {
          txId: `stage12-${Date.now()}`,
          gatewayRef: 'stage12-regression',
        },
        failOnStatusCode: false,
      })
      expect(pay.status(), 'CONFIRMED -> PAID_ESCROW').toBe(200)

      const payJson = (await pay.json().catch(() => ({}))) as {
        success?: boolean
        data?: { status?: string }
      }
      expect(payJson?.success).toBeTruthy()
      expect(String(payJson?.data?.status || '').toUpperCase()).toBe('PAID_ESCROW')

      const after = await renterApi.get(`/api/v2/bookings/${bookingId}`, { failOnStatusCode: false })
      expect(after.status()).toBe(200)
      const afterJson = (await after.json().catch(() => ({}))) as {
        data?: { status?: string }
      }
      expect(String(afterJson?.data?.status || '').toUpperCase()).toBe('PAID_ESCROW')
    } finally {
      await Promise.all([adminApi.dispose(), renterApi.dispose()])
    }
  })
})
