/**
 * Stage 114.2 / 114.4 — push/email для реферальных событий (earned bonus, teammate joined, admin alerts).
 */
import { getSiteDisplayName } from '@/lib/site-url.js'
import { supabaseAdmin } from '@/lib/supabase'
import { PushService } from '@/lib/services/push.service.js'
import { getNotifyDeps } from '@/lib/services/notifications/notify-deps.js'
import { formatPrivacyDisplayNameForParticipant } from '@/lib/utils/name-formatter'
import { convertReferralPayoutThbToCurrency } from '@/lib/services/marketing/referral-payout-fx.service.js'

function round2(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

function formatAmountThb(amountThb, lang = 'ru') {
  const n = round2(amountThb)
  const locale = lang === 'en' ? 'en-US' : lang === 'th' ? 'th-TH' : lang === 'zh' ? 'zh-CN' : 'ru-RU'
  return `${n.toLocaleString(locale, { maximumFractionDigits: 2 })} THB`
}

function formatAmountRub(amountRub, lang = 'ru') {
  const n = Math.round(Number(amountRub) || 0)
  const locale = lang === 'en' ? 'en-US' : 'ru-RU'
  return `${n.toLocaleString(locale, { maximumFractionDigits: 0 })} ₽`
}

function mlmTeamLevelLabel(data, lang = 'ru') {
  const depth = Number(data?.ledgerDepth)
  if (Number.isFinite(depth) && depth > 1) {
    return `L${depth}`
  }
  return 'L1'
}

function listingCityLabel(data) {
  return String(data?.listingCity || '').trim()
}

async function resolveRubEquivalent(amountThb, data) {
  if (Number.isFinite(Number(data?.amountRub)) && Number(data.amountRub) > 0) {
    return Math.round(Number(data.amountRub))
  }
  try {
    const fx = await convertReferralPayoutThbToCurrency(Number(amountThb), 'RUB')
    return Math.round(fx.amountInPayoutCurrency)
  } catch {
    return null
  }
}
function referralLevelLabel(data, lang = 'ru') {
  const depth = Number(data?.ledgerDepth)
  const rtype = String(data?.referralType || '').toLowerCase()
  if (rtype === 'host_activation') {
    return lang === 'en' ? 'Host activation bonus' : 'Бонус за активацию хоста'
  }
  if (Number.isFinite(depth) && depth > 1) {
    return lang === 'en' ? `Network level L${depth}` : `Уровень сети L${depth}`
  }
  if (Number.isFinite(depth) && depth === 1) {
    return lang === 'en' ? 'Direct referral (L1)' : 'Прямой реферал (L1)'
  }
  return lang === 'en' ? 'Referral reward' : 'Реферальное начисление'
}

function referralSourceLine(data, refereeName, lang = 'ru') {
  const name = String(refereeName || '').trim()
  const rtype = String(data?.referralType || '').toLowerCase()
  if (name) {
    return lang === 'en' ? `From: ${name}` : `От: ${name}`
  }
  if (rtype === 'host_activation') {
    return lang === 'en' ? 'Supply-side host activation' : 'Активация партнёра (supply)'
  }
  return ''
}

async function loadProfileNotifyFields(userId) {
  const uid = String(userId || '').trim()
  if (!uid) return null
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id,email,first_name,last_name,language,preferred_language,telegram_id')
    .eq('id', uid)
    .maybeSingle()
  if (error || !data?.id) return null
  const lang = String(data.preferred_language || data.language || 'ru').toLowerCase().startsWith('en')
    ? 'en'
    : 'ru'
  return { profile: data, lang }
}

/** Реферальный бонус зачислен в кошелёк (после earned + credit). */
export async function handleReferralBonusEarned(data) {
  const { sendEmail, sendTelegram } = getNotifyDeps()
  const beneficiaryId = String(data?.beneficiaryId || data?.userId || '').trim()
  const amountThb = round2(data?.amountThb)
  const bookingId = data?.bookingId ? String(data.bookingId) : null
  const ledgerId = data?.ledgerId ? String(data.ledgerId) : null
  const txType = String(data?.txType || 'referral_bonus').toLowerCase()
  if (!beneficiaryId || amountThb <= 0) return

  const loaded = await loadProfileNotifyFields(beneficiaryId)
  if (!loaded?.profile?.email) return
  const { profile, lang } = loaded
  const site = getSiteDisplayName()
  const amountLabel = formatAmountThb(amountThb, lang)
  const isCashback = txType === 'referral_cashback'
  const levelLine = referralLevelLabel(data, lang)

  let refereeName = ''
  const refereeId = String(data?.refereeId || '').trim()
  if (refereeId) {
    const refLoaded = await loadProfileNotifyFields(refereeId)
    if (refLoaded?.profile) {
      refereeName = formatPrivacyDisplayNameForParticipant(
        refLoaded.profile.first_name,
        refLoaded.profile.last_name,
        refLoaded.profile.email,
        'Friend',
      )
    }
  }
  const sourceLine = referralSourceLine(data, refereeName, lang)
  const profileLink = refereeId ? `/u/${refereeId}` : '/profile/referral'
  const teamLevel = mlmTeamLevelLabel(data, lang)
  const city = listingCityLabel(data)
  const amountRub = await resolveRubEquivalent(amountThb, data)
  const rubPart = amountRub != null ? ` (~${formatAmountRub(amountRub, lang)})` : ''
  const cityPart = city ? ` (${city})` : ''
  const headlineRu =
    `Доступно к выводу: +${amountLabel}${rubPart} с команды ${teamLevel}!` +
    (city ? cityPart : '')
  const headlineEn =
    `Available to withdraw: +${amountLabel}${rubPart} from team ${teamLevel}!` +
    (city ? cityPart : '')

  const subject =
    lang === 'en'
      ? `${isCashback ? 'Referral cashback' : 'Referral bonus'} +${amountLabel} — ${site}`
      : `${isCashback ? 'Реферальный кешбэк' : 'Реферальный бонус'} +${amountLabel} — ${site}`

  const textBody =
    lang === 'en'
      ? `Hello${profile.first_name ? `, ${profile.first_name}` : ''}!\n\n` +
        `${headlineEn}\n` +
        `${isCashback ? 'Friend cashback' : 'Referral reward'} credited to wallet.\n` +
        `Level: ${levelLine}\n` +
        (sourceLine ? `${sourceLine}\n` : '') +
        (bookingId ? `Booking: ${bookingId}\n` : '') +
        `\nWallet: /profile/wallet\nReferral hub: /profile/referral\n` +
        (refereeId ? `Profile: ${profileLink}\n` : '') +
        `\nTeam ${site}`
      : `Здравствуйте${profile.first_name ? `, ${profile.first_name}` : ''}!\n\n` +
        `${headlineRu}\n` +
        `Средства зачислены на кошелёк (${isCashback ? 'кешбэк за друга' : 'бонус по реферальной программе'}).\n` +
        `Уровень: ${levelLine}\n` +
        (sourceLine ? `${sourceLine}\n` : '') +
        (bookingId ? `Бронь: ${bookingId}\n` : '') +
        `\nКошелёк: /profile/wallet\nРефералка: /profile/referral\n` +
        (refereeId ? `Профиль: ${profileLink}\n` : '') +
        `\nКоманда ${site}`

  await sendEmail(profile.email, subject, textBody)

  if (profile.telegram_id) {
    const tgHeadline = lang === 'en' ? headlineEn : headlineRu
    await sendTelegram(
      profile.telegram_id,
      lang === 'en'
        ? `🎁 <b>Referral reward</b>\n\n${tgHeadline}\n<a href="/profile/wallet">Open wallet</a>`
        : `🎁 <b>Реферальное начисление</b>\n\n${tgHeadline}\n<a href="/profile/wallet">Кошелёк</a>`,
    )
  }

  await PushService.sendToUser(beneficiaryId, 'REFERRAL_BONUS_EARNED', {
    amountThb: String(amountThb),
    amountLabel,
    amountRub: amountRub != null ? String(amountRub) : '',
    amountRubLabel: amountRub != null ? formatAmountRub(amountRub, lang) : '',
    bookingId: bookingId || '',
    ledgerId: ledgerId || '',
    link: '/profile/wallet',
    txType,
    levelLine: levelLine || '',
    teamLevel,
    listingCity: city,
    sourceLine: sourceLine || '',
    headline: lang === 'en' ? headlineEn : headlineRu,
    siteName: site,
  })
}

/** Stage 131.7 — held accrual (hold period or fraud gate review). */
export async function handleReferralBonusHeld(data) {
  const { sendEmail, sendTelegram } = getNotifyDeps()
  const beneficiaryId = String(data?.beneficiaryId || '').trim()
  const amountThb = round2(data?.amountThb)
  if (!beneficiaryId || amountThb <= 0) return

  const loaded = await loadProfileNotifyFields(beneficiaryId)
  if (!loaded?.profile?.email) return
  const { profile, lang } = loaded
  const site = getSiteDisplayName()
  const amountLabel = formatAmountThb(amountThb, lang)
  const teamLevel = mlmTeamLevelLabel(data, lang)
  const city = listingCityLabel(data)
  const cityPart = city ? ` (${city})` : ''
  const holdDays = Math.max(0, Math.floor(Number(data?.holdDays) || 0))
  const fraudGate = data?.fraudGateHold === true

  let holdLineRu
  let holdLineEn
  if (fraudGate) {
    holdLineRu = `+${amountLabel} с ${teamLevel}${cityPart}. На проверке, разблокировка после проверки антифродом`
    holdLineEn = `+${amountLabel} from ${teamLevel}${cityPart}. Under review — unlock after fraud check`
  } else if (holdDays > 0) {
    holdLineRu = `+${amountLabel} с ${teamLevel}${cityPart}. На проверке, разблокировка через ${holdDays} дн.`
    holdLineEn = `+${amountLabel} from ${teamLevel}${cityPart}. On hold — unlock in ${holdDays} days`
  } else {
    holdLineRu = `+${amountLabel} с ${teamLevel}${cityPart}. На проверке`
    holdLineEn = `+${amountLabel} from ${teamLevel}${cityPart}. On hold`
  }

  const subject =
    lang === 'en' ? `Referral bonus on hold — ${site}` : `Реферальный бонус на удержании — ${site}`

  const textBody =
    lang === 'en'
      ? `Hello${profile.first_name ? `, ${profile.first_name}` : ''}!\n\n${holdLineEn}\n\nReferral hub: /profile/referral\n\nTeam ${site}`
      : `Здравствуйте${profile.first_name ? `, ${profile.first_name}` : ''}!\n\n${holdLineRu}\n\nРефералка: /profile/referral\n\nКоманда ${site}`

  await sendEmail(profile.email, subject, textBody)

  if (profile.telegram_id) {
    await sendTelegram(
      profile.telegram_id,
      lang === 'en'
        ? `⏳ <b>Referral on hold</b>\n\n${holdLineEn}`
        : `⏳ <b>Бонус на удержании</b>\n\n${holdLineRu}`,
    )
  }

  await PushService.sendToUser(beneficiaryId, 'REFERRAL_BONUS_HELD', {
    amountThb: String(amountThb),
    amountLabel,
    teamLevel,
    listingCity: city,
    holdDays: String(holdDays),
    fraudGateHold: fraudGate ? '1' : '0',
    headline: lang === 'en' ? holdLineEn : holdLineRu,
    link: '/profile/referral',
    siteName: site,
  })
}

/** Stage 114.4 — крупное earned или всплеск за час (FinTech topic). */
export async function handleReferralAdminAlert(data) {
  const { sendToAdminTopic } = getNotifyDeps()
  const amountThb = round2(data?.amountThb)
  const hourlySumThb = round2(data?.hourlySumThb)
  const ambassadorLabel = String(data?.ambassadorLabel || data?.beneficiaryId || '').trim()
  if (amountThb <= 0 && !data?.monthlyApproaching) return

  const policyThb = round2(data?.thresholdThb) || 10_000
  const reasons = []
  if (data?.large) reasons.push(`начисление ≥ ${formatAmountThb(policyThb)}`)
  if (data?.burst) reasons.push(`сумма earned за 1ч ≥ ${formatAmountThb(hourlySumThb)}`)
  if (data?.monthly) {
    reasons.push(
      `месячный spend ≥ ${formatAmountThb(data.monthly?.thresholdThb || policyThb)} (${formatAmountThb(data.monthlySpendThb || data.monthly?.monthlySpendThb)})`,
    )
  }
  if (data?.monthlyApproaching) {
    reasons.push(
      `месячный spend приближается к лимиту: ${formatAmountThb(data.monthlyApproachSpendThb || data.monthlySpendThb)} (warn ≥ ${formatAmountThb(data.monthlyApproachWarnThb)})`,
    )
  }

  await sendToAdminTopic(
    'FINANCE',
    `⚠️ <b>Referral: подозрительная активность</b>\n\n` +
      `👤 ${ambassadorLabel}\n` +
      `💰 Текущее: <b>${formatAmountThb(amountThb)}</b>\n` +
      (data?.burst ? `📊 За последний час (earned): <b>${formatAmountThb(hourlySumThb)}</b>\n` : '') +
      `🔎 Причина: ${reasons.join(' · ') || 'порог'}\n` +
      (data?.bookingId ? `📋 Бронь: <code>${data.bookingId}</code>\n` : '') +
      (data?.ledgerId ? `🧾 Ledger: <code>${data.ledgerId}</code>\n` : '') +
      `🔗 <a href="/admin/settings/finances">FinTech</a> · <a href="/admin/marketing/payouts">Выплаты</a>`,
  )
}

/** Новый участник в команде (после referral_relations). */
export async function handleReferralTeammateJoined(data) {
  const { sendEmail, sendTelegram } = getNotifyDeps()
  const referrerId = String(data?.referrerId || '').trim()
  const refereeId = String(data?.refereeId || '').trim()
  if (!referrerId || !refereeId) return

  const loaded = await loadProfileNotifyFields(referrerId)
  if (!loaded?.profile?.email) return
  const { profile, lang } = loaded
  const site = getSiteDisplayName()

  let displayName = String(data?.displayName || '').trim()
  if (!displayName) {
    const { data: refProf } = await supabaseAdmin
      .from('profiles')
      .select('first_name,last_name,email')
      .eq('id', refereeId)
      .maybeSingle()
    displayName = formatPrivacyDisplayNameForParticipant(
      refProf?.first_name,
      refProf?.last_name,
      refProf?.email,
      'Friend',
    )
  }

  const subject =
    lang === 'en' ? `New teammate in your team — ${site}` : `В команде новый участник — ${site}`

  const textBody =
    lang === 'en'
      ? `Hello${profile.first_name ? `, ${profile.first_name}` : ''}!\n\n` +
        `${displayName} joined via your referral link.\n\n` +
        `Track progress: /profile/status\n\nTeam ${site}`
      : `Здравствуйте${profile.first_name ? `, ${profile.first_name}` : ''}!\n\n` +
        `${displayName} присоединился по вашей реферальной ссылке.\n\n` +
        `Прогресс: /profile/status\n\nКоманда ${site}`

  await sendEmail(profile.email, subject, textBody)

  if (profile.telegram_id) {
    await sendTelegram(
      profile.telegram_id,
      lang === 'en'
        ? `👥 <b>New teammate</b>\n\n<b>${displayName}</b> joined your referral team.`
        : `👥 <b>Новый в команде</b>\n\n<b>${displayName}</b> присоединился по вашей ссылке.`,
    )
  }

  await PushService.sendToUser(referrerId, 'REFERRAL_TEAMMATE_JOINED', {
    displayName,
    refereeId,
    link: '/profile/status',
  })
}

/** Заявка на вывод реферального withdrawable (полуавтомат, FinTech). */
export async function handleReferralWalletPayoutRequested(data) {
  const { sendToAdminTopic } = getNotifyDeps()
  const userId = String(data?.userId || '').trim()
  const amountThb = round2(data?.amountThb)
  if (!userId || amountThb <= 0) return

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('email,first_name,last_name')
    .eq('id', userId)
    .maybeSingle()

  await sendToAdminTopic(
    'FINANCE',
    `💳 <b>Заявка: вывод реферального кошелька</b>\n\n` +
      `👤 ${formatPrivacyDisplayNameForParticipant(profile?.first_name, profile?.last_name, profile?.email, userId)}\n` +
      `💰 Сумма (withdrawable): <b>${formatAmountThb(amountThb)}</b>\n` +
      `📋 Статус: <code>withdrawable_referral</code>\n` +
      `🔗 <a href="/admin/marketing/payouts">Кошельки к выплате</a> · <a href="/admin/settings/finances">FinTech</a>`,
  )
}
