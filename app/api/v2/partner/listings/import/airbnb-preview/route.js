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

// ─── URL normalisation ────────────────────────────────────────────────────────

/**
 * Очищает ссылку Airbnb: убирает query-параметры, hash, нормализует поддомен.
 *   ru.airbnb.com → www.airbnb.com
 *   airbnb.ru     → www.airbnb.com
 * Возвращает чистую строку или null если разобрать не удалось.
 */
function normalizeAirbnbUrl(raw) {
  let u
  try {
    u = new URL(raw.trim())
  } catch {
    return null
  }
  if (!['https:', 'http:'].includes(u.protocol)) return null

  // hostname.includes('airbnb.') — работает для любого поддомена и TLD
  if (/airbnb\./i.test(u.hostname)) {
    u.hostname = 'www.airbnb.com'
    u.protocol = 'https:'
  }

  u.search = ''
  u.hash = ''
  return u.toString()
}

/** Проверяет, что строка похожа на URL объявления Airbnb (содержит /rooms/ или /h/) */
function looksLikeAirbnbListingUrl(url) {
  try {
    const u = new URL(url)
    return /airbnb\./i.test(u.hostname) && (/\/rooms\/\d+/.test(u.pathname) || /\/h\/[a-z0-9_-]+/i.test(u.pathname))
  } catch {
    return false
  }
}

// ─── Validation ───────────────────────────────────────────────────────────────

const bodySchema = z.object({
  /** Raw URL from partner — will be normalised before use */
  url: z.string().min(1),
  /**
   * ID категории из БД.
   * В нашей БД категории хранятся с текстовыми ID вида 'cat-property',
   * поэтому НЕ используем .uuid() — принимаем любую непустую строку.
   */
  categoryId: z.string().min(1),
  basePriceThbFallback: z.number().nonnegative().optional(),
  /** listingId остаётся UUID — это реальный UUID из таблицы listings */
  listingId: z.string().uuid().optional(),
  migrateImagesToStorage: z.boolean().optional(),
})

/** Человекочитаемая ошибка для каждого поля (сервер возвращает в поле error) */
function friendlyValidationError(zodError) {
  const issues = zodError.issues || []
  for (const issue of issues) {
    const field = issue.path[0]
    if (field === 'url') {
      return {
        error: 'Ссылка на объявление не распознана. Убедитесь, что вставили корректный URL.',
        error_en: 'Listing URL is invalid. Please paste a correct listing link.',
        field: 'url',
      }
    }
    if (field === 'categoryId') {
      return {
        error: 'Пожалуйста, выберите категорию объекта перед импортом.',
        error_en: 'Please select a listing category before importing.',
        field: 'categoryId',
      }
    }
  }
  return {
    error: 'Неверные параметры запроса. Проверьте форму и попробуйте снова.',
    error_en: 'Invalid request parameters. Check the form and try again.',
    field: null,
  }
}

// ─── Preview shape ────────────────────────────────────────────────────────────

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

// ─── Handler ──────────────────────────────────────────────────────────────────

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

  // ── Нормализуем URL до валидации ─────────────────────────────────────────
  if (json && typeof json.url === 'string') {
    const clean = normalizeAirbnbUrl(json.url)
    if (clean) {
      json = { ...json, url: clean }
    }
  }

  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    const friendly = friendlyValidationError(parsed.error)
    return NextResponse.json(
      { success: false, ...friendly, details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { url, categoryId, basePriceThbFallback, listingId, migrateImagesToStorage } = parsed.data

  // ── Дополнительная проверка: ссылка должна быть Airbnb листингом ─────────
  if (!looksLikeAirbnbListingUrl(url)) {
    return NextResponse.json(
      {
        success: false,
        error: 'Ссылка не похожа на объявление Airbnb. Скопируйте URL со страницы объявления вида airbnb.com/rooms/…',
        error_en: 'URL does not look like an Airbnb listing. Copy the URL from a listing page (airbnb.com/rooms/…).',
        field: 'url',
      },
      { status: 400 }
    )
  }

  try {
    const { raw, source } = await fetchAirbnbListingRaw(url)
    const normalized = normalizeAirbnbPayloadForMapper(raw, url)
    const { row, warnings } = mapExternalToInternal(normalized, 'airbnb', {
      ownerId: userId,
      categoryId,
      basePriceThbFallback,
    })

    const parserWarnings = []
    if (!row.images?.length) parserWarnings.push('Фотографии не извлечены — добавьте их вручную.')
    if (row.base_price_thb === 0) parserWarnings.push('Цена не определена — укажите стоимость в батах перед публикацией.')

    let imageMigration = null
    if (listingId && migrateImagesToStorage && row.images?.length) {
      if (!supabaseAdmin) {
        parserWarnings.push('Перенос фото пропущен: хранилище не настроено на сервере.')
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
          parserWarnings.push(`Ошибка переноса фото в хранилище: ${upErr.message}`)
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
      /** Используемый (нормализованный) URL — полезен для отладки */
      normalizedUrl: url,
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
          error: 'Импорт не настроен на сервере. Обратитесь к администратору.',
          error_en: msg,
          hint: 'Set APIFY_TOKEN in production, or ENABLE_AIRBNB_PLAYWRIGHT=1 on a Node server with Playwright browsers installed.',
        },
        { status: 503 }
      )
    }
    // Airbnb URL parse error
    if (msg.includes('airbnb') || msg.includes('rooms') || msg.includes('URL')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Ссылка на Airbnb не распознана. Скопируйте URL прямо со страницы объявления.',
          error_en: msg,
          field: 'url',
        },
        { status: 422 }
      )
    }
    console.error('[airbnb-preview]', msg)
    return NextResponse.json({ success: false, error: msg }, { status: 422 })
  }
}
