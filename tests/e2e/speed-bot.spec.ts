/**
 * Speed Bot — LCP главной и каталога; прокси TTFB; алерт [PERFORMANCE_LOW] через internal API (серия из 3 замеров).
 */
import { test, expect, type APIRequestContext, type Page } from '@playwright/test'
import { E2E_FIXTURE_SECRET, E2E_HEADERS, E2E_ROUTES } from './constants'

const LCP_THRESHOLD_MS = 3500

async function measureLcpMs(page: Page): Promise<number> {
  return page.evaluate(() => {
    return new Promise<number>((resolve) => {
      let max = 0
      try {
        const po = new PerformanceObserver((list) => {
          for (const e of list.getEntries()) {
            const t = 'startTime' in e ? Number((e as { startTime: number }).startTime) : 0
            if (t > max) max = t
          }
        })
        po.observe({ type: 'largest-contentful-paint', buffered: true })
      } catch {
        /* LCP unsupported */
      }
      setTimeout(() => resolve(Math.round(max)), 4500)
    })
  })
}

async function postPerformanceSample(
  request: APIRequestContext,
  baseURL: string,
  body: {
    pageKey: string
    url: string
    lcpMs: number
    serverTtfbMs?: number
    thresholdMs?: number
  },
) {
  if (!E2E_FIXTURE_SECRET) return null
  return request.post(`${baseURL}${E2E_ROUTES.performanceLowAlert}`, {
    headers: {
      [E2E_HEADERS.fixtureSecretHeader]: E2E_FIXTURE_SECRET,
      'Content-Type': E2E_HEADERS.jsonContentType,
    },
    data: body,
  })
}

test.describe('@speed-bot', () => {
  test('главная и /listings: три замера LCP; при превышении порога — цепочка к internal API', async ({
    page,
    baseURL,
    request,
  }) => {
    test.skip(!baseURL, 'baseURL')

    const samples: { path: string; pageKey: string }[] = [
      { path: '/', pageKey: 'home' },
      { path: '/listings', pageKey: 'listings' },
    ]

    for (const { path, pageKey } of samples) {
      const fullUrl = `${baseURL}${path}`

      for (let i = 0; i < 3; i++) {
        const navStart = Date.now()
        await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 })
        const navMs = Date.now() - navStart

        const lcpMs = await measureLcpMs(page)
        expect(lcpMs).toBeGreaterThanOrEqual(0)

        if (E2E_FIXTURE_SECRET) {
          const res = await postPerformanceSample(request, baseURL, {
            pageKey,
            url: fullUrl,
            lcpMs,
            serverTtfbMs: navMs,
            thresholdMs: LCP_THRESHOLD_MS,
          })
          expect(res?.ok()).toBeTruthy()
        }

        if (lcpMs <= LCP_THRESHOLD_MS) {
          /* быстрая страница — не копим ложные алерты дальше по этому URL в том же прогоне */
          break
        }
      }
    }
  })

  test('internal API: три подряд «медленных» замера → fired (самопроверка логики)', async ({
    request,
    baseURL,
  }) => {
    test.skip(!baseURL, 'baseURL')
    test.skip(!E2E_FIXTURE_SECRET, 'E2E_FIXTURE_SECRET')

    const url = `${baseURL}/`
    const pageKey = `speed-selftest-${Date.now()}`
    const thresholdMs = 100

    for (let i = 0; i < 2; i++) {
      const r = await postPerformanceSample(request, baseURL, {
        pageKey,
        url,
        lcpMs: 5000,
        serverTtfbMs: 50,
        thresholdMs,
      })
      expect(r?.ok()).toBeTruthy()
      const j = (await r!.json()) as { fired?: boolean; streak?: number }
      expect(j.fired).toBeFalsy()
      expect(j.streak).toBe(i + 1)
    }

    const r3 = await postPerformanceSample(request, baseURL, {
      pageKey,
      url,
      lcpMs: 5000,
      serverTtfbMs: 900,
      thresholdMs,
    })
    expect(r3?.ok()).toBeTruthy()
    const j3 = (await r3!.json()) as { fired?: boolean }
    expect(j3.fired).toBeTruthy()
  })
})
