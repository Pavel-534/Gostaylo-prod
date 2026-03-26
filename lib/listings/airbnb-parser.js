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
  walkArray(r.photos)      // официальный актор: photos: [{ picture, caption }]
  walkArray(r.gallery)     // альтернативное поле
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

  /**
   * Принимает строку, объект { name } или объект { title } (grouped amenities от официального актора).
   * Официальный apify~airbnb-scraper может вернуть:
   *   amenities: [ "Wifi", "Pool", ... ]
   * или сгруппированный вариант:
   *   amenityGroups: [{ title: "Bathroom", amenities: ["Bathtub", "Shower"] }]
   */
  const take = (v) => {
    if (typeof v === 'string' && v.trim()) {
      labels.push(v.trim())
    } else if (v && typeof v === 'object') {
      const o = /** @type {Record<string, unknown>} */ (v)
      const label = o.name ?? o.title ?? o.label ?? o.text
      if (typeof label === 'string' && label.trim()) {
        labels.push(label.trim())
      }
      // Рекурсивно раскрываем вложенный массив удобств (amenityGroups[].amenities)
      if (Array.isArray(o.amenities)) {
        for (const a of o.amenities) take(a)
      }
      if (Array.isArray(o.items)) {
        for (const a of o.items) take(a)
      }
    }
  }

  const tryArray = (key) => {
    if (Array.isArray(r[key])) {
      for (const a of r[key]) take(a)
    }
  }

  tryArray('amenities')
  tryArray('amenityGroups')   // официальный актор — сгруппированные удобства
  tryArray('amenityNames')
  tryArray('facilitiesGroups')
  tryArray('facilities')

  return [...new Set(labels)]
}

/**
 * Вспомогательная функция: извлечь число из значения или из объекта { amount, value }.
 * @param {unknown} v
 */
function pickNumericAmount(v) {
  const direct = asNumber(v)
  if (direct != null) return direct
  if (v && typeof v === 'object') {
    const o = /** @type {Record<string, unknown>} */ (v)
    return asNumber(o.amount) ?? asNumber(o.value) ?? asNumber(o.price) ?? null
  }
  return null
}

function pickPrice(raw) {
  if (!raw || typeof raw !== 'object') return null
  const r = /** @type {Record<string, unknown>} */ (raw)

  const pricing = r.pricing && typeof r.pricing === 'object'
    ? /** @type {Record<string, unknown>} */ (r.pricing)
    : null
  const priceBreakdown = r.priceBreakdown && typeof r.priceBreakdown === 'object'
    ? /** @type {Record<string, unknown>} */ (r.priceBreakdown)
    : null
  const priceInfo = r.priceInfo && typeof r.priceInfo === 'object'
    ? /** @type {Record<string, unknown>} */ (r.priceInfo)
    : null

  // Плоские числовые поля — проверяем первыми
  const flatCandidates = [
    r.price,
    r.nightlyPrice,
    r.nightly_price,
    r.basePrice,
    r.base_price,
    r.amount,
    r.pricePerNight,
    r.price_per_night,
    r.rate,
    r.listingPrice,
    r.listing_price,
    r.originalPrice,
    r.displayPrice,
  ]
  for (const c of flatCandidates) {
    const n = asNumber(c)
    if (n != null && n > 0) return n
  }

  // Вложенные структуры — используем pickNumericAmount, чтобы
  // вытащить { amount } из официального apify~airbnb-scraper формата:
  //   pricing: { rate: { amount: 5000, currency: 'THB' }, cleaningFee: { amount: 500 } }
  const nestedCandidates = [
    pricing?.rate,          // официальный актор: pricing.rate = { amount, currency }
    pricing?.basePrice,
    pricing?.base_price,
    pricing?.nightlyPrice,
    pricing?.price,
    pricing?.amount,
    pricing?.nightly,
    priceBreakdown?.basePrice,
    priceBreakdown?.rate,
    priceBreakdown?.price,
    priceBreakdown?.amount,
    priceInfo?.price,
    priceInfo?.rate,
    priceInfo?.basePrice,
  ]
  for (const c of nestedCandidates) {
    const n = pickNumericAmount(c)
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
  // ── Диагностический лог для сервера ─────────────────────────────────────
  if (item && typeof item === 'object') {
    const keys = Object.keys(item)
    console.log(
      `[airbnb-parser] Using official Apify actor. Fields found: ${keys.length}`,
      '| Keys:', keys.slice(0, 40).join(', ')
    )
  }

  const roomId =
    extractAirbnbRoomId(canonicalUrl) ||
    asString(item.id) ||
    asString(item.roomId) ||
    asString(item.listingId) ||
    asString(item.listing_id) ||
    asString(item.room_id)

  const loc =
    item.location && typeof item.location === 'object'
      ? /** @type {Record<string, unknown>} */ (item.location)
      : item.locationDetail && typeof item.locationDetail === 'object'
        ? /** @type {Record<string, unknown>} */ (item.locationDetail)
        : {}

  const images = collectImageUrls(item)
  const amenity_names = collectAmenityLabels(item)

  const lat =
    asNumber(item.lat) ??
    asNumber(item.latitude) ??
    asNumber(loc.lat) ??
    asNumber(loc.latitude) ??
    asNumber(loc.coordinatesLat)
  const lng =
    asNumber(item.lng) ??
    asNumber(item.lon) ??
    asNumber(item.longitude) ??
    asNumber(loc.lng) ??
    asNumber(loc.lon) ??
    asNumber(loc.longitude) ??
    asNumber(loc.coordinatesLng)

  // ── Цена и валюта из всех схем ───────────────────────────────────────────
  const pricingObj = item.pricing && typeof item.pricing === 'object'
    ? /** @type {Record<string, unknown>} */ (item.pricing)
    : null
  const pricingRate = pricingObj?.rate && typeof pricingObj.rate === 'object'
    ? /** @type {Record<string, unknown>} */ (pricingObj.rate)
    : null
  const priceBreakdown = item.priceBreakdown && typeof item.priceBreakdown === 'object'
    ? /** @type {Record<string, unknown>} */ (item.priceBreakdown)
    : null

  const currency =
    asString(item.currency) ||
    asString(item.priceCurrency) ||
    asString(item.price_currency) ||
    asString(item.currencyCode) ||
    // официальный актор: pricing.rate.currency
    (pricingRate ? asString(pricingRate.currency) || asString(pricingRate.currencyCode) : null) ||
    (pricingObj ? asString(pricingObj.currency) || asString(pricingObj.currencyCode) : null) ||
    (priceBreakdown ? asString(priceBreakdown.currency) : null) ||
    null

  // ── Текстовые поля ───────────────────────────────────────────────────────
  const name =
    asString(item.name) ||
    asString(item.title) ||
    asString(item.listingTitle) ||
    asString(item.listing_title) ||
    asString(item.roomName) ||
    asString(item.room_title) ||
    asString(item.propertyName) ||
    asString(item.property_name) ||
    ''

  // Официальный актор может вернуть sectionedDescription — массив объектов { title, body }
  let description = ''
  if (!description) {
    const sectioned = item.sectionedDescription
    if (Array.isArray(sectioned) && sectioned.length > 0) {
      description = sectioned
        .map((s) => {
          if (typeof s === 'string') return s
          if (s && typeof s === 'object') {
            const o = /** @type {Record<string, unknown>} */ (s)
            return [asString(o.title), asString(o.body), asString(o.text)].filter(Boolean).join('\n')
          }
          return ''
        })
        .filter(Boolean)
        .join('\n\n')
    }
  }
  if (!description) {
    description =
      asString(item.description) ||
      asString(item.htmlDescription) ||
      asString(item.summary) ||
      asString(item.details) ||
      asString(item.aboutThisSpace) ||
      asString(item.about_this_space) ||
      asString(item.the_space) ||
      asString(item.theSpace) ||
      asString(item.overview) ||
      asString(item.about) ||
      asString(item.notes) ||
      ''
  }

  // ── Гео-поля ─────────────────────────────────────────────────────────────
  // locationTitle у официального актора: "Rawai, Phuket Province, Thailand"
  const locationTitle = asString(item.locationTitle) || asString(item.location_title) || ''

  const city =
    asString(item.city) ||
    asString(loc.city) ||
    asString(item.cityName) ||
    asString(item.address_city) ||
    // Разбить locationTitle: берём первую часть — обычно это район/город
    (locationTitle ? locationTitle.split(',')[0].trim() : '') ||
    ''

  const neighborhood =
    asString(item.neighborhood) ||
    asString(item.district) ||
    asString(item.area) ||
    asString(loc.neighborhood) ||
    asString(loc.area) ||
    asString(loc.district) ||
    // locationTitle как fallback — берём первую часть (район)
    (locationTitle ? locationTitle.split(',')[0].trim() : '') ||
    ''

  // roomType (тип жилья) — сохраняем в metadata позже через map-external-to-internal
  const roomType =
    asString(item.roomType) ||
    asString(item.room_type) ||
    asString(item.propertyType) ||
    asString(item.property_type) ||
    ''

  return {
    name,
    description,
    room_type: roomType,
    listing_url: canonicalUrl,
    url: canonicalUrl,
    id: roomId || undefined,
    room_id: roomId || undefined,
    nightly_price: pickPrice(item),
    price: pickPrice(item),
    currency,
    pictures: images.map((url) => ({ url })),
    image_urls: images,
    amenity_names,
    amenities: amenity_names,
    city,
    neighborhood,
    location_title: locationTitle || undefined,
    district: asString(item.district) || asString(loc.district) || neighborhood || undefined,
    lat,
    lng,
    latitude: lat,
    longitude: lng,
    location: { city, neighborhood },
    bedrooms:
      asNumber(item.bedrooms) ??
      asNumber(item.bedroomCount) ??
      asNumber(item.bedroom_count) ??
      asNumber(item.numBedrooms),
    beds:
      asNumber(item.beds) ??
      asNumber(item.bedCount) ??
      asNumber(item.bed_count) ??
      asNumber(item.numBeds),
    bathrooms:
      asNumber(item.bathrooms) ??
      asNumber(item.bathroomCount) ??
      asNumber(item.bathroom_count) ??
      asNumber(item.numBathrooms),
    accommodates:
      asNumber(item.accommodates) ??
      asNumber(item.personCapacity) ??
      asNumber(item.person_capacity) ??
      asNumber(item.maxGuests) ??
      asNumber(item.max_guests) ??
      asNumber(item.guests),
    person_capacity:
      asNumber(item.personCapacity) ??
      asNumber(item.person_capacity) ??
      asNumber(item.accommodates) ??
      asNumber(item.maxGuests),
    check_in_time:
      asString(item.checkInTime) ||
      asString(item.check_in_time) ||
      asString(item.checkin) ||
      asString(item.checkIn) ||
      '',
    check_out_time:
      asString(item.checkOutTime) ||
      asString(item.check_out_time) ||
      asString(item.checkout) ||
      asString(item.checkOut) ||
      '',
    pets_allowed: item.petsAllowed ?? item.allowPets ?? item.pets_allowed ?? null,
    smoking_allowed: item.smokingAllowed ?? item.smoking_allowed ?? null,
  }
}

/**
 * Максимальное время ожидания ответа от одного Apify актора (мс).
 * 28 сек × 4 актора = 112 сек < maxDuration роута (120).
 */
const ACTOR_TIMEOUT_MS = 28_000

/**
 * Акторы Apify, которые пробуем по очереди.
 * Порядок: официальный актор Apify — первым; остальные — fallback.
 *
 * Задать первичный актор можно через APIFY_AIRBNB_ACTOR_ID.
 * ПРИМЕЧАНИЕ: tri_angle~airbnb-scraper НЕ поддерживает прямые URL листингов.
 */
/**
 * Список кандидатов, сортированных по приоритету.
 *
 * ПЛАТНЫЕ / НЕРАБОЧИЕ акторы не включать:
 *   ✗ tri_angle~airbnb-scraper   — не поддерживает прямые URL листингов
 *   ✗ caprolok~airbnb-scraper    — платный (403 после trial)
 *
 * Рекомендуется настроить через Vercel:
 *   APIFY_AIRBNB_ACTOR_ID=apify~airbnb-scraper
 * или создать Task в Apify UI с residential proxy и указать:
 *   APIFY_AIRBNB_TASK_ID=<id>
 */
const APIFY_ACTOR_CANDIDATES = [
  {
    // Официальный актор Apify — поддерживает прямые ссылки, платит за
    // проксирование из общего пула аккаунта.
    id: 'apify~airbnb-scraper',
    buildInput: (url, extra) => ({
      startUrls: [{ url }],
      maxListings: 1,
      proxyConfiguration: { useApifyProxy: true },
      ...extra,
    }),
  },
  {
    id: 'dtrungtin~airbnb-scraper',
    buildInput: (url, extra) => ({
      startUrls: [{ url }],
      maxListings: 1,
      proxyConfiguration: { useApifyProxy: true },
      ...extra,
    }),
  },
  {
    id: 'automation-lab~airbnb-listing',
    buildInput: (url, extra) => ({
      startUrls: [{ url }],
      proxyConfiguration: { useApifyProxy: true },
      ...extra,
    }),
  },
]

/**
 * Вызывает один Apify Actor и возвращает первый item датасета.
 * При 404 бросает ошибку с кодом ACTOR_NOT_FOUND (не прерывает цепочку).
 *
 * @param {string} canonicalUrl
 * @param {string} token
 * @param {{ id: string, buildInput: (url: string, extra: object) => object }} actor
 * @param {Record<string, unknown>} [extraInput]
 */
async function tryApifyActor(canonicalUrl, token, actor, extraInput = {}) {
  const safeActor = encodeURIComponent(actor.id)
  const endpoint = `https://api.apify.com/v2/acts/${safeActor}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`
  const input = actor.buildInput(canonicalUrl, extraInput)

  // ── Логируем что именно отправляем ───────────────────────────────────────
  console.log(`[airbnb-parser] Trying Apify actor: ${actor.id}`)
  console.log('[airbnb-parser] Sending input to Apify:', JSON.stringify(input))

  let res
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(ACTOR_TIMEOUT_MS),
    })
  } catch (fetchErr) {
    const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr)
    const isTimeout = msg.includes('timeout') || msg.includes('abort') || msg.includes('AbortError')
    console.error(`[airbnb-parser] ${isTimeout ? 'Timeout' : 'Network error'} calling actor ${actor.id}:`, msg)
    const err = new Error(`Apify ${isTimeout ? 'timeout' : 'network error'} (actor ${actor.id}): ${msg}`)
    // Таймаут = актор слишком долго работает → пробуем следующий
    err.code = isTimeout ? 'APIFY_ACTOR_TIMEOUT' : 'APIFY_HTTP_ERROR'
    err.httpStatus = 0
    throw err
  }

  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    console.error(`[airbnb-parser] Non-JSON response from actor ${actor.id} (HTTP ${res.status}):`, text.slice(0, 500))
    const err = new Error(`Apify: non-JSON response from actor ${actor.id} (HTTP ${res.status})`)
    err.code = 'APIFY_HTTP_ERROR'
    err.httpStatus = res.status
    throw err
  }

  if (res.status === 404) {
    const msg = data?.error?.message || data?.message || 'Actor not found'
    // Используем console.error (не warn) — чтобы было видно в Vercel
    console.error(`[airbnb-parser] Actor ${actor.id} → 404 (not found): ${msg}`)
    const err = new Error(`Apify error 404: Actor ${actor.id} not found`)
    err.code = 'ACTOR_NOT_FOUND'
    throw err
  }

  if (!res.ok) {
    const errMsg = data?.error?.message || data?.message || text.slice(0, 300)
    const errType = data?.error?.type || ''
    const runId = errMsg?.match(/run ID: ([^,)]+)/)?.[1] || ''

    console.error(
      `[airbnb-parser] Actor ${actor.id} → HTTP ${res.status} (type=${errType}${runId ? ', runId=' + runId : ''}):`, errMsg
    )
    console.error('[airbnb-parser] Full Apify error response:', JSON.stringify(data).slice(0, 1000))

    const err = new Error(`Apify error ${res.status} (actor ${actor.id}): ${errMsg}`)
    err.code = 'APIFY_HTTP_ERROR'
    err.httpStatus = res.status

    if (res.status === 400) {
      if (errType === 'run-failed') {
        // Актор ЗАПУСТИЛСЯ, но упал при выполнении (Airbnb заблокировал, нет proxy и т.п.)
        err.code = 'APIFY_RUN_FAILED'
      } else {
        // Актор отклонил input (не поддерживает такой формат URL)
        err.code = 'APIFY_ACTOR_REJECTED_INPUT'
      }
    } else if (res.status === 422) {
      err.code = 'APIFY_ACTOR_REJECTED_INPUT'
    } else if (res.status === 403) {
      // Платный актор / истёк пробный период — пропускаем, пробуем следующий
      const isPaymentRequired =
        /trial|rent|paid|payment|subscription|billing/i.test(errMsg)
      if (isPaymentRequired) {
        err.code = 'APIFY_PAYMENT_REQUIRED'
        console.warn(`[airbnb-parser] Actor ${actor.id} requires payment — skipping`)
      }
      // 403 без признаков оплаты = проблема с токеном → APIFY_HTTP_ERROR, цепочка прерывается
    }
    // 401 = неверный токен → APIFY_HTTP_ERROR, цепочка прерывается немедленно
    throw err
  }

  // ── Логируем сырой ответ для диагностики ─────────────────────────────────
  console.log(
    `[airbnb-parser] Raw data from Apify (actor ${actor.id}):`,
    JSON.stringify(data).slice(0, 3000)
  )

  // Датасет может вернуться как массив или как одиночный объект
  let first = null
  if (Array.isArray(data) && data.length > 0) {
    first = data[0]
  } else if (Array.isArray(data) && data.length === 0) {
    // пустой массив — актор ничего не нашёл
    first = null
  } else if (data && typeof data === 'object' && !Array.isArray(data)) {
    // Некоторые акторы оборачивают датасет в { items: [] } или { data: [] }
    if (Array.isArray(data.items) && data.items.length > 0) {
      first = data.items[0]
    } else if (Array.isArray(data.data) && data.data.length > 0) {
      first = data.data[0]
    } else if (Array.isArray(data.results) && data.results.length > 0) {
      first = data.results[0]
    } else if (
      data.id || data.roomId || data.listing_id ||
      data.title || data.name || data.listingTitle ||
      data.photos || data.images
    ) {
      // Одиночный объект-листинг
      first = data
    }
  }

  if (!first) {
    console.warn(`[airbnb-parser] Actor ${actor.id} returned empty dataset`)
    const err = new Error(`Apify actor ${actor.id} returned empty dataset — the listing may be unavailable or the URL format is unsupported`)
    err.code = 'APIFY_EMPTY_DATASET'
    throw err
  }

  console.log(`[airbnb-parser] Actor ${actor.id} succeeded. Top-level keys: ${Object.keys(first).slice(0, 30).join(', ')}`)
  return first
}

/**
 * Запускает Apify с цепочкой fallback-акторов.
 * Если задан APIFY_AIRBNB_ACTOR_ID — он идёт первым; при ошибке переходим к встроенному списку.
 *
 * @param {string} canonicalUrl
 * @param {string} token
 * @param {string} [primaryActorId]  APIFY_AIRBNB_ACTOR_ID из env
 * @param {Record<string, unknown>} [extraInput]
 * @returns {Promise<{ item: Record<string, unknown>, actorId: string }>}
 */
export async function fetchAirbnbViaApify(canonicalUrl, token, primaryActorId, extraInput = {}) {
  // Собираем очередь: сначала то, что задано в env, затем встроенные кандидаты
  const queue = []

  if (primaryActorId) {
    // Ищем в кандидатах — берём их buildInput; если нет — используем универсальный
    const known = APIFY_ACTOR_CANDIDATES.find((a) => a.id === primaryActorId)
    queue.push(
      known ?? {
        id: primaryActorId,
        buildInput: (url, extra) => ({ startUrls: [{ url }], maxListings: 1, ...extra }),
      }
    )
  }

  // Добавляем остальных кандидатов (не дублируем primary)
  for (const candidate of APIFY_ACTOR_CANDIDATES) {
    if (candidate.id !== primaryActorId) {
      queue.push(candidate)
    }
  }

  const triedIds = []
  const skippedCodes = new Set()
  let lastError = null

  /**
   * Коды, при которых продолжаем fallback-цепочку к следующему актору:
   *  ACTOR_NOT_FOUND            — 404, актора не существует
   *  APIFY_EMPTY_DATASET        — актор запустился, но вернул пустой датасет
   *  APIFY_ACTOR_REJECTED_INPUT — HTTP 400/422: актор не поддерживает такой формат URL/input
   *  APIFY_RUN_FAILED           — HTTP 400 run-failed: актор запустился, но Airbnb его заблокировал
   *  APIFY_ACTOR_TIMEOUT        — актор не ответил за ACTOR_TIMEOUT_MS мс
   */
  const SKIPPABLE = new Set([
    'ACTOR_NOT_FOUND',              // 404 — актора не существует
    'APIFY_EMPTY_DATASET',          // актор запустился, но вернул пустой датасет
    'APIFY_ACTOR_REJECTED_INPUT',   // 400/422 — актор не поддерживает такой формат URL
    'APIFY_RUN_FAILED',             // 400 run-failed — Airbnb заблокировал во время выполнения
    'APIFY_ACTOR_TIMEOUT',          // таймаут (> ACTOR_TIMEOUT_MS)
    'APIFY_PAYMENT_REQUIRED',       // 403 — актор платный / истёк пробный период
  ])

  for (const actor of queue) {
    triedIds.push(actor.id)
    try {
      const item = await tryApifyActor(canonicalUrl, token, actor, extraInput)
      console.log(`[airbnb-parser] ✅ SUCCESS via actor: ${actor.id}`)
      return { item, actorId: actor.id }
    } catch (err) {
      lastError = err
      if (SKIPPABLE.has(err.code)) {
        console.warn(`[airbnb-parser] Actor ${actor.id} skipped (${err.code}), trying next...`)
        skippedCodes.add(err.code)
        continue
      }
      // 401/403 (токен) или сетевая ошибка — прерываем сразу, нет смысла пробовать следующий
      console.error(`[airbnb-parser] Fatal error from actor ${actor.id} (${err.code ?? 'unknown'}):`, err.message)
      throw err
    }
  }

  console.error(
    `[airbnb-parser] All Apify actors failed. Tried: ${triedIds.join(', ')}. Codes: ${[...skippedCodes].join(', ')}`
  )

  // Если хотя бы один актор вернул пустой датасет — скорее всего объявление закрыто
  if (skippedCodes.has('APIFY_EMPTY_DATASET')) {
    const err = new Error(
      `Объявление не найдено или недоступно для парсинга (попробовали: ${triedIds.join(', ')}). ` +
      `Проверьте, что объявление открыто в браузере.`
    )
    err.code = 'LISTING_NOT_FOUND'
    throw err
  }

  // Все акторы провалились при выполнении — Airbnb блокирует без residential proxy
  if (skippedCodes.has('APIFY_RUN_FAILED')) {
    const err = new Error(
      `Все акторы были заблокированы Airbnb (run-failed). ` +
      `Попробовали: ${triedIds.join(', ')}. ` +
      `Решение: создайте Apify Task в UI консоли с residential proxy и установите APIFY_AIRBNB_TASK_ID в Vercel env.`
    )
    err.code = 'ALL_ACTORS_BLOCKED'
    throw err
  }

  // Все акторы не ответили вовремя
  if ([...skippedCodes].every((c) => c === 'APIFY_ACTOR_TIMEOUT')) {
    const err = new Error(
      `Все акторы превысили таймаут (${ACTOR_TIMEOUT_MS / 1000}с). ` +
      `Попробовали: ${triedIds.join(', ')}.`
    )
    err.code = 'ALL_ACTORS_UNAVAILABLE'
    throw err
  }

  // Все акторы не найдены или отклонили input
  const err = new Error(
    `Ни один Apify-актор не смог обработать запрос.\n` +
    `Попробовали: ${triedIds.join(', ')}.\n` +
    `Установите APIFY_AIRBNB_ACTOR_ID=apify~airbnb-scraper в переменных окружения.`
  )
  err.code = 'ALL_ACTORS_UNAVAILABLE'
  throw err
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
 * Запустить Apify Task (приоритетный путь — настраивается в UI Apify с нужным proxy).
 * Задача хранит свои настройки; здесь передаём только URL листинга.
 *
 * @param {string} canonicalUrl
 * @param {string} token
 * @param {string} taskId  формат username~taskName или числовой ID
 * @param {Record<string, unknown>} [extraInput]
 * @returns {Promise<{ item: Record<string, unknown>, taskId: string }>}
 */
export async function fetchAirbnbViaApifyTask(canonicalUrl, token, taskId, extraInput = {}) {
  const safeTask = encodeURIComponent(taskId)
  const endpoint = `https://api.apify.com/v2/actor-tasks/${safeTask}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`

  console.log(`[airbnb-parser] 🔑 Using Apify Task (priority path): ${taskId}`)
  console.log('[airbnb-parser] Sending input to Apify Task:', JSON.stringify({ startUrls: [{ url: canonicalUrl }] }))

  let res
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startUrls: [{ url: canonicalUrl }],
        ...extraInput,
      }),
      signal: AbortSignal.timeout(ACTOR_TIMEOUT_MS),
    })
  } catch (fetchErr) {
    const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr)
    console.error(`[airbnb-parser] Apify Task network/timeout error (${taskId}):`, msg)
    throw new Error(`Apify Task network error (${taskId}): ${msg}`)
  }

  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    console.error(`[airbnb-parser] Apify Task non-JSON response (${res.status}):`, text.slice(0, 500))
    throw new Error(`Apify Task: non-JSON response (${res.status})`)
  }

  if (!res.ok) {
    const msg = data?.error?.message || data?.message || text.slice(0, 300)
    console.error(`[airbnb-parser] Apify Task ${taskId} → HTTP ${res.status}:`, msg)
    throw new Error(`Apify Task error ${res.status} (task ${taskId}): ${msg}`)
  }

  const first = Array.isArray(data) ? data[0] : (data?.items?.[0] ?? data?.data?.[0] ?? null)
  if (!first) {
    console.warn(`[airbnb-parser] Apify Task ${taskId} returned empty dataset`)
    throw new Error(`Apify Task ${taskId} returned empty dataset`)
  }

  console.log(`[airbnb-parser] ✅ SUCCESS via Task: ${taskId}. Keys: ${Object.keys(first).slice(0, 20).join(', ')}`)
  return { item: first, taskId }
}

/**
 * @param {string} url
 * @returns {Promise<{ raw: Record<string, unknown>, source: string }>}
 *   source — строка вида 'apify-task:<taskId>', 'apify:<actorId>', 'playwright'
 */
export async function fetchAirbnbListingRaw(url) {
  assertAllowedAirbnbUrl(url)
  const canonicalUrl = url.split('?')[0]

  const token = process.env.APIFY_TOKEN
  const primaryActorId = process.env.APIFY_AIRBNB_ACTOR_ID || null
  const taskId = process.env.APIFY_AIRBNB_TASK_ID || null

  // ── Стартовый лог: какой путь выбран ─────────────────────────────────────
  if (!token) {
    console.log('[airbnb-parser] No APIFY_TOKEN — will try Playwright')
  } else if (taskId) {
    console.log(`[airbnb-parser] Import path: Apify Task (APIFY_AIRBNB_TASK_ID=${taskId}) [PRIORITY]`)
  } else if (primaryActorId) {
    console.log(`[airbnb-parser] Import path: Apify Actor chain (primary=${primaryActorId})`)
  } else {
    console.log(`[airbnb-parser] Import path: Apify Actor chain (auto, first=${APIFY_ACTOR_CANDIDATES[0]?.id})`)
  }

  let extraInput = {}
  if (process.env.APIFY_AIRBNB_INPUT_JSON) {
    try {
      extraInput = JSON.parse(process.env.APIFY_AIRBNB_INPUT_JSON)
    } catch {
      console.warn('[airbnb-parser] APIFY_AIRBNB_INPUT_JSON is invalid JSON — ignoring')
    }
  }

  if (token) {
    // ── Task — приоритетный путь (настройки proxy сохранены в Apify UI) ─────
    if (taskId) {
      const { item, taskId: usedTask } = await fetchAirbnbViaApifyTask(canonicalUrl, token, taskId, extraInput)
      return { raw: /** @type {Record<string, unknown>} */ (item), source: `apify-task:${usedTask}` }
    }

    // ── Актор(ы) с fallback-цепочкой ────────────────────────────────────────
    const { item, actorId } = await fetchAirbnbViaApify(canonicalUrl, token, primaryActorId, extraInput)
    return { raw: /** @type {Record<string, unknown>} */ (item), source: `apify:${actorId}` }
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
