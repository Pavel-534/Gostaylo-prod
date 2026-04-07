/**
 * In-memory streak + quiet window для Speed Bot (E2E internal API).
 * На serverless инстанс может сбрасываться — для nightly CI достаточно.
 */

const QUIET_MS = 6 * 60 * 60 * 1000

const G = typeof globalThis !== 'undefined' ? globalThis : {}
const SYM = Symbol.for('gostaylo.performanceLowAlert')

function store() {
  if (!G[SYM]) G[SYM] = new Map()
  return G[SYM]
}

/**
 * @param {string} pageKey
 * @param {number} lcpMs
 * @param {number} [thresholdMs]
 * @returns {{ fired: boolean, suppressed?: boolean, streak: number, bad: boolean }}
 */
export function processPerformanceSample(pageKey, lcpMs, thresholdMs = 3500) {
  const key = String(pageKey || 'default')
  const bad = Number(lcpMs) > thresholdMs
  const m = store()
  const st = m.get(key) || { streak: 0, lastAlertAt: 0 }

  if (!bad) {
    st.streak = 0
    m.set(key, st)
    return { fired: false, streak: 0, bad: false }
  }

  const now0 = Date.now()
  if (st.streak >= 3) {
    if (now0 - st.lastAlertAt < QUIET_MS) {
      return { fired: false, suppressed: true, streak: 3, bad: true }
    }
    st.streak = 0
  }

  st.streak += 1
  m.set(key, st)

  if (st.streak < 3) {
    return { fired: false, streak: st.streak, bad: true }
  }

  const now = Date.now()
  if (now - st.lastAlertAt < QUIET_MS) {
    st.streak = 3
    m.set(key, st)
    return { fired: false, suppressed: true, streak: 3, bad: true }
  }

  st.lastAlertAt = now
  st.streak = 0
  m.set(key, st)
  return { fired: true, streak: 0, bad: true }
}
