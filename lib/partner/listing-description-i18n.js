/**
 * Двуязычное описание объявления: metadata.description_translations + колонка listings.description (канон RU).
 */

export function pickPartnerFormDescription(lang, listingDescription, meta) {
  const dt = meta?.description_translations
  if (dt && typeof dt === 'object') {
    if (lang === 'ru' && dt.ru) return String(dt.ru)
    if (lang === 'en' && dt.en) return String(dt.en)
    if ((lang === 'zh' || lang === 'th') && (dt.en || dt.ru)) return String(dt.en || dt.ru)
  }
  return listingDescription || ''
}

/** Колонка listings.description + JSON-LD: приоритет русского текста. */
export function buildListingDescriptionForDb(formData, uiLang) {
  const dt = formData.metadata?.description_translations
  const ru = (dt?.ru && String(dt.ru).trim()) || ''
  const en = (dt?.en && String(dt.en).trim()) || ''
  const single = String(formData.description || '').trim()
  if (ru) return ru
  if (uiLang === 'en' && en) return en
  return single
}

export function mergeDescriptionTranslationsForSave(formData, uiLang) {
  const raw = formData.description || ''
  const prev = formData.metadata?.description_translations
  const dt = { ...(typeof prev === 'object' ? prev : {}) }
  if (uiLang === 'ru') dt.ru = raw
  else if (uiLang === 'en') dt.en = raw
  if (!dt.en && dt.ru) dt.en = dt.ru
  if (!dt.ru && dt.en) dt.ru = dt.en
  return dt
}
