/**
 * Stage 200.35 — upsert curated launch geo into public.geo_locations (+ synonyms).
 *
 * Usage:
 *   node --env-file=.env.local scripts/seed-geo-locations.mjs
 *
 * Does NOT call Nominatim (OSM ToS). Static centroids from lib/geo/launch-markets-seed-data.js
 */

import { createClient } from '@supabase/supabase-js'
import {
  LAUNCH_GEO_SEED,
  LAUNCH_GEO_SYNONYM_SEED,
} from '../lib/geo/launch-markets-seed-data.js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const sb = createClient(url, key, { auth: { persistSession: false } })

function rowFromSeed(n) {
  const [bn, bs, be, bw] = n.bbox || []
  return {
    code: n.code,
    level: n.level,
    parent_code: n.parent_code,
    label_en: n.label_en,
    label_ru: n.label_ru || null,
    label_th: n.label_th || null,
    label_zh: n.label_zh || null,
    flag: n.flag || null,
    iso_country: n.country_code,
    country_code: n.country_code,
    centroid_lat: n.centroid_lat,
    centroid_lng: n.centroid_lng,
    bbox_north: bn ?? null,
    bbox_south: bs ?? null,
    bbox_east: be ?? null,
    bbox_west: bw ?? null,
    timezone: n.timezone || null,
    currency_code: n.currency_code || null,
    is_active: true,
    is_auto_imported: false,
    updated_at: new Date().toISOString(),
  }
}

async function upsertNodes() {
  // Parents before children: country → region → city → neighborhood
  const order = { country: 0, region: 1, city: 2, neighborhood: 3 }
  const sorted = [...LAUNCH_GEO_SEED].sort((a, b) => order[a.level] - order[b.level])

  let ok = 0
  for (const n of sorted) {
    const row = rowFromSeed(n)
    const { data: existing } = await sb.from('geo_locations').select('id').eq('code', n.code).maybeSingle()
    if (existing?.id) {
      const { error } = await sb.from('geo_locations').update(row).eq('code', n.code)
      if (error) {
        console.error('UPDATE fail', n.code, error.message)
        continue
      }
    } else {
      const { error } = await sb.from('geo_locations').insert(row)
      if (error) {
        console.error('INSERT fail', n.code, error.message)
        continue
      }
    }
    ok += 1
  }
  console.log(`geo_locations upserted: ${ok}/${sorted.length}`)
}

async function upsertSynonyms() {
  let ok = 0
  for (const s of LAUNCH_GEO_SYNONYM_SEED) {
    const { data: existing } = await sb
      .from('geo_synonyms')
      .select('id')
      .eq('lang', s.lang)
      .ilike('alias_term', s.alias_term)
      .maybeSingle()

    if (existing?.id) {
      ok += 1
      continue
    }
    const { error } = await sb.from('geo_synonyms').insert({
      target_code: s.target_code,
      target_type: s.target_type,
      lang: s.lang,
      alias_term: s.alias_term,
      weight: s.weight ?? 100,
    })
    if (error) {
      console.error('synonym fail', s.alias_term, error.message)
      continue
    }
    ok += 1
  }
  console.log(`geo_synonyms ensured: ${ok}/${LAUNCH_GEO_SYNONYM_SEED.length}`)
}

await upsertNodes()
await upsertSynonyms()
console.log('Done Stage 200.35 geo seed')
