import { chromium } from 'playwright'

const routes = ['/', '/profile', '/renter/dashboard', '/partner/listings', '/admin/users', '/messages']

const browser = await chromium.launch({ headless: true })
const results = []

for (const route of routes) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errors = []
  const pageErrors = []
  const warns = []
  const consoleHandler = (msg) => {
    const t = msg.type()
    if (t === 'error' && errors.length < 10) errors.push(msg.text())
    if (t === 'warning' && warns.length < 10) warns.push(msg.text())
  }
  const pageErrHandler = (e) => pageErrors.push(String(e))
  page.on('console', consoleHandler)
  page.on('pageerror', pageErrHandler)

  const url = `http://127.0.0.1:3000${route}`
  let ok = true
  let status = null
  try {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 })
    status = resp ? resp.status() : null
  } catch (e) {
    ok = false
    pageErrors.push(`NAV_FAIL:${e.message}`)
  }

  await page.waitForTimeout(1500)
  await page.waitForLoadState('domcontentloaded').catch(() => {})
  await page.waitForSelector('[data-testid^="app-header-"]', { timeout: 2000 }).catch(() => {})

  let metrics = {
    cssVar: null,
    hasHeader: false,
    headerHeight: null,
    mainTop: null,
  }
  try {
    metrics = await page.evaluate(() => {
      const cssVar = getComputedStyle(document.documentElement)
        .getPropertyValue('--app-header-height')
        .trim()
      const header = document.querySelector('[data-testid^="app-header-"]')
      const headerRect = header ? header.getBoundingClientRect() : null
      const main = document.querySelector('main') || document.body
      const mainRect = main ? main.getBoundingClientRect() : null
      return {
        cssVar: cssVar || null,
        hasHeader: !!header,
        headerHeight: headerRect ? Math.round(headerRect.height) : null,
        mainTop: mainRect ? Math.round(mainRect.top) : null,
      }
    })
  } catch (e) {
    pageErrors.push(`EVAL_FAIL:${e.message}`)
  }

  results.push({
    route,
    ok,
    status,
    errors,
    pageErrors,
    warns: warns.slice(0, 5),
    metrics,
  })

  page.off('console', consoleHandler)
  page.off('pageerror', pageErrHandler)
  await page.close()
}

await browser.close()
console.log(JSON.stringify(results, null, 2))
