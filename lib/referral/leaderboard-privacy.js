/**
 * Маскировка имён для публичного лидерборда (Stage 74.1).
 */

/**
 * @param {string} userId
 * @param {string|null|undefined} firstName
 * @param {string|null|undefined} lastName
 * @returns {string}
 */
export function maskReferralLeaderboardName(userId, firstName, lastName) {
  const id = String(userId || '').replace(/-/g, '')
  const tail = id.slice(-6) || '0'
  const fromHex = Number.parseInt(tail, 16)
  const num = Number.isFinite(fromHex)
    ? fromHex % 100000
    : Math.abs(tail.split('').reduce((a, c) => (a << 5) - a + c.charCodeAt(0), 0)) % 100000
  const userNum = String(num).padStart(5, '0')

  const first = typeof firstName === 'string' ? firstName.trim() : ''
  const last = typeof lastName === 'string' ? lastName.trim() : ''

  if (first.length >= 4) {
    const a = first.slice(0, 2)
    const b = first.slice(-2)
    const li = last.length ? `${last[0].toUpperCase()}.` : ''
    return `${a}...${b}${li ? ` ${li}` : ''}`.trim()
  }
  if (first.length > 0) {
    const li = last.length ? `${last[0].toUpperCase()}.` : ''
    return `${first.slice(0, 2)}...${li ? ` ${li}` : ''}`.trim()
  }

  return `User_${userNum}`
}
