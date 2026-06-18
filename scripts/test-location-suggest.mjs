#!/usr/bin/env node
/** Quick manual check for Stage 158.1 suggest (run: node scripts/test-location-suggest.mjs) */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import nextEnv from '@next/env'
import { createJiti } from 'jiti'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
nextEnv.loadEnvConfig(root)
const jiti = createJiti(import.meta.url, { interopDefault: true, alias: { '@': root } })

const { suggestLocations } = await jiti.import(path.join(root, 'lib/locations/location-suggest.service.js'))

const cases = [
  { q: 'патонг', lang: 'ru' },
  { q: 'Patong', lang: 'en' },
  { q: 'Чалонг', lang: 'ru' },
  { q: 'чалонг', lang: 'ru' },
  { q: 'патнг', lang: 'ru' },
  { q: 'patg', lang: 'en' },
  { q: 'chalong', lang: 'en' },
  { q: 'phuket', lang: 'en', limit: 3 },
  { q: 'samara', lang: 'en' },
  { q: 'самара', lang: 'ru' },
  { q: '', lang: 'ru', limit: 3 },
]

for (const c of cases) {
  const t0 = performance.now()
  const data = await suggestLocations(c)
  const ms = Math.round(performance.now() - t0)
  console.log(`\n--- q=${JSON.stringify(c.q)} lang=${c.lang} (${ms}ms) ---`)
  for (const item of data.items.slice(0, 5)) {
    console.log(
      `  ${item.label} [${item.value}] kind=${item.match_kind} syn=${item.matched_synonym || '-'} count=${item.listing_count}`,
    )
  }
  if (!data.items.length) console.log('  (no results)')
}
