/**
 * Admin Moderation API
 * GET — pending listings (без черновиков)
 * PATCH — approve | reject | set_featured | update;
 *   approve/update: опционально title, description, district, basePriceThb, metadata (нормализация SSOT).
 *   update — правки без смены статуса (только PENDING).
 */

import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { toPublicImageUrl, mapPublicImageUrls } from '@/lib/public-image-url'
import { resolveDefaultCommissionPercent } from '@/lib/services/currency.service'
import { normalizePartnerListingMetadata } from '@/lib/partner/listing-wizard-metadata'
import { recordTeammateNewListingIfFirst } from '@/lib/referral/referral-feed-recorder'
import { requireAdminStaff } from '@/lib/security/admin-staff-access'
import { recordStaffListingModeration } from '@/lib/services/audit/staff-audit'
import { NotificationService, NotificationEvents } from '@/lib/services/notification.service'
import { sendToAdminTopic } from '@/lib/services/notifications/telegram.service.js'
import {
  buildModerationFacets,
  filterPendingModerationListings,
} from '@/lib/admin/moderation-queue.js'
import { readSystemSettingValue } from '@/lib/admin/system-settings-store'
import { buildListingPriceWriteFields } from '@/lib/listing/listing-base-price-canon.js'

export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

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

/**
 * Apply optional content fields from moderation PATCH body onto updateData.
 * Stage 200.86 — price edits are L1 asset amounts in listing.base_currency (not raw ledger THB).
 * @param {Record<string, unknown>} updateData
 * @param {{ title?: unknown, description?: unknown, district?: unknown, basePriceThb?: unknown, metadata?: unknown }} body
 * @param {unknown} listing
 */
async function applyModerationContentFields(updateData, body, listing) {
  const { title, description, district, basePriceThb, metadata: metadataPatch } = body

  if (title !== undefined && title !== null) {
    const t = String(title).trim().slice(0, 255)
    if (t) updateData.title = t
  }
  if (description !== undefined && description !== null) {
    updateData.description = String(description).trim().slice(0, 50_000)
  }
  if (district !== undefined && district !== null) {
    updateData.district = String(district).trim().slice(0, 200)
  }

  let nextMeta =
    listing.metadata && typeof listing.metadata === 'object' && !Array.isArray(listing.metadata)
      ? { ...listing.metadata }
      : {}

  if (metadataPatch != null && typeof metadataPatch === 'object' && !Array.isArray(metadataPatch)) {
    const categorySlug = categorySlugFromListing(listing)
    const nameFb = String(listing.categories?.name || listing.categories?.[0]?.name || '')
    const merged = { ...nextMeta, ...metadataPatch }
    const catRow = listing?.categories
    const wp =
      (catRow && typeof catRow === 'object' && !Array.isArray(catRow)
        ? catRow.wizard_profile
        : Array.isArray(catRow)
          ? catRow[0]?.wizard_profile
          : null) ?? null
    nextMeta = normalizePartnerListingMetadata(merged, categorySlug, nameFb, wp)
    updateData.metadata = nextMeta
  }

  if (basePriceThb !== undefined && basePriceThb !== null && basePriceThb !== '') {
    const n = Number(basePriceThb)
    if (!Number.isFinite(n) || n < 0) {
      const err = new Error('basePriceThb must be a non-negative number')
      err.status = 400
      throw err
    }
    const currency = String(listing.base_currency || 'THB').toUpperCase()
    const priceWrite = await buildListingPriceWriteFields({
      assetAmount: n,
      currency,
      existingMetadata: updateData.metadata !== undefined ? updateData.metadata : nextMeta,
    })
    updateData.base_price_thb = priceWrite.base_price_thb
    updateData.metadata = priceWrite.metadata
  }
}

export async function GET(request) {
  const gate = await requireAdminStaff(request)
  if (gate.error) return gate.error

  const { searchParams } = new URL(request.url)
  const filters = {
    partnerQ: searchParams.get('partner') || '',
    categorySlug: searchParams.get('category') || '',
    dateFrom: searchParams.get('dateFrom') || '',
    dateTo: searchParams.get('dateTo') || '',
  }

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

    const baseListings = (rawListings || []).filter((listing) => listing.metadata?.is_draft !== true)
    const facets = buildModerationFacets(baseListings)
    const listings = filterPendingModerationListings(baseListings, filters)

    const generalSettings = (await readSystemSettingValue('general')) || {}
    const raw = parseFloat(generalSettings?.defaultCommissionRate)
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
      totalPending: baseListings.length,
      facets,
      filters,
    })
  } catch (error) {
    console.error('Moderation GET error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function PATCH(request) {
  const gate = await requireAdminStaff(request)
  if (gate.error) return gate.error

  try {
    const body = await request.json()
    const { listingId, action, rejectReason, isFeatured } = body

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
      void recordStaffListingModeration({
        actorId: gate.profile.id,
        actorRole: gate.profile.role,
        listingId,
        action: 'set_featured',
        listingTitle: listing.title,
        ownerId: listing.owner?.id,
        isFeatured,
      })
      return NextResponse.json({ success: true, action: 'set_featured', listingId, isFeatured })
    }

    let updateData = {}

    if (action === 'approve') {
      updateData = {
        status: 'ACTIVE',
        available: true,
        updated_at: timestamp,
      }
      await applyModerationContentFields(updateData, body, listing)
    } else if (action === 'update') {
      if (String(listing.status || '').toUpperCase() !== 'PENDING') {
        return NextResponse.json({ error: 'update only allowed for PENDING listings' }, { status: 400 })
      }
      updateData = { updated_at: timestamp }
      await applyModerationContentFields(updateData, body, listing)
      const contentKeys = Object.keys(updateData).filter((k) => k !== 'updated_at')
      if (contentKeys.length === 0) {
        return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
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
    const finalDistrict = updateData.district ?? listing.district
    const finalPrice =
      updateData.base_price_thb !== undefined ? updateData.base_price_thb : listing.base_price_thb

    if (action === 'update') {
      void recordStaffListingModeration({
        actorId: gate.profile.id,
        actorRole: gate.profile.role,
        listingId,
        action: 'update',
        listingTitle: finalTitle,
        ownerId: listing.owner?.id,
      })
      return NextResponse.json({
        success: true,
        action: 'update',
        listingId,
        title: finalTitle,
        description: finalDescription,
        district: finalDistrict,
        base_price_thb: finalPrice,
      })
    }

    if (action === 'approve') {
      void recordTeammateNewListingIfFirst(String(listingId)).catch((err) =>
        console.warn('[moderation] referral_team_events listing:', err?.message || err),
      )
      try {
        revalidatePath('/')
        revalidatePath('/listings')
        revalidatePath(`/listings/${listingId}`)
      } catch (revalErr) {
        console.warn('[moderation] revalidate:', revalErr?.message || revalErr)
      }
    }

    void recordStaffListingModeration({
      actorId: gate.profile.id,
      actorRole: gate.profile.role,
      listingId,
      action: action === 'approve' ? 'approve' : 'reject',
      listingTitle: finalTitle,
      ownerId: listing.owner?.id,
    })

    if (action === 'approve' || action === 'reject') {
      const partner = listing.owner
        ? {
            id: listing.owner.id,
            email: listing.owner.email,
            telegram_id: listing.owner.telegram_id,
            first_name: listing.owner.first_name,
            last_name: listing.owner.last_name,
          }
        : null
      const listingPayload = {
        id: listingId,
        title: action === 'approve' ? finalTitle : listing.title,
        description: finalDescription,
      }
      try {
        await NotificationService.dispatch(
          action === 'approve' ? NotificationEvents.LISTING_APPROVED : NotificationEvents.LISTING_REJECTED,
          {
            listing: listingPayload,
            partner,
            reason: action === 'reject' ? rejectReason : undefined,
          },
        )
        notificationSent = !!(partner?.telegram_id || partner?.email)
      } catch (notifyErr) {
        console.error('[moderation] partner notification:', notifyErr)
      }
    }

    const adminMessage =
      action === 'approve'
        ? `✅ <b>ОБЪЯВЛЕНИЕ ОДОБРЕНО</b>\n\n📍 ${finalTitle}\n👤 ${listing.owner?.first_name || ''} ${listing.owner?.last_name || ''}\n📧 ${listing.owner?.email || ''}`
        : `❌ <b>ОБЪЯВЛЕНИЕ ОТКЛОНЕНО</b>\n\n📍 ${listing.title}\n👤 ${listing.owner?.first_name || ''}\n📝 Причина: ${rejectReason?.substring(0, 100)}`

    try {
      // Stage 201.66 — use SSOT topic helper (env group + NEW_PARTNERS), not hardcoded chat/thread.
      await sendToAdminTopic('NEW_PARTNERS', adminMessage)
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
    const status = error?.status === 400 ? 400 : 500
    return NextResponse.json({ success: false, error: error.message }, { status })
  }
}
