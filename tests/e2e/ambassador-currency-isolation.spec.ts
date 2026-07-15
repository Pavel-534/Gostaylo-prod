/**
 * Stage 188.2 — ambassador hub currency isolation (no THB leak for non-THB users).
 *
 * Requires auth (renter storage from playwright setup).
 * Run: npx playwright test --project=ambassador-currency-isolation
 */
import { test, expect } from '@playwright/test'
import { E2E_TEST_IDS } from './constants'

async function setHeaderCurrency(page: import('@playwright/test').Page, code: string) {
  await page.addInitScript((cur) => {
    localStorage.setItem('gostaylo_currency', cur)
    localStorage.setItem('gostaylo_currency_explicit', '1')
  }, code)
}

async function walletContent(page: import('@playwright/test').Page) {
  const shell = page.locator('.gsl-page')
  await expect(shell).toBeVisible({ timeout: 30_000 })
  await expect(shell.getByText(/На балансе|Total balance/i)).toBeVisible({ timeout: 60_000 })
  await expect(shell).not.toContainText('Загрузка реферальной программы', { timeout: 60_000 })
  return shell
}

test.describe('@ambassador-currency-isolation', () => {
  test('wallet hides THB/฿ when RUB selected in header', async ({ page }) => {
    await setHeaderCurrency(page, 'RUB')
    await page.goto('/profile/wallet')
    await page.waitForLoadState('domcontentloaded')

    const shell = await walletContent(page)

    const text = ((await shell.textContent()) || '').replace(/\s+/g, ' ')
    expect(text).not.toMatch(/\d[\d\s,.]*\s*THB|฿/)
    expect(text).toMatch(/₽/)
  })

  test('wallet shows THB when header currency is THB', async ({ page }) => {
    await setHeaderCurrency(page, 'THB')
    await page.goto('/profile/wallet')
    await page.waitForLoadState('domcontentloaded')

    const shell = await walletContent(page)

    const text = ((await shell.textContent()) || '').replace(/\s+/g, ' ')
    expect(text).toMatch(/THB/)
  })

  test('header currency switch updates wallet display', async ({ page }) => {
    await setHeaderCurrency(page, 'RUB')
    await page.goto('/profile/wallet')
    await page.waitForLoadState('domcontentloaded')

    const shell = await walletContent(page)

    await page.getByTestId(E2E_TEST_IDS.currencySelector).click()
    await page.getByTestId('currency-option-THB').click()

    await expect
      .poll(
        async () => {
          const text = ((await shell.textContent()) || '').replace(/\s+/g, ' ')
          return /THB/.test(text)
        },
        { timeout: 30_000 },
      )
      .toBe(true)
  })

  test('withdrawal input shows localized min error below threshold (RUB)', async ({ page }) => {
    await setHeaderCurrency(page, 'RUB')
    await page.goto('/profile/wallet')
    await page.waitForLoadState('domcontentloaded')

    await walletContent(page)

    const input = page.locator('#withdraw-gross-display')
    const visible = await input.isVisible({ timeout: 15_000 }).catch(() => false)
    test.skip(!visible, 'Waterfall not shown — insufficient withdrawable balance for E2E user')

    await input.fill('100')
    const err = page.getByTestId('withdraw-below-min-error')
    await expect(err).toBeVisible({ timeout: 10_000 })

    const errText = ((await err.textContent()) || '').replace(/\s+/g, ' ')
    expect(errText).toMatch(/Минимальная сумма для вывода|Minimum withdrawal amount/i)
    expect(errText).toMatch(/₽/)
    expect(errText).not.toMatch(/\d[\d\s,.]*\s*THB/)
  })
})
