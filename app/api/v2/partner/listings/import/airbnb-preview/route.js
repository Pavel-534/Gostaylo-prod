/**
 * POST /api/v2/partner/listings/import/airbnb-preview
 * Парсит публичный URL Airbnb (Apify или Playwright), маппит в строку listings, возвращает preview без записи в БД.
 *
 * Env:
 * - APIFY_TOKEN + опционально APIFY_AIRBNB_ACTOR_ID (default epctex~airbnb-scraper), APIFY_AIRBNB_INPUT_JSON
 * - или ENABLE_AIRBNB_PLAYWRIGHT=1 (только self-hosted / Docker с Chromium)
 */

export const runtime = 'nodejs'
export const maxDuration = 120
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getUserIdFromSession, verifyPartnerAccess } from '@/lib/services/session-service'
import { rateLimitCheck } from '@/lib/rate-limit'
import { mapExternalToInternal } from '@/lib/listings/map-external-to-internal'
import { fetchAirbnbListingRaw, normalizeAirbnbPayloadForMapper } from '@/lib/listings/airbnb-parser'
import { supabaseAdmin } from '@/lib/supabase'
import { migrateListingExternalImages } from '@/lib/services/external-image-storage'

const bodySchema = z.object({
  url: z.string().url(),
  categoryId: z.string().uuid(),
  basePriceThbFallback: z.number().nonnegative().optional(),
  /** Если задано вместе с migrateImagesToStorage — после парсинга только колонка images обновляется в БД */
  listingId: z.string().uuid().optional(),
  migrateImagesToStorage: z.boolean().optional(),
})

function toPreview(row, categoryId) {
  return {
    title: row.title,
    description: row.description,
    basePriceThb: row.base_price_thb,
    district: row.district,
    latitude: row.latitude,
    longitude: row.longitude,
    images: row.images,
    coverImage: row.cover_image,
    categoryId,
    metadata: row.metadata,
    syncSettings: row.sync_settings,
    importPlatform: row.import_platform,
    importExternalId: row.import_external_id,
    importExternalUrl: row.import_external_url,
    lastImportedAt: row.last_imported_at,
    status: row.status,
    available: row.available,
    commissionRate: row.commission_rate,
  }
}

export async function POST(request) {
  const limited = rateLimitCheck(request, 'partner_import')
  if (limited) {
    return NextResponse.json(limited.body, { status: limited.status, headers: limited.headers })
  }

  const userId = await getUserIdFromSession()
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const partner = await verifyPartnerAccess(userId)
  if (!partner) {
    return NextResponse.json({ success: false, error: 'Partner access required' }, { status: 403 })
  }

  let json
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { url, categoryId, basePriceThbFallback, listingId, migrateImagesToStorage } = parsed.data

  try {
    const { raw, source } = await fetchAirbnbListingRaw(url)
    const normalized = normalizeAirbnbPayloadForMapper(raw, url.split('?')[0])
    const { row, warnings } = mapExternalToInternal(normalized, 'airbnb', {
      ownerId: userId,
      categoryId,
      basePriceThbFallback,
    })

    const parserWarnings = []
    if (!row.images?.length) parserWarnings.push('No photos extracted — add images manually.')
    if (row.base_price_thb === 0) parserWarnings.push('Price missing or zero — set THB price before publish.')

    let imageMigration = null
    if (listingId && migrateImagesToStorage && row.images?.length) {
      if (!supabaseAdmin) {
        parserWarnings.push('migrateImagesToStorage skipped: server storage not configured')
      } else {
        const { data: existing, error: exErr } = await supabaseAdmin
          .from('listings')
          .select('id, owner_id')
          .eq('id', listingId)
          .single()
        if (exErr || !existing || String(existing.owner_id) !== String(userId)) {
          return NextResponse.json({ success: false, error: 'Listing not found or access denied' }, { status: 403 })
        }
        const { images: migratedImages, migrated, failed, details } = await migrateListingExternalImages(
          listingId,
          row.images
        )
        const { error: upErr } = await supabaseAdmin
          .from('listings')
          .update({
            images: migratedImages,
            updated_at: new Date().toISOString(),
          })
          .eq('id', listingId)
        if (upErr) {
          console.error('[airbnb-preview] images migrate update:', upErr)
          parserWarnings.push(`Image storage update failed: ${upErr.message}`)
        } else {
          row.images = migratedImages
          row.cover_image = migratedImages[0] ?? row.cover_image
          imageMigration = { migrated, failed, details }
        }
      }
    }

    return NextResponse.json({
      success: true,
      source,
      warnings: [...parserWarnings, ...warnings],
      preview: toPreview(row, categoryId),
      imageMigration,
      /** Готовый payload для insert (snake_case); owner_id уже текущий партнёр */
      suggestedInsert: {
        owner_id: row.owner_id,
        category_id: row.category_id,
        title: row.title,
        description: row.description,
        district: row.district,
        base_price_thb: row.base_price_thb,
        latitude: row.latitude,
        longitude: row.longitude,
        images: row.images,
        cover_image: row.cover_image,
        metadata: row.metadata,
        sync_settings: row.sync_settings,
        import_platform: row.import_platform,
        import_external_id: row.import_external_id,
        import_external_url: row.import_external_url,
        last_imported_at: row.last_imported_at,
        status: row.status,
        available: row.available,
        commission_rate: row.commission_rate,
      },
    })
  } catch (e) {
    const code = e?.code
    const msg = e?.message || String(e)
    if (code === 'IMPORT_NOT_CONFIGURED') {
      return NextResponse.json(
        {
          success: false,
          error: msg,
          hint: 'Set APIFY_TOKEN in production, or ENABLE_AIRBNB_PLAYWRIGHT=1 on a Node server with Playwright browsers installed.',
        },
        { status: 503 }
      )
    }
    console.error('[airbnb-preview]', msg)
    return NextResponse.json({ success: false, error: msg }, { status: 422 })
  }
}
