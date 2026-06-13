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
  const isL2 = Number.isFinite(Number(data?.ledgerDepth)) && Number(data.ledgerDepth) > 1
  const headlineRu =
    (isL2
      ? `Сеть L${Number(data.ledgerDepth)}: +${amountLabel}${rubPart} доступно к выводу!`
      : `Доступно к выводу: +${amountLabel}${rubPart} с команды ${teamLevel}!`) + (city ? cityPart : '')
  const headlineEn =
    (isL2
      ? `Network L${Number(data.ledgerDepth)}: +${amountLabel}${rubPart} available to withdraw!`
      : `Available to withdraw: +${amountLabel}${rubPart} from team ${teamLevel}!`) + (city ? cityPart : '')

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
  const amountRub = await resolveRubEquivalent(amountThb, data)
  const rubPart = amountRub != null ? ` (~${formatAmountRub(amountRub, lang)})` : ''

  let holdLineRu
  let holdLineEn
  if (fraudGate) {
    holdLineRu = `+${amountLabel}${rubPart} с ${teamLevel}${cityPart}. На проверке, разблокировка после проверки антифродом`
    holdLineEn = `+${amountLabel}${rubPart} from ${teamLevel}${cityPart}. Under review — unlock after fraud check`
  } else if (holdDays > 0) {
    holdLineRu = `+${amountLabel}${rubPart} с ${teamLevel}${cityPart}. На проверке, разблокировка через ${holdDays} дн.`
    holdLineEn = `+${amountLabel}${rubPart} from ${teamLevel}${cityPart}. On hold — unlock in ${holdDays} days`
  } else {
    holdLineRu = `+${amountLabel}${rubPart} с ${teamLevel}${cityPart}. На проверке`
    holdLineEn = `+${amountLabel}${rubPart} from ${teamLevel}${cityPart}. On hold`
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
    amountRub: amountRub != null ? String(amountRub) : '',
    amountRubLabel: amountRub != null ? formatAmountRub(amountRub, lang) : '',
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
      `🔗 <a href="/admin/settings/finances">FinTech</a> · <a href="/admin/marketing/referral-payouts">Выплаты</a>`,
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

async function dispatchReferralWithdrawalUserNotice(data, stage) {
  const { sendEmail, sendTelegram } = getNotifyDeps()
  const userId = String(data?.userId || '').trim()
  const netRub = Math.round(Number(data?.netRub) || 0)
  const grossThb = round2(data?.grossThb)
  const payoutId = data?.payoutId ? String(data.payoutId) : null
  if (!userId) return

  const loaded = await loadProfileNotifyFields(userId)
  if (!loaded?.profile?.email) return
  const { profile, lang } = loaded
  const site = getSiteDisplayName()
  const rubLabel = netRub > 0 ? formatAmountRub(netRub, lang) : ''
  const thbLabel = grossThb > 0 ? formatAmountThb(grossThb, lang) : ''

  const copy = {
    approved: {
      subjectRu: `Заявка на вывод одобрена — ${site}`,
      subjectEn: `Withdrawal request approved — ${site}`,
      bodyRu:
        `Здравствуйте${profile.first_name ? `, ${profile.first_name}` : ''}!\n\n` +
        `FinTech одобрил вашу заявку на вывод реферального баланса` +
        (rubLabel ? `: ≈ ${rubLabel} на карту РФ` : thbLabel ? ` (${thbLabel})` : '') +
        `.\nСледующий шаг — формирование банковского реестра.\n\nКошелёк: /profile/wallet`,
      bodyEn:
        `Hello${profile.first_name ? `, ${profile.first_name}` : ''}!\n\n` +
        `Your referral withdrawal was approved` +
        (rubLabel ? ` (≈ ${rubLabel} to RU card)` : thbLabel ? ` (${thbLabel})` : '') +
        `.\nNext: bank registry export.\n\nWallet: /profile/wallet`,
      tgRu: `✅ <b>Заявка одобрена</b>\n\n${rubLabel || thbLabel || 'Вывод'} — готовим перевод на карту РФ.\n<a href="/profile/wallet">Кошелёк</a>`,
      tgEn: `✅ <b>Withdrawal approved</b>\n\n${rubLabel || thbLabel || 'Payout'} — preparing RU card transfer.\n<a href="/profile/wallet">Wallet</a>`,
      pushKey: 'REFERRAL_WITHDRAWAL_APPROVED',
      headlineRu: rubLabel
        ? `Заявка одобрена: ≈ ${rubLabel} на карту РФ`
        : `Заявка на вывод одобрена`,
      headlineEn: rubLabel
        ? `Withdrawal approved: ≈ ${rubLabel} to RU card`
        : `Withdrawal request approved`,
    },
    registry_sent: {
      subjectRu: `Реестр отправлен в банк — ${site}`,
      subjectEn: `Registry sent to bank — ${site}`,
      bodyRu:
        `Здравствуйте${profile.first_name ? `, ${profile.first_name}` : ''}!\n\n` +
        `Реестр Т-Банка сформирован и передан в обработку` +
        (rubLabel ? ` (≈ ${rubLabel})` : '') +
        `.\nОбычно зачисление занимает 1–3 рабочих дня.\n\nСтатус: /profile/wallet`,
      bodyEn:
        `Hello${profile.first_name ? `, ${profile.first_name}` : ''}!\n\n` +
        `T-Bank registry was exported` +
        (rubLabel ? ` (≈ ${rubLabel})` : '') +
        `.\nFunds usually arrive in 1–3 business days.\n\nStatus: /profile/wallet`,
      tgRu: `🏦 <b>Реестр в банке</b>\n\n${rubLabel || 'Перевод'} отправлен в Т-Банк на обработку.\n<a href="/profile/wallet">Статус</a>`,
      tgEn: `🏦 <b>Registry at bank</b>\n\n${rubLabel || 'Transfer'} sent to T-Bank for processing.\n<a href="/profile/wallet">Status</a>`,
      pushKey: 'REFERRAL_WITHDRAWAL_REGISTRY_SENT',
      headlineRu: rubLabel
        ? `Реестр в банке: ≈ ${rubLabel} в обработке`
        : `Реестр отправлен в банк`,
      headlineEn: rubLabel
        ? `Bank registry: ≈ ${rubLabel} processing`
        : `Registry sent to bank`,
    },
    paid: {
      subjectRu: `Выплата зачислена — ${site}`,
      subjectEn: `Payout completed — ${site}`,
      bodyRu:
        `Здравствуйте${profile.first_name ? `, ${profile.first_name}` : ''}!\n\n` +
        `Выплата реферального баланса отмечена как выполненная` +
        (rubLabel ? `: ≈ ${rubLabel} на карту РФ` : '') +
        `.\n\nИстория: /profile/wallet`,
      bodyEn:
        `Hello${profile.first_name ? `, ${profile.first_name}` : ''}!\n\n` +
        `Referral withdrawal marked as paid` +
        (rubLabel ? `: ≈ ${rubLabel} to RU card` : '') +
        `.\n\nHistory: /profile/wallet`,
      tgRu: `💸 <b>Выплата выполнена</b>\n\n${rubLabel || 'Средства'} зачислены на карту РФ.\n<a href="/profile/wallet">Кошелёк</a>`,
      tgEn: `💸 <b>Payout completed</b>\n\n${rubLabel || 'Funds'} paid to RU card.\n<a href="/profile/wallet">Wallet</a>`,
      pushKey: 'REFERRAL_WITHDRAWAL_PAID',
      headlineRu: rubLabel ? `Выплачено ≈ ${rubLabel} на карту РФ` : `Выплата выполнена`,
      headlineEn: rubLabel ? `Paid ≈ ${rubLabel} to RU card` : `Payout completed`,
    },
    rejected: {
      subjectRu: `Заявка на вывод отклонена — ${site}`,
      subjectEn: `Withdrawal request rejected — ${site}`,
      bodyRu:
        `Здравствуйте${profile.first_name ? `, ${profile.first_name}` : ''}!\n\n` +
        `FinTech отклонил заявку на вывод реферального баланса` +
        (rubLabel ? ` (≈ ${rubLabel})` : thbLabel ? ` (${thbLabel})` : '') +
        `. Средства остаются на кошельке — вы можете подать заявку снова.\n\n` +
        (data?.reason ? `Причина: ${data.reason}\n\n` : '') +
        `Кошелёк: /profile/wallet`,
      bodyEn:
        `Hello${profile.first_name ? `, ${profile.first_name}` : ''}!\n\n` +
        `Your referral withdrawal was rejected` +
        (rubLabel ? ` (≈ ${rubLabel})` : thbLabel ? ` (${thbLabel})` : '') +
        `. Funds remain in your wallet — you may submit a new request.\n\n` +
        (data?.reason ? `Reason: ${data.reason}\n\n` : '') +
        `Wallet: /profile/wallet`,
      tgRu: `❌ <b>Заявка отклонена</b>\n\n${rubLabel || thbLabel || 'Вывод'} не выполнен. Баланс на кошельке.\n<a href="/profile/wallet">Подать снова</a>`,
      tgEn: `❌ <b>Withdrawal rejected</b>\n\n${rubLabel || thbLabel || 'Payout'} declined. Balance remains in wallet.\n<a href="/profile/wallet">Try again</a>`,
      pushKey: 'REFERRAL_WITHDRAWAL_REJECTED',
      headlineRu: rubLabel
        ? `Заявка отклонена: ≈ ${rubLabel} остаётся на кошельке`
        : `Заявка на вывод отклонена`,
      headlineEn: rubLabel
        ? `Withdrawal rejected: ≈ ${rubLabel} remains in wallet`
        : `Withdrawal request rejected`,
    },
    expired: {
      subjectRu: `Срок заявки на вывод истёк — ${site}`,
      subjectEn: `Withdrawal FX lock expired — ${site}`,
      bodyRu:
        `Здравствуйте${profile.first_name ? `, ${profile.first_name}` : ''}!\n\n` +
        `Истёк 48-часовой курс по заявке на вывод` +
        (rubLabel ? ` (≈ ${rubLabel})` : thbLabel ? ` (${thbLabel})` : '') +
        `. Заявка сброшена — подайте новую, чтобы зафиксировать актуальный курс.\n\n` +
        `Кошелёк: /profile/wallet`,
      bodyEn:
        `Hello${profile.first_name ? `, ${profile.first_name}` : ''}!\n\n` +
        `The 48-hour FX lock on your withdrawal` +
        (rubLabel ? ` (≈ ${rubLabel})` : thbLabel ? ` (${thbLabel})` : '') +
        ` expired. Submit a new request to lock the current rate.\n\n` +
        `Wallet: /profile/wallet`,
      tgRu: `⏱ <b>Курс истёк</b>\n\n${rubLabel || thbLabel || 'Заявка'} сброшена. Подайте вывод заново для нового курса.\n<a href="/profile/wallet">Кошелёк</a>`,
      tgEn: `⏱ <b>FX lock expired</b>\n\n${rubLabel || thbLabel || 'Request'} cleared. Submit withdrawal again for a fresh rate.\n<a href="/profile/wallet">Wallet</a>`,
      pushKey: 'REFERRAL_WITHDRAWAL_EXPIRED',
      headlineRu: rubLabel
        ? `Курс истёк: подайте вывод ≈ ${rubLabel} заново`
        : `Срок заявки на вывод истёк — подайте снова`,
      headlineEn: rubLabel
        ? `FX lock expired: resubmit ≈ ${rubLabel} withdrawal`
        : `Withdrawal lock expired — submit again`,
    },
  }

  const c = copy[stage]
  if (!c) return

  await sendEmail(
    profile.email,
    lang === 'en' ? c.subjectEn : c.subjectRu,
    lang === 'en' ? c.bodyEn : c.bodyRu,
  )

  if (profile.telegram_id) {
    await sendTelegram(profile.telegram_id, lang === 'en' ? c.tgEn : c.tgRu)
  }

  await PushService.sendToUser(userId, c.pushKey, {
    netRub: String(netRub),
    netRubLabel: rubLabel,
    grossThb: String(grossThb),
    grossThbLabel: thbLabel,
    payoutId: payoutId || '',
    headline: lang === 'en' ? c.headlineEn : c.headlineRu,
    link: '/profile/wallet',
    siteName: site,
  })
}

/** Stage 132.3 — FinTech approve → payout PENDING. */
export async function handleReferralWithdrawalApproved(data) {
  await dispatchReferralWithdrawalUserNotice(data, 'approved')
}

/** Stage 132.3 — T-Bank registry export → PROCESSING. */
export async function handleReferralWithdrawalRegistrySent(data) {
  await dispatchReferralWithdrawalUserNotice(data, 'registry_sent')
}

/** Stage 132.3 — admin marks payout PAID. */
export async function handleReferralWithdrawalPaid(data) {
  await dispatchReferralWithdrawalUserNotice(data, 'paid')
}

/** Stage 135 — FinTech reject (bulk or manual). */
export async function handleReferralWithdrawalRejected(data) {
  await dispatchReferralWithdrawalUserNotice(data, 'rejected')
}

/** Stage 135 — FX lock lazy-expire (48h). */
export async function handleReferralWithdrawalExpired(data) {
  await dispatchReferralWithdrawalUserNotice(data, 'expired')
}

/** Stage 135 — weekly team earnings digest (L1+L2, THB + RUB teaser). */
export async function handleReferralTeamWeeklyDigest(data) {
  const { sendEmail, sendTelegram } = getNotifyDeps()
  const userId = String(data?.userId || '').trim()
  const totalThb = round2(data?.totalThb)
  const l1Thb = round2(data?.l1Thb)
  const l2Thb = round2(data?.l2Thb)
  if (!userId || totalThb <= 0) return

  const loaded = await loadProfileNotifyFields(userId)
  if (!loaded?.profile?.email) return
  const { profile, lang } = loaded
  const site = getSiteDisplayName()
  const totalLabel = formatAmountThb(totalThb, lang)
  const l1Label = formatAmountThb(l1Thb, lang)
  const l2Label = formatAmountThb(l2Thb, lang)
  const totalRub = await resolveRubEquivalent(totalThb, data)
  const rubPart = totalRub != null ? ` (~${formatAmountRub(totalRub, lang)})` : ''

  const headlineRu = `Ваша команда заработала ${totalLabel}${rubPart} на этой неделе`
  const headlineEn = `Your team earned ${totalLabel}${rubPart} this week`

  const subject =
    lang === 'en' ? `Weekly team earnings — ${site}` : `Итоги недели по команде — ${site}`

  const textBody =
    lang === 'en'
      ? `Hello${profile.first_name ? `, ${profile.first_name}` : ''}!\n\n` +
        `${headlineEn}\n` +
        `L1 (direct): ${l1Label}\n` +
        `L2 (network): ${l2Label}\n\n` +
        `Referral hub: /profile/referral\n\nTeam ${site}`
      : `Здравствуйте${profile.first_name ? `, ${profile.first_name}` : ''}!\n\n` +
        `${headlineRu}\n` +
        `L1 (прямые): ${l1Label}\n` +
        `L2 (сеть): ${l2Label}\n\n` +
        `Рефералка: /profile/referral\n\nКоманда ${site}`

  await sendEmail(profile.email, subject, textBody)

  if (profile.telegram_id) {
    await sendTelegram(
      profile.telegram_id,
      lang === 'en'
        ? `📊 <b>Weekly team digest</b>\n\n${headlineEn}\nL1: ${l1Label} · L2: ${l2Label}\n<a href="/profile/referral">Open hub</a>`
        : `📊 <b>Итоги недели</b>\n\n${headlineRu}\nL1: ${l1Label} · L2: ${l2Label}\n<a href="/profile/referral">Открыть</a>`,
    )
  }

  await PushService.sendToUser(userId, 'REFERRAL_TEAM_WEEKLY_DIGEST', {
    totalThb: String(totalThb),
    totalLabel,
    l1Thb: String(l1Thb),
    l1Label,
    l2Thb: String(l2Thb),
    l2Label,
    amountRub: totalRub != null ? String(totalRub) : '',
    headline: lang === 'en' ? headlineEn : headlineRu,
    link: '/profile/referral',
    siteName: site,
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
      `🔗 <a href="/admin/marketing/referral-payouts">Кошельки к выплате</a> · <a href="/admin/settings/finances">FinTech</a>`,
  )
}
