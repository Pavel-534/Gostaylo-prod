/**
 * Stage 202.41 — detect infra blips that must not spam Telegram System Alerts.
 * Stage 202.42 — also used by read-path / outbound Telegram retries.
 * Covers Vercel/Supabase/Cloudflare 502–504s and AbortError timeouts.
 */

/**
 * @param {unknown} errOrText
 * @returns {boolean}
 */
export function isTransientOpsError(errOrText) {
  if (errOrText == null) return false
  const msg = String(
    typeof errOrText === 'object' && errOrText !== null
      ? errOrText.message ?? errOrText.details ?? errOrText
      : errOrText,
  ).toLowerCase()
  if (!msg) return false

  if (msg.includes('gateway timeout')) return true
  if (msg.includes('bad gateway')) return true
  if (msg.includes('operation was aborted')) return true
  if (msg.includes('aborted due to timeout')) return true
  if (msg.includes('aborterror')) return true
  if (msg.includes('etimedout') || msg.includes('econnreset')) return true
  if (msg.includes('socket hang up') || msg.includes('fetch failed')) return true
  if (msg.includes('ssl handshake') || msg.includes('error code 525') || /\b525\b/.test(msg)) {
    return true
  }
  if (/\b502\b|\b503\b|\b504\b/.test(msg)) return true
  if (msg.includes('cloudflare') && (msg.includes('timeout') || msg.includes('520') || msg.includes('522') || msg.includes('525'))) {
    return true
  }
  return false
}
