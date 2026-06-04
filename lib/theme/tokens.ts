/**
 * Stage 129.0 — Design System tokens (SSOT).
 *
 * Runtime values for Tailwind live in `tokens.cjs` (Node CJS bridge).
 * Product display name (white-label): `lib/site-url.js` → `getSiteDisplayName()`.
 * Import from here in TypeScript / React components.
 *
 * @see docs/PRODUCT_UI_SYSTEM.md
 */

import cjs from './tokens.cjs'

export type DesignTokens = typeof cjs.designTokens

export const designTokens = cjs.designTokens
export const colors = cjs.colors
export const spacing = cjs.spacing
export const radii = cjs.radii
export const shadows = cjs.shadows
export const typography = cjs.typography
export const cssVars = cjs.cssVars

/** Brand shortcuts for inline styles (SVG, charts) — prefer Tailwind classes in UI */
export const brandHex = colors.brand.DEFAULT
export const brandHoverHex = colors.brand.hover
export const brandSurfaceHex = colors.brand.surface
export const brandMintHex = colors.brand.mint
export const brandNavyHex = colors.brand.navy

export const toTailwindExtend = cjs.toTailwindExtend

export default designTokens
