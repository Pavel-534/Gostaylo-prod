import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []

page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})

await page.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(1500)

const cards = await page.locator('#listings-section a').count()
console.log(JSON.stringify({ cards, errors: errors.slice(0, 8) }, null, 2))

await browser.close()
