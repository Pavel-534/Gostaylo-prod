/**
 * Caption / command parsing — /link email, эвристики для legacy,
 * и структурирование объявлений только через OpenAI (gpt-4o-mini).
 */

const OPENAI_MODEL = 'gpt-4o-mini'

const LISTING_PARSE_SYSTEM = `You are the listing copywriter for GoStayLo (Phuket rentals). Parse the user's Telegram message/caption and return ONLY valid JSON with exactly these keys:
- category: one of "property", "transport", "yachts", "nanny", "tours"
  • property — villas, apartments, condos, houses, studios, rooms
  • transport — bikes, scooters, cars, transfers, vehicle rental
  • yachts — boats, catamarans, yacht charters
  • nanny — babysitting, child care, nanny services, family help
  • tours — excursions, trips, surf lessons, guided experiences, activities
- title: short catchy title (max ~70 chars), no markdown, no emojis in the title string
- description: rich, persuasive marketing copy in the same language as the caption (Russian or English). Plain text, line breaks allowed.
  • property: luxury, spacious, premium getaway tone; highlight location vibe and comfort
  • transport: confident, practical, freedom to explore
  • yachts: upscale marine lifestyle, freedom, sea
  • nanny: warm, trustworthy, caring professional tone
  • tours: vivid, exciting, memorable experience
- price: integer, nightly rate in Thai Baht (THB). Convert USD/EUR if given (~36 THB/USD unless another rate stated).
- district: English area name when possible (Rawai, Patong, Karon, Kata, Kamala, Chalong, Bang Tao, Surin, Panwa, Phuket Town, Mai Khao, Nai Harn, Nai Yang) or null
- bedrooms: non-negative integer; for nanny/tours/transport/yachts usually 0 unless bedrooms clearly mentioned

Money slang (THB per night when rental context):
- "100к", "50 к", "25k", "80K" → thousands (e.g. 50к → 50000)
- "сотка" often → 100000 in informal Russian money talk
- "пятерка баксов" / small USD amounts → convert to THB

If price is completely missing, use 0. Never invent false facts; you may polish wording beyond raw facts.`

/** @typedef {'property'|'transport'|'yachts'|'nanny'|'tours'} ListingCategoryDisplay */

const AI_CATEGORY_SET = new Set(['property', 'transport', 'yachts', 'nanny', 'tours'])

export const CATEGORY_KEYWORDS = {
  'cat-yachts': ['яхта', 'yacht', 'лодка', 'boat', 'катер', 'катамаран', 'catamaran'],
  'cat-vehicles': ['байк', 'bike', 'мот', 'скутер', 'scooter', 'машина', 'car', 'авто', 'аренда авто'],
  'cat-tours': ['тур', 'tour', 'экскурсия', 'excursion', 'поездка', 'trip', 'сёрфинг', 'surf'],
  'cat-nanny': ['няня', 'nanny', 'babysit', 'бебисит', 'нянч', 'детск', 'child care', 'babysitter'],
  'cat-property': [
    'вилла',
    'villa',
    'апарт',
    'apartment',
    'дом',
    'house',
    'кондо',
    'condo',
    'студия',
    'studio',
    'недвижимость',
    'property',
  ],
}

export const DISTRICTS = [
  'Rawai',
  'Chalong',
  'Kata',
  'Karon',
  'Patong',
  'Kamala',
  'Surin',
  'Bang Tao',
  'Nai Harn',
  'Panwa',
  'Mai Khao',
  'Nai Yang',
  'Phuket Town',
]

export function extractEmailFromLinkCommand(text) {
  const cleanText = text.replace(/^\/link(@\w+)?\s*/i, '').trim()
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
  const match = cleanText.match(emailRegex)
  return match ? match[0].toLowerCase() : null
}

export function extractPrice(text) {
  if (!text) return 0

  const normalizedText = text.toLowerCase().replace(/\s+/g, ' ')

  const markerPatterns = [
    /(\d[\d\s]*)\s*(thb|бат|baht)/i,
    /฿\s*(\d[\d\s]*)/,
    /(\d[\d\s]*)\s*฿/,
  ]

  for (const pattern of markerPatterns) {
    const match = text.match(pattern)
    if (match) {
      const numStr = match[1] || match[0]
      const price = parseInt(numStr.replace(/[^\d]/g, ''), 10)
      if (price > 0) {
        console.log(`[PRICE] Found with marker: ${price}`)
        return price
      }
    }
  }

  const thousandsK = text.match(/(\d[\d\s]*)\s*(?:k|к)\b/i)
  if (thousandsK) {
    const base = parseInt(thousandsK[1].replace(/[^\d]/g, ''), 10)
    if (base > 0) {
      const price = base * 1000
      console.log(`[PRICE] Thousands suffix (k/к): ${price}`)
      return price
    }
  }

  const cleanedText = normalizedText
    .replace(/(?:до|через|от|в|за)\s*\d+/gi, '')
    .replace(/\d+\s*(?:м|km|метр|минут|мин|м²|кв\.?м)/gi, '')
    .replace(/\d{1,2}[:.]\d{2}/g, '')

  const numbers = cleanedText.match(/\d+/g)

  if (numbers) {
    const validPrices = numbers.map((n) => parseInt(n, 10)).filter((n) => n >= 1000 && n < 10000000)

    if (validPrices.length > 0) {
      const maxPrice = Math.max(...validPrices)
      console.log(`[PRICE] Found max number: ${maxPrice}`)
      return maxPrice
    }
  }

  console.log('[PRICE] No price found, defaulting to 0')
  return 0
}

export function extractCategoryFromCaption(text) {
  if (!text) return null
  const lower = text.toLowerCase()
  for (const [catId, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      console.log(`[CATEGORY] Detected: ${catId}`)
      return catId
    }
  }
  return null
}

export function extractDistrictFromCaption(text) {
  if (!text) return null
  const lower = text.toLowerCase()
  for (const d of DISTRICTS) {
    if (lower.includes(d.toLowerCase())) {
      console.log(`[DISTRICT] Detected: ${d}`)
      return d
    }
  }
  return null
}

/**
 * @param {string|null|undefined} categoryId — как из extractCategoryFromCaption (cat-*)
 */
export function categoryIdToSlug(categoryId) {
  if (!categoryId) return 'property'
  const s = String(categoryId).toLowerCase()
  const m = s.match(/^cat-(.+)$/)
  return m ? m[1] : s
}

/**
 * @param {unknown} rawCategory — значение поля category от модели
 * @returns {{ category_display: ListingCategoryDisplay, category_db_slug: string }}
 */
export function mapAiCategoryToDb(rawCategory) {
  let c = String(rawCategory || 'property').toLowerCase().trim()
  if (c === 'vehicle' || c === 'vehicles') c = 'transport'
  if (!AI_CATEGORY_SET.has(c)) c = 'property'

  /** @type {ListingCategoryDisplay} */
  const category_display = /** @type {ListingCategoryDisplay} */ (c)

  const category_db_slug =
    c === 'transport'
      ? 'vehicles'
      : c === 'nanny'
        ? 'nanny'
        : c === 'yachts'
          ? 'yachts'
          : c === 'tours'
            ? 'tours'
            : 'property'

  return { category_display, category_db_slug }
}

/**
 * @param {unknown} raw
 */
function normalizeOpenAiListing(raw) {
  if (!raw || typeof raw !== 'object') return null
  const o = /** @type {Record<string, unknown>} */ (raw)

  const title = typeof o.title === 'string' ? o.title.trim().slice(0, 200) : ''
  const description = typeof o.description === 'string' ? o.description.trim() : ''
  let price = Number(o.price)
  if (!Number.isFinite(price) || price < 0) price = 0
  price = Math.round(price)
  const district =
    o.district == null || o.district === ''
      ? null
      : String(o.district).trim().slice(0, 120) || null
  let bedrooms = Number(o.bedrooms)
  if (!Number.isFinite(bedrooms) || bedrooms < 0) bedrooms = 0
  bedrooms = Math.min(50, Math.round(bedrooms))

  const rawCat = o.category != null ? o.category : o.category_slug
  const { category_display, category_db_slug } = mapAiCategoryToDb(rawCat)

  if (!title) return null

  return {
    title,
    description,
    price,
    district,
    bedrooms,
    category_display,
    category_db_slug,
  }
}

/**
 * @param {string} caption
 * @param {'ru'|'en'} lang
 * @param {string} apiKey
 */
async function callOpenAiListingParse(caption, lang, apiKey) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: LISTING_PARSE_SYSTEM },
        {
          role: 'user',
          content: `Interface language hint: ${lang}. User message:\n${caption}`,
        },
      ],
      temperature: 0.62,
    }),
  })
  const data = await res.json()
  if (!res.ok) {
    console.error(
      '[OPENAI_PARSE]',
      res.status,
      data?.error?.message || JSON.stringify(data).slice(0, 400)
    )
    return null
  }
  const content = data?.choices?.[0]?.message?.content
  if (!content || typeof content !== 'string') return null
  let raw = content.trim()
  if (raw.startsWith('```')) {
    raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  }
  const parsed = JSON.parse(raw)
  const norm = normalizeOpenAiListing(parsed)
  if (!norm) return null
  console.log('[OPENAI_PARSE] ok', {
    price: norm.price,
    category_display: norm.category_display,
    category_db_slug: norm.category_db_slug,
  })
  return norm
}

/**
 * Только OpenAI. Без ключа или при ошибке — ok: false.
 * @param {string} caption
 * @param {{ lang?: 'ru'|'en', openaiApiKey?: string|null }} opts
 * @returns {Promise<
 *   | { ok: true, title: string, description: string, price: number, district: string|null, bedrooms: number, category_display: ListingCategoryDisplay, category_db_slug: string }
 *   | { ok: false, code: 'NO_KEY'|'EMPTY_CAPTION'|'PARSE_FAILED' }
 * >}
 */
export async function parseListingCaption(caption, opts = {}) {
  const lang = opts.lang === 'ru' ? 'ru' : 'en'
  const apiKey = opts.openaiApiKey
  if (!apiKey || !String(apiKey).trim()) {
    return { ok: false, code: 'NO_KEY' }
  }
  const text = String(caption || '').trim()
  if (!text) {
    return { ok: false, code: 'EMPTY_CAPTION' }
  }
  try {
    const norm = await callOpenAiListingParse(text, lang, String(apiKey).trim())
    if (!norm) return { ok: false, code: 'PARSE_FAILED' }
    return { ok: true, ...norm }
  } catch (e) {
    console.error('[OPENAI_PARSE] error', e?.message || e)
    return { ok: false, code: 'PARSE_FAILED' }
  }
}
