/**
 * ADR-210 Slice 6 — dry-run Concierge payload validation (no DB writes).
 */

import { applyMappingProfile, resolveMappingProfileOrError } from './index.js'
import { isHostedListingImageUrl } from '@/lib/listing-image-host-utils'
import { isGoogleDriveFolderOrViewUrl } from '@/lib/services/concierge/concierge-media.service.js'

const HEAD_TIMEOUT_MS = 8000

/**
 * Soft check that HTTPS image URL responds (HEAD, then GET Range if needed).
 * Failures become warnings — do not block valid:true if structure is ok.
 *
 * @param {string} url
 * @param {{ fetchImpl?: typeof fetch, timeoutMs?: number }} [opts]
 */
export async function probeHttpsImageUrl(url, opts = {}) {
  const fetchImpl = opts.fetchImpl || fetch
  const timeoutMs = Number.isFinite(opts.timeoutMs) ? opts.timeoutMs : HEAD_TIMEOUT_MS

  if (isHostedListingImageUrl(url)) {
    return { ok: true, skipped: true }
  }
  if (isGoogleDriveFolderOrViewUrl(url)) {
    return { ok: false, error: 'DRIVE_FOLDER_OR_VIEW' }
  }
  if (!/^https:\/\//i.test(url)) {
    return { ok: false, error: 'NON_HTTPS' }
  }

  try {
    const ac = new AbortController()
    const t = setTimeout(() => ac.abort(), timeoutMs)
    try {
      let res = await fetchImpl(url, {
        method: 'HEAD',
        redirect: 'follow',
        signal: ac.signal,
      })
      if (res.status === 405 || res.status === 403 || res.status === 501) {
        res = await fetchImpl(url, {
          method: 'GET',
          redirect: 'follow',
          signal: ac.signal,
          headers: { Range: 'bytes=0-0', Accept: 'image/*,*/*;q=0.8' },
        })
      }
      if (!res.ok && res.status !== 206) {
        return { ok: false, error: `HTTP ${res.status}` }
      }
      const ct = String(res.headers.get('content-type') || '').toLowerCase()
      if (ct && !ct.startsWith('image/') && !ct.includes('octet-stream')) {
        return { ok: false, error: `Not image MIME: ${ct}` }
      }
      return { ok: true }
    } finally {
      clearTimeout(t)
    }
  } catch (e) {
    const msg = e?.name === 'AbortError' ? 'timeout' : e?.message || 'fetch failed'
    return { ok: false, error: msg }
  }
}

/**
 * @param {{
 *   mappingProfile?: string,
 *   listings?: object[],
 *   rateToThb?: Record<string, number>,
 *   checkImageUrls?: boolean,
 *   fetchImpl?: typeof fetch,
 * }} input
 */
export async function validateConciergePayload(input = {}) {
  const resolved = resolveMappingProfileOrError(input.mappingProfile)
  if (!resolved.ok) {
    return {
      ok: false,
      status: 400,
      valid: false,
      code: resolved.code,
      error: resolved.error,
      summary: { totalListings: 0, totalSeasons: 0, warnings: [], errors: [] },
    }
  }

  const listingsIn = Array.isArray(input.listings) ? input.listings : null
  if (!listingsIn || listingsIn.length === 0) {
    return {
      ok: false,
      status: 400,
      valid: false,
      code: 'VALIDATION_ERROR',
      error: 'listings array required',
      summary: { totalListings: 0, totalSeasons: 0, warnings: [], errors: [] },
    }
  }

  const mapped = applyMappingProfile(input.mappingProfile, listingsIn, {
    rateToThb: input.rateToThb,
  })

  if (!mapped.ok) {
    return {
      ok: true,
      status: 200,
      valid: false,
      mappingProfile: mapped.profileId || resolved.profile.id,
      summary: {
        totalListings: listingsIn.length,
        totalSeasons: 0,
        warnings: mapped.warnings || [],
        errors: mapped.errors || [],
      },
    }
  }

  const warnings = [...(mapped.warnings || [])]
  let totalSeasons = 0
  for (const listing of mapped.listings) {
    totalSeasons += Array.isArray(listing.seasons) ? listing.seasons.length : 0
  }

  const checkImages = input.checkImageUrls !== false
  if (checkImages) {
    const seen = new Set()
    for (const listing of mapped.listings) {
      const images = Array.isArray(listing.images) ? listing.images : []
      for (const url of images) {
        if (seen.has(url)) continue
        seen.add(url)
        const probe = await probeHttpsImageUrl(url, { fetchImpl: input.fetchImpl })
        if (!probe.ok) {
          warnings.push({
            externalId: listing.externalId,
            code: 'IMAGE_URL_UNREACHABLE',
            message: `Фото недоступно (${probe.error}): ${url}`,
            url,
            field: 'images',
          })
        }
      }
    }
  }

  return {
    ok: true,
    status: 200,
    valid: true,
    mappingProfile: mapped.profileId,
    listings: mapped.listings,
    summary: {
      totalListings: mapped.listings.length,
      totalSeasons,
      warnings,
      errors: [],
    },
  }
}
