/**
 * Stage 131.A6 — public leaderboard name masking.
 *
 * Important: this is separate from `maskReferralLeaderboardName` (cabinet leaderboard privacy).
 */

function toUserShortId(userId) {
  const id = String(userId || '').replace(/-/g, '')
  const tail = id.slice(-6) || '0'
  const fromHex = Number.parseInt(tail, 16)
  const num = Number.isFinite(fromHex)
    ? fromHex % 100000
    : Math.abs(
        tail
          .split('')
          .reduce((a, c) => (a << 5) - a + c.charCodeAt(0), 0),
      ) % 100000

  return String(num).padStart(5, '0')
}

/**
 * @param {{ id?: string, first_name?: string | null, last_name?: string | null }} profile
 * @returns {string}
 */
export function maskPublicReferralName(profile) {
  const first = typeof profile?.first_name === 'string' ? profile.first_name.trim() : ''
  const last = typeof profile?.last_name === 'string' ? profile.last_name.trim() : ''
  const shortId = toUserShortId(profile?.id)

  if (first) {
    if (last) {
      const li = String(last[0] || '').toUpperCase()
      return `${first} ${li}.`
    }
    return first
  }

  return `Амбассадор #${shortId}`
}

