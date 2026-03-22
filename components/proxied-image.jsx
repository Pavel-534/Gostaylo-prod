'use client'

import Image from 'next/image'
import { toStorageProxyUrl } from '@/lib/supabase-proxy-urls'

function isAbsoluteHttpUrl(url) {
  return typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))
}

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
  const u = toStorageProxyUrl(src) || src || '/placeholder.svg'
  const effectiveUnoptimized =
    unoptimized !== undefined ? unoptimized : isAbsoluteHttpUrl(u)
  if (fill) {
    return (
      <Image
        src={u}
        alt={alt}
        fill
        className={className}
        sizes={sizes}
        priority={priority}
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
      unoptimized={effectiveUnoptimized}
    />
  )
}
