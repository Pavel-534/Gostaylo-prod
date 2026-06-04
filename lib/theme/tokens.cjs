/**
 * Stage 129.0 — Design tokens (runtime / Tailwind bridge).
 * Typed API for components: lib/theme/tokens.ts
 *
 * Visual colors only — product display name: lib/site-url.js (getSiteDisplayName).
 * Keep in sync with tokens.ts when changing values.
 */

const colors = {
  brand: {
    DEFAULT: '#006666',
    hover: '#005757',
    surface: '#f7f9fb',
    muted: '#e6f4f3',
    mint: '#0D9488',
    navy: '#0F172A',
  },
  text: {
    DEFAULT: '#0f172a',
    muted: '#64748b',
    subtle: '#94a3b8',
    inverse: '#ffffff',
  },
  surface: {
    DEFAULT: '#ffffff',
    canvas: '#f7f9fb',
    elevated: '#ffffff',
  },
  /** Email / legacy accent — prefer brand.mint for new UI */
  email: {
    primary: '#0d9488',
    primaryHover: '#0f766e',
    tint: '#f0fdfa',
  },
}

const spacing = {
  0: '0px',
  px: '1px',
  0.5: '0.125rem',
  1: '0.25rem',
  1.5: '0.375rem',
  2: '0.5rem',
  2.5: '0.625rem',
  3: '0.75rem',
  3.5: '0.875rem',
  4: '1rem',
  5: '1.25rem',
  6: '1.5rem',
  7: '1.75rem',
  8: '2rem',
  10: '2.5rem',
  12: '3rem',
  16: '4rem',
  20: '5rem',
  24: '6rem',
}

const radii = {
  none: '0px',
  sm: 'calc(var(--radius) - 4px)',
  md: 'calc(var(--radius) - 2px)',
  lg: 'var(--radius)',
  xl: '0.75rem',
  '2xl': '1rem',
  '3xl': '1.5rem',
  full: '9999px',
}

const shadows = {
  sm: '0 1px 2px rgba(15, 23, 42, 0.06)',
  DEFAULT: '0 1px 3px rgba(15, 23, 42, 0.08)',
  md: '0 4px 12px rgba(15, 23, 42, 0.08)',
  lg: '0 8px 24px rgba(15, 23, 42, 0.08)',
  brandSm: '0 4px 12px rgba(0, 102, 102, 0.2)',
  brandMd: '0 6px 18px rgba(0, 102, 102, 0.22)',
  brandIcon: '0 8px 20px rgba(0, 102, 102, 0.38)',
  brandRing: '0 10px 28px rgba(0, 102, 102, 0.18)',
}

const typography = {
  fontFamily: {
    sans: 'var(--font-sans)',
    serif: 'var(--font-serif)',
  },
  fontSize: {
    xs: ['0.75rem', { lineHeight: '1rem' }],
    sm: ['0.875rem', { lineHeight: '1.25rem' }],
    base: ['1rem', { lineHeight: '1.5rem' }],
    lg: ['1.125rem', { lineHeight: '1.75rem' }],
    xl: ['1.25rem', { lineHeight: '1.75rem' }],
    '2xl': ['1.5rem', { lineHeight: '2rem' }],
    '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
    '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  letterSpacing: {
    tight: '-0.025em',
    normal: '0em',
    wide: '0.025em',
  },
}

/** HSL components for shadcn CSS variables (no hsl() wrapper) */
const cssVars = {
  primary: '180 100% 20%',
  primaryForeground: '0 0% 100%',
}

const designTokens = {
  colors,
  spacing,
  radii,
  shadows,
  typography,
  cssVars,
}

/** Tailwind `theme.extend` fragments derived from tokens */
function toTailwindExtend() {
  return {
    colors: {
      brand: colors.brand,
    },
    boxShadow: {
      brand: shadows.brandMd,
      'brand-sm': shadows.brandSm,
      'brand-md': shadows.brandMd,
      'brand-icon': shadows.brandIcon,
      'brand-ring': shadows.brandRing,
    },
    fontSize: typography.fontSize,
  }
}

module.exports = {
  designTokens,
  colors,
  spacing,
  radii,
  shadows,
  typography,
  cssVars,
  toTailwindExtend,
}
