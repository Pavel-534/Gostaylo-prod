/**
 * SSOT серверной обработки растровых изображений (sharp → WebP).
 * Stage 95.2 — main + один lightweight thumbnail (`thumb_*.webp`) за один decode.
 */

import {
  MEDIA_PROFILE_IDS,
  MEDIA_PROFILES,
  logMediaProfile,
  resolveMediaProfileId,
  isRasterImageMime,
} from '@/lib/services/media/media-profiles'

export {
  MEDIA_PROFILE_IDS,
  MEDIA_PROFILES,
  logMediaProfile,
  resolveMediaProfileId,
  isRasterImageMime,
}

/** Профили, для которых пишем `thumb_*` рядом с main (экономия CPU — не для KYC/PDF). */
export const THUMB_ENABLED_PROFILES = new Set(['listing_photo', 'avatar', 'chat_image'])

/** Один thumbnail: fit inside 600×400, WebP ~78%. */
export const THUMBNAIL_PROFILE = Object.freeze({
  width: 600,
  height: 400,
  quality: 0.78,
})

/** @deprecated use THUMBNAIL_PROFILE */
export const MEDIA_VARIANTS = Object.freeze({
  thumb: { maxDimension: 400, quality: 0.76 },
})

export function shouldGenerateThumb(profileId) {
  return THUMB_ENABLED_PROFILES.has(profileId)
}

export { buildThumbStoragePath, isThumbStoragePath } from './storage-path-utils'

/**
 * @param {Buffer} buffer
 * @param {{ maxDimension?: number, quality?: number, width?: number, height?: number }} profile
 */
async function runSharpWebp(buffer, profile) {
  const sharpMod = await import('sharp')
  const sharp = sharpMod.default || sharpMod
  let pipe = sharp(Buffer.from(buffer)).rotate()
  if (profile.width && profile.height) {
    pipe = pipe.resize(profile.width, profile.height, {
      fit: 'inside',
      withoutEnlargement: true,
    })
  } else {
    const dim = profile.maxDimension || 1920
    pipe = pipe.resize(dim, dim, { fit: 'inside', withoutEnlargement: true })
  }
  const q = Math.min(100, Math.max(1, Math.round((profile.quality ?? 0.8) * 100)))
  return pipe.webp({ quality: q }).toBuffer()
}

/**
 * @param {Buffer} buffer
 * @param {string} profileId
 * @returns {Promise<{ ok: true, buffer: Buffer } | { ok: false, error: string }>}
 */
export async function processImageBufferToWebp(buffer, profileId) {
  const id = MEDIA_PROFILE_IDS.includes(profileId) ? profileId : 'listing_photo'
  const profile = MEDIA_PROFILES[id]
  const startSize = buffer.length
  try {
    const out = await runSharpWebp(buffer, profile)
    const endSize = out.length
    const ratio = startSize ? ((1 - endSize / startSize) * 100).toFixed(1) : '0'
    console.log(
      `[IMAGE_PROCESSOR] ${id}: ${(startSize / 1024).toFixed(1)}KB → ${(endSize / 1024).toFixed(1)}KB (-${ratio}%)`,
    )
    return { ok: true, buffer: out }
  } catch (e) {
    const msg = e?.message || String(e)
    console.error('[IMAGE_PROCESSOR] sharp failed:', msg)
    return { ok: false, error: msg }
  }
}

/**
 * Main WebP + thumb за один decode (clone pipeline).
 * @param {Buffer} buffer
 * @param {string} profileId
 */
export async function processImageMainAndThumb(buffer, profileId) {
  const id = MEDIA_PROFILE_IDS.includes(profileId) ? profileId : 'listing_photo'
  const mainProfile = MEDIA_PROFILES[id]
  const startSize = buffer.length
  try {
    const sharpMod = await import('sharp')
    const sharp = sharpMod.default || sharpMod
    const base = sharp(Buffer.from(buffer)).rotate()

    const main = await base
      .clone()
      .resize(mainProfile.maxDimension, mainProfile.maxDimension, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: Math.round(mainProfile.quality * 100) })
      .toBuffer()

    const thumb = await base
      .clone()
      .resize(THUMBNAIL_PROFILE.width, THUMBNAIL_PROFILE.height, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: Math.round(THUMBNAIL_PROFILE.quality * 100) })
      .toBuffer()

    const mainKb = (main.length / 1024).toFixed(1)
    const thumbKb = (thumb.length / 1024).toFixed(1)
    console.log(
      `[IMAGE_PROCESSOR] ${id}+thumb: ${(startSize / 1024).toFixed(1)}KB → main ${mainKb}KB, thumb ${thumbKb}KB`,
    )
    return { ok: true, main, thumb }
  } catch (e) {
    const msg = e?.message || String(e)
    console.error('[IMAGE_PROCESSOR] main+thumb failed:', msg)
    return { ok: false, error: msg }
  }
}

/**
 * @param {Buffer} buffer
 * @param {string} profileId
 * @param {{ variants?: string[] }} [opts]
 */
export async function processImageWithVariants(buffer, profileId, opts = {}) {
  if (shouldGenerateThumb(profileId) && !(opts.variants?.length)) {
    const dual = await processImageMainAndThumb(buffer, profileId)
    if (!dual.ok) return dual
    return { ok: true, main: dual.main, variants: { thumb: dual.thumb } }
  }

  const main = await processImageBufferToWebp(buffer, profileId)
  if (!main.ok) return main

  const variantIds = Array.isArray(opts.variants) ? opts.variants : []
  const variants = {}
  for (const vid of variantIds) {
    const vp = MEDIA_VARIANTS[vid]
    if (!vp) continue
    try {
      variants[vid] = await runSharpWebp(buffer, {
        maxDimension: vp.maxDimension,
        quality: vp.quality,
      })
    } catch (e) {
      console.warn(`[IMAGE_PROCESSOR] variant ${vid}:`, e?.message || e)
    }
  }
  return { ok: true, main: main.buffer, variants }
}

export async function compressImageBufferTelegramListing(inputBuffer) {
  const buf = Buffer.isBuffer(inputBuffer) ? inputBuffer : Buffer.from(inputBuffer)
  const res = await processImageMainAndThumb(buf, 'listing_photo')
  if (!res.ok) {
    const fallback = await processImageBufferToWebp(buf, 'listing_photo')
    return fallback.ok ? fallback.buffer : buf
  }
  return res.main
}

/** @deprecated — use buildThumbStoragePath */
export function buildVariantStoragePath(storagePath, variantId) {
  if (variantId === 'thumb') return buildThumbStoragePath(storagePath)
  const s = String(storagePath || '').replace(/^\/+/, '')
  if (!s) return s
  const base = s.replace(/\.[^./\\]+$/i, '')
  return `${base}_${variantId}.webp`
}
