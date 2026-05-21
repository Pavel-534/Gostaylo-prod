/**
 * Stage 111.1 — публичные API витрины (фичи, статистика, локации).
 */

async function readJson(res) {
  try {
    return await res.json()
  } catch {
    return {}
  }
}

export async function fetchSiteFeatures() {
  const res = await fetch('/api/v2/site-features')
  const data = await readJson(res)
  return {
    ok: res.ok && data.success,
    semanticSearchOnSite:
      data?.data && typeof data.data.semanticSearchOnSite === 'boolean'
        ? data.data.semanticSearchOnSite
        : null,
    data: data?.data ?? null,
    raw: data,
    status: res.status,
  }
}

export async function fetchPublicStats() {
  const res = await fetch('/api/v2/public/stats')
  const data = await readJson(res)
  return { ok: res.ok && data.success, data: data?.data ?? null, raw: data, status: res.status }
}

export async function fetchSearchLocations() {
  const res = await fetch('/api/v2/search/locations')
  const data = await readJson(res)
  return { ok: res.ok && data.success, locations: data?.data ?? data?.locations ?? [], raw: data, status: res.status }
}

/** Публичные UI-строки маркетинга (каталог, flash strip). */
export async function fetchPublicMarketingUiStrings(lang) {
  const q = lang ? `?lang=${encodeURIComponent(lang)}` : ''
  const res = await fetch(`/api/v2/marketing/ui-strings${q}`, { cache: 'no-store' })
  const data = await readJson(res)
  return { ok: res.ok && data.success, data: data?.data ?? null, raw: data, status: res.status }
}

/** Быстрый preview доступности листингов по региону (geo toast, hero count). */
/** Geo + валюта по IP (CurrencyProvider, авто-валюта). */
export async function fetchGeoCurrencyHint() {
  const res = await fetch('/api/v2/geo', { cache: 'no-store' })
  const data = await readJson(res)
  return {
    ok: res.ok && data.success,
    currencyCode: data?.currency?.code ?? null,
    location: data?.location ?? null,
    raw: data,
    status: res.status,
  }
}

export async function fetchSearchAvailableCount(params) {
  const qs = params instanceof URLSearchParams ? params : new URLSearchParams(params)
  if (!qs.has('limit')) qs.set('limit', '1')
  const res = await fetch(`/api/v2/search?${qs.toString()}`)
  const data = await readJson(res)
  return {
    ok: res.ok && data.success,
    available: data?.data?.meta?.available ?? 0,
    raw: data,
    status: res.status,
  }
}
