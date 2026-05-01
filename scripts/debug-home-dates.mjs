import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const requests = []

page.on('response', async (resp) => {
  const url = resp.url()
  if (!url.includes('/api/v2/search?')) return
  try {
    const body = await resp.json()
    requests.push({
      url,
      status: resp.status(),
      success: body?.success,
      available: body?.data?.meta?.available ?? null,
      total: body?.data?.meta?.total ?? null,
      hasDateFilter: body?.data?.filters?.hasDateFilter ?? null,
      checkIn: body?.data?.filters?.applied?.checkIn ?? null,
      checkOut: body?.data?.filters?.applied?.checkOut ?? null,
      filteredOutByAvailabilityErrors: body?.data?.meta?.filteredOutByAvailabilityErrors ?? null,
    })
  } catch {
    requests.push({ url, status: resp.status(), parse: 'failed' })
  }
})

await page.goto('http://127.0.0.1:3000/', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2000)

const initialCards = await page.locator('#listings-section a[href^="/listings/"]').count()

// Open search calendar and pick two dates in first visible month.
await page.click('[data-testid="search-calendar-trigger"]')
await page.waitForTimeout(300)

// pick first two available days in desktop calendar
const dayButtons = page.locator('button').filter({ hasText: /^[0-9]{1,2}$/ })
const count = await dayButtons.count()
if (count >= 10) {
  await dayButtons.nth(6).click()
  await page.waitForTimeout(150)
  await dayButtons.nth(9).click()
}

await page.waitForTimeout(2500)
const cardsAfter = await page.locator('#listings-section a[href^="/listings/"]').count()

console.log(
  JSON.stringify(
    {
      initialCards,
      cardsAfter,
      requests,
    },
    null,
    2,
  ),
)

await browser.close()
