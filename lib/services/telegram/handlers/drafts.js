import { telegramEnv } from '../env.js'
import { sendTelegram } from '../api.js'
import { getTelegramMessages } from '../messages/index.js'
import { buildLocalizedSiteUrl } from '../../../site-url.js'

export async function handleMyDrafts(chatId, lang) {
  const t = getTelegramMessages(lang)
  const loc = lang === 'ru' ? 'ru-RU' : 'en-US'
  const { supabaseUrl, serviceKey } = telegramEnv()
  const chatIdStr = String(chatId)
  const partnerRes = await fetch(
    `${supabaseUrl}/rest/v1/profiles?telegram_id=eq.${chatIdStr}&select=id,role`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
  )
  const partners = await partnerRes.json()
  const partner = partners?.[0]

  if (!partner || !['PARTNER', 'ADMIN'].includes(partner.role)) {
    await sendTelegram(chatId, t.draftsAccessDenied())
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
    await sendTelegram(chatId, t.draftsEmpty())
    return
  }

  const lines = drafts.slice(0, 10).map((d, i) => {
    const price = d.base_price_thb
      ? `฿${Number(d.base_price_thb).toLocaleString(loc)}`
      : '—'
    const editUrl = buildLocalizedSiteUrl(lang, `/partner/listings/new?edit=${d.id}`)
    const title = (d.title || t.draftUntitled()).substring(0, 40)
    return t.draftLine(i + 1, title, price, editUrl)
  })
  const more = drafts.length > 10 ? t.draftsMore(drafts.length - 10) : ''

  await sendTelegram(
    chatId,
    t.draftsHeader(drafts.length) + lines.join('\n\n') + more + t.draftsFooter(lang)
  )
}
