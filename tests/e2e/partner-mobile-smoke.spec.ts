/**
 * Stage 194.0-D — Partner cabinet mobile smoke @ 375×812.
 *
 * Requires: auth setup (`playwright/.auth/partner.json`).
 */
import { test, expect } from '@playwright/test'

const MOBILE = { width: 375, height: 812 } as const

test.describe.configure({ mode: 'serial' })

test.describe('@partner partner mobile smoke (Stage 194.0-D)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(MOBILE)
  })

  test('dashboard shows PartnerMobileBottomNav with 5 tabs', async ({ page, baseURL }) => {
    test.skip(!baseURL, 'baseURL')
    await page.goto(`${baseURL}/partner/dashboard`, { waitUntil: 'domcontentloaded' })

    const nav = page.getByTestId('partner-mobile-bottom-nav')
    await expect(nav).toBeVisible({ timeout: 60_000 })
    await expect(page.getByTestId('partner-nav-dashboard')).toBeVisible()
    await expect(page.getByTestId('partner-nav-listings')).toBeVisible()
    await expect(page.getByTestId('partner-nav-calendar')).toBeVisible()
    await expect(page.getByTestId('partner-nav-bookings')).toBeVisible()
    await expect(page.getByTestId('partner-nav-more')).toBeVisible()
  })

  test('listings: More sheet opens on listing card', async ({ page, baseURL }) => {
    test.skip(!baseURL, 'baseURL')
    await page.goto(`${baseURL}/partner/listings`, { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('partner-mobile-bottom-nav')).toBeVisible({ timeout: 60_000 })

    const moreBtn = page.locator('[data-testid^="listing-more-btn-"]').first()
    test.skip((await moreBtn.count()) === 0, 'Нет карточек объявлений у партнёра')

    await moreBtn.click()
    await expect(page.getByTestId('partner-listing-more-sheet')).toBeVisible({ timeout: 15_000 })
  })

  test('wizard: BottomNav hidden; slim header touch ≥44px', async ({ page, baseURL }) => {
    test.skip(!baseURL, 'baseURL')
    await page.goto(`${baseURL}/partner/listings/new`, { waitUntil: 'domcontentloaded' })

    await expect(page.getByTestId('listing-wizard-mobile-action-bar')).toBeVisible({
      timeout: 60_000,
    })
    await expect(page.getByTestId('partner-mobile-bottom-nav')).toHaveCount(0)

    const exitBtn = page.getByTestId('listing-wizard-exit')
    await expect(exitBtn).toBeVisible({ timeout: 15_000 })
    const box = await exitBtn.boundingBox()
    expect(box, 'exit button geometry').toBeTruthy()
    expect(box!.height).toBeGreaterThanOrEqual(44)
    expect(box!.width).toBeGreaterThanOrEqual(44)
  })

  test('calendar: Quick Actions + near-term active; month pane opens grid', async ({ page, baseURL }) => {
    test.skip(!baseURL, 'baseURL')
    await page.goto(`${baseURL}/partner/calendar`, { waitUntil: 'domcontentloaded' })

    await expect(page.getByTestId('partner-cal-mobile-quick-actions')).toBeVisible({
      timeout: 60_000,
    })
    await expect(page.getByTestId('partner-cal-quick-block')).toBeVisible()
    await expect(page.getByTestId('partner-cal-quick-ical')).toBeVisible()

    const nearTerm = page.getByTestId('partner-cal-window-10')
    await expect(nearTerm).toBeVisible()
    await expect(nearTerm).toHaveClass(/bg-brand/)

    await page.getByTestId('partner-cal-window-month').click()
    await expect(page.getByTestId('partner-cal-mobile-month')).toBeVisible({ timeout: 15_000 })

    await page.getByTestId('partner-cal-window-overview').click()
    await expect(page.getByTestId('partner-cal-mobile-overview')).toBeVisible({ timeout: 15_000 })
  })

  test('More tab opens workspace sidebar drawer', async ({ page, baseURL }) => {
    test.skip(!baseURL, 'baseURL')
    await page.goto(`${baseURL}/partner/dashboard`, { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('partner-mobile-bottom-nav')).toBeVisible({ timeout: 60_000 })

    const sidebar = page.getByTestId('partner-workspace-sidebar')
    await expect(sidebar).toHaveAttribute('data-open', 'false')

    await page.getByTestId('partner-nav-more').click()
    await expect(sidebar).toHaveAttribute('data-open', 'true', { timeout: 10_000 })
    await expect(page.getByTestId('create-listing-btn')).toBeVisible()
    await expect(page.getByRole('link', { name: /отзыв|reviews|评价|รีวิว/i }).first()).toBeVisible()
  })
})
