import type { MetadataRoute } from 'next'
import { getRequestSiteUrl } from '@/lib/server-site-url'
import { getPublicSiteUrl } from '@/lib/site-url'

async function baseUrl(): Promise<string> {
  try {
    return await getRequestSiteUrl()
  } catch {
    return getPublicSiteUrl()
  }
}

/**
 * Системный robots.txt (Next.js Metadata API).
 * Не попадает под matcher в middleware.ts — только /admin, /partner, /renter, /messages.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const origin = await baseUrl()
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
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
