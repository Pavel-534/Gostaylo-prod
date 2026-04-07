'use client'

import Image from 'next/image'
import { toPublicImageUrl, isRemoteHttpImageSrc } from '@/lib/public-image-url'
import { LISTING_CARD_BLUR_DATA_URL } from '@/lib/listing-image-blur'

/**
 * next/image + путь /_storage/... для объектов из Supabase Storage.
 * Внешние http(s) URL не оптимизируем на сервере (избегаем таймаутов при dev / жёстких сетях).
 */
export function ProxiedImage({
  src,
  alt = '',
  className,
  width,
  height,
  fill,
  sizes,
  priority,
  unoptimized,
}) {
  const raw = src || '/placeholder.svg'
  const u = raw === '/placeholder.svg' ? raw : toPublicImageUrl(raw) || raw
  const effectiveUnoptimized = unoptimized !== undefined ? unoptimized : isRemoteHttpImageSrc(u)
  if (fill) {
    return (
      <Image
        src={u}
        alt={alt}
        fill
        className={className}
        sizes={sizes}
        priority={priority}
        placeholder="blur"
        blurDataURL={LISTING_CARD_BLUR_DATA_URL}
        unoptimized={effectiveUnoptimized}
      />
    )
  }
  return (
    <Image
      src={u}
      alt={alt}
      width={width ?? 80}
      height={height ?? 80}
      className={className}
      priority={priority}
      placeholder="blur"
      blurDataURL={LISTING_CARD_BLUR_DATA_URL}
      unoptimized={effectiveUnoptimized}
    />
  )
}
