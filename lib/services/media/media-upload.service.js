/**
 * Серверный медиа-пайплайн (sharp). Профили и MIME — re-export из `media-profiles.js`.
 * Клиент: только `compress-image-browser.js` + `POST /api/v2/upload` — не импортируйте этот файл в `'use client'`.
 */

import { MEDIA_PROFILE_IDS, MEDIA_PROFILES } from '@/lib/services/media/media-profiles'

export {
  MEDIA_PROFILE_IDS,
  MEDIA_PROFILES,
  logMediaProfile,
  resolveMediaProfileId,
  isRasterImageMime,
} from '@/lib/services/media/media-profiles'

/**
 * Сервер: ресайз + WebP через sharp.
 * @param {Buffer} buffer
 * @param {string} profileId
 * @returns {Promise<{ ok: true, buffer: Buffer } | { ok: false, error: string }>}
 */
export async function processImageBufferToWebp(buffer, profileId) {
  const id = MEDIA_PROFILE_IDS.includes(profileId) ? profileId : 'listing_photo'
  const profile = MEDIA_PROFILES[id]
  try {
    const sharpMod = await import('sharp')
    const sharp = sharpMod.default || sharpMod
    const out = await sharp(Buffer.from(buffer))
      .rotate()
      .resize(profile.maxDimension, profile.maxDimension, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: Math.min(100, Math.max(1, Math.round(profile.quality * 100))) })
      .toBuffer()
    const startSize = buffer.length
    const endSize = out.length
    const ratio = startSize ? ((1 - endSize / startSize) * 100).toFixed(1) : '0'
    console.log(`[MEDIA_PIPELINE] sharp ${id}: ${(startSize / 1024).toFixed(1)}KB → ${(endSize / 1024).toFixed(1)}KB (-${ratio}%)`)
    return { ok: true, buffer: out }
  } catch (e) {
    const msg = e?.message || String(e)
    console.error('[MEDIA_PIPELINE] sharp failed:', msg)
    return { ok: false, error: msg }
  }
}

/**
 * Совместимость с Telegram-ingest (`lib/services/telegram/storage.js`): вход ArrayBuffer или Buffer → WebP buffer.
 */
export async function compressImageBufferTelegramListing(inputBuffer) {
  const buf = Buffer.isBuffer(inputBuffer) ? inputBuffer : Buffer.from(inputBuffer)
  const res = await processImageBufferToWebp(buf, 'listing_photo')
  if (!res.ok) return buf
  return res.buffer
}
