/**
 * Stage 200.95 — grammatical subtitle for wizard specs ("Add details for your …").
 * RU needs genitive + lowercase; EN/others lowercase the category noun.
 */

const RU_CATEGORY_GENITIVE = {
  недвижимость: 'недвижимости',
  транспорт: 'транспорта',
  услуга: 'услуги',
  услуги: 'услуг',
  тур: 'тура',
  туры: 'туров',
  сервис: 'сервиса',
}

/**
 * @param {(key: string) => string} t
 * @param {string} language
 * @param {string} [categoryLabel]
 * @returns {string}
 */
export function formatWizardAddDetailsLine(t, language, categoryLabel) {
  const label = String(categoryLabel || '').trim()
  if (!label) {
    return typeof t === 'function' ? t('addDetailsForStay') : ''
  }

  const lang = String(language || '').toLowerCase().slice(0, 2)
  if (lang === 'ru') {
    const key = label.toLowerCase()
    const genitive = RU_CATEGORY_GENITIVE[key] || key
    return `${t('addDetailsFor')} ${genitive}.`
  }

  return `${t('addDetailsFor')} ${label.toLowerCase()}.`
}
