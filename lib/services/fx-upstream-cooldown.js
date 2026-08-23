/**
 * Stage 201.113 — shared cooldown after ExchangeRate-API 429 / quota pressure.
 * Prevents guest hot-path + cron from hammering a exhausted free-tier key.
 */

/** Default: 12h — free plan updates ~daily; retry sooner once quota recovers. */
export const FX_UPSTREAM_429_COOLDOWN_MS = 12 * 60 * 60 * 1000

/** @type {number} */
let last429AtMs = 0

/** @internal tests */
export function resetFxUpstreamCooldownForTests() {
  last429AtMs = 0
}

/**
 * @param {number} [nowMs]
 */
export function markFxUpstreamRateLimited(nowMs = Date.now()) {
  last429AtMs = nowMs
}

/**
 * @param {number} [nowMs]
 * @param {number} [cooldownMs]
 * @returns {boolean}
 */
export function isFxUpstreamInCooldown(nowMs = Date.now(), cooldownMs = FX_UPSTREAM_429_COOLDOWN_MS) {
  if (!last429AtMs) return false
  return nowMs - last429AtMs < cooldownMs
}

/**
 * @param {number} [nowMs]
 * @param {number} [cooldownMs]
 * @returns {number} ms remaining, or 0
 */
export function fxUpstreamCooldownRemainingMs(
  nowMs = Date.now(),
  cooldownMs = FX_UPSTREAM_429_COOLDOWN_MS,
) {
  if (!last429AtMs) return 0
  const left = cooldownMs - (nowMs - last429AtMs)
  return left > 0 ? left : 0
}
