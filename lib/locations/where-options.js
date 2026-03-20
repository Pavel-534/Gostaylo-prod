/**
 * Собирает опции «Куда» из API + алиасы Таиланда (RU/EN/ZH/TH).
 * language: 'ru' | 'en' | 'zh' | 'th'
 */

import { CITY_ALIASES, DISTRICT_ALIASES } from '@/lib/locations/thailand-aliases'

const ANYWHERE_LABEL = {
  ru: 'Везде',
  en: 'Anywhere',
  zh: '任何地方',
  th: 'ทุกที่',
}

function labelFor(lang, meta, fallback) {
  if (!meta) return fallback
  return meta[lang] || meta.en || meta.ru || meta.zh || meta.th || fallback
}

function matchFor(meta, value) {
  if (meta?.match?.length) return [...meta.match]
  const v = String(value).toLowerCase()
  return [v]
}

/**
 * @param {{ cities?: string[], allDistricts?: string[] }} locationsData
 * @param {string} language
 * @returns {{ value: string, type: 'all'|'city'|'district', label: string, match: string[] }[]}
 */
export function buildWhereOptions(locationsData, language = 'en') {
  const cities = locationsData?.cities || []
  const districts = locationsData?.allDistricts || []

  const out = []
  out.push({
    value: 'all',
    type: 'all',
    label: ANYWHERE_LABEL[language] || ANYWHERE_LABEL.en,
    match: [
      'all',
      'всё',
      'везде',
      'anywhere',
      'any',
      '任何地方',
      '处处',
      'ทุกที่',
      'ทั้งหมด',
    ],
  })

  for (const c of cities) {
    const meta = CITY_ALIASES[c]
    const label = labelFor(language, meta, c)
    out.push({
      value: c,
      type: 'city',
      label,
      match: matchFor(meta, c),
    })
  }

  for (const d of districts) {
    const meta = DISTRICT_ALIASES[d]
    const label = labelFor(language, meta, d)
    const base = [d, ...(meta?.match || [])].map((x) => String(x).toLowerCase())
    out.push({
      value: d,
      type: 'district',
      label,
      match: [...new Set(base)],
    })
  }

  return out
}

/**
 * Фильтр по вводу (RU/EN латиница, без учёта регистра).
 * @param {ReturnType<typeof buildWhereOptions>} options
 * @param {string} query
 */
export function filterWhereOptions(options, query) {
  const q = query.trim().toLowerCase()
  if (!q) return options

  const scored = options
    .map((o) => {
      let score = 0
      if (o.value.toLowerCase() === q) score += 100
      if (o.label.toLowerCase().includes(q)) score += 50
      if (o.match.some((m) => m.startsWith(q))) score += 40
      if (o.match.some((m) => m.includes(q))) score += 20
      return { o, score }
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)

  const out = scored.map(({ o }) => o)
  if (out.length > 0) return out

  // Мягкий fallback: любое вхождение в подпись (латиница/кириллица)
  return options
    .filter((o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q))
    .slice(0, 20)
}

export function getOptionLabel(options, value) {
  const o = options.find((x) => x.value === value)
  return o?.label || value || ''
}
