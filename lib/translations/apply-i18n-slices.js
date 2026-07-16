/**
 * Merge lazy i18n slices into mutable `uiTranslations` (Stage 171.31).
 * @see register-*-slice.js per route group.
 */
import { uiTranslations, LANGS } from './translation-state'

/**
 * @param {Record<string, Record<string, string>>} sliceByLang — e.g. chatUi
 */
export function applyI18nSlices(sliceByLang) {
  if (!sliceByLang || typeof sliceByLang !== 'object') return
  for (const lang of LANGS) {
    const patch = sliceByLang[lang]
    if (patch && typeof patch === 'object') {
      Object.assign(uiTranslations[lang], patch)
    }
  }
}
