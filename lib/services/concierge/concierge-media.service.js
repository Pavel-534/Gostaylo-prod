/**
 * ADR-210 Slice 4 — Concierge media rehost + Drive folder/view guards.
 * Reuses uploadExternalImageToStorage (listing-images); pathMode=concierge.
 */

import { supabaseAdmin } from '@/lib/supabase'
import {
  CONCIERGE_IMAGE_MIME_ALLOWLIST,
  isHostedListingImageUrl,
  uploadExternalImageToStorage,
} from '@/lib/services/external-image-storage'
import { listingImagesContainExternalUrls } from '@/lib/listing-image-host-utils'

/**
 * Google Drive folder / file-view links are not direct image bytes.
 * Ops must materialize HTTPS image URLs first (see CONCIERGE_DRIVE_MEDIA_PLAYBOOK).
 *
 * @param {string} raw
 * @returns {boolean}
 */
export function isGoogleDriveFolderOrViewUrl(raw) {
  const url = String(raw || '').trim()
  if (!url) return false
  let host = ''
  let pathname = ''
  let search = ''
  try {
    const u = new URL(url)
    host = u.hostname.toLowerCase()
    pathname = u.pathname.toLowerCase()
    search = u.search.toLowerCase()
  } catch {
    return /drive\.google\.com/i.test(url)
  }
  if (!host.includes('drive.google.com') && !host.includes('docs.google.com')) {
    return false
  }
  // Direct export/download may be usable later — not treated as folder/view skip for ingest filter
  if (search.includes('export=download') || pathname.includes('/uc')) {
    return false
  }
  if (pathname.includes('/folders/') || pathname.includes('/drive/folders')) return true
  if (pathname.includes('/file/d/') && pathname.includes('/view')) return true
  if (pathname.includes('/open') || search.includes('usp=sharing')) {
    // open?id= without export — treat as non-image view
    return true
  }
  if (host.includes('docs.google.com') && pathname.includes('/document')) return true
  return pathname.includes('/view') || pathname.endsWith('/view')
}

/**
 * Split raw image inputs into HTTPS file URLs vs Drive warnings vs rejects.
 *
 * @param {unknown} images
 * @returns {{ images: string[], mediaWarnings: Array<{ url: string, code: string, message: string }> }}
 */
export function filterConciergeImagesWithDriveGuard(images) {
  const out = []
  const mediaWarnings = []
  if (!Array.isArray(images)) return { images: out, mediaWarnings }

  for (const raw of images) {
    const url = String(raw || '').trim()
    if (!url) continue
    if (isGoogleDriveFolderOrViewUrl(url)) {
      mediaWarnings.push({
        url,
        code: 'DRIVE_FOLDER_OR_VIEW',
        message:
          'Google Drive folder/view links are skipped. Materialize direct HTTPS image URLs (ops playbook).',
      })
      continue
    }
    if (!/^https:\/\//i.test(url)) {
      mediaWarnings.push({
        url,
        code: 'NON_HTTPS_IMAGE',
        message: 'Only https:// image URLs are accepted for Concierge ingest',
      })
      continue
    }
    out.push(url)
  }
  return { images: out, mediaWarnings }
}

/**
 * Upload one external URL into listing-images/concierge/{id}/{hash}.ext
 */
export async function uploadConciergeExternalImage(url, listingId, opts = {}) {
  return uploadExternalImageToStorage(url, listingId, {
    pathMode: 'concierge',
    allowedContentTypes: CONCIERGE_IMAGE_MIME_ALLOWLIST,
    fetchImpl: opts.fetchImpl,
    storageClient: opts.storageClient,
    timeoutMs: opts.timeoutMs,
  })
}

/**
 * Rehost images for a single listing row. Per-URL failures keep original URL.
 *
 * @param {{ id: string, images?: string[]|null, cover_image?: string|null }} listing
 * @param {{
 *   force?: boolean,
 *   db?: import('@supabase/supabase-js').SupabaseClient,
 *   uploadFn?: typeof uploadConciergeExternalImage,
 * }} [opts]
 */
export async function rehostConciergeListingImages(listing, opts = {}) {
  const listingId = String(listing?.id || '').trim()
  if (!listingId) {
    return {
      ok: false,
      listingId: null,
      updated: false,
      updatedImagesCount: 0,
      errors: [{ listingId: null, url: null, error: 'listingId required' }],
    }
  }

  const input = Array.isArray(listing.images) ? listing.images.filter((u) => typeof u === 'string' && u.trim()) : []
  const driveSkipped = []
  const workUrls = []
  for (const url of input) {
    if (isGoogleDriveFolderOrViewUrl(url)) {
      driveSkipped.push({
        listingId,
        url,
        error: 'DRIVE_FOLDER_OR_VIEW',
        code: 'DRIVE_FOLDER_OR_VIEW',
      })
      continue
    }
    workUrls.push(url)
  }

  if (!opts.force && !listingImagesContainExternalUrls(workUrls)) {
    return {
      ok: true,
      listingId,
      updated: false,
      updatedImagesCount: 0,
      skipped: true,
      errors: driveSkipped,
      images: workUrls,
    }
  }

  const uploadFn = opts.uploadFn || uploadConciergeExternalImage
  const nextImages = []
  const errors = [...driveSkipped]
  let updatedImagesCount = 0

  for (const original of workUrls) {
    if (isHostedListingImageUrl(original)) {
      nextImages.push(original)
      continue
    }
    if (!/^https:\/\//i.test(original)) {
      nextImages.push(original)
      errors.push({ listingId, url: original, error: 'NON_HTTPS', code: 'NON_HTTPS' })
      continue
    }

    try {
      const result = await uploadFn(original, listingId, opts)
      if (result.success && result.url) {
        nextImages.push(result.url)
        updatedImagesCount += 1
      } else {
        nextImages.push(original)
        errors.push({
          listingId,
          url: original,
          error: result.error || 'upload failed',
          code: 'REHOST_FAILED',
        })
        console.warn('[concierge-media] rehost failed', listingId, original, result.error)
      }
    } catch (e) {
      nextImages.push(original)
      errors.push({
        listingId,
        url: original,
        error: e?.message || String(e),
        code: 'REHOST_EXCEPTION',
      })
      console.warn('[concierge-media] rehost exception', listingId, original, e?.message)
    }
  }

  const changed =
    updatedImagesCount > 0 ||
    JSON.stringify(nextImages) !== JSON.stringify(workUrls) ||
    driveSkipped.length > 0

  if (!changed && errors.length === driveSkipped.length) {
    return {
      ok: true,
      listingId,
      updated: false,
      updatedImagesCount: 0,
      errors,
      images: nextImages,
    }
  }

  const db = opts.db || supabaseAdmin
  if (!db) {
    return {
      ok: false,
      listingId,
      updated: false,
      updatedImagesCount: 0,
      errors: [...errors, { listingId, url: null, error: 'Supabase not configured' }],
      images: nextImages,
    }
  }

  const cover = nextImages[0] || listing.cover_image || null
  const { error: updErr } = await db
    .from('listings')
    .update({
      images: nextImages,
      cover_image: cover,
      updated_at: new Date().toISOString(),
    })
    .eq('id', listingId)

  if (updErr) {
    return {
      ok: false,
      listingId,
      updated: false,
      updatedImagesCount: 0,
      errors: [...errors, { listingId, url: null, error: updErr.message }],
      images: nextImages,
    }
  }

  return {
    ok: true,
    listingId,
    updated: true,
    updatedImagesCount,
    errors,
    images: nextImages,
  }
}

/**
 * Batch rehost for Concierge listings.
 *
 * @param {{
 *   listingId?: string,
 *   batchId?: string,
 *   listingIds?: string[],
 *   force?: boolean,
 *   db?: import('@supabase/supabase-js').SupabaseClient,
 *   uploadFn?: typeof uploadConciergeExternalImage,
 *   fetchImpl?: typeof fetch,
 *   storageClient?: import('@supabase/supabase-js').SupabaseClient,
 * }} input
 */
export async function rehostConciergeMedia(input = {}) {
  const db = input.db || supabaseAdmin
  if (!db) {
    return {
      ok: false,
      status: 503,
      code: 'SUPABASE_NOT_CONFIGURED',
      error: 'Supabase not configured',
      processedListings: 0,
      updatedImagesCount: 0,
      errors: [],
    }
  }

  const listingId = input.listingId ? String(input.listingId).trim() : ''
  const batchId = input.batchId ? String(input.batchId).trim() : ''
  const explicitIds = Array.isArray(input.listingIds)
    ? input.listingIds.map((id) => String(id).trim()).filter(Boolean)
    : []

  if (!listingId && !batchId && explicitIds.length === 0) {
    return {
      ok: false,
      status: 400,
      code: 'VALIDATION_ERROR',
      error: 'listingId or batchId required',
      processedListings: 0,
      updatedImagesCount: 0,
      errors: [],
    }
  }

  /** @type {string[]} */
  let targetIds = []

  if (listingId) {
    targetIds = [listingId]
  } else if (explicitIds.length) {
    targetIds = [...new Set(explicitIds)]
  } else {
    const { data: batch, error: batchErr } = await db
      .from('concierge_import_batches')
      .select('id, metadata')
      .eq('id', batchId)
      .maybeSingle()

    if (batchErr) {
      return {
        ok: false,
        status: 500,
        code: 'DB_ERROR',
        error: batchErr.message,
        processedListings: 0,
        updatedImagesCount: 0,
        errors: [],
      }
    }
    if (!batch?.id) {
      return {
        ok: false,
        status: 404,
        code: 'BATCH_NOT_FOUND',
        error: 'Import batch not found',
        processedListings: 0,
        updatedImagesCount: 0,
        errors: [],
      }
    }

    const metaIds =
      batch.metadata &&
      typeof batch.metadata === 'object' &&
      Array.isArray(batch.metadata.listing_ids)
        ? batch.metadata.listing_ids.map((id) => String(id)).filter(Boolean)
        : []

    if (metaIds.length) {
      targetIds = metaIds
    } else {
      const { data: rows, error: listErr } = await db
        .from('listings')
        .select('id')
        .eq('concierge_batch_id', batchId)
        .limit(500)
      if (listErr) {
        return {
          ok: false,
          status: 500,
          code: 'DB_ERROR',
          error: listErr.message,
          processedListings: 0,
          updatedImagesCount: 0,
          errors: [],
        }
      }
      targetIds = (Array.isArray(rows) ? rows : []).map((r) => String(r.id))
    }
  }

  if (!targetIds.length) {
    return {
      ok: true,
      status: 200,
      processedListings: 0,
      updatedImagesCount: 0,
      errors: [],
      mediaWarnings: [],
    }
  }

  const { data: listings, error: fetchErr } = await db
    .from('listings')
    .select('id, images, cover_image, concierge_batch_id, metadata')
    .in('id', targetIds)

  if (fetchErr) {
    return {
      ok: false,
      status: 500,
      code: 'DB_ERROR',
      error: fetchErr.message,
      processedListings: 0,
      updatedImagesCount: 0,
      errors: [],
    }
  }

  const rows = Array.isArray(listings) ? listings : []
  let processedListings = 0
  let updatedImagesCount = 0
  /** @type {Array<{ listingId?: string|null, url?: string|null, error: string, code?: string }>} */
  const errors = []
  const mediaWarnings = []

  for (const row of rows) {
    const result = await rehostConciergeListingImages(row, {
      force: input.force === true,
      db,
      uploadFn: input.uploadFn,
      fetchImpl: input.fetchImpl,
      storageClient: input.storageClient,
    })
    processedListings += 1
    updatedImagesCount += result.updatedImagesCount || 0
    if (Array.isArray(result.errors) && result.errors.length) {
      for (const e of result.errors) {
        if (e.code === 'DRIVE_FOLDER_OR_VIEW') {
          mediaWarnings.push(e)
        } else {
          errors.push(e)
        }
      }
    }
  }

  if (batchId) {
    try {
      const { data: batchRow } = await db
        .from('concierge_import_batches')
        .select('metadata')
        .eq('id', batchId)
        .maybeSingle()
      const prev =
        batchRow?.metadata && typeof batchRow.metadata === 'object' ? batchRow.metadata : {}
      const prevWarnings = Array.isArray(prev.media_warnings) ? prev.media_warnings : []
      await db
        .from('concierge_import_batches')
        .update({
          metadata: {
            ...prev,
            media_warnings: [...prevWarnings, ...mediaWarnings],
            rehost: {
              at: new Date().toISOString(),
              processedListings,
              updatedImagesCount,
              errorCount: errors.length,
            },
          },
        })
        .eq('id', batchId)
    } catch (e) {
      console.warn('[concierge-media] batch metadata update failed', e?.message)
    }
  }

  return {
    ok: true,
    status: 200,
    processedListings,
    updatedImagesCount,
    errors,
    mediaWarnings,
  }
}
