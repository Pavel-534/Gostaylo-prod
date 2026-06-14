/**
 * Stage 145 — premium EmailService delivery with plain-text fallback on success:false or throw.
 */

/**
 * @param {{ success?: boolean, queued?: boolean } | null | undefined} result
 */
export function isPremiumEmailDelivered(result) {
  return result?.success === true || result?.queued === true
}

/**
 * Try premium HTML email; on failure or success:false send localized plain-text fallback.
 *
 * @param {object} opts
 * @param {string} opts.channelLabel — for logs / safeNotifyChannel id
 * @param {string | null | undefined} opts.to
 * @param {() => Promise<{ success?: boolean, queued?: boolean } | void>} opts.premiumFn
 * @param {(to: string, subject: string, body: string) => Promise<unknown>} opts.sendPlainEmail
 * @param {() => { subject: string, body: string }} opts.buildFallback
 */
export async function deliverPremiumEmailWithPlainFallback({
  channelLabel,
  to,
  premiumFn,
  sendPlainEmail,
  buildFallback,
}) {
  if (!to) return { delivered: false, reason: 'no_recipient' }

  let needFallback = true
  try {
    const res = await premiumFn()
    if (isPremiumEmailDelivered(res)) {
      needFallback = false
      console.log(`[EMAIL] premium ok channel=${channelLabel} to=${to}`)
    } else if (res?.success === false) {
      console.warn(`[EMAIL] premium success:false channel=${channelLabel} to=${to}`, res?.error || '')
    }
  } catch (e) {
    console.error(`[EMAIL] premium throw channel=${channelLabel}`, e)
  }

  if (!needFallback) return { delivered: true, channel: 'premium' }

  const { subject, body } = buildFallback()
  await sendPlainEmail(to, subject, body)
  console.log(`[EMAIL] plain fallback sent channel=${channelLabel} to=${to}`)
  return { delivered: true, channel: 'plain_fallback' }
}
