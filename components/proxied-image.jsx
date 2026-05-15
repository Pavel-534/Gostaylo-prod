'use client'

import Image from 'next/image'
import { isRemoteHttpImageSrc } from '@/lib/public-image-url'
import { resolveImageDisplaySrc } from '@/lib/image-display-url'
import { LISTING_CARD_BLUR_DATA_URL } from '@/lib/listing-image-blur'

/**
 * next/image + путь /_storage/... для объектов из Supabase Storage.
 * Внешние http(s) URL не оптимизируем на сервере (избегаем таймаутов при dev / жёстких сетях).
 */
export function ProxiedImage({
  src,
  /** Optional explicit thumb; if omitted and preferThumb, derives from main storage path */
  thumbSrc = null,
  preferThumb = true,
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
  const u =
    raw === '/placeholder.svg'
      ? raw
      : resolveImageDisplaySrc(thumbSrc ? { url: raw, thumbUrl: thumbSrc } : raw, { preferThumb }) || raw
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
