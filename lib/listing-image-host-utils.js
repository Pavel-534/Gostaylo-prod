/**
 * Чистые утилиты URL картинок листинга (без серверных зависимостей — можно импортировать в client).
 */

export function isHostedListingImageUrl(url) {
  if (!url || typeof url !== 'string') return true
  const u = url.trim()
  if (u.startsWith('/_storage/')) return true
  if (u.includes('/listing-images/')) return true
  if (u.includes('supabase.co/storage/v1/object/public/listing-images')) return true
  if (u.startsWith('blob:') || u.startsWith('data:')) return true
  return false
}

export function listingImagesContainExternalUrls(urls) {
  if (!Array.isArray(urls)) return false
  return urls.some((u) => typeof u === 'string' && u.trim() && !isHostedListingImageUrl(u))
}
