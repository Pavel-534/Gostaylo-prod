import type { MetadataRoute } from 'next'
import { getPublicSiteUrl } from '@/lib/site-url'

/**
 * Системный robots.txt (Next.js Metadata API).
 * Stage 200.71 — apex via getPublicSiteUrl(); expanded disallow for guest/auth private zones.
 */
export default function robots(): MetadataRoute.Robots {
  const origin = getPublicSiteUrl().replace(/\/$/, '')
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/auth',
          '/login',
          '/my-bookings',
          '/profile',
          '/partner',
          '/admin',
          '/api',
          '/messages',
          '/checkout',
          '/settings',
          '/dashboard',
          '/renter',
        ],
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
    host: origin.replace(/^https?:\/\//, ''),
  }
}
