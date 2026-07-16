/**
 * Подбор окна дат для E2E (vehicles): первый доступный заезд + N суток.
 */
import type { APIRequestContext } from '@playwright/test'

export function addListingDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** First can_check_in window where each night in [start, end) passes PlatformCalendar validation. */
export function findFirstValidCalendarSpan(
  calRows: Array<{
    date?: string
    can_check_in?: boolean
    status?: string
    is_transition?: boolean
  }> | null | undefined,
  spanDays: number,
): { startIso: string; endIso: string } | null {
  if (!Array.isArray(calRows)) return null
  const byDate = new Map(calRows.filter((r) => r?.date).map((r) => [String(r.date), r]))

  for (const row of calRows) {
    if (!row?.can_check_in || !row.date) continue
    const startIso = String(row.date)
    const endIso = addListingDays(startIso, spanDays)
    if (!byDate.has(endIso)) continue

    let valid = true
    let cursor = startIso
    while (cursor < endIso) {
      const day = byDate.get(cursor)
      if (
        day &&
        day.status === 'BLOCKED' &&
        !day.is_transition &&
        !day.can_check_in
      ) {
        valid = false
        break
      }
      cursor = addListingDays(cursor, 1)
    }
    if (valid) return { startIso, endIso }
  }
  return null
}

export async function pickVehicleNDayRange(
  request: APIRequestContext,
  baseURL: string,
  spanDays: number,
): Promise<{ listingId: string; checkIn: string; checkOut: string } | null> {
  const listingsRes = await request.get(`${baseURL}/api/v2/search?category=vehicles&limit=20`)
  if (!listingsRes.ok()) return null
  const j = (await listingsRes.json()) as { data?: { listings?: Array<{ id?: string }> } }
  const rows = (j?.data?.listings || []).filter((x) => x?.id)
  for (const row of rows) {
    const id = String(row.id)
    const calRes = await request.get(`${baseURL}/api/v2/listings/${id}/calendar?days=180`)
    if (!calRes.ok()) continue
    const calJson = (await calRes.json()) as {
      success?: boolean
      data?: { calendar?: Array<{ date?: string; can_check_in?: boolean }> }
    }
    const cal = calJson?.data?.calendar
    if (!Array.isArray(cal)) continue
    const firstIn = cal.find((d) => d?.can_check_in === true && d?.date)
    const startIso = firstIn?.date
    if (!startIso) continue
    const endIso = addListingDays(startIso, spanDays)
    const hasEnd = cal.some((d) => d?.date === endIso)
    if (hasEnd) return { listingId: id, checkIn: startIso, checkOut: endIso }
  }
  return null
}
