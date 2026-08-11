/**
 * Stage 200.90 — Resolve street/house display from wizard form without
 * treating an empty metadata.street as «absent» (that made house number
 * reappear in the street field after the partner cleared the street).
 */

/**
 * @param {Record<string, unknown>|null|undefined} metadata
 * @param {string} key
 * @returns {string|null} null = key not set (legacy fallback); string may be ''
 */
export function readExplicitMetaString(metadata, key) {
  if (!metadata || typeof metadata !== 'object') return null
  if (!Object.prototype.hasOwnProperty.call(metadata, key)) return null
  return String(metadata[key] ?? '')
}

/**
 * @param {{ address?: string|null, metadata?: Record<string, unknown>|null }} form
 * @returns {string}
 */
export function resolveWizardStreetDisplay(form) {
  const explicit = readExplicitMetaString(form?.metadata, 'street')
  if (explicit != null) return explicit

  const addr = String(form?.address || '').trim()
  if (!addr) return ''
  const houseExplicit = readExplicitMetaString(form?.metadata, 'house_number')
  if (houseExplicit == null || houseExplicit === '') {
    return addr.split(',')[0]?.trim() || addr
  }
  return addr.split(',')[0]?.trim() || ''
}

/**
 * @param {{ address?: string|null, metadata?: Record<string, unknown>|null }} form
 * @returns {string}
 */
export function resolveWizardHouseDisplay(form) {
  const explicit = readExplicitMetaString(form?.metadata, 'house_number')
  if (explicit != null) return explicit

  const addr = String(form?.address || '').trim()
  const streetExplicit = readExplicitMetaString(form?.metadata, 'street')
  if (!addr || (streetExplicit != null && streetExplicit !== '')) return ''
  const parts = addr.split(',').map((p) => p.trim()).filter(Boolean)
  return parts.length > 1 ? parts.slice(1).join(', ') : ''
}

/**
 * Compose listings.address — never put house alone (would poison street display).
 * @param {string} street
 * @param {string} house
 */
export function composeWizardStreetHouseAddress(street, house) {
  const st = String(street || '').trim()
  const hn = String(house || '').trim()
  if (st && hn) return `${st}, ${hn}`
  if (st) return st
  return ''
}
