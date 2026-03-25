/**
 * Airbnb listing URL → нормализованный объект для mapExternalToInternal (platform: airbnb).
 * Стратегии: Apify (рекомендуется в проде) → Playwright (self-hosted / локально).
 *
 * Важно: парсинг публичных страниц может нарушать ToS Airbnb; используйте официальные
 * каналы где возможно. Apify-акторы — отдельная лицензия/ответственность пользователя.
 */

const AIRBNB_HOST_RE = /^(?:www\.)?airbnb\./i

/**
 * @param {string} url
 * @returns {string | null}
 */
export function extractAirbnbRoomId(url) {
  try {
    const u = new URL(url)
    const m = u.pathname.match(/\/rooms\/(\d+)/i)
    if (m) return m[1]
    const h = u.pathname.match(/\/h\/([a-zA-Z0-9_-]+)/i)
    if (h) return h[1]
  } catch {
    return null
  }
  return null
}

/**
 * @param {string} url
 */
export function assertAllowedAirbnbUrl(url) {
  let u
  try {
    u = new URL(url)
  } catch {
    throw new Error('Invalid URL')
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') {
    throw new Error('Only http(s) URLs are allowed')
  }
  if (!AIRBNB_HOST_RE.test(u.hostname)) {
    throw new Error('URL must be an Airbnb listing (airbnb.* domain)')
  }
  if (!extractAirbnbRoomId(url)) {
    throw new Error('Expected a listing URL containing /rooms/<id> or /h/<code>')
  }
}

/**
 * Повышаем размер превью muscache (эвристика; не все URL меняются одинаково).
 * @param {string} raw
 */
export function upgradeAirbnbImageUrl(raw) {
  if (!raw || typeof raw !== 'string') return raw
  try {
    const u = new URL(raw)
    if (!u.hostname.includes('muscache.com') && !u.hostname.includes('airbnb')) return raw
    u.searchParams.set('im_w', '1920')
    u.searchParams.set('im_h', '1440')
    return u.toString()
  } catch {
    return raw
  }
}

function asString(v) {
  if (v == null) return ''
  return String(v).trim()
}

function asNumber(v) {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : null
}

/**
 * Собрать URL картинок из произвольного объекта Apify/скрапера.
 * @param {unknown} raw
 * @returns {string[]}
 */
export function collectImageUrls(raw) {
  if (!raw || typeof raw !== 'object') return []
  const r = /** @type {Record<string, unknown>} */ (raw)
  const out = new Set()

  const push = (u) => {
    const s = asString(u)
    if (s && /^https?:\/\//i.test(s)) out.add(upgradeAirbnbImageUrl(s))
  }

  const walkArray = (arr) => {
    if (!Array.isArray(arr)) return
    for (const item of arr) {
      if (typeof item === 'string') push(item)
      else if (item && typeof item === 'object') {
        const o = /** @type {Record<string, unknown>} */ (item)
        push(o.url)
        push(o.uri)
        push(o.imageUrl)
        push(o.large)
        push(o.picture)
        push(o.baseUrl)
        if (o.imageUrls && typeof o.imageUrls === 'object') {
          const iu = /** @type {Record<string, unknown>} */ (o.imageUrls)
          push(iu.original)
          push(iu.large)
          push(iu.medium)
        }
      }
    }
  }

  walkArray(r.images)
  walkArray(r.photos)
  walkArray(r.pictures)
  walkArray(r.pictureUrls)
  if (Array.isArray(r.imageUrls)) walkArray(r.imageUrls)

  return [...out]
}

/**
 * Удобства из разных форматов.
 * @param {unknown} raw
 * @returns {string[]}
 */
export function collectAmenityLabels(raw) {
  if (!raw || typeof raw !== 'object') return []
  const r = /** @type {Record<string, unknown>} */ (raw)
  const labels = []

  const take = (v) => {
    if (typeof v === 'string' && v.trim()) labels.push(v.trim())
    else if (v && typeof v === 'object' && typeof (/** @type {Record<string, unknown>} */ (v)).name === 'string') {
      labels.push(String((/** @type {Record<string, unknown>} */ (v)).name).trim())
    }
  }

  if (Array.isArray(r.amenities)) {
    for (const a of r.amenities) take(a)
  }
  if (Array.isArray(r.amenityNames)) {
    for (const a of r.amenityNames) take(a)
  }
  if (Array.isArray(r.facilities)) {
    for (const a of r.facilities) take(a)
  }

  return [...new Set(labels)]
}

function pickPrice(raw) {
  if (!raw || typeof raw !== 'object') return null
  const r = /** @type {Record<string, unknown>} */ (raw)
  const candidates = [
    r.price,
    r.nightlyPrice,
    r.nightly_price,
    r.basePrice,
    r.amount,
    r.pricePerNight,
    r.rate,
    r.pricing && typeof r.pricing === 'object' ? (/** @type {Record<string, unknown>} */ (r.pricing)).basePrice : null,
    r.pricing && typeof r.pricing === 'object' ? (/** @type {Record<string, unknown>} */ (r.pricing)).rate : null,
  ]
  for (const c of candidates) {
    const n = asNumber(c)
    if (n != null && n > 0) return n
  }
  return null
}

/**
 * Привести сырой объект (Apify item или извлечённый JSON) к полям, которые читает mapAirbnbLike.
 * @param {Record<string, unknown>} item
 * @param {string} canonicalUrl
 */
export function normalizeAirbnbPayloadForMapper(item, canonicalUrl) {
  const roomId = extractAirbnbRoomId(canonicalUrl) || asString(item.id) || asString(item.roomId) || asString(item.listingId)

  const loc =
    item.location && typeof item.location === 'object'
      ? /** @type {Record<string, unknown>} */ (item.location)
      : {}

  const images = collectImageUrls(item)
  const amenity_names = collectAmenityLabels(item)

  const lat =
    asNumber(item.lat) ??
    asNumber(item.latitude) ??
    asNumber(loc.lat) ??
    asNumber(loc.latitude)
  const lng =
    asNumber(item.lng) ??
    asNumber(item.lon) ??
    asNumber(item.longitude) ??
    asNumber(loc.lng) ??
    asNumber(loc.longitude)

  return {
    name: asString(item.name) || asString(item.title) || asString(item.listingTitle),
    description: asString(item.description) || asString(item.summary) || asString(item.details),
    listing_url: canonicalUrl,
    url: canonicalUrl,
    id: roomId || undefined,
    room_id: roomId || undefined,
    nightly_price: pickPrice(item),
    price: pickPrice(item),
    pictures: images.map((url) => ({ url })),
    image_urls: images,
    amenity_names,
    amenities: amenity_names,
    city: asString(item.city) || asString(loc.city),
    neighborhood: asString(item.neighborhood) || asString(item.district) || asString(loc.neighborhood),
    district: asString(item.district) || asString(loc.district),
    lat,
    lng,
    latitude: lat,
    longitude: lng,
    location: { city: asString(loc.city) || asString(item.city), neighborhood: asString(loc.neighborhood) },
    bedrooms: asNumber(item.bedrooms) ?? asNumber(item.bedroomCount),
    beds: asNumber(item.beds) ?? asNumber(item.bedCount),
    bathrooms: asNumber(item.bathrooms) ?? asNumber(item.bathroomCount),
    accommodates: asNumber(item.accommodates) ?? asNumber(item.personCapacity) ?? asNumber(item.guests),
    person_capacity: asNumber(item.personCapacity) ?? asNumber(item.accommodates),
    check_in_time: asString(item.checkInTime) || asString(item.checkin),
    check_out_time: asString(item.checkOutTime) || asString(item.checkout),
    pets_allowed: item.petsAllowed ?? item.allowPets,
    smoking_allowed: item.smokingAllowed,
  }
}

/**
 * @param {string} canonicalUrl
 * @param {string} token
 * @param {string} actorId  например epctex~airbnb-scraper
 * @param {Record<string, unknown>} [extraInput]
 */
export async function fetchAirbnbViaApify(canonicalUrl, token, actorId, extraInput = {}) {
  const safeActor = encodeURIComponent(actorId)
  const endpoint = `https://api.apify.com/v2/acts/${safeActor}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`

  const defaultInput = {
    startUrls: [{ url: canonicalUrl }],
    maxListings: 1,
    ...extraInput,
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(defaultInput),
    signal: AbortSignal.timeout(120000),
  })

  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(`Apify: non-JSON response (${res.status})`)
  }

  if (!res.ok) {
    const msg = data?.error?.message || data?.message || text.slice(0, 200)
    throw new Error(`Apify error ${res.status}: ${msg}`)
  }

  let first = null
  if (Array.isArray(data) && data.length > 0) {
    first = data[0]
  } else if (data && typeof data === 'object' && !Array.isArray(data) && (data.id || data.roomId || data.title)) {
    first = data
  }

  if (!first) {
    throw new Error('Apify returned no listing rows — check actor input schema and APIFY_AIRBNB_ACTOR_ID')
  }

  return first
}

/**
 * Глубокий поиск первого объекта с похожими на листинг полями (для __NEXT_DATA__ / вложенных JSON).
 * @param {unknown} node
 * @param {number} depth
 */
function deepFindListingNode(node, depth = 0) {
  if (depth > 12 || node == null) return null
  if (typeof node === 'object' && !Array.isArray(node)) {
    const o = /** @type {Record<string, unknown>} */ (node)
    const hasTitle = typeof o.name === 'string' || typeof o.title === 'string' || typeof o.listingTitle === 'string'
    const hasPhotos =
      (Array.isArray(o.photos) && o.photos.length > 0) ||
      (Array.isArray(o.images) && o.images.length > 0) ||
      (Array.isArray(o.pictures) && o.pictures.length > 0)
    if (hasTitle && (hasPhotos || typeof o.description === 'string')) {
      return o
    }
    for (const k of Object.keys(o)) {
      const found = deepFindListingNode(o[k], depth + 1)
      if (found) return found
    }
  } else if (Array.isArray(node)) {
    for (const el of node) {
      const found = deepFindListingNode(el, depth + 1)
      if (found) return found
    }
  }
  return null
}

/**
 * @param {string} canonicalUrl
 */
export async function fetchAirbnbViaPlaywright(canonicalUrl) {
  const { chromium } = await import('playwright')

  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-dev-shm-usage', '--no-sandbox'],
  })

  try {
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'en-US',
    })
    const page = await context.newPage()
    await page.goto(canonicalUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })

    let listingNode = null

    const nextData = await page.evaluate(() => {
      const el = document.getElementById('__NEXT_DATA__')
      if (!el?.textContent) return null
      try {
        return JSON.parse(el.textContent)
      } catch {
        return null
      }
    })

    if (nextData) {
      listingNode = deepFindListingNode(nextData)
    }

    if (!listingNode) {
      listingNode = await page.evaluate(() => {
        const scripts = [...document.querySelectorAll('script[type="application/json"]')]
        for (const s of scripts) {
          try {
            const j = JSON.parse(s.textContent || '')
            const str = JSON.stringify(j)
            if (str.includes('Listing') && (str.includes('photo') || str.includes('Picture'))) {
              return j
            }
          } catch {
            /* skip */
          }
        }
        return null
      })
      if (listingNode && typeof listingNode === 'object') {
        listingNode = deepFindListingNode(listingNode) || listingNode
      }
    }

    const domImages = await page.evaluate(() => {
      const urls = [...document.querySelectorAll('img[src*="muscache.com"], img[src*="airbnb"]')]
        .map((img) => (/** @type {HTMLImageElement} */ (img)).src)
        .filter(Boolean)
      return [...new Set(urls)]
    })

    await context.close()

    const base =
      listingNode && typeof listingNode === 'object'
        ? /** @type {Record<string, unknown>} */ (listingNode)
        : {}

    const merged = { ...base }
    if (!collectImageUrls(merged).length && domImages.length) {
      merged.pictures = domImages.map((u) => ({ url: u }))
    }

    if (!asString(merged.name) && !asString(merged.title)) {
      throw new Error(
        'Playwright: could not extract listing JSON from page (Airbnb layout changed or blocked). Use Apify (APIFY_TOKEN).'
      )
    }

    return merged
  } finally {
    await browser.close()
  }
}

/**
 * @param {string} url
 * @returns {Promise<{ raw: Record<string, unknown>, source: 'apify' | 'playwright' }>}
 */
export async function fetchAirbnbListingRaw(url) {
  assertAllowedAirbnbUrl(url)
  const canonicalUrl = url.split('?')[0]

  const token = process.env.APIFY_TOKEN
  const actorId = process.env.APIFY_AIRBNB_ACTOR_ID || 'epctex~airbnb-scraper'

  let extraInput = {}
  if (process.env.APIFY_AIRBNB_INPUT_JSON) {
    try {
      extraInput = JSON.parse(process.env.APIFY_AIRBNB_INPUT_JSON)
    } catch {
      /* ignore invalid env */
    }
  }

  if (token) {
    const item = await fetchAirbnbViaApify(canonicalUrl, token, actorId, extraInput)
    return { raw: /** @type {Record<string, unknown>} */ (item), source: 'apify' }
  }

  const allowPw =
    process.env.ENABLE_AIRBNB_PLAYWRIGHT === 'true' || process.env.ENABLE_AIRBNB_PLAYWRIGHT === '1'
  if (!allowPw) {
    const err = new Error(
      'Airbnb import is not configured: set APIFY_TOKEN (recommended) or ENABLE_AIRBNB_PLAYWRIGHT=1 for Playwright (self-hosted only).'
    )
    err.code = 'IMPORT_NOT_CONFIGURED'
    throw err
  }

  const raw = await fetchAirbnbViaPlaywright(canonicalUrl)
  return { raw, source: 'playwright' }
}
