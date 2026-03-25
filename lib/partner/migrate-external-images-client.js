/**
 * Клиентский вызов миграции внешних URL → listing-images (после сохранения листинга).
 */

import { listingImagesContainExternalUrls } from '@/lib/listing-image-host-utils'

/**
 * Сохраняет ту же обложку по индексу после миграции URL (порядок элементов тот же).
 * @param {string[]} prevImages
 * @param {string | null | undefined} prevCover
 * @param {string[]} newImages
 */
export function mapCoverUrlAfterMigration(prevImages, prevCover, newImages) {
  if (!Array.isArray(newImages) || newImages.length === 0) return null
  if (!prevCover) return newImages[0]
  const idx = prevImages.findIndex((u) => u === prevCover)
  if (idx < 0) return newImages[0]
  return newImages[Math.min(idx, newImages.length - 1)] || newImages[0]
}

/**
 * @param {string} listingId
 * @param {string} coverUrl
 */
export async function patchPartnerListingCoverImage(listingId, coverUrl) {
  if (!listingId || !coverUrl) return
  await fetch(`/api/v2/partner/listings/${listingId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ coverImage: coverUrl }),
  }).catch(() => {})
}

/**
 * @param {string} listingId
 * @param {string[]} images — текущий массив ссылок в форме
 * @returns {Promise<{ success: boolean, images: string[], migrated?: number, failed?: number } | null>}
 */
export async function migrateExternalImagesAfterSave(listingId, images) {
  if (!listingId || !listingImagesContainExternalUrls(images)) return null
  const res = await fetch(`/api/v2/partner/listings/${listingId}/migrate-external-images`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ urls: images }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.success || !Array.isArray(data.images)) return null
  return data
}
