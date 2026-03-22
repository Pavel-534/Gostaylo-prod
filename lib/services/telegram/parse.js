/**
 * Caption / command parsing — price, category, district, /link email.
 */

export const CATEGORY_KEYWORDS = {
  'cat-yachts': ['яхта', 'yacht', 'лодка', 'boat', 'катер', 'катамаран', 'catamaran'],
  'cat-vehicles': ['байк', 'bike', 'мот', 'скутер', 'scooter', 'машина', 'car', 'авто', 'аренда авто'],
  'cat-tours': ['тур', 'tour', 'экскурсия', 'excursion', 'поездка', 'trip', 'сёрфинг', 'surf'],
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
