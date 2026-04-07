/**
 * Tiny neutral blur for listing cards (Next/Image placeholder="blur").
 * SVG → base64, ~200 bytes.
 */
export const LISTING_CARD_BLUR_DATA_URL =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iMzAiIHZpZXdCb3g9IjAgMCA0MCAzMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAiIGhlaWdodD0iMzAiIGZpbGw9IiNlMmU4ZjAiLz48L3N2Zz4='

/**
 * LQIP: если в метаданных листинга есть data URL плейсхолдера (например сгенерированный при загрузке фото),
 * используем его вместо серого прямоугольника.
 * Ожидаемые поля: metadata.card_blur_data_url или metadata.blur_data_url (строка data:image/...;base64,...)
 */
export function getListingCardBlurDataURL(listing) {
  const meta = listing?.metadata
  if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
    const raw = meta.card_blur_data_url || meta.blur_data_url
    if (typeof raw === 'string' && raw.startsWith('data:image/') && raw.length > 50) {
      return raw
    }
  }
  return LISTING_CARD_BLUR_DATA_URL
}
