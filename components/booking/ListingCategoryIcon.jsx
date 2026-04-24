'use client'

import { Car, Home, MapPin, User } from 'lucide-react'
import { inferListingServiceTypeFromCategorySlug } from '@/lib/partner/listing-service-type'

/**
 * Визуальная метка категории брони (Super-App): жильё / транспорт / услуга / тур.
 * @param {{ categorySlug?: string | null, className?: string, title?: string }} props
 */
export function ListingCategoryIcon({ categorySlug, className, title }) {
  const kind = inferListingServiceTypeFromCategorySlug(categorySlug)
  const cn = className || 'h-5 w-5 shrink-0 text-teal-700'
  const tip = title || undefined
  if (kind === 'transport') return <Car className={cn} aria-hidden title={tip} />
  if (kind === 'service') return <User className={cn} aria-hidden title={tip} />
  if (kind === 'tour') return <MapPin className={cn} aria-hidden title={tip} />
  return <Home className={cn} aria-hidden title={tip} />
}
