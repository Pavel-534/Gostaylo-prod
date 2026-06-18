#!/usr/bin/env node
/**
 * Generates INSERT statements for migrations/stage158_3_geo_synonyms.sql
 * from legacy JS alias sources (one-time / regen when sources change).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const { CITY_ALIASES, DISTRICT_ALIASES } = await import(
  pathToFileURL(path.join(root, 'lib/locations/thailand-aliases.js')).href
)
const { PHUKET_DISTRICT_ALIASES } = await import(
  pathToFileURL(path.join(root, 'lib/locations/phuket-districts-canonical.js')).href
)
const { WHERE_SLUG_ALIASES } = await import(
  pathToFileURL(path.join(root, 'lib/locations/where-slug-aliases.js')).href
)

/** @type {Map<string, { target_code: string, target_type: string, lang: string, weight: number }>} */
const rows = new Map()

function add(alias_term, target_code, target_type, lang, weight = 100) {
  const term = String(alias_term || '').trim()
  if (!term || term.length > 120) return
  const key = `${lang}:${term.toLowerCase()}`
  const existing = rows.get(key)
  if (!existing || weight > existing.weight) {
    rows.set(key, { target_code, target_type, lang, weight, alias_term: term })
  }
}

const CITY_CODE_MAP = {
  Phuket: 'phuket-city',
  Bangkok: 'bangkok',
  'Chiang Mai': 'chiang-mai',
  Pattaya: 'pattaya',
  Krabi: 'krabi-city',
  'Koh Samui': 'samui',
  Samui: 'samui',
  'Hua Hin': 'hua-hin',
  'Phang Nga': 'phang-nga',
}

function guessLang(term) {
  if (/[\u0400-\u04FF]/.test(term)) return 'ru'
  if (/[\u0E00-\u0E7F]/.test(term)) return 'th'
  if (/[\u4e00-\u9fff]/.test(term)) return 'zh'
  return '*'
}

for (const [cityName, meta] of Object.entries(CITY_ALIASES)) {
  if (cityName === 'Other') continue
  const code = CITY_CODE_MAP[cityName] || cityName.toLowerCase().replace(/\s+/g, '-')
  for (const m of meta.match || []) {
    const lang = guessLang(m)
    add(m, code, 'city', lang, lang === '*' ? 95 : 100)
  }
}

for (const [district, meta] of Object.entries(DISTRICT_ALIASES)) {
  for (const m of meta.match || []) {
    const lang = guessLang(m)
    add(m, district, 'district', lang, lang === '*' ? 95 : 100)
  }
}

for (const [alias, canon] of Object.entries(PHUKET_DISTRICT_ALIASES)) {
  add(alias, canon, 'district', '*', 98)
}

for (const [slug, target] of Object.entries(WHERE_SLUG_ALIASES)) {
  const isRegion = target.includes('-') && target === target.toUpperCase()
  add(slug, target, isRegion ? 'region' : 'city', '*', 100)
}

// Popular RU cities (synonyms for search; samara may be unverified until geo_locations row)
const RU_CITIES = [
  { code: 'moscow', terms: { ru: ['москва', 'мск'], en: ['moscow'], '*': ['msk'] } },
  {
    code: 'spb',
    terms: {
      ru: ['санкт-петербург', 'петербург', 'питер', 'спб'],
      en: ['saint petersburg', 'st petersburg', 'petersburg'],
      '*': ['spb'],
    },
  },
  { code: 'sochi', terms: { ru: ['сочи'], en: ['sochi'], '*': ['sochi'] } },
  { code: 'kazan', terms: { ru: ['казань'], en: ['kazan'], '*': ['kazan'] } },
  { code: 'samara', terms: { ru: ['самара'], en: ['samara'], '*': ['samara'] } },
]

for (const city of RU_CITIES) {
  for (const [lang, terms] of Object.entries(city.terms)) {
    for (const t of terms) add(t, city.code, 'city', lang, 100)
  }
}

// Extra high-value district synonyms (cyrillic exact)
add('патонг', 'Patong', 'district', 'ru', 100)
add('чалонг', 'Chalong', 'district', 'ru', 100)
add('Patong', 'Patong', 'district', 'en', 100)
add('Chalong', 'Chalong', 'district', 'en', 100)

function sqlEscape(s) {
  return String(s).replace(/'/g, "''")
}

const values = [...rows.values()]
  .sort((a, b) => a.lang.localeCompare(b.lang) || a.alias_term.localeCompare(b.alias_term))

const sqlValues = values
  .map(
    (r) =>
      `  ('${sqlEscape(r.target_code)}', '${r.target_type}', '${r.lang}', '${sqlEscape(r.alias_term)}', ${r.weight})`,
  )
  .join(',\n')

const sql = `-- AUTO-GENERATED seed (${values.length} rows) — scripts/build-geo-synonyms-seed-sql.mjs
INSERT INTO public.geo_synonyms (target_code, target_type, lang, alias_term, weight)
VALUES
${sqlValues}
ON CONFLICT (lower(alias_term), lang) DO NOTHING;
`

const jsRows = values.map((r) => ({
  target_code: r.target_code,
  target_type: r.target_type,
  lang: r.lang,
  alias_term: r.alias_term,
  weight: r.weight,
}))

const js = `/** AUTO-GENERATED — scripts/build-geo-synonyms-seed-sql.mjs (mirror of SQL seed; used when geo_synonyms table not yet migrated) */
export const GEO_SYNONYMS_FALLBACK_SEED = ${JSON.stringify(jsRows, null, 2)}
`

const outSql = path.join(root, 'migrations', 'stage158_3_geo_synonyms_seed.generated.sql')
const outJs = path.join(root, 'lib/locations/geo-synonyms-fallback.seed.js')
fs.writeFileSync(outSql, sql, 'utf8')
fs.writeFileSync(outJs, js, 'utf8')
console.log(`Wrote ${rows.size} rows → ${outSql}`)
console.log(`Wrote fallback seed → ${outJs}`)
