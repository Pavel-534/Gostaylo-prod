import { expect, request as playwrightRequest, type APIRequestContext } from '@playwright/test'
import { E2E_FIXTURE_SECRET, E2E_HEADERS, E2E_ROUTES } from './constants'

type PendingFixtureResponse = {
  success?: boolean
  data?: { bookingId?: string }
}

type PromoteOptions = {
  baseURL: string
  renterApi: APIRequestContext
  renterEmail?: string
}

export async function createPaidEscrowFixtureBooking({
  baseURL,
  renterApi,
  renterEmail,
}: PromoteOptions): Promise<string> {
  const anon = await playwrightRequest.newContext({ baseURL })
  try {
    const res = await anon.post(E2E_ROUTES.paidEscrowBookingFixture, {
      headers: {
        [E2E_HEADERS.fixtureSecretHeader]: E2E_FIXTURE_SECRET,
      },
      data: renterEmail ? { renterEmail } : {},
      failOnStatusCode: false,
    })
    expect(res.ok(), `paid escrow fixture booking -> ${res.status()}`).toBeTruthy()
    const body = (await res.json().catch(() => ({}))) as PendingFixtureResponse
    expect(body?.success).toBeTruthy()
    const bookingId = String(body?.data?.bookingId || '')
    expect(bookingId).toBeTruthy()

    const ownershipProbe = await renterApi.get(`/api/v2/bookings/${bookingId}`, {
      failOnStatusCode: false,
    })
    expect(ownershipProbe.status(), 'fixture renter should own paid escrow booking').toBe(200)

    return bookingId
  } finally {
    await anon.dispose()
  }
}
