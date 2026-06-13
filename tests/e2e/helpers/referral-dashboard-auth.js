/**
 * Stage 133 — login helper for referral dashboard visual E2E.
 */
import { expect } from '@playwright/test'
import { E2E_ROUTES } from '../constants'

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} baseURL
 * @param {{ email: string, password: string }} creds
 */
export async function loginReferralAmbassador(page, baseURL, creds) {
  const loginRes = await page.request.post(`${baseURL}${E2E_ROUTES.authLogin}`, {
    data: {
      email: String(creds.email || '').toLowerCase().trim(),
      password: creds.password,
    },
  })
  const loginJson = await loginRes.json().catch(() => ({}))
  expect(loginRes.ok(), `login → HTTP ${loginRes.status()} ${JSON.stringify(loginJson).slice(0, 200)}`).toBeTruthy()
  expect(loginJson?.success, 'login success=false').toBeTruthy()

  const meRes = await page.request.get(`${baseURL}${E2E_ROUTES.authMe}`)
  expect(meRes.ok(), 'auth/me after login').toBeTruthy()
  const meJson = await meRes.json()
  const user = meJson?.user
  expect(user?.id, 'auth/me user.id').toBeTruthy()

  await page.evaluate((u) => {
    try {
      localStorage.setItem('gostaylo_user', JSON.stringify(u))
      window.dispatchEvent(new CustomEvent('auth-change', { detail: u }))
    } catch {
      /* ignore */
    }
  }, user)

  await page.goto(`${baseURL}/profile/referral`, { waitUntil: 'domcontentloaded' })

  await page.waitForResponse(
    (r) => r.url().includes('/api/v2/auth/me') && r.request().method() === 'GET' && r.ok(),
    { timeout: 60_000 },
  )
  await page.waitForResponse(
    (r) => r.url().includes('/api/v2/referral/me') && r.request().method() === 'GET' && r.ok(),
    { timeout: 60_000 },
  )

  await expect(page.getByRole('tab', { name: 'Команда' })).toBeVisible({ timeout: 60_000 })
}

/**
 * @param {import('@playwright/test').Page} page
 */
export async function openReferralTeamTab(page) {
  const teamTab = page.getByRole('tab', { name: 'Команда' })
  await teamTab.click()

  const panel = page.getByTestId('referral-team-tab-ready')
  await expect(panel).toBeVisible({ timeout: 45_000 })
  await expect(panel.locator('.animate-pulse')).toHaveCount(0, { timeout: 45_000 })
  await expect(panel.getByText('Аналитика команды')).toBeVisible({ timeout: 15_000 })
  await expect(panel.getByText('400,5 THB').first()).toBeVisible({ timeout: 15_000 })
  await expect(panel.getByText('Твоя команда').first()).toBeVisible({ timeout: 15_000 })

  return panel
}

/**
 * @param {import('@playwright/test').Page} page
 */
export async function stabilizeVisualPage(page) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0.001ms !important;
        animation-delay: 0ms !important;
        transition-duration: 0.001ms !important;
        caret-color: transparent !important;
      }
    `,
  })
}
