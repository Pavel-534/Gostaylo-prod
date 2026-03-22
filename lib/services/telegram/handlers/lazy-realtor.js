import { telegramEnv } from '../env.js'
import { sendTelegram } from '../api.js'
import { uploadPhotoToStorage } from '../storage.js'
import { extractPrice, extractCategoryFromCaption, extractDistrictFromCaption } from '../parse.js'
import { getTelegramMessages } from '../messages/index.js'
import { buildLocalizedSiteUrl } from '../../../site-url.js'

export async function handlePhotoUpload(chatId, message, firstName, lang) {
  const t = getTelegramMessages(lang)
  const loc = lang === 'ru' ? 'ru-RU' : 'en-US'
  const { supabaseUrl, serviceKey } = telegramEnv()
  try {
    const chatIdStr = String(chatId)
    console.log(`[LAZY REALTOR] Looking up partner with telegram_id=${chatIdStr}`)

    const partnerRes = await fetch(
      `${supabaseUrl}/rest/v1/profiles?telegram_id=eq.${chatIdStr}&select=id,role,first_name,last_name,email`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      }
    )
    const partners = await partnerRes.json()
    const partner = partners?.[0]

    console.log(
      `[LAZY REALTOR] Partner lookup result:`,
      partner ? { id: partner.id, email: partner.email, role: partner.role } : 'NOT FOUND'
    )

    if (!partner) {
      await sendTelegram(chatId, t.lazyNotLinked(lang))
      return
    }

    if (!['PARTNER', 'ADMIN'].includes(partner.role)) {
      await sendTelegram(chatId, t.lazyNoRights(lang))
      return
    }

    await sendTelegram(chatId, t.lazyCreating())

    const photo = message.photo
    const caption = message.caption || ''
    const fileId = photo[photo.length - 1].file_id

    const listingId = `lst-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 5)}`

    const photoUrl = await uploadPhotoToStorage(fileId, listingId)

    const price = extractPrice(caption)

    const lines = caption.split('\n').filter((l) => l.trim())
    const title = lines[0]?.substring(0, 100) || t.lazyDefaultTitle(firstName)
    const description = lines.slice(1).join('\n') || caption || t.createdViaTelegram()

    const detectedCategory = extractCategoryFromCaption(caption)
    let categoryId = detectedCategory

    if (!categoryId) {
      const catRes = await fetch(
        `${supabaseUrl}/rest/v1/categories?is_active=eq.true&limit=1&select=id`,
        { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
      )
      const cats = await catRes.json()
      categoryId = Array.isArray(cats) && cats[0]?.id ? cats[0].id : 'cat-property'
    }

    const district = extractDistrictFromCaption(caption) || 'Phuket'

    console.log(`[LAZY REALTOR] Creating DRAFT: ${listingId}`)
    console.log(`[LAZY REALTOR] owner_id: ${partner.id}, category: ${categoryId}, district: ${district}`)
    console.log(`[LAZY REALTOR] Price: ${price}, Photo: ${photoUrl ? 'yes' : 'no'}`)

    const listingRes = await fetch(`${supabaseUrl}/rest/v1/listings`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        id: listingId,
        owner_id: partner.id,
        category_id: categoryId,
        status: 'INACTIVE',
        title,
        description,
        district,
        base_price_thb: price,
        commission_rate: 15,
        images: photoUrl ? [photoUrl] : [],
        cover_image: photoUrl,
        metadata: {
          source: 'TELEGRAM_LAZY_REALTOR',
          is_draft: true,
          telegram_chat_id: String(chatId),
          created_by: partner.first_name || firstName,
          created_at: new Date().toISOString(),
          needs_review: false,
        },
        available: false,
        is_featured: false,
        views: 0,
      }),
    })

    if (listingRes.ok) {
      const priceLine =
        price > 0 ? `฿${Number(price).toLocaleString(loc)}` : t.priceNotSet()
      const editUrl = buildLocalizedSiteUrl(lang, `/partner/listings/new?edit=${listingId}`)
      const listingsUrl = buildLocalizedSiteUrl(lang, '/partner/listings')

      await sendTelegram(
        chatId,
        t.lazyDraftCreated({
          title,
          priceLine,
          photoOk: Boolean(photoUrl),
          editUrl,
          listingsUrl,
        })
      )
    } else {
      const error = await listingRes.text()
      console.error('[LISTING CREATE ERROR]', error)
      await sendTelegram(chatId, t.lazyDraftCreateError())
    }
  } catch (e) {
    console.error('[PHOTO ERROR]', e)
    await sendTelegram(chatId, t.lazyPhotoError())
  }
}
