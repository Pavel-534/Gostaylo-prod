/**
 * PlatformCalendar E2E — Dialog (desktop) / Drawer (mobile) picker helpers.
 * Stage 171.39 — replaces brittle getByRole('dialog') after calendar UX change.
 */
import { expect, type Locator, type Page } from '@playwright/test'
import { addListingDays } from './vehicle-calendar-range'

export { addListingDays }

/** Desktop sticky booking card on PDP (lg+). */
export function getDesktopBookingCard(page: Page): Locator {
  return page.locator('div.hidden.lg\\:block.sticky.top-24')
}

/** Visible picker shell (Dialog or Drawer). */
export function getPlatformCalendarPicker(page: Page): Locator {
  return page.locator('[data-testid="platform-calendar-picker"]:visible')
}

async function isBookingWidgetReady(desktopBookingCard: Locator): Promise<boolean> {
  if (await desktopBookingCard.getByTestId('booking-price-total').isVisible().catch(() => false)) {
    return true
  }
  return desktopBookingCard.getByTestId('listing-book-now').isEnabled().catch(() => false)
}

async function ensurePickerOpen(page: Page, desktopBookingCard: Locator): Promise<Locator> {
  const picker = getPlatformCalendarPicker(page)
  if (await picker.isVisible()) return picker
  await desktopBookingCard.getByTestId('platform-calendar-trigger').click()
  await expect(picker).toBeVisible({ timeout: 10_000 })
  return picker
}

/** Opens PlatformCalendar and returns the visible picker shell. */
export async function openPlatformCalendarPicker(
  page: Page,
  desktopBookingCard?: Locator,
): Promise<Locator> {
  const card = desktopBookingCard ?? getDesktopBookingCard(page)
  const trigger = card.getByTestId('platform-calendar-trigger')
  await expect(trigger).toBeVisible({ timeout: 30_000 })
  await expect(trigger).toBeEnabled({ timeout: 30_000 })

  const picker = getPlatformCalendarPicker(page)

  await expect
    .poll(
      async () => {
        if (!(await picker.isVisible())) {
          await trigger.click()
        }
        return picker.isVisible()
      },
      { timeout: 30_000, intervals: [200, 400, 600, 1000] },
    )
    .toBeTruthy()

  return picker
}

function availabilityResponseMatcher(listingId: string) {
  const id = encodeURIComponent(String(listingId || '').trim())
  return (r: import('@playwright/test').Response) => {
    const u = r.url()
    if (r.request().method() !== 'GET' || !r.ok()) return false
    return u.includes(`/api/v2/listings/${id}/availability`) && u.includes('startDate=')
  }
}

/** Wait for pricing breakdown total after dates are selected. */
export async function waitForBookingPriceTotal(
  desktopBookingCard: Locator,
  options?: { timeout?: number },
): Promise<Locator> {
  const totalLoc = desktopBookingCard.getByTestId('booking-price-total')
  await expect(totalLoc).toBeVisible({ timeout: options?.timeout ?? 60_000 })
  return totalLoc
}

/** Wait until book CTA is enabled (availability + commission settled). */
export async function waitForListingBookCtaEnabled(
  desktopBookingCard: Locator,
  options?: { timeout?: number },
): Promise<Locator> {
  const book = desktopBookingCard.getByTestId('listing-book-now')
  await expect
    .poll(async () => book.isEnabled(), {
      timeout: options?.timeout ?? 90_000,
      intervals: [400, 800, 1200],
    })
    .toBeTruthy()
  return book
}

async function clickCalendarDatePair(
  picker: Locator,
  startIso: string,
  endIso: string,
  options?: { page?: Page; listingId?: string },
): Promise<void> {
  const checkInBtn = picker.locator(`button[data-date="${startIso}"]`).first()
  await expect(checkInBtn).toBeVisible({ timeout: 15_000 })
  await checkInBtn.click()

  const checkoutBtn = picker.locator(`button[data-date="${endIso}"]`).first()
  await expect(checkoutBtn).toBeVisible({ timeout: 15_000 })

  const availabilityP =
    options?.page && options?.listingId
      ? options.page.waitForResponse(availabilityResponseMatcher(options.listingId), {
          timeout: 90_000,
        })
      : null

  await checkoutBtn.scrollIntoViewIfNeeded()
  await checkoutBtn.click()

  if (availabilityP) {
    await availabilityP.catch(() => {
      /* TanStack cache may skip network — trigger/price wait is SSOT */
    })
  }

  await picker.page().waitForTimeout(350)
}

/** Select check-in + check-out span inside an open picker. Retries when range validation fails. */
export async function selectPlatformCalendarRange(
  picker: Locator,
  spanDays: number,
  options?: {
    page?: Page
    listingId?: string
    desktopBookingCard?: Locator
    knownStartIso?: string
    knownEndIso?: string
  },
): Promise<{ startIso: string; endIso: string }> {
  const page = picker.page()
  const card = options?.desktopBookingCard

  const attempts: Array<{ startIso: string; endIso: string }> = []
  if (options?.knownStartIso && options?.knownEndIso) {
    attempts.push({ startIso: options.knownStartIso, endIso: options.knownEndIso })
  }

  const candidates = picker.locator('button[data-clickable="true"]')
  const count = await candidates.count()
  for (let i = 0; i < Math.min(count, 14); i++) {
    const startIso = await candidates.nth(i).getAttribute('data-date')
    if (!startIso) continue
    attempts.push({ startIso, endIso: addListingDays(startIso, spanDays) })
  }

  const seen = new Set<string>()
  const uniqueAttempts = attempts.filter(({ startIso }) => {
    if (seen.has(startIso)) return false
    seen.add(startIso)
    return true
  })

  let lastError = 'no attempts'

  for (const { startIso, endIso } of uniqueAttempts) {
    const activePicker = card ? await ensurePickerOpen(page, card) : picker

    const checkInBtn = activePicker.locator(`button[data-date="${startIso}"]`).first()
    const checkoutBtn = activePicker.locator(`button[data-date="${endIso}"]`).first()
    if (!(await checkInBtn.isVisible().catch(() => false))) {
      lastError = `check-in ${startIso} not visible`
      continue
    }
    if (!(await checkoutBtn.isVisible().catch(() => false))) {
      lastError = `checkout ${endIso} not visible for start ${startIso}`
      continue
    }

    try {
      await clickCalendarDatePair(activePicker, startIso, endIso, options)
      if (!card) return { startIso, endIso }

      const settled = await expect
        .poll(() => isBookingWidgetReady(card), { timeout: 12_000, intervals: [250, 500, 800] })
        .toBeTruthy()
        .then(() => true)
        .catch(() => false)

      if (settled) return { startIso, endIso }
      lastError = `widget not ready after ${startIso}→${endIso}`
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
    }
  }

  throw new Error(
    `PlatformCalendar: could not select ${spanDays}-day range (${uniqueAttempts.length} attempts). Last: ${lastError}`,
  )
}

/** Close picker if still open (Escape). */
export async function closePlatformCalendarPicker(page: Page): Promise<void> {
  const picker = getPlatformCalendarPicker(page)
  if (await picker.isVisible()) {
    await page.keyboard.press('Escape')
    await expect(picker).toBeHidden({ timeout: 15_000 })
  }
}

/** Full flow: open picker → select range → wait pricing → optionally close. */
export async function pickDatesOnDesktopBookingCard(
  page: Page,
  spanDays: number,
  options?: {
    closeAfter?: boolean
    desktopBookingCard?: Locator
    listingId?: string
    waitForPrice?: boolean
    knownStartIso?: string
    knownEndIso?: string
  },
): Promise<{ startIso: string; endIso: string; picker: Locator; desktopBookingCard: Locator }> {
  const desktopBookingCard = options?.desktopBookingCard ?? getDesktopBookingCard(page)
  const picker = await openPlatformCalendarPicker(page, desktopBookingCard)
  const range = await selectPlatformCalendarRange(picker, spanDays, {
    page,
    listingId: options?.listingId,
    desktopBookingCard,
    knownStartIso: options?.knownStartIso,
    knownEndIso: options?.knownEndIso,
  })

  if (options?.waitForPrice !== false) {
    await waitForBookingPriceTotal(desktopBookingCard)
  }

  if (options?.closeAfter !== false) {
    await closePlatformCalendarPicker(page)
  }

  return { ...range, picker, desktopBookingCard }
}
