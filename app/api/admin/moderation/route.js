/**
 * Admin Moderation API
 * GET — pending listings (без черновиков)
 * PATCH — approve | reject | set_featured; при approve опционально title, description, metadata (нормализация SSOT).
 */

import { NextResponse } from 'next/server'
import { toPublicImageUrl, mapPublicImageUrls } from '@/lib/public-image-url'
import { getPublicSiteUrl } from '@/lib/site-url.js'
import { resolveDefaultCommissionPercent } from '@/lib/services/currency.service'
import { normalizePartnerListingMetadata } from '@/lib/partner/listing-wizard-metadata'

export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const ADMIN_TOPIC_ID = '-1003832026983'
const LISTINGS_THREAD_ID = 3

const LISTING_SELECT =
  '*,owner:profiles!listings_owner_id_fkey(id,first_name,last_name,email,phone,telegram_id,custom_commission_rate),categories(slug,name,wizard_profile)'

function supabaseHeaders(extra = {}) {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    ...extra,
  }
}

/**
 * @param {unknown} listing
 * @returns {string}
 */
function categorySlugFromListing(listing) {
  const row = listing?.categories
  if (row && typeof row === 'object' && !Array.isArray(row)) {
    const s = String(row.slug || '').toLowerCase().trim()
    if (s) return s
  }
  if (Array.isArray(row) && row[0]?.slug) {
    return String(row[0].slug || '').toLowerCase().trim()
  }
  const m = listing?.metadata && typeof listing.metadata === 'object' ? listing.metadata : {}
  return String(m.category_slug || m.categorySlug || '').toLowerCase().trim()
}

export async function GET() {
  try {
    const listingsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/listings?status=eq.PENDING&select=${encodeURIComponent(LISTING_SELECT)}&order=created_at.desc`,
      {
        headers: supabaseHeaders({ 'Cache-Control': 'no-cache' }),
        cache: 'no-store',
      },
    )

    if (!listingsRes.ok) {
      throw new Error('Failed to fetch listings')
    }

    const rawListings = await listingsRes.json()

    const listings = (rawListings || []).filter((listing) => {
      const isDraft = listing.metadata?.is_draft === true
      return !isDraft
    })

    const settingsRes = await fetch(`${SUPABASE_URL}/rest/v1/system_settings?key=eq.general&select=value`, {
      headers: supabaseHeaders(),
    })
    const settings = await settingsRes.json()
    const raw = parseFloat(settings?.[0]?.value?.defaultCommissionRate)
    const systemCommission =
      Number.isFinite(raw) && raw >= 0 ? raw : await resolveDefaultCommissionPercent()

    const listingsWithCommission = listings.map((listing) => ({
      ...listing,
      images: mapPublicImageUrls(listing.images || []),
      cover_image: listing.cover_image ? toPublicImageUrl(listing.cover_image) : null,
      effectiveCommission: listing.owner?.custom_commission_rate ?? systemCommission,
      systemCommission,
    }))

    return NextResponse.json({
      success: true,
      listings: listingsWithCommission,
      count: listingsWithCommission.length,
    })
  } catch (error) {
    console.error('Moderation GET error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function PATCH(request) {
  try {
    const body = await request.json()
    const { listingId, action, rejectReason, isFeatured, title, description, metadata: metadataPatch } = body

    if (!listingId || !action) {
      return NextResponse.json({ error: 'listingId and action required' }, { status: 400 })
    }

    const listingRes = await fetch(
      `${SUPABASE_URL}/rest/v1/listings?id=eq.${encodeURIComponent(listingId)}&select=${encodeURIComponent(LISTING_SELECT)}`,
      { headers: supabaseHeaders() },
    )
    const listings = await listingRes.json()
    const listing = listings?.[0]

    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }

    const timestamp = new Date().toISOString()
    let notificationSent = false

    if (action === 'set_featured') {
      if (typeof isFeatured !== 'boolean') {
        return NextResponse.json({ error: 'isFeatured boolean required for set_featured' }, { status: 400 })
      }
      const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/listings?id=eq.${encodeURIComponent(listingId)}`, {
        method: 'PATCH',
        headers: supabaseHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ is_featured: isFeatured, updated_at: timestamp }),
      })
      if (!updateRes.ok) {
        const errText = await updateRes.text().catch(() => '')
        console.error('set_featured PATCH failed', updateRes.status, errText)
        return NextResponse.json({ success: false, error: 'Failed to update listing featured flag' }, { status: 500 })
      }
      return NextResponse.json({ success: true, action: 'set_featured', listingId, isFeatured })
    }

    let updateData = {}

    if (action === 'approve') {
      const categorySlug = categorySlugFromListing(listing)
      const nameFb = String(listing.categories?.name || listing.categories?.[0]?.name || '')

      updateData = {
        status: 'ACTIVE',
        available: true,
        updated_at: timestamp,
      }

      if (title !== undefined && title !== null) {
        const t = String(title).trim().slice(0, 255)
        if (t) updateData.title = t
      }
      if (description !== undefined && description !== null) {
        updateData.description = String(description).trim().slice(0, 50_000)
      }

      if (metadataPatch != null && typeof metadataPatch === 'object' && !Array.isArray(metadataPatch)) {
        const prevMeta =
          listing.metadata && typeof listing.metadata === 'object' && !Array.isArray(listing.metadata)
            ? { ...listing.metadata }
            : {}
        const merged = { ...prevMeta, ...metadataPatch }
        const catRow = listing?.categories
        const wp =
          (catRow && typeof catRow === 'object' && !Array.isArray(catRow)
            ? catRow.wizard_profile
            : Array.isArray(catRow)
              ? catRow[0]?.wizard_profile
              : null) ?? null
        updateData.metadata = normalizePartnerListingMetadata(merged, categorySlug, nameFb, wp)
      }
    } else if (action === 'reject') {
      if (!rejectReason) {
        return NextResponse.json({ error: 'Reject reason required' }, { status: 400 })
      }
      updateData = {
        status: 'REJECTED',
        available: false,
        rejection_reason: rejectReason,
        rejected_at: timestamp,
        updated_at: timestamp,
      }
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/listings?id=eq.${encodeURIComponent(listingId)}`, {
      method: 'PATCH',
      headers: supabaseHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(updateData),
    })

    if (!updateRes.ok) {
      const errText = await updateRes.text().catch(() => '')
      console.error('Moderation listing PATCH failed', updateRes.status, errText)
      throw new Error('Failed to update listing')
    }

    const finalTitle = updateData.title ?? listing.title
    const finalDescription = updateData.description ?? listing.description

    if (listing.owner?.telegram_id && (action === 'approve' || action === 'reject')) {
      const appUrl = getPublicSiteUrl()
      const partnerMessage =
        action === 'approve'
          ? `✅ <b>Ваше объявление опубликовано!</b>\n\n📍 <b>${finalTitle}</b>\n\n🎉 Теперь его видят арендаторы!\n\n<a href="${appUrl}/listings/${listing.id}">Посмотреть объявление →</a>`
          : `❌ <b>Объявление отклонено</b>\n\n📍 <b>${listing.title}</b>\n\n📝 <b>Причина:</b>\n${rejectReason}\n\n<i>Исправьте замечания и отправьте повторно</i>\n\n<a href="${appUrl}/partner/listings/${listing.id}/edit">✏️ Редактировать объявление →</a>`

      try {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: listing.owner.telegram_id,
            text: partnerMessage,
            parse_mode: 'HTML',
          }),
        })
        notificationSent = true
      } catch (tgError) {
        console.error('Telegram to partner error:', tgError)
      }
    }

    const adminMessage =
      action === 'approve'
        ? `✅ <b>ОБЪЯВЛЕНИЕ ОДОБРЕНО</b>\n\n📍 ${finalTitle}\n👤 ${listing.owner?.first_name || ''} ${listing.owner?.last_name || ''}\n📧 ${listing.owner?.email || ''}`
        : `❌ <b>ОБЪЯВЛЕНИЕ ОТКЛОНЕНО</b>\n\n📍 ${listing.title}\n👤 ${listing.owner?.first_name || ''}\n📝 Причина: ${rejectReason?.substring(0, 100)}`

    try {
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: ADMIN_TOPIC_ID,
          message_thread_id: LISTINGS_THREAD_ID,
          text: adminMessage,
          parse_mode: 'HTML',
        }),
      })
    } catch (e) {
      console.error('Admin topic error:', e)
    }

    return NextResponse.json({
      success: true,
      action,
      listingId,
      notificationSent,
      title: finalTitle,
      description: finalDescription,
    })
  } catch (error) {
    console.error('Moderation PATCH error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
