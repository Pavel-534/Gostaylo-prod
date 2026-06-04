/**
 * Node/CJS bridge for white-label brand name (Tailwind, build scripts).
 * Logic MUST match `getSiteDisplayName()` in lib/site-url.js.
 *
 * SSOT for display name: NEXT_PUBLIC_SITE_NAME | SITE_DISPLAY_NAME → else "Platform"
 * Visual colors are separate: lib/theme/tokens.cjs (never embed product name there).
 */

function getSiteDisplayName() {
  const explicit = process.env.NEXT_PUBLIC_SITE_NAME || process.env.SITE_DISPLAY_NAME
  if (explicit && String(explicit).trim()) return String(explicit).trim()
  return 'Platform'
}

/** Pointers for config comments — no hardcoded product literals */
const VISUAL_TOKENS_SSOT = 'lib/theme/tokens.cjs'
const DISPLAY_NAME_SSOT = 'lib/site-url.js → getSiteDisplayName()'

module.exports = {
  getSiteDisplayName,
  VISUAL_TOKENS_SSOT,
  DISPLAY_NAME_SSOT,
}
