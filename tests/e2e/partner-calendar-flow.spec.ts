/**
 * Stage 188.0 Post-188 — partner calendar range selection + wizard URL sync smoke.
 *
 * Requires: auth setup (`playwright/.auth/partner.json`), partner with at least one listing.
 */
import { test, expect } from '@playwright/test'
import { addDays, format } from 'date-fns'
import { E2E_ROUTES, E2E_STRINGS } from './constants'

test.describe.configure({ mode: 'serial' })

async function fetchAuthUserId(request, baseURL) {
  const res = await request.get(`${baseURL}${E2E_ROUTES.authMe}`, { failOnStatusCode: false })
  if (!res.ok()) return null
  const json = await res.json().catch(() => ({}))
  return json?.user?.id ? String(json.user.id) : null
}

async function fetchPartnerListings(request, baseURL, partnerId) {
  const res = await request.get(
    `${baseURL}/api/v2/partner/listings?partnerId=${encodeURIComponent(partnerId)}`,
  )
  expect(res.ok()).toBeTruthy()
  const json = await res.json()
  return (json?.data || []) as Array<{ id: string; title?: string; status?: string }>
}

async function fetchCalendarRow(request, baseURL, listingId, startDate, endDate) {
  const qs = new URLSearchParams({ listingId, startDate, endDate })
  const res = await request.get(`${baseURL}/api/v2/partner/calendar?${qs}`)
  expect(res.ok()).toBeTruthy()
  const json = await res.json()
  const row = (json?.data?.listings || []).find((x) => String(x?.listing?.id) === String(listingId))
  return {
    dates: (json?.data?.dates || []) as string[],
    availability: (row?.availability || {}) as Record<string, { status?: string }>,
  }
}

function findAvailablePair(dates, availability) {
  for (let i = 0; i < dates.length - 1; i += 1) {
    const start = dates[i]
    const end = dates[i + 1]
    if (availability[start]?.status === 'AVAILABLE' && availability[end]?.status === 'AVAILABLE') {
      return { start, end }
    }
  }
  return null
}

function findAvailableDate(dates, availability, exclude = new Set()) {
  for (const date of dates) {
    if (exclude.has(date)) continue
    if (availability[date]?.status === 'AVAILABLE') return date
  }
  return null
}

test.describe('@partner partner calendar & wizard polish', () => {
  test('wizard step navigation syncs ?step= to URL and survives reload', async ({
    page,
    baseURL,
    request,
  }) => {
    test.skip(!baseURL, 'baseURL')
    await page.setViewportSize({ width: 1280, height: 900 })

    const uid = await fetchAuthUserId(request, baseURL)
    test.skip(!uid, 'Нет сессии partner')

    const listings = await fetchPartnerListings(request, baseURL, uid)
    const listing =
      listings.find((l) => E2E_STRINGS.bikeTitleRegex.test(String(l.title || ''))) || listings[0]
    test.skip(!listing?.id, 'Нет листингов у партнёра')

    await page.goto(`${baseURL}/partner/listings/${listing.id}?step=photos`, {
      waitUntil: 'domcontentloaded',
    })
    await expect(page).toHaveURL(/[?&]step=photos/, { timeout: 30_000 })
    await expect(page.getByRole('navigation', { name: 'Listing wizard steps' })).toBeVisible({
      timeout: 60_000,
    })

    const backBtn = page.getByRole('button', { name: /назад|back/i }).first()
    await expect(backBtn).toBeEnabled({ timeout: 15_000 })
    await backBtn.click()
    await expect(page).toHaveURL(/[?&]step=location/)

    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/[?&]step=location/, { timeout: 30_000 })
  })

  test('two-tap range opens action sheet with prefilled block dates; manual block shows unblock', async ({
    page,
    baseURL,
    request,
  }) => {
    test.skip(!baseURL, 'baseURL')
    await page.setViewportSize({ width: 1280, height: 900 })

    const uid = await fetchAuthUserId(request, baseURL)
    test.skip(!uid, 'Нет сессии partner')

    const listings = await fetchPartnerListings(request, baseURL, uid)
    const listing =
      listings.find((l) => E2E_STRINGS.bikeTitleRegex.test(String(l.title || ''))) ||
      listings.find((l) => l.status === 'ACTIVE') ||
      listings[0]
    test.skip(!listing?.id, 'Нет листингов у партнёра')

    const startDate = format(new Date(), 'yyyy-MM-dd')
    const endDate = format(addDays(new Date(), 45), 'yyyy-MM-dd')
    const { dates, availability } = await fetchCalendarRow(
      request,
      baseURL,
      listing.id,
      startDate,
      endDate,
    )
    test.skip(dates.length === 0, 'Календарь вернул пустой диапазон')

    const range = findAvailablePair(dates, availability)
    test.skip(!range, 'Нет двух подряд свободных дат для range selection')

    let blockDate = findAvailableDate(dates.slice(20), availability, new Set([range.start, range.end]))
    let createdBlockId = null

    if (blockDate) {
      const blockRes = await request.post(`${baseURL}/api/v2/partner/calendar/block`, {
        data: {
          listingId: listing.id,
          startDate: blockDate,
          endDate: blockDate,
          type: 'OWNER_USE',
          reason: '[E2E_TEST_DATA] partner-calendar-flow',
        },
      })
      if (blockRes.ok()) {
        const blockJson = await blockRes.json().catch(() => ({}))
        createdBlockId = blockJson?.data?.id || null
      } else {
        blockDate = null
      }
    }

    try {
      await page.goto(
        `${baseURL}/partner/calendar?listingId=${encodeURIComponent(listing.id)}`,
        { waitUntil: 'domcontentloaded' },
      )

      const cellSelector = (date, status) =>
        `[data-testid="partner-cal-cell"][data-listing-id="${listing.id}"][data-date="${date}"][data-status="${status}"]`

      await expect(page.locator(cellSelector(range.start, 'AVAILABLE')).first()).toBeVisible({
        timeout: 45_000,
      })

      await page.locator(cellSelector(range.start, 'AVAILABLE')).first().click()
      await page.locator(cellSelector(range.end, 'AVAILABLE')).first().click()

      const overlay = page.getByTestId('partner-cal-action-overlay')
      await expect(overlay).toBeVisible({ timeout: 15_000 })
      await expect(overlay.getByRole('heading', { name: /выберите действие|choose an action/i })).toBeVisible()

      await overlay.getByRole('button', { name: /заблокировать даты|block dates/i }).click()
      await expect(overlay.getByRole('heading', { name: /заблокировать|block dates/i })).toBeVisible()

      const startInput = overlay.locator('input[type="date"]').first()
      const endInput = overlay.locator('input[type="date"]').nth(1)
      await expect(startInput).toHaveValue(range.start)
      await expect(endInput).toHaveValue(range.end)

      if (blockDate && createdBlockId) {
        await page.keyboard.press('Escape')
        await expect(overlay).not.toBeVisible({ timeout: 10_000 })

        await expect(page.locator(cellSelector(blockDate, 'BLOCKED')).first()).toBeVisible({
          timeout: 20_000,
        })
        await page.locator(cellSelector(blockDate, 'BLOCKED')).first().click()

        await expect(overlay).toBeVisible({ timeout: 15_000 })
        await expect(
          overlay.getByRole('button', { name: /разблокировать даты|unblock dates/i }),
        ).toBeVisible()
      }
    } finally {
      if (createdBlockId) {
        await request
          .delete(
            `${baseURL}/api/v2/partner/calendar/block?blockId=${encodeURIComponent(createdBlockId)}`,
          )
          .catch(() => {})
      }
    }
  })
})
