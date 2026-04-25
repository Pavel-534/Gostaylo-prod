'use client'

import * as LucideIcons from 'lucide-react'
import { AMENITY_DICTIONARY_BY_SLUG } from '@/lib/constants/amenities-dictionary'

/**
 * Renders Lucide icon for SSOT amenity slug (iconName from amenities-dictionary).
 * @param {{ slug: string, className?: string, 'aria-hidden'?: boolean }} props
 */
export function AmenityLucideIcon({ slug, className, 'aria-hidden': ariaHidden = true }) {
  const row = AMENITY_DICTIONARY_BY_SLUG.get(String(slug || '').toLowerCase())
  const name = row?.iconName || 'Circle'
  const Icon = LucideIcons[name] || LucideIcons.Circle
  return <Icon className={className} aria-hidden={ariaHidden} />
}
