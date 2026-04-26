/**
 * Stage 61.0 — vertical copy SSOT (layer before slug-specific `verticals/*.js`).
 * Category display names stay in `lib/translations/categories.js` (`getCategoryName`).
 * Service-type lines for ops/success paths may live in `lib/config/success-guide-content.js`.
 * Add here only **cross-vertical** UI strings keyed for future `resolveVerticalUi(lang, slug)`.
 */
export const baseVerticalUi = {
  ru: {
    verticalBase_offerGeneric: 'Предложение',
  },
  en: {
    verticalBase_offerGeneric: 'Offer',
  },
  zh: {
    verticalBase_offerGeneric: '方案',
  },
  th: {
    verticalBase_offerGeneric: 'แพ็กเกจ',
  },
}
