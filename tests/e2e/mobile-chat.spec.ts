/**
 * Мобильный аудит чата.
 * Профиль устройства задаётся проектом Playwright (`chat-mobile-iphone` / `chat-mobile-pixel`).
 */
import { test, expect } from '@playwright/test'

const LONG_TEXT =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(18) +
  'Проверка длинного текста в композере без перекрытия области ввода на узком экране.'

test.describe('Mobile chat UI', () => {
  test('композер: длинный текст остаётся в видимой области после scrollIntoView', async ({
    page,
    baseURL,
  }) => {
    test.skip(!baseURL, 'baseURL')
    await page.goto(`${baseURL}/messages/`, { waitUntil: 'domcontentloaded' })
    const row = page.locator('a[href^="/messages/"]').first()
    test.skip((await row.count()) === 0, 'Нет бесед — пропуск мобильного сценария')
    await row.click()
    await page.waitForURL(/\/messages\/[^/]+/, { timeout: 30_000 })

    const ta = page.getByTestId('chat-composer-textarea')
    await expect(ta).toBeVisible({ timeout: 30_000 })
    await ta.fill(LONG_TEXT)
    await ta.scrollIntoViewIfNeeded()

    const box = await ta.boundingBox()
    const vh = page.viewportSize()?.height ?? 800
    expect(box, 'bounding box композера').toBeTruthy()
    expect(box!.y + box!.height).toBeLessThanOrEqual(vh + 120)
  })

  test('системная карточка на ширине 375px (узкий вьюпорт)', async ({ page, baseURL }) => {
    test.skip(!baseURL, 'baseURL')
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(`${baseURL}/messages/`, { waitUntil: 'domcontentloaded' })
    const row = page.locator('a[href^="/messages/"]').first()
    test.skip((await row.count()) === 0, 'Нет бесед')
    await row.click()
    await page.waitForURL(/\/messages\/[^/]+/, { timeout: 30_000 })

    const cards = page.getByTestId('chat-milestone-card')
    test.skip((await cards.count()) === 0, 'В первой беседе нет системных карточек')
    const milestone = cards.first()
    await milestone.scrollIntoViewIfNeeded()
    const w = (await milestone.boundingBox())?.width ?? 0
    expect(w).toBeGreaterThan(200)
    expect(w).toBeLessThanOrEqual(375)
  })

  test('кнопки Подтвердить / Оплатить кликабельны, если отображаются', async ({
    page,
    baseURL,
  }) => {
    test.skip(!baseURL, 'baseURL')
    await page.goto(`${baseURL}/messages/`, { waitUntil: 'domcontentloaded' })
    const row = page.locator('a[href^="/messages/"]').first()
    test.skip((await row.count()) === 0, 'Нет бесед')
    await row.click()
    await page.waitForURL(/\/messages\/[^/]+/, { timeout: 30_000 })

    const confirm = page.getByTestId('chat-action-confirm')
    const pay = page.getByTestId('chat-action-pay')

    if (await confirm.isVisible().catch(() => false)) {
      await confirm.scrollIntoViewIfNeeded()
      await expect(confirm).toBeEnabled()
      await expect(confirm).toBeInViewport()
      await confirm.click()
      await page.keyboard.press('Escape').catch(() => {})
    }

    if (await pay.isVisible().catch(() => false)) {
      await pay.scrollIntoViewIfNeeded()
      await expect(pay).toBeEnabled()
      await expect(pay).toBeInViewport()
      const box = await pay.boundingBox()
      expect(box && box.width > 0 && box.height > 0).toBeTruthy()
    }
  })
})
