/**
 * Stage 115.0 — SSOT визуальных классов продукта (Tailwind + globals `.gsl-*`).
 * Не меняет бизнес-логику; только cohesion layout / states / brand chrome.
 */

/** Deep teal brand (Stage 77+); согласован с referral / mobile nav */
export const BRAND_DEEP_HEX = '#006666'
export const BRAND_DEEP_HOVER_HEX = '#005757'
export const SURFACE_HEX = '#f7f9fb'
/** SVG / charts default accent */
export const BRAND_CHART_HEX = '#006666'

/** Shared focus ring for search bars (home hero, sticky bar) */
export const GSL_FIELD_FOCUS =
  'focus-within:border-brand focus-within:shadow-[0_0_0_3px_rgba(0,102,102,0.12)] focus-visible:outline-none'

export const GSL_FINTECH_HERO_GRADIENT =
  'bg-gradient-to-br from-brand via-brand-hover to-teal-950'

export const GSL_BRAND_SHADOW_SOFT = 'shadow-[0_8px_24px_rgba(0,102,102,0.16)]'
export const GSL_BRAND_SHADOW_SOFT_HOVER = 'group-hover:shadow-[0_8px_24px_rgba(0,102,102,0.16)]'
export const GSL_BRAND_SHADOW_ICON = 'shadow-[0_8px_20px_rgba(0,102,102,0.38)]'
export const GSL_BRAND_SHADOW_RING = 'shadow-[0_10px_28px_rgba(0,102,102,0.18)]'

export const productUi = {
  page: 'gsl-page min-h-screen',
  pageContainer: 'gsl-page-container mx-auto max-w-6xl px-3 sm:px-4 py-6 sm:py-10',
  pageContainerNarrow: 'gsl-page-container mx-auto max-w-4xl px-3 sm:px-4 py-6 sm:py-10',
  card: 'gsl-card rounded-xl border border-slate-200 bg-white shadow-sm',
  cardInteractive: 'gsl-card gsl-card-hover rounded-xl border border-slate-200 bg-white shadow-sm',
  hubNav: 'gsl-hub-nav',
  hubNavActive: 'gsl-hub-nav-active',
  hubNavIdle: 'gsl-hub-nav-idle',
  navItemActive: 'gsl-nav-item-active',
  navItemIdle: 'gsl-nav-item-idle',
  sectionTitle: 'text-2xl sm:text-3xl font-bold tracking-tight text-slate-900',
  sectionSubtitle: 'text-slate-600 max-w-2xl text-sm sm:text-base leading-relaxed',
  btnBrand: 'gsl-btn-brand',
  shimmer: 'gsl-shimmer',
}

export const {
  page: GSL_PAGE,
  pageContainer: GSL_PAGE_CONTAINER,
  pageContainerNarrow: GSL_PAGE_CONTAINER_NARROW,
  card: GSL_CARD,
  cardInteractive: GSL_CARD_INTERACTIVE,
  hubNav: GSL_HUB_NAV,
  hubNavActive: GSL_HUB_NAV_ACTIVE,
  hubNavIdle: GSL_HUB_NAV_IDLE,
  navItemActive: GSL_NAV_ITEM_ACTIVE,
  navItemIdle: GSL_NAV_ITEM_IDLE,
  sectionTitle: GSL_SECTION_TITLE,
  sectionSubtitle: GSL_SECTION_SUBTITLE,
  btnBrand: GSL_BTN_BRAND,
  shimmer: GSL_SHIMMER,
} = productUi
