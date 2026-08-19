/**
 * Guest pool split envelope (ADR-131A §4.5).
 * Leaf module — no pricing / Next imports (unit-testable).
 */

function round2(n) {
  return Math.round(Number(n) * 100) / 100
}

function parsePoolPercent(raw) {
  const n = Number(raw)
  if (!Number.isFinite(n)) return 0
  return n
}

/**
 * @param {object} policy camelCase merged config
 * @returns {{ ok: boolean, errors: string[], mode: 'legacy' | 'l3' | 'l2_off', sum: number }}
 */
export function validateGuestPoolSplit(policy) {
  if (!policy?.ambassadorGuestL2Enabled) {
    return { ok: true, errors: [], mode: 'l2_off', sum: 0 }
  }

  const l1 = parsePoolPercent(policy.ambassadorGuestPoolL1Percent)
  const l2 = parsePoolPercent(policy.ambassadorGuestPoolL2Percent)
  const l3 = parsePoolPercent(policy.ambassadorGuestPoolL3Percent)
  const referee = parsePoolPercent(policy.ambassadorGuestPoolRefereePercent)
  const l3Enabled = policy.ambassadorGuestL3Enabled === true
  const errors = []

  if (l3Enabled) {
    if (l3 <= 0) {
      errors.push('Guest pool L3 percent must be > 0 when ambassador_guest_l3_enabled is true')
    }
    const sum = round2(l1 + l2 + l3 + referee)
    if (Math.abs(sum - 100) > 0.05) {
      errors.push(`Guest pool sum must be 100, got ${sum.toFixed(2)} (mode: l3)`)
    }
    return { ok: errors.length === 0, errors, mode: 'l3', sum }
  }

  if (l3 > 0) {
    errors.push('Guest pool L3 percent must be 0 when ambassador_guest_l3_enabled is false')
  }
  const sum = round2(l1 + l2 + referee)
  if (Math.abs(sum - 100) > 0.05) {
    errors.push(`Guest pool sum must be 100, got ${sum.toFixed(2)} (mode: legacy)`)
  }
  return { ok: errors.length === 0, errors, mode: 'legacy', sum }
}
