/**
 * ADR-210 Slice 7.1 — notify existing (non-shadow) partner after Concierge ingest.
 * Email via sendResendEmail (+ transport guard). Welcome flag in profiles.metadata.
 */

import { supabaseAdmin } from '@/lib/supabase'
import { getPublicSiteUrl, getSiteDisplayName } from '@/lib/site-url'
import { sendResendEmail } from '@/lib/services/notifications/email.service.js'

export const CONCIERGE_WELCOME_PENDING_KEY = 'concierge_welcome_pending'

/**
 * @param {{
 *   partnerProfileId: string,
 *   email?: string|null,
 *   batchId: string,
 *   listingsCount: number,
 *   db?: import('@supabase/supabase-js').SupabaseClient,
 *   sendEmail?: boolean,
 * }} input
 */
export async function notifyExistingPartnerConciergeIngest(input) {
  const db = input.db || supabaseAdmin
  if (!db) {
    return { ok: false, code: 'SUPABASE_NOT_CONFIGURED', error: 'Supabase not configured' }
  }

  const partnerProfileId = String(input.partnerProfileId || '').trim()
  const batchId = String(input.batchId || '').trim()
  const listingsCount = Math.max(0, Number(input.listingsCount) || 0)
  if (!partnerProfileId || !batchId) {
    return { ok: false, code: 'VALIDATION_ERROR', error: 'partnerProfileId and batchId required' }
  }

  const { data: partner, error } = await db
    .from('profiles')
    .select('id, email, role, is_shadow, metadata')
    .eq('id', partnerProfileId)
    .maybeSingle()

  if (error) {
    return { ok: false, code: 'DB_ERROR', error: error.message }
  }
  if (!partner?.id) {
    return { ok: false, code: 'PARTNER_NOT_FOUND', error: 'Partner not found' }
  }
  if (partner.is_shadow === true) {
    return { ok: true, skipped: true, reason: 'shadow' }
  }

  const email = String(input.email || partner.email || '').trim().toLowerCase()
  const meta = partner.metadata && typeof partner.metadata === 'object' ? { ...partner.metadata } : {}
  meta[CONCIERGE_WELCOME_PENDING_KEY] = {
    at: new Date().toISOString(),
    batchId,
    listingsCount,
  }

  const { error: updErr } = await db.from('profiles').update({ metadata: meta }).eq('id', partnerProfileId)
  if (updErr) {
    return { ok: false, code: 'DB_ERROR', error: updErr.message }
  }

  const brand = getSiteDisplayName()
  const base = getPublicSiteUrl().replace(/\/$/, '')
  const listingsUrl = `${base}/partner/listings?concierge_welcome=true`
  let emailSent = false

  if (input.sendEmail !== false && email && email.includes('@')) {
    const subject = `${brand}: вам добавлены новые черновики объектов`
    const text = [
      `Здравствуйте!`,
      ``,
      `Команда ${brand} загрузила для вас ${listingsCount} черновик(ов) объявлений.`,
      `Откройте кабинет, проверьте фото, сезонные цены и календарь, затем отправьте на модерацию:`,
      listingsUrl,
      ``,
      `Батч: ${batchId}`,
      ``,
      `— Команда ${brand}`,
    ].join('\n')
    try {
      await sendResendEmail(email, subject, text)
      emailSent = true
    } catch (e) {
      console.warn('[concierge-notify] email failed', e?.message || e)
    }
  }

  return { ok: true, emailSent, listingsUrl }
}

/**
 * Clear profiles.metadata.concierge_welcome_pending after partner sees the banner.
 * @param {{ partnerProfileId: string, db?: import('@supabase/supabase-js').SupabaseClient }} input
 */
export async function clearConciergeWelcomePending(input) {
  const db = input.db || supabaseAdmin
  if (!db) {
    return { ok: false, code: 'SUPABASE_NOT_CONFIGURED', error: 'Supabase not configured' }
  }
  const partnerProfileId = String(input.partnerProfileId || '').trim()
  if (!partnerProfileId) {
    return { ok: false, code: 'VALIDATION_ERROR', error: 'partnerProfileId required' }
  }

  const { data: partner, error } = await db
    .from('profiles')
    .select('id, metadata')
    .eq('id', partnerProfileId)
    .maybeSingle()

  if (error) return { ok: false, code: 'DB_ERROR', error: error.message }
  if (!partner?.id) return { ok: false, code: 'PARTNER_NOT_FOUND', error: 'Partner not found' }

  const meta = partner.metadata && typeof partner.metadata === 'object' ? { ...partner.metadata } : {}
  if (!(CONCIERGE_WELCOME_PENDING_KEY in meta)) {
    return { ok: true, cleared: false }
  }
  delete meta[CONCIERGE_WELCOME_PENDING_KEY]
  const { error: updErr } = await db.from('profiles').update({ metadata: meta }).eq('id', partnerProfileId)
  if (updErr) return { ok: false, code: 'DB_ERROR', error: updErr.message }
  return { ok: true, cleared: true }
}

/**
 * @param {object|null|undefined} metadata
 */
export function hasConciergeWelcomePending(metadata) {
  const pending = metadata?.[CONCIERGE_WELCOME_PENDING_KEY]
  return Boolean(pending && typeof pending === 'object')
}
