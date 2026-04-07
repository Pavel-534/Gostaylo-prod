import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createPendingChatBookingFixture } from '@/lib/e2e/create-pending-chat-booking-fixture'
import { EmailService } from '@/lib/services/email.service'
import { getPublicSiteUrl } from '@/lib/site-url'
import { buildFraudBanReplyMarkup } from '@/lib/services/fraud-telegram-ban-button'
import { verifyTelegramBanLinkToken } from '@/lib/auth/telegram-ban-link'

function fixtureSecret() {
  return String(process.env.E2E_FIXTURE_SECRET || '').trim()
}

function extractTokenFromUrl(url) {
  try {
    const u = new URL(url)
    return u.searchParams.get('t')
  } catch {
    return null
  }
}

export async function POST(request) {
  const expected = fixtureSecret()
  if (!expected) {
    return NextResponse.json({ success: false, error: 'Integrity test API disabled' }, { status: 404 })
  }
  const got = request.headers.get('x-e2e-fixture-secret') || ''
  if (got !== expected) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) || {}
  const lang = String(body.lang || 'ru').slice(0, 2)
  const partnerEmail = String(body.partnerEmail || process.env.E2E_PARTNER_EMAIL || '86boa@mail.ru')
  const renterEmail = String(body.renterEmail || process.env.E2E_RENTER_EMAIL || 'pavel29031983@gmail.com')

  const fixture = await createPendingChatBookingFixture({ partnerEmail, renterEmail })
  const { data: booking } = await supabaseAdmin
    .from('bookings')
    .select('id,renter_id,guest_name,check_in,check_out,price_thb,listings(title,district,cover_image,images)')
    .eq('id', fixture.bookingId)
    .single()

  if (!booking) {
    return NextResponse.json({ success: false, error: 'Fixture booking not found' }, { status: 404 })
  }

  const listing = booking.listings || {}
  const imageUrl = listing.cover_image || (Array.isArray(listing.images) ? listing.images[0] : null)
  const chatUrl = `${getPublicSiteUrl()}/messages/${fixture.conversationId}/`

  const payload = {
    bookingId: booking.id,
    guestName: booking.guest_name || 'Guest',
    listingTitle: listing.title || 'Listing',
    listingImageUrl: imageUrl,
    district: listing.district || '',
    checkIn: booking.check_in,
    checkOut: booking.check_out,
    priceLine: `฿${Math.round(Number(booking.price_thb || 0)).toLocaleString('ru-RU')}`,
    checkoutUrl: `${getPublicSiteUrl()}/checkout/${booking.id}/`,
    chatUrl,
    profileUrl: `${getPublicSiteUrl()}/renter/profile/`,
  }

  const prepared = EmailService.prepareBookingConfirmedGuestEmail(payload, lang)
  const html = String(prepared?.template?.html || '')
  const hasConversationDeepLink = html.includes(`/messages/${fixture.conversationId}/`)
  const hasFallbackMessagesOnly = /\/messages\/["']/.test(html)
  const calendarTokenInHtml = (() => {
    const m = html.match(/\/api\/calendar\/stay\?t=([^"'&\s<]+)/)
    return m?.[1] || null
  })()

  const banMarkup = buildFraudBanReplyMarkup(booking.renter_id)
  const banUrl = banMarkup?.inline_keyboard?.[0]?.[0]?.url || null
  const banToken = banUrl ? extractTokenFromUrl(banUrl) : null
  const verifiedBan = banToken ? verifyTelegramBanLinkToken(banToken) : null

  return NextResponse.json({
    success: true,
    data: {
      fixture,
      lang,
      chatUrl,
      hasConversationDeepLink,
      hasFallbackMessagesOnly,
      calendarTokenPresent: Boolean(calendarTokenInHtml),
      zhPrefersIcsCopy: lang === 'zh' ? html.includes('首选：下载 .ics') : null,
      icsAttachmentPresent: Boolean(prepared?.attachments?.length),
      icsAttachmentName: prepared?.attachments?.[0]?.filename || null,
      icsAttachmentContentType: prepared?.attachments?.[0]?.content_type || null,
      banButtonUrl: banUrl,
      banTokenValid: Boolean(verifiedBan?.userId),
      banTokenUserId: verifiedBan?.userId || null,
    },
  })
}

