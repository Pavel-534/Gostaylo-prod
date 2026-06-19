/**
 * Stage 169.0 — Wave G P0: discovery rails + catalog sort analytics smoke.
 *
 * Uses window.__GSL_ANALYTICS_TAP__ (product-analytics.js) — works with or without PostHog.
 *
 * Run: npx playwright test --project=discovery-analytics
 */
import { test, expect } from '@playwright/test'
import {
  installAnalyticsTap,
  readAnalyticsTap,
  waitForAnalyticsEvent,
  findListingWithSimilarCandidates,
  assertNoEvent,
} from './discovery-analytics.helpers'

test.describe('@discovery-analytics Wave G P0', () => {
  test.beforeEach(async ({ page }) => {
    await installAnalyticsTap(page)
  })

  test('PDP similar rail — recommendation_impression + click (similar_pdp)', async ({
    page,
    baseURL,
    request,
  }) => {
    test.skip(!baseURL, 'baseURL required')

    const listingId = await findListingWithSimilarCandidates(request, baseURL, 4)
    test.skip(!listingId, 'No ACTIVE listing with ≥4 similar candidates in catalog')

    await page.goto(`${baseURL}/listings/${listingId}`, { waitUntil: 'domcontentloaded' })
    await expect(page.locator('main')).toBeVisible({ timeout: 30_000 })

    const similarHeading = page.getByRole('heading', {
      name: /Похожие объявления|Similar listings/i,
    })
    await expect(similarHeading).toBeVisible({ timeout: 25_000 })
    await similarHeading.scrollIntoViewIfNeeded()

    const impressions = await waitForAnalyticsEvent(page, 'recommendation_impression', {
      surface: 'similar_pdp',
    })
    expect(impressions[0]?.properties?.mode).toBe('similar_v1')
    expect(impressions[0]?.properties?.anchor_listing_id).toBe(listingId)

    const similarLink = page
      .locator('section')
      .filter({ has: similarHeading })
      .getByRole('link')
      .first()
    await similarLink.click()

    await page.waitForURL(/\/listings\//, { timeout: 15_000 })
    const tap = await readAnalyticsTap(page)
    const clicks = tap.filter(
      (e) => e.event === 'recommendation_click' && e.properties?.surface === 'similar_pdp',
    )
    expect(clicks.length).toBeGreaterThan(0)
    expect(clicks[0]?.properties?.position).toBe(0)
  })

  test('Catalog — user sort change emits catalog_sort_change (not on URL hydrate)', async ({
    page,
    baseURL,
  }) => {
    test.skip(!baseURL, 'baseURL required')

    await page.goto(`${baseURL}/listings?sort=price_asc`, { waitUntil: 'domcontentloaded' })
    await expect(page.locator('#listings-results')).toBeVisible({ timeout: 45_000 })
    await expect(page.locator('#listings-results a[href*="/listings/"]').first()).toBeVisible({
      timeout: 60_000,
    })

    await page.waitForTimeout(500)
    let tap = await readAnalyticsTap(page)
    assertNoEvent(tap, 'catalog_sort_change')

    const sortTrigger = page.locator('#listings-results [role="combobox"]').first()
    await expect(sortTrigger).toBeVisible({ timeout: 30_000 })
    await sortTrigger.click()
    await page.getByRole('option', { name: /Цена: по убыванию|Price: high to low/i }).click()

    await waitForAnalyticsEvent(page, 'catalog_sort_change')
    tap = await readAnalyticsTap(page)
    const sortEvents = tap.filter((e) => e.event === 'catalog_sort_change')
    expect(sortEvents).toHaveLength(1)
    expect(sortEvents[0]?.properties?.from_sort).toBe('price_asc')
    expect(sortEvents[0]?.properties?.to_sort).toBe('price_desc')
  })

  test('Home — for_you_home impression when rail visible', async ({ page, baseURL, request }) => {
    test.skip(!baseURL, 'baseURL required')

    const forYouRes = await request.get(`${baseURL}/api/v2/recommendations/for-you?limit=16`)
    test.skip(!forYouRes.ok(), 'for-you API unavailable')
    const forYouJson = (await forYouRes.json().catch(() => ({}))) as {
      success?: boolean
      listings?: unknown[]
    }
    test.skip(
      !forYouJson?.success || !Array.isArray(forYouJson.listings) || forYouJson.listings.length < 6,
      'Catalog too sparse for For You rail (need ≥6)',
    )

    await page.goto(baseURL, { waitUntil: 'domcontentloaded' })

    const forYouHeading = page.getByRole('heading', { name: /Для вас|For you/i })
    await expect(forYouHeading).toBeVisible({ timeout: 30_000 })
    await forYouHeading.scrollIntoViewIfNeeded()

    const impressions = await waitForAnalyticsEvent(page, 'recommendation_impression', {
      surface: 'for_you_home',
    })
    expect(impressions[0]?.properties?.count).toBeGreaterThanOrEqual(1)
  })
})
