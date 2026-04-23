import path from 'path'
import { expect, request as playwrightRequest, test, type APIRequestContext } from '@playwright/test'
import { E2E_EMAILS, E2E_FIXTURE_SECRET, E2E_HEADERS, E2E_ROUTES } from './constants'
import { createPaidEscrowFixtureBooking } from './paid-escrow-fixture'

type FixtureResponse = {
  success?: boolean
  data?: { bookingId?: string }
}

const AUTH_DIR = path.join(process.cwd(), 'playwright', '.auth')

async function createApiContext(baseURL: string, storageStatePath?: string): Promise<APIRequestContext> {
  return playwrightRequest.newContext({
    baseURL,
    ...(storageStatePath ? { storageState: storageStatePath } : {}),
  })
}

async function createFixtureBooking(baseURL: string, renterEmail?: string): Promise<string> {
  const anon = await createApiContext(baseURL)
  try {
    const res = await anon.post(E2E_ROUTES.pendingChatBookingFixture, {
      headers: {
        [E2E_HEADERS.fixtureSecretHeader]: E2E_FIXTURE_SECRET,
      },
      data: renterEmail ? { renterEmail } : {},
      failOnStatusCode: false,
    })
    expect(res.ok(), `fixture create booking -> ${res.status()}`).toBeTruthy()
    const body = (await res.json().catch(() => ({}))) as FixtureResponse
    expect(body?.success).toBeTruthy()
    const bookingId = String(body?.data?.bookingId || '')
    expect(bookingId).toBeTruthy()
    return bookingId
  } finally {
    await anon.dispose()
  }
}

test.describe('Stage 9.1 API guard security matrix', () => {
  test.describe.configure({ mode: 'serial' })

  let baseURL = ''
  let renterApi: APIRequestContext
  let partnerApi: APIRequestContext
  let adminApi: APIRequestContext
  let anonymousApi: APIRequestContext

  let ownBookingId = ''
  let foreignBookingId = ''
  let paidEscrowBookingId = ''

  test.beforeAll(async ({ baseURL: pwBaseURL }) => {
    test.skip(!pwBaseURL, 'baseURL is required')
    test.skip(!E2E_FIXTURE_SECRET, 'E2E_FIXTURE_SECRET is required for stage9 fixture setup')

    baseURL = String(pwBaseURL)
    renterApi = await createApiContext(baseURL, path.join(AUTH_DIR, 'user.json'))
    partnerApi = await createApiContext(baseURL, path.join(AUTH_DIR, 'partner.json'))
    adminApi = await createApiContext(baseURL, path.join(AUTH_DIR, 'admin.json'))
    anonymousApi = await createApiContext(baseURL)

    ownBookingId = await createFixtureBooking(baseURL)
    foreignBookingId = await createFixtureBooking(baseURL, E2E_EMAILS.admin)
    paidEscrowBookingId = await createPaidEscrowFixtureBooking({
      baseURL,
      renterApi,
    })
  })

  test.afterAll(async () => {
    await Promise.all([
      renterApi?.dispose(),
      partnerApi?.dispose(),
      adminApi?.dispose(),
      anonymousApi?.dispose(),
    ])
  })

  test('GET /api/v2/bookings -> 401/403/200', async () => {
    const noSession = await anonymousApi.get('/api/v2/bookings', { failOnStatusCode: false })
    expect(noSession.status()).toBe(401)

    const forbidden = await renterApi.get('/api/v2/bookings?partnerId=00000000-0000-0000-0000-000000000001', {
      failOnStatusCode: false,
    })
    expect(forbidden.status()).toBe(403)

    const success = await renterApi.get('/api/v2/bookings', { failOnStatusCode: false })
    expect(success.status()).toBe(200)
  })

  test('GET /api/v2/bookings/[id] -> 401/403/200', async () => {
    const noSession = await anonymousApi.get(`/api/v2/bookings/${ownBookingId}`, { failOnStatusCode: false })
    expect(noSession.status()).toBe(401)

    const forbidden = await renterApi.get(`/api/v2/bookings/${foreignBookingId}`, { failOnStatusCode: false })
    expect(forbidden.status()).toBe(403)

    const success = await renterApi.get(`/api/v2/bookings/${ownBookingId}`, { failOnStatusCode: false })
    expect(success.status()).toBe(200)
  })

  test('PUT /api/v2/bookings/[id] -> 401/403/200', async () => {
    const payload = { status: 'CONFIRMED', reason: 'stage9-guard-test' }

    const noSession = await anonymousApi.put(`/api/v2/bookings/${ownBookingId}`, {
      data: payload,
      failOnStatusCode: false,
    })
    expect(noSession.status()).toBe(401)

    const forbidden = await partnerApi.put(`/api/v2/bookings/${ownBookingId}`, {
      data: payload,
      failOnStatusCode: false,
    })
    expect(forbidden.status()).toBe(403)

    const success = await adminApi.put(`/api/v2/bookings/${ownBookingId}`, {
      data: payload,
      failOnStatusCode: false,
    })
    expect(success.status()).toBe(200)
  })

  test('POST /api/v2/bookings/[id]/check-in/confirm -> 401/403/200', async () => {
    const noSession = await anonymousApi.post(`/api/v2/bookings/${paidEscrowBookingId}/check-in/confirm`, {
      failOnStatusCode: false,
    })
    expect(noSession.status()).toBe(401)

    const forbidden = await renterApi.post(`/api/v2/bookings/${foreignBookingId}/check-in/confirm`, {
      failOnStatusCode: false,
    })
    expect(forbidden.status()).toBe(403)

    const success = await renterApi.post(`/api/v2/bookings/${paidEscrowBookingId}/check-in/confirm`, {
      failOnStatusCode: false,
    })
    expect(success.status()).toBe(200)
  })

  test('POST /api/v2/payments/verify-tron -> 401/403/200', async () => {
    const payload = {
      txid: 'stage9_guard_fake_txid',
      bookingId: ownBookingId,
    }

    const noSession = await anonymousApi.post('/api/v2/payments/verify-tron', {
      data: payload,
      failOnStatusCode: false,
    })
    expect(noSession.status()).toBe(401)

    const forbidden = await partnerApi.post('/api/v2/payments/verify-tron', {
      data: payload,
      failOnStatusCode: false,
    })
    expect(forbidden.status()).toBe(403)

    const success = await renterApi.post('/api/v2/payments/verify-tron', {
      data: payload,
      failOnStatusCode: false,
    })
    expect(success.status()).toBe(200)
  })
})
