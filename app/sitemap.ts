import type { MetadataRoute } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { getRequestSiteUrl } from '@/lib/server-site-url'
import { getPublicSiteUrl } from '@/lib/site-url'

const PAGE_SIZE = 1000

async function resolveBaseUrl(): Promise<string> {
  try {
    return await getRequestSiteUrl()
  } catch {
    return getPublicSiteUrl()
  }
}

type ListingRow = { id: string; updated_at: string | null }

async function fetchAllActiveListings(): Promise<ListingRow[]> {
  if (!supabaseAdmin) return []

  const rows: ListingRow[] = []
  let from = 0

  for (;;) {
    const { data, error } = await supabaseAdmin
      .from('listings')
      .select('id, updated_at')
      .eq('status', 'ACTIVE')
      .order('updated_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)

    if (error) {
      console.error('[sitemap] listings query error:', error.message)
      break
    }
    if (!data?.length) break

    for (const row of data) {
      if (row?.id) rows.push({ id: row.id, updated_at: row.updated_at ?? null })
    }

    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return rows
}

/**
 * Динамический sitemap.xml.
 * Не попадает под matcher в middleware.ts.
 *
 * TODO: Добавить фильтрацию по категориям для разделения приоритетов (property, vehicles, services)
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = await resolveBaseUrl()
  const origin = base.replace(/\/$/, '')

  const entries: MetadataRoute.Sitemap = [
    {
      url: `${origin}/`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${origin}/listings/`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
  ]

  const listings = await fetchAllActiveListings()
  for (const row of listings) {
    const lastMod = row.updated_at ? new Date(row.updated_at) : new Date()
    entries.push({
      url: `${origin}/listings/${row.id}/`,
      lastModified: lastMod,
      changeFrequency: 'weekly',
      priority: 0.8,
    })
  }

  return entries
}
