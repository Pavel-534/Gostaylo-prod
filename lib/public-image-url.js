/**
 * URL картинки для браузера: Supabase → /_storage/..., Unsplash → /api/v2/images/proxy?...
 */
import { toStorageProxyUrl } from '@/lib/supabase-proxy-urls'
import { proxifyUnsplashUrl } from '@/lib/proxify-unsplash-url'

export function toPublicImageUrl(url) {
  if (!url || typeof url !== 'string') return url
  const storage = toStorageProxyUrl(url) || url
  return proxifyUnsplashUrl(storage)
}

export function mapPublicImageUrls(urls) {
  if (!Array.isArray(urls)) return urls
  return urls.map((u) => toPublicImageUrl(u)).filter(Boolean)
}
