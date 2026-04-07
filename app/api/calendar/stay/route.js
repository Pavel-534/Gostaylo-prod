import { NextResponse } from 'next/server'
import { getPublicSiteUrl } from '@/lib/site-url'
import { buildStayIcsBody } from '@/lib/calendar/stay-ics'
import { verifyCalendarStayToken, resolveBookingCalendarStay } from '@/lib/calendar/calendar-stay-token'

/**
 * GET /api/calendar/stay?t=<signed-token>
 * Токен выдаётся только при отправке письма (TTL ~14 дней) и сверяется с бронью в БД.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('t')
  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 })
  }

  const verified = verifyCalendarStayToken(token)
  if (!verified) {
    return NextResponse.json({ error: 'Invalid or expired link' }, { status: 403 })
  }

  const { startYmd, endYmd } = verified
  const startDt = new Date(`${startYmd}T00:00:00.000Z`)
  const endDt = new Date(`${endYmd}T00:00:00.000Z`)
  if (!(startDt < endDt)) {
    return NextResponse.json({ error: 'Invalid date range' }, { status: 400 })
  }

  const resolved = await resolveBookingCalendarStay(verified)
  if (!resolved) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const site = getPublicSiteUrl().replace(/^https?:\/\//, '').replace(/\/$/, '') || 'gostaylo'
  const body = buildStayIcsBody({
    title: resolved.title,
    location: resolved.location,
    startYmd: resolved.startYmd,
    endYmd: resolved.endYmd,
    bookingId: resolved.bookingId,
    siteHost: site,
    details: `${getPublicSiteUrl()}/checkout/${resolved.bookingId}/`,
  })

  if (!body) {
    return NextResponse.json({ error: 'Could not build calendar' }, { status: 400 })
  }

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="gostaylo-stay.ics"',
      'Cache-Control': 'private, no-store',
    },
  })
}
