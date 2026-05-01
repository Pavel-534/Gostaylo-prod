/**
 * Feature flag: unified AppHeader.
 *
 * Когда 'on' — используется единый <AppHeader> на всех страницах.
 * Когда 'off' (default) — legacy <UniversalHeader> + inline hedders в
 *   /renter /partner /admin layouts.
 *
 * Читается ТОЛЬКО на клиенте через NEXT_PUBLIC_UNIFIED_HEADER.
 */
export const UNIFIED_HEADER_ENABLED =
  process.env.NEXT_PUBLIC_UNIFIED_HEADER === 'on' ||
  process.env.NEXT_PUBLIC_UNIFIED_HEADER === '1'
