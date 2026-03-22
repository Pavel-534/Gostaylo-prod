import { telegramEnv } from '../env.js'
import { sendTelegram } from '../api.js'

export async function handleMyDrafts(chatId) {
  const { supabaseUrl, serviceKey, appUrl } = telegramEnv()
  const chatIdStr = String(chatId)
  const partnerRes = await fetch(
    `${supabaseUrl}/rest/v1/profiles?telegram_id=eq.${chatIdStr}&select=id,role`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
  )
  const partners = await partnerRes.json()
  const partner = partners?.[0]

  if (!partner || !['PARTNER', 'ADMIN'].includes(partner.role)) {
    await sendTelegram(
      chatId,
      '❌ <b>Telegram не привязан</b> или недостаточно прав.\n\n' +
        '<code>/link email@test.com</code> — привязать аккаунт'
    )
    return
  }

  const listingsRes = await fetch(
    `${supabaseUrl}/rest/v1/listings?owner_id=eq.${partner.id}&status=eq.INACTIVE&select=id,title,base_price_thb,metadata`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
  )
  const listings = await listingsRes.json()
  const drafts = (Array.isArray(listings) ? listings : []).filter(
    (l) =>
      l.metadata?.is_draft === true ||
      l.metadata?.is_draft === 'true' ||
      l.metadata?.source === 'TELEGRAM_LAZY_REALTOR'
  )

  if (drafts.length === 0) {
    await sendTelegram(
      chatId,
      '📋 <b>Нет черновиков</b>\n\n' + 'Отправьте фото с описанием — создам черновик.\n\n' + '/help — инструкция'
    )
    return
  }

  const lines = drafts.slice(0, 10).map((d, i) => {
    const price = d.base_price_thb ? `฿${Number(d.base_price_thb).toLocaleString()}` : '—'
    const editUrl = `${appUrl}/partner/listings/new?edit=${d.id}`
    return `${i + 1}. <b>${(d.title || 'Без названия').substring(0, 40)}</b> ${price}\n   <a href="${editUrl}">Редактировать →</a>`
  })
  const more = drafts.length > 10 ? `\n\n... и ещё ${drafts.length - 10}` : ''

  await sendTelegram(
    chatId,
    `📋 <b>Ваши черновики</b> (${drafts.length})\n\n` +
      lines.join('\n\n') +
      more +
      `\n\n📍 <a href="${appUrl}/partner/listings">Все объекты →</a>`
  )
}
