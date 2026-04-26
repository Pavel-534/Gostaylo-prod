/**
 * Обогащение строки листинга при импорте с Airbnb: гео-район Пхукета, SEO-мета, workation.
 */

import { getSiteDisplayName } from '@/lib/site-url'

/** Популярные районы платформы — те же названия, что в мастере партнёра */
export const PHUKET_POPULAR_DISTRICTS: { name: string; lat: number; lng: number }[] = [
  { name: 'Rawai',    lat: 7.7665, lng: 98.3165 },
  { name: 'Nai Harn', lat: 7.777,  lng: 98.302  },
  { name: 'Chalong',  lat: 7.828,  lng: 98.336  },
  { name: 'Kata',     lat: 7.818,  lng: 98.298  },
  { name: 'Karon',    lat: 7.852,  lng: 98.296  },
  { name: 'Panwa',    lat: 7.818,  lng: 98.405  },
  { name: 'Patong',   lat: 7.896,  lng: 98.298  },
  { name: 'Kamala',   lat: 7.953,  lng: 98.282  },
  { name: 'Surin',    lat: 7.963,  lng: 98.278  },
  { name: 'Bang Tao', lat: 7.997,  lng: 98.307  },
  { name: 'Nai Yang', lat: 8.12,   lng: 98.298  },
  { name: 'Mai Khao', lat: 8.118,  lng: 98.308  },
]

const EARTH_KM = 6371

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(a)))
}

/**
 * Ближайший район Пхукета по координатам.
 * Порог 12 км: если ближайший центроид дальше — null (не подменяем чужой регион).
 */
export function nearestPhuketDistrictName(
  lat: number | null | undefined,
  lng: number | null | undefined,
  maxKm = 12
): string | null {
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null
  let best: { name: string; km: number } | null = null
  for (const d of PHUKET_POPULAR_DISTRICTS) {
    const km = haversineKm(lat, lng, d.lat, d.lng)
    if (!best || km < best.km) best = { name: d.name, km }
  }
  if (!best || best.km > maxKm) return null
  return best.name
}

const WORKATION_RE = /\b(high[\s-]*speed[\s-]*internet|fiber|fibre)\b/i

export function descriptionImpliesWorkationReady(description: string | null | undefined): boolean {
  if (!description || typeof description !== 'string') return false
  return WORKATION_RE.test(description)
}

function stripText(htmlish: string): string {
  return htmlish.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function clamp(s: string, max: number): string {
  if (s.length <= max) return s
  const cut = s.slice(0, max - 1)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trim() + '…'
}

// ─────────────────────────────────────────────
// Мультиязычные шаблоны
// ─────────────────────────────────────────────

type Lang = 'ru' | 'en' | 'zh' | 'th'

interface LangConfig {
  phuket: string
  separator: string        // между частями заголовка
  bookSuffix: string       // хвост description
  descSep: string          // знак препинания после сниппета
  amenitySep: string       // знак препинания после удобств
}

const LANG_CFG: Record<Lang, LangConfig> = {
  en: {
    phuket: 'Phuket',
    separator: ' · ',
    bookSuffix: ', Phuket — book on {brand}.',
    descSep: '.',
    amenitySep: '.',
  },
  ru: {
    phuket: 'Пхукет',
    separator: ' · ',
    bookSuffix: ', Пхукет — бронируйте на {brand}.',
    descSep: '.',
    amenitySep: '.',
  },
  zh: {
    phuket: '普吉岛',
    separator: ' · ',
    bookSuffix: '，普吉岛 — 在{brand}预订。',
    descSep: '。',
    amenitySep: '。',
  },
  th: {
    phuket: 'ภูเก็ต',
    separator: ' · ',
    bookSuffix: ', ภูเก็ต — จองผ่าน {brand}.',
    descSep: '.',
    amenitySep: '.',
  },
}

const TITLE_MAX = 60
const DESC_MAX = 160
const SNIPPET_MAX = 120

export interface ImportSeoBlock {
  title: string
  description: string
}

export type ImportSeoLocales = Record<Lang, ImportSeoBlock>

export interface ImportSeoInput {
  /** Оригинальный заголовок с площадки (как правило, английский) */
  title: string
  /** Район — обычно латиница (Rawai, Bang Tao…) */
  district: string | null
  description: string | null | undefined
  /** Подписи удобств на языке площадки */
  amenityLabels: string[]
}

function buildOneLang(cfg: LangConfig, input: ImportSeoInput): ImportSeoBlock {
  const brand = getSiteDisplayName()
  const district = (input.district && String(input.district).trim()) || cfg.phuket
  const rawTitle = (input.title && String(input.title).trim()) || 'Holiday rental'

  // title
  const suffix = `${cfg.separator}${district}${cfg.separator}${cfg.phuket} | ${brand}`
  let title = rawTitle + suffix
  if (title.length > TITLE_MAX) {
    const room = TITLE_MAX - suffix.length - 1
    title = clamp(rawTitle, Math.max(20, room)) + suffix
  }

  // description
  const plain = input.description ? stripText(String(input.description)) : ''
  const snippet = plain ? clamp(plain, SNIPPET_MAX) : ''
  const labels = (input.amenityLabels || []).map((s) => String(s).trim()).filter(Boolean).slice(0, 5)
  const amenityPart = labels.length ? labels.join(', ') + cfg.amenitySep + ' ' : ''
  const snippetPart = snippet ? snippet + (snippet.endsWith(cfg.descSep) ? ' ' : cfg.descSep + ' ') : ''
  const bookSuffix = cfg.bookSuffix.replace(/\{brand\}/g, brand)
  const description = clamp(
    (snippetPart + amenityPart + district + bookSuffix).replace(/\s+/g, ' ').trim(),
    DESC_MAX
  )

  return { title, description }
}

/**
 * Генерирует SEO-мета на 4 языках.
 * Заголовок и сниппет берутся из оригинала (как правило, English) — переводить заголовок
 * автоматически нет смысла без LLM; структура готова, партнёр может дополнить.
 */
export function buildImportSeoMeta(input: ImportSeoInput): { seo: ImportSeoLocales } {
  const langs: Lang[] = ['en', 'ru', 'zh', 'th']
  const seo = {} as ImportSeoLocales
  for (const lang of langs) {
    seo[lang] = buildOneLang(LANG_CFG[lang], input)
  }
  return { seo }
}
