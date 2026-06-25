/**
 * Self-hosted Leaflet 1.9.4 default marker sprites (Stage 171.17).
 * SSOT paths — same-origin `/leaflet/images/*` (SWR via `public/sw.js`).
 */

/** @type {{ iconUrl: string, iconRetinaUrl: string, shadowUrl: string }} */
export const LEAFLET_DEFAULT_ICON_URLS = {
  iconUrl: '/leaflet/images/marker-icon.png',
  iconRetinaUrl: '/leaflet/images/marker-icon-2x.png',
  shadowUrl: '/leaflet/images/marker-shadow.png',
}

/**
 * Fix Leaflet default marker paths (bundler does not copy `dist/images`).
 * @param {typeof import('leaflet')} L
 */
export function configureLeafletDefaultIcons(L) {
  if (!L?.Icon?.Default) return
  delete L.Icon.Default.prototype._getIconUrl
  L.Icon.Default.mergeOptions(LEAFLET_DEFAULT_ICON_URLS)
}
