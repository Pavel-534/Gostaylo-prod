#!/usr/bin/env node
/**
 * Stage 157 — backfill country_code / region_code / city_code for ACTIVE listings.
 *
 * Usage:
 *   node scripts/geo-backfill-legacy-listings.js [--dry-run] [--limit N]
 */
import nextEnv from '@next/env'
import { createJiti } from 'jiti'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
nextEnv.loadEnvConfig(root)

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const limitIdx = args.indexOf('--limit')
const limit = limitIdx >= 0 ? Math.max(1, parseInt(args[limitIdx + 1], 10) || 500) : 5000

const jiti = createJiti(import.meta.url, { interopDefault: true, alias: { '@': root } })
const { supabaseAdmin } = await jiti.import(path.join(root, 'lib/supabase.js'))
const { inferGeoFromLegacyRow } = await jiti.import(
  path.join(root, 'lib/locations/resolve-listing-geo-snapshot.js'),
)

if (!supabaseAdmin) {
  console.error('SUPABASE not configured')
  process.exit(1)
}

let offset = 0
const pageSize = 200
let updated = 0
let skipped = 0
let errors = 0

console.log(`[geo-backfill] dryRun=${dryRun} limit=${limit}`)

while (offset < limit) {
  const { data: rows, error } = await supabaseAdmin
    .from('listings')
    .select('id, district, metadata, latitude, longitude, country_code, region_code, city_code, status')
    .eq('status', 'ACTIVE')
    .or('country_code.is.null,city_code.is.null')
    .range(offset, offset + pageSize - 1)

  if (error) {
    console.error('[geo-backfill] read error:', error.message)
    process.exit(1)
  }
  if (!rows?.length) break

  for (const row of rows) {
    if (updated + skipped + errors >= limit) break

    const snapshot = inferGeoFromLegacyRow(row)
    if (!snapshot.country_code && !snapshot.city_code) {
      skipped++
      continue
    }

    const patch = {
      country_code: snapshot.country_code,
      region_code: snapshot.region_code,
      city_code: snapshot.city_code,
      district: snapshot.district || row.district,
      metadata: {
        ...(row.metadata && typeof row.metadata === 'object' ? row.metadata : {}),
        ...snapshot.metadataGeo,
      },
      updated_at: new Date().toISOString(),
    }

    if (dryRun) {
      console.log(`[dry-run] ${row.id}`, patch.country_code, patch.city_code, patch.district)
      updated++
      continue
    }

    const { error: upErr } = await supabaseAdmin.from('listings').update(patch).eq('id', row.id)
    if (upErr) {
      console.error(`[geo-backfill] update failed ${row.id}:`, upErr.message)
      errors++
    } else {
      updated++
    }
  }

  if (rows.length < pageSize) break
  offset += pageSize
}

console.log(`[geo-backfill] done updated=${updated} skipped=${skipped} errors=${errors}`)
if (errors > 0 && !dryRun) process.exit(1)
