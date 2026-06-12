/**
 * Stage 114.2 / 114.4 — диспетчер реферальных уведомлений (outbox через NotificationService).
 */
import { NotificationService, NotificationEvents } from '@/lib/services/notification.service.js'
import { supabaseAdmin } from '@/lib/supabase'
import { getReferralAdminAlertPolicy } from '@/lib/admin/referral-alert-policy.js'
import { formatPrivacyDisplayNameForParticipant } from '@/lib/utils/name-formatter'
import { convertReferralPayoutThbToCurrency } from '@/lib/services/marketing/referral-payout-fx.service.js'

const NOTIFY_META_KEY = 'teammate_join_notified_at'

/**
 * @param {{ beneficiaryId: string, amountThb: number, bookingId?: string, ledgerId?: string, txType?: string }} payload
 */
function round2(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

async function maybeNotifyAdminReferralAlerts(payload) {
  const amountThb = round2(payload?.amountThb)
  const beneficiaryId = String(payload?.beneficiaryId || '').trim()
  if (!beneficiaryId || amountThb <= 0) return

  const policy = await getReferralAdminAlertPolicy()
  const oneHourAgo = new Date(Date.now() - 3600000).toISOString()

  let hourlySum = amountThb
  try {
    const { data: recent } = await supabaseAdmin
      .from('referral_ledger')
      .select('amount_thb')
      .eq('referrer_id', beneficiaryId)
      .eq('status', 'earned')
      .gte('earned_at', oneHourAgo)
    hourlySum = round2((recent || []).reduce((acc, r) => acc + Number(r?.amount_thb || 0), 0))
  } catch {
    /* optional */
  }

  const large = amountThb >= policy.largeEarnAlertThb
  const burst = hourlySum >= policy.hourlyBurstAlertThb

  const monthly = await maybeNotifyMonthlySpendAlert(policy)
  const approaching = await maybeNotifyMonthlySpendApproaching(policy)

  if (!large && !burst && !monthly && !approaching) return

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('email,first_name,last_name')
    .eq('id', beneficiaryId)
    .maybeSingle()

  const label = formatPrivacyDisplayNameForParticipant(
    profile?.first_name,
    profile?.last_name,
    profile?.email,
    beneficiaryId,
  )

  try {
    await NotificationService.dispatch(NotificationEvents.REFERRAL_ADMIN_ALERT, {
      beneficiaryId,
      amountThb,
      hourlySumThb: hourlySum,
      large,
      burst,
      monthly: Boolean(monthly),
      monthlyApproaching: Boolean(approaching),
      monthlyApproachSpendThb: approaching?.monthlySpendThb ?? null,
      monthlyApproachWarnThb: approaching?.warnThb ?? null,
      monthlySpendThb: monthly?.monthlySpendThb ?? approaching?.monthlySpendThb ?? null,
      bookingId: payload?.bookingId || null,
      ledgerId: payload?.ledgerId || null,
      ambassadorLabel: label,
      thresholdThb: large ? policy.largeEarnAlertThb : policy.monthlySpendAlertThb,
    })
  } catch (e) {
    console.warn('[REFERRAL_NOTIFY] admin alert', e?.message || e)
  }
}

function currentUtcMonthStartIso() {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
}

async function maybeNotifyMonthlySpendAlert(policy) {
  const monthStartIso = currentUtcMonthStartIso()
  const monthlySpendThb = await sumMonthlyEarnedThb()
  if (monthlySpendThb == null || monthlySpendThb < policy.monthlySpendAlertThb) return null

  const signalKey = 'REFERRAL_MONTHLY_SPEND_ALERT'
  try {
    const { data: existing } = await supabaseAdmin
      .from('critical_signal_events')
      .select('id')
      .eq('signal_key', signalKey)
      .gte('created_at', monthStartIso)
      .limit(1)
    if (Array.isArray(existing) && existing.length > 0) return null
  } catch {
    /* table optional */
  }

  try {
    await supabaseAdmin.from('critical_signal_events').insert({
      signal_key: signalKey,
      severity: 'warning',
      message: `Referral monthly spend ${monthlySpendThb} THB >= ${policy.monthlySpendAlertThb}`,
      metadata: { monthlySpendThb, thresholdThb: policy.monthlySpendAlertThb, monthStartIso },
    })
  } catch {
    /* optional */
  }

  return { monthlySpendThb, thresholdThb: policy.monthlySpendAlertThb }
}

async function sumMonthlyEarnedThb() {
  const monthStartIso = currentUtcMonthStartIso()
  const { data: rows, error } = await supabaseAdmin
    .from('referral_ledger')
    .select('amount_thb')
    .eq('status', 'earned')
    .gte('earned_at', monthStartIso)
  if (error) return null
  return round2((rows || []).reduce((acc, r) => acc + Number(r?.amount_thb || 0), 0))
}

/** Stage 114.7 — предупреждение при ≥ warn% месячного лимита (1×/мес., до hard alert). */
async function maybeNotifyMonthlySpendApproaching(policy) {
  const warnThb = round2(policy.monthlySpendWarnThb ?? policy.monthlySpendAlertThb * 0.8)
  const monthlySpendThb = await sumMonthlyEarnedThb()
  if (monthlySpendThb == null || monthlySpendThb < warnThb || monthlySpendThb >= policy.monthlySpendAlertThb) return null

  const monthStartIso = currentUtcMonthStartIso()
  const signalKey = 'REFERRAL_MONTHLY_SPEND_APPROACHING'
  try {
    const { data: existing } = await supabaseAdmin
      .from('critical_signal_events')
      .select('id')
      .eq('signal_key', signalKey)
      .gte('created_at', monthStartIso)
      .limit(1)
    if (Array.isArray(existing) && existing.length > 0) return null
  } catch {
    /* table optional */
  }

  try {
    await supabaseAdmin.from('critical_signal_events').insert({
      signal_key: signalKey,
      severity: 'info',
      message: `Referral monthly spend approaching: ${monthlySpendThb} THB (warn ${warnThb})`,
      metadata: {
        monthlySpendThb,
        warnThb,
        warnPercent: policy.monthlySpendWarnPercent,
        thresholdThb: policy.monthlySpendAlertThb,
        monthStartIso,
      },
    })
  } catch {
    /* optional */
  }

  return { monthlySpendThb, warnThb, thresholdThb: policy.monthlySpendAlertThb }
}

export async function notifyReferralBonusEarned(payload) {
  if (!payload?.beneficiaryId || !(Number(payload.amountThb) > 0)) return
  try {
    let enriched = { ...payload }
    try {
      const fx = await convertReferralPayoutThbToCurrency(Number(payload.amountThb), 'RUB')
      enriched = {
        ...enriched,
        amountRub: fx.amountInPayoutCurrency,
        midRateRubToThb: fx.midRateToThb,
        unlocked: payload.unlocked !== false,
      }
    } catch {
      /* FX optional for notify */
    }
    await NotificationService.dispatch(NotificationEvents.REFERRAL_BONUS_EARNED, enriched)
    void maybeNotifyAdminReferralAlerts(payload)
  } catch (e) {
    console.warn('[REFERRAL_NOTIFY] bonus earned', e?.message || e)
  }
}

/** Stage 131.7 — held accrual (hold period or fraud gate). */
export async function notifyReferralBonusHeld(payload) {
  if (!payload?.beneficiaryId || !(Number(payload.amountThb) > 0)) return
  try {
    await NotificationService.dispatch(NotificationEvents.REFERRAL_BONUS_HELD, {
      ...payload,
      fraudGateHold: payload.fraudGateHold === true,
      holdDays: Math.max(0, Math.floor(Number(payload.holdDays) || 0)),
    })
  } catch (e) {
    console.warn('[REFERRAL_NOTIFY] bonus held', e?.message || e)
  }
}

/**
 * Идемпотентно по metadata.referral_relations (не дублировать при повторном OAuth/register).
 */
export async function notifyTeammateJoined({ referrerId, refereeId, displayName = null }) {
  const rid = String(referrerId || '').trim()
  const fid = String(refereeId || '').trim()
  if (!rid || !fid || rid === fid) return

  try {
    const { data: rel } = await supabaseAdmin
      .from('referral_relations')
      .select('id,metadata')
      .eq('referrer_id', rid)
      .eq('referee_id', fid)
      .maybeSingle()

    const meta = rel?.metadata && typeof rel.metadata === 'object' ? rel.metadata : {}
    if (meta[NOTIFY_META_KEY]) return

    await NotificationService.dispatch(NotificationEvents.REFERRAL_TEAMMATE_JOINED, {
      referrerId: rid,
      refereeId: fid,
      displayName,
    })

    await supabaseAdmin
      .from('referral_relations')
      .update({
        metadata: { ...meta, [NOTIFY_META_KEY]: new Date().toISOString() },
      })
      .eq('referrer_id', rid)
      .eq('referee_id', fid)
  } catch (e) {
    console.warn('[REFERRAL_NOTIFY] teammate joined', e?.message || e)
  }
}

export async function notifyReferralWalletPayoutRequested({ userId, amountThb }) {
  try {
    await NotificationService.dispatch(NotificationEvents.REFERRAL_WALLET_PAYOUT_REQUESTED, {
      userId: String(userId || ''),
      amountThb: Number(amountThb) || 0,
    })
  } catch (e) {
    console.warn('[REFERRAL_NOTIFY] wallet payout request', e?.message || e)
  }
}
