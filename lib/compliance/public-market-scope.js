/**
 * Stage 202.35 — reversible RF-only public marketing for bank onboarding.
 *
 * Env: NEXT_PUBLIC_PUBLIC_MARKET_SCOPE
 * - unset | `global` — full destination chips / geo suggest (default for dev)
 * - `rf-only` — hide Thailand/world quick chips + TH geo toast on storefront
 *
 * Legal/about/footer copy is RF-focused separately (Stage 202.34).
 */

export function isRfOnlyPublicMarketScope() {
  const v = String(process.env.NEXT_PUBLIC_PUBLIC_MARKET_SCOPE || 'global')
    .trim()
    .toLowerCase()
  return v === 'rf-only' || v === 'rf'
}

/**
 * @template T
 * @param {T[]} groups
 * @param {(group: T) => boolean} keepGlobal
 */
export function filterDestinationGroupsForPublicScope(groups, keepGlobal = (g) => g?.id === 'russia') {
  if (!isRfOnlyPublicMarketScope()) return groups
  return groups.filter(keepGlobal)
}
