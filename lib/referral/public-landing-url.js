/**
 * SSOT короткой персональной «визитки» (/u/[id]) для QR, PDF и Stories.
 */

import { getPublicSiteUrl } from '@/lib/site-url'

/** Полный канонический URL страницы @/u/[userId] */
export function buildAmbassadorLandingUrl(userId) {
  const raw = getPublicSiteUrl().replace(/\/$/, '')
  const uid = String(userId || '').trim()
  if (!uid) return raw
  return `${raw}/u/${encodeURIComponent(uid)}`
}

/**
 * Короткая подпись для печати: `example.com/u/abc-id` без схемы.
 * @param {string} userId
 */
export function ambassadorLandingShortLabel(userId) {
  try {
    const u = getPublicSiteUrl().replace(/\/$/, '')
    const host = new URL(u.startsWith('http') ? u : `https://${u}`).hostname
    const id = encodeURIComponent(String(userId || '').trim())
    return id ? `${host}/u/${id}` : host
  } catch {
    const uid = encodeURIComponent(String(userId || '').trim())
    return uid ? `…/u/${uid}` : ''
  }
}
