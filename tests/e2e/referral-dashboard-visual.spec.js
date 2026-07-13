/**
 * Stage 133 (ADR-133) — visual regression: ambassador tab «Команда» on /profile/referral.
 *
 * Requires: E2E_FIXTURE_SECRET, Supabase (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY),
 * running Next app (webServer or PLAYWRIGHT_BASE_URL).
 *
 * Snapshots: tests/e2e/referral-dashboard-visual.spec.js-snapshots/
 * Update: npm run test:visual-referral -- --update-snapshots
 */
import { test, expect } from '@playwright/test'
import { E2E_FIXTURE_SECRET, E2E_HEADERS, E2E_ROUTES } from './constants'
import {
  loginReferralAmbassador,
  openReferralTeamTab,
  openReferralLinkTab,
  assertNoSignificantOverlap,
  stabilizeVisualPage,
} from './helpers/referral-dashboard-auth'

test.describe.configure({ mode: 'serial' })

test.describe('@referral-dashboard-visual', () => {
  /** @type {{ email: string, password: string } | null} */
  let creds = null

  test.beforeAll(async ({ request, baseURL }) => {
    test.skip(!baseURL, 'baseURL')
    test.skip(!E2E_FIXTURE_SECRET, 'E2E_FIXTURE_SECRET required for referral-dashboard-visual fixture')

    const res = await request.post(`${baseURL}${E2E_ROUTES.referralDashboardVisualFixture}`, {
      headers: { [E2E_HEADERS.fixtureSecretHeader]: E2E_FIXTURE_SECRET },
      data: {},
    })
    const json = await res.json().catch(() => ({}))
    expect(res.ok(), `${res.status()} ${json?.error || ''}`).toBeTruthy()
    expect(json?.success, json?.error || 'fixture failed').toBeTruthy()
    expect(json?.data?.email, 'fixture email').toBeTruthy()
    expect(json?.data?.password, 'fixture password').toBeTruthy()
    creds = { email: json.data.email, password: json.data.password }
  })

  test.beforeEach(async ({ page }) => {
    test.skip(!creds, 'fixture credentials missing')
    await stabilizeVisualPage(page)
  })

  test('desktop 1280×800 — KPI grid and «Принёс платформе» column', async ({ page, baseURL }) => {
    test.skip(!baseURL || !creds, 'baseURL/creds')

    await page.setViewportSize({ width: 1280, height: 800 })
    await loginReferralAmbassador(page, baseURL, creds)
    const panel = await openReferralTeamTab(page)

    await expect(panel).toHaveScreenshot('referral-team-desktop.png', {
      animations: 'disabled',
      maxDiffPixelRatio: 0.025,
    })
  })

  test('mobile 360×640 — grid-cols-2, truncate, earned under member name', async ({ page, baseURL }) => {
    test.skip(!baseURL || !creds, 'baseURL/creds')

    await page.setViewportSize({ width: 360, height: 640 })
    await loginReferralAmbassador(page, baseURL, creds)
    const panel = await openReferralTeamTab(page)

    await expect(panel).toHaveScreenshot('referral-team-mobile.png', {
      animations: 'disabled',
      maxDiffPixelRatio: 0.025,
    })
  })

  test('mobile 360×640 — link tab share stack and tabs not clipped', async ({ page, baseURL }) => {
    test.skip(!baseURL || !creds, 'baseURL/creds')

    await page.setViewportSize({ width: 360, height: 640 })
    await loginReferralAmbassador(page, baseURL, creds)

    const linkTab = page.getByRole('tab', { name: 'Моя ссылка' })
    const tablist = page.getByTestId('referral-profile-tabs')
    await expect(tablist).toBeVisible({ timeout: 30_000 })

    const tablistBox = await tablist.boundingBox()
    const linkTabBox = await linkTab.boundingBox()
    expect(tablistBox).toBeTruthy()
    expect(linkTabBox).toBeTruthy()
    expect(linkTabBox.x).toBeGreaterThanOrEqual(tablistBox.x - 2)
    expect(linkTabBox.x + linkTabBox.width).toBeLessThanOrEqual(tablistBox.x + tablistBox.width + 4)

    const shareRow = await openReferralLinkTab(page)
    const buttons = shareRow.locator('button')
    const count = await buttons.count()
    expect(count).toBeGreaterThanOrEqual(3)

    /** @type {Array<{ x: number, y: number, width: number, height: number }>} */
    const boxes = []
    for (let i = 0; i < count; i++) {
      const box = await buttons.nth(i).boundingBox()
      if (box) boxes.push(box)
    }
    assertNoSignificantOverlap(boxes)

    const viewport = page.viewportSize()
    for (const box of boxes) {
      expect(box.width).toBeGreaterThan((viewport?.width ?? 360) * 0.82)
      expect(box.height).toBeGreaterThanOrEqual(40)
    }
  })
})
