/**
 * Stage 53.0 — единый SSOT числовых фолбэков split-fee (гость / хост из general / резервный фонд).
 * Реэкспортируется из `lib/services/currency.service.js`; импортируйте отсюда в клиентских модулях без тяги `supabaseAdmin`.
 * @see ARCHITECTURAL_DECISIONS.md Golden rule §2
 */

/**
 * @typedef {{
 *   guestServiceFeePercent: number,
 *   hostCommissionPercentFromGeneral: number,
 *   insuranceFundPercent: number,
 * }} PlatformSplitFeeDefaults
 */

/** @type {Readonly<PlatformSplitFeeDefaults>} */
export const PLATFORM_SPLIT_FEE_DEFAULTS = Object.freeze({
  /** Сервисный сбор с гостя (% от субтотала), не доля хоста */
  guestServiceFeePercent: 5,
  hostCommissionPercentFromGeneral: 0,
  /**
   * Резервный (страховой) фонд: % от **валовой маржи платформы** (guest fee + host commission THB),
   * не путать с `hostCommissionPercent` / комиссией с партнёра.
   */
  insuranceFundPercent: 0.5,
})
