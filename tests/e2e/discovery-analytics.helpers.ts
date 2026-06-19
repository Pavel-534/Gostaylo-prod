/**
 * Stage 169.0 — helpers for discovery analytics E2E (G-5).
 */
import { expect, type Page, type APIRequestContext } from '@playwright/test'

export type AnalyticsTapEntry = {
  event: string
  properties: Record<string, unknown>
}

declare global {
  interface Window {
    __GSL_ANALYTICS_TAP__?: AnalyticsTapEntry[]
  }
}

export async function installAnalyticsTap(page: Page) {
  await page.addInitScript(() => {
    window.__GSL_ANALYTICS_TAP__ = []
  })
}

export async function readAnalyticsTap(page: Page): Promise<AnalyticsTapEntry[]> {
  return page.evaluate(() => window.__GSL_ANALYTICS_TAP__ ?? [])
}

export async function waitForAnalyticsEvent(
  page: Page,
  eventName: string,
  opts: { timeout?: number; surface?: string } = {},
) {
  const { timeout = 20_000, surface } = opts
  await page.waitForFunction(
    ({ name, surface: surf }) => {
      const tap = window.__GSL_ANALYTICS_TAP__ ?? []
      if (!Array.isArray(tap)) return false
      return tap.some((entry) => {
        if (entry?.event !== name) return false
        if (surf && entry.properties?.surface !== surf) return false
        return true
      })
    },
    { name: eventName, surface: surface ?? null },
    { timeout },
  )
  const all = await readAnalyticsTap(page)
  const matches = all.filter((e) => {
    if (e.event !== eventName) return false
    if (surface && e.properties?.surface !== surface) return false
    return true
  })
  expect(matches.length).toBeGreaterThan(0)
  return matches
}

export async function findListingWithSimilarCandidates(
  request: APIRequestContext,
  baseURL: string,
  minSimilar = 4,
): Promise<string | null> {
  const searchRes = await request.get(`${baseURL}/api/v2/search?limit=40`)
  if (!searchRes.ok()) return null
  const searchJson = (await searchRes.json().catch(() => ({}))) as {
    data?: { listings?: Array<{ id?: string }> }
  }
  const candidates = searchJson?.data?.listings ?? []
  for (const row of candidates) {
    const id = String(row?.id ?? '').trim()
    if (!id) continue
    const simRes = await request.get(
      `${baseURL}/api/v2/listings/${encodeURIComponent(id)}/similar?limit=12`,
    )
    if (!simRes.ok()) continue
    const simJson = (await simRes.json().catch(() => ({}))) as {
      success?: boolean
      listings?: unknown[]
    }
    if (simJson?.success && Array.isArray(simJson.listings) && simJson.listings.length >= minSimilar) {
      return id
    }
  }
  return null
}

export function assertNoEvent(tap: AnalyticsTapEntry[], eventName: string) {
  const hits = tap.filter((e) => e.event === eventName)
  expect(hits, `Unexpected ${eventName} events: ${JSON.stringify(hits)}`).toEqual([])
}
