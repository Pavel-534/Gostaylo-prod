/**
 * Stage 143.1 — partner workspace polish + ambassador guide visibility.
 */
import { test, expect } from '@playwright/test'
import { E2E_FIXTURE_SECRET, E2E_HEADERS, E2E_ROUTES } from './constants'
import { loginReferralAmbassador, stabilizeVisualPage } from './helpers/referral-dashboard-auth'

test.describe.configure({ mode: 'serial' })

test.describe('@stage1431-onboarding-polish', () => {
  /** @type {{ email: string, password: string } | null} */
  let creds = null

  test.beforeAll(async ({ request, baseURL }) => {
    test.skip(!baseURL, 'baseURL')
    test.skip(!E2E_FIXTURE_SECRET, 'E2E_FIXTURE_SECRET required')

    const res = await request.post(`${baseURL}${E2E_ROUTES.referralDashboardVisualFixture}`, {
      headers: { [E2E_HEADERS.fixtureSecretHeader]: E2E_FIXTURE_SECRET },
      data: {},
    })
    const json = await res.json().catch(() => ({}))
    expect(res.ok(), `${res.status()} ${json?.error || ''}`).toBeTruthy()
    creds = { email: json.data.email, password: json.data.password }
  })

  test('referral link tab shows ambassador first-wave guide', async ({ page, baseURL }) => {
    test.skip(!baseURL || !creds, 'baseURL/creds')

    await stabilizeVisualPage(page)
    await loginReferralAmbassador(page, baseURL, creds)
    await page.goto(`${baseURL}/profile/referral`)
    await page.getByRole('tab', { name: /ссылка|link/i }).click()
    await expect(page.getByTestId('ambassador-first-wave-guide')).toBeVisible({ timeout: 15_000 })
  })

  test('partner bookings access denied shows login CTA', async ({ page, baseURL }) => {
    test.skip(!baseURL, 'baseURL')
    await page.goto(`${baseURL}/partner/bookings`)
    await expect(page.getByTestId('access-denied-login-btn')).toBeVisible({ timeout: 15_000 })
  })
})
