/**
 * Stage 112.2 / 113.0 — SSOT browser fetch для партнёрского и публичного календаря.
 */

import { dedupeClientRequest } from '@/lib/api/client-request-dedup'
import { TTL_PARTNER_CALENDAR_INFLIGHT_MS } from '@/lib/api/client-fetch-policy'

async function readJson(res) {
  try {
    return await res.json()
  } catch {
    return {}
  }
}

const defaultInit = {
  credentials: 'include',
  cache: 'no-store',
}

/** Партнёрский календарь (все листинги или один). */
export async function fetchPartnerCalendar({ partnerId, startDate, endDate, listingId } = {}) {
  const params = new URLSearchParams()
  if (partnerId) params.set('partnerId', partnerId)
  if (startDate) params.set('startDate', startDate)
  if (endDate) params.set('endDate', endDate)
  if (listingId) params.set('listingId', listingId)

  const cacheKey = `partner:calendar:${params.toString()}`
  return dedupeClientRequest(
    cacheKey,
    async () => {
      const res = await fetch(`/api/v2/partner/calendar?${params}`, {
        ...defaultInit,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      })
      const json = await readJson(res)
      if (!res.ok) {
        throw new Error(json.error || `Ошибка загрузки календаря (${res.status})`)
      }
      if (json.status === 'error') {
        throw new Error(json.error || 'Ошибка календаря')
      }
      if (json.data == null) {
        throw new Error('Некорректный ответ API')
      }
      return { data: json.data, meta: json.meta || {} }
    },
    { ttlMs: TTL_PARTNER_CALENDAR_INFLIGHT_MS },
  )
}

/** Публичный календарь листинга (витрина / platform-calendar). */
export async function fetchPublicListingCalendar(listingId, { days = 180, guests = 1, signal } = {}) {
  const res = await fetch(
    `/api/v2/listings/${listingId}/calendar?days=${days}&guests=${guests}`,
    { signal, cache: 'default' },
  )
  const json = await readJson(res)
  return {
    ok: res.ok && json.success === true,
    calendar: Array.isArray(json.data?.calendar) ? json.data.calendar : [],
    error: json.error ?? null,
  }
}

/** Блокировки дат в кабинете партнёра (availability-calendar). */
export async function fetchListingCalendarBlocks(listingId) {
  const res = await fetch(`/api/v2/partner/listings/${listingId}/calendar`, defaultInit)
  const json = await readJson(res)
  return {
    ok: res.ok && json.success === true,
    blocks: json.blocks || [],
    blockedDates: json.blockedDates || [],
    error: json.error ?? null,
  }
}

export async function postListingCalendarBlock(listingId, body) {
  const res = await fetch(`/api/v2/partner/listings/${listingId}/calendar`, {
    ...defaultInit,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await readJson(res)
  return { ok: res.ok && json.success === true, json, error: json.error ?? null }
}

export async function deleteListingCalendarBlock(listingId, blockId) {
  const res = await fetch(
    `/api/v2/partner/listings/${listingId}/calendar?blockId=${encodeURIComponent(blockId)}`,
    { ...defaultInit, method: 'DELETE' },
  )
  const json = await readJson(res)
  return { ok: res.ok && json.success === true, json, error: json.error ?? null }
}
