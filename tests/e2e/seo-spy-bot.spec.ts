/**
 * SEO Spy Bot — сценарий №25 (Playwright).
 * Случайные листинги: title, meta description, OpenGraph, согласованность цены с витриной.
 * Алерт в Telegram (топик TELEGRAM_SYSTEM_ALERTS_TOPIC_ID): POST …/seo-spy-alert при E2E_FIXTURE_SECRET.
 */
import { test, expect, type APIRequestContext } from '@playwright/test'
import {
  E2E_FIXTURE_SECRET,
  E2E_HEADERS,
  E2E_ROUTES,
  E2E_TEST_IDS,
} from './constants'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function normWs(s: string): string {
  return String(s || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

type PageSeo = {
  title: string
  description: string
  ogTitle: string
  ogDescription: string
  ogImage: string
}

async function readSeoFromDom(page: import('@playwright/test').Page): Promise<PageSeo> {
  return page.evaluate(() => {
    const descEl = document.querySelector('meta[name="description"]')
    const ogTitleEl = document.querySelector('meta[property="og:title"]')
    const ogDescEl = document.querySelector('meta[property="og:description"]')
    const ogImageEl = document.querySelector('meta[property="og:image"]')
    return {
      title: document.title || '',
      description: descEl?.getAttribute('content')?.trim() || '',
      ogTitle: ogTitleEl?.getAttribute('content')?.trim() || '',
      ogDescription: ogDescEl?.getAttribute('content')?.trim() || '',
      ogImage: ogImageEl?.getAttribute('content')?.trim() || '',
    }
  })
}

async function reportSeoFailure(
  request: APIRequestContext,
  baseURL: string,
  pageUrl: string,
  detail: string,
) {
  if (!E2E_FIXTURE_SECRET) {
    console.warn('[seo-spy-bot] E2E_FIXTURE_SECRET missing — skip Telegram alert:', detail)
    return
  }
  const res = await request.post(`${baseURL}${E2E_ROUTES.seoSpyAlert}`, {
    headers: { [E2E_HEADERS.fixtureSecretHeader]: E2E_FIXTURE_SECRET },
    data: { url: pageUrl, detail },
  })
  if (!res.ok()) {
    console.warn('[seo-spy-bot] alert API', res.status(), await res.text().catch(() => ''))
  }
}

test.describe('@seo-spy-bot', () => {
  test('случайные листинги: метаданные, OG и цена', async ({ page, baseURL, request }) => {
    test.skip(!baseURL, 'baseURL')

    const listRes = await request.get(
      `${baseURL}/api/v2/listings?status=ACTIVE&limit=72`,
    )
    expect(listRes.ok(), 'listings API').toBeTruthy()
    const listJson = (await listRes.json()) as { data?: Array<{ id?: string; basePriceThb?: number }> }
    const rows = (listJson?.data || []).filter(
      (x) => x?.id && String((x as { coverImage?: string }).coverImage || '').trim(),
    )
    test.skip(rows.length < 3, 'Недостаточно ACTIVE листингов с обложкой (og:image) для выборки')

    const picked = shuffle(rows).slice(0, 4)
    await page.setViewportSize({ width: 1400, height: 900 })

    for (const row of picked) {
      const id = String(row.id)
      const pageUrl = `${baseURL.replace(/\/$/, '')}/listings/${id}/`

      const apiRes = await request.get(`${baseURL}/api/v2/listings/${id}`)
      expect(apiRes.ok(), `GET listing ${id}`).toBeTruthy()
      const apiJson = (await apiRes.json()) as { data?: { basePriceThb?: number } }
      const baseThb = Number(apiJson?.data?.basePriceThb)
      const hasPrice = Number.isFinite(baseThb) && baseThb > 0

      await page.goto(pageUrl, { waitUntil: 'domcontentloaded' })

      const heroLoc = page.getByTestId(E2E_TEST_IDS.listingHeroPrice).first()
      await expect(heroLoc, `hero price visible ${pageUrl}`).toBeVisible({ timeout: 35_000 })
      const heroPrice = normWs((await heroLoc.textContent()) || '')

      const seo = await readSeoFromDom(page)

      const failures: string[] = []
      if (!normWs(seo.title)) failures.push('empty <title>')
      if (!normWs(seo.description)) failures.push('empty meta[name=description]')
      if (!normWs(seo.ogTitle)) failures.push('empty og:title')
      if (!normWs(seo.ogDescription)) failures.push('empty og:description')
      if (!normWs(seo.ogImage)) failures.push('empty og:image')

      if (hasPrice && heroPrice) {
        const bundle = [seo.title, seo.description, seo.ogTitle, seo.ogDescription]
          .map(normWs)
          .join(' | ')
        if (!bundle.includes(heroPrice)) {
          failures.push(
            `price mismatch: hero "${heroPrice}" not found in title/description/og (basePriceThb=${baseThb})`,
          )
        }
      }

      if (failures.length) {
        const detail = failures.join('; ')
        await reportSeoFailure(request, baseURL, pageUrl, detail)
        throw new Error(`${pageUrl} — ${detail}`)
      }
    }
  })
})
