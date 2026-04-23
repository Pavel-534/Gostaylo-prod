/**
 * GoStayLo translations — public API (modular implementation in ./translations/).
 * @see ./translations/index.js
 */

export {
  categoryTranslations,
  amenityTranslations,
  uiTranslations,
  supportedLanguages,
  DEFAULT_UI_LANGUAGE,
  getCategoryName,
  getAmenityName,
  getUIText,
  t,
  getListingText,
  detectLanguage,
  setLanguage,
  getLangFromRequest,
} from './translations/index.js'
