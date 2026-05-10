/**
 * Лог автоматической выдачи **VERIFIED** профилю (не `dispute_events` — там FK на **disputes**).
 * Append-only: **`critical_signal_events`** (**`signal_key` = `SYSTEM_AUTO_VERIFICATION`**).
 */

const SIGNAL = 'SYSTEM_AUTO_VERIFICATION'

/**
 * @param {{ userId: string, applicationId?: string | null, actorId?: string | null, source?: string, extra?: Record<string, unknown> }} p
 */
export async function recordSystemAutoVerification(p) {
  const userId = p.userId && String(p.userId).trim()
  if (!userId) return
  try {
    const { supabaseAdmin } = await import('@/lib/supabase')
    if (!supabaseAdmin?.from) return
    const { error } = await supabaseAdmin.from('critical_signal_events').insert({
      signal_key: SIGNAL,
      detail: {
        userId,
        applicationId: p.applicationId ?? null,
        actorId: p.actorId ?? null,
        source: p.source || 'partner_application_approved',
        ...((p.extra && typeof p.extra === 'object') ? p.extra : {}),
        recordedAt: new Date().toISOString(),
      },
    })
    if (
      error &&
      !String(error.message || '').includes("Could not find the table 'public.critical_signal_events'")
    ) {
      console.warn('[SYSTEM_AUTO_VERIFICATION]', error.message)
    }
  } catch (e) {
    console.warn('[SYSTEM_AUTO_VERIFICATION]', e?.message || e)
  }
}
