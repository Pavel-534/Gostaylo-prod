import { telegramEnv } from '../env.js'
import { sendTelegram, withMainMenu, withMainMenuForChat } from '../api.js'
import { menuVariantFromRole } from '../menu-variant.js'
import { uploadPhotoToStorage } from '../storage.js'
import {
  extractCategoryFromCaption,
  parseListingCaption,
  categoryIdToSlug,
} from '../parse.js'
import { getTelegramMessages } from '../messages/index.js'
import { buildLocalizedSiteUrl } from '../../../site-url.js'
import {
  setPendingPhotos,
  hasPendingPhotos,
  takePendingPhotos,
  restorePendingPhotos,
  clearPendingPhotos,
} from '../pending-photos-buffer.js'

async function fetchPartnerProfile(chatId, supabaseUrl, serviceKey) {
  const chatIdStr = String(chatId)
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
  return partners?.[0] || null
}

/**
 * @param {object[]} rows — categories из REST
 * @param {string} dbSlug — slug в БД (vehicles, property, …)
 * @param {string} caption — для fallback по ключевым словам
 */
function resolveCategoryId(rows, dbSlug, caption) {
  if (!Array.isArray(rows) || rows.length === 0) return 'cat-property'

  const bySlug = new Map(rows.map((r) => [String(r.slug || '').toLowerCase(), r.id]))
  const byId = new Map(rows.map((r) => [String(r.id || '').toLowerCase(), r.id]))

  let slug = String(dbSlug || 'property').toLowerCase()
  const aliases = {
    transport: 'vehicles',
    vehicle: 'vehicles',
    vehicles: 'vehicles',
    yacht: 'yachts',
    boat: 'yachts',
    villa: 'property',
    apartment: 'property',
    condo: 'property',
    home: 'property',
    studio: 'property',
    house: 'property',
    bike: 'vehicles',
    car: 'vehicles',
    scooter: 'vehicles',
    tour: 'tours',
    excursion: 'tours',
    nanny: 'nanny',
  }
  if (aliases[slug]) slug = aliases[slug]
  if (bySlug.has(slug)) return bySlug.get(slug)

  const heur = extractCategoryFromCaption(caption)
  if (heur && byId.has(String(heur).toLowerCase())) return byId.get(String(heur).toLowerCase())
  if (heur) {
    const s = categoryIdToSlug(heur)
    if (bySlug.has(s)) return bySlug.get(s)
  }

  return rows[0].id || 'cat-property'
}

function mergeAlbumCaptions(messages) {
  const parts = []
  const seen = new Set()
  for (const m of messages) {
    const c = (m.caption || '').trim()
    if (!c || seen.has(c)) continue
    seen.add(c)
    parts.push(c)
  }
  return parts.join('\n')
}

function collectLargestFileIds(messages) {
  const ids = []
  for (const m of messages) {
    const ph = m.photo
    if (!ph?.length) continue
    const last = ph[ph.length - 1]
    if (last?.file_id) ids.push(last.file_id)
  }
  return ids
}

async function finalizeDraftListing({
  chatId,
  partner,
  ownerId,
  fileIds,
  firstName,
  lang,
  parsed,
  captionForResolve,
  t,
}) {
  const loc = lang === 'ru' ? 'ru-RU' : 'en-US'
  const { supabaseUrl, serviceKey } = telegramEnv()

  await sendTelegram(chatId, t.lazyCreating())

  const listingId = `lst-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 5)}`

  const imageUrls = []
  for (const fileId of fileIds) {
    const url = await uploadPhotoToStorage(fileId, listingId)
    if (url) imageUrls.push(url)
  }

  const title = (parsed.title || t.lazyDefaultTitle(firstName)).trim().slice(0, 100)
  const description = (
    parsed.description?.trim() || t.createdViaTelegram()
  ).slice(0, 8000)
  const price = parsed.price
  const district = (parsed.district || 'Phuket').trim().slice(0, 120)

  const catRes = await fetch(
    `${supabaseUrl}/rest/v1/categories?is_active=eq.true&select=id,slug`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
  )
  const catRows = await catRes.json()
  const rows = Array.isArray(catRows) ? catRows : []

  const hasNannySlug = rows.some((r) => String(r.slug || '').toLowerCase() === 'nanny')
  let dbSlug = parsed.category_db_slug
  if (dbSlug === 'nanny' && !hasNannySlug) {
    dbSlug = 'property'
  }

  const categoryId = resolveCategoryId(rows, dbSlug, captionForResolve)
  const cover = imageUrls[0] || null

  const metadata = {
    source: 'TELEGRAM_LAZY_REALTOR',
    is_draft: true,
    telegram_chat_id: String(chatId),
    created_by: partner.first_name || firstName,
    created_at: new Date().toISOString(),
    needs_review: false,
    bedrooms: parsed.bedrooms ?? 0,
    telegram_ai_category: parsed.category_display,
  }
  if (parsed.category_display === 'nanny' && !hasNannySlug) {
    metadata.ai_intended_category = 'nanny'
  }

  console.log(`[LAZY REALTOR] Creating DRAFT: ${listingId}`)
  console.log(
    `[LAZY REALTOR] owner_id: ${ownerId}, category: ${categoryId}, district: ${district}, photos: ${imageUrls.length}`
  )
  console.log(`[LAZY REALTOR] Price: ${price}`)

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
      owner_id: ownerId,
      category_id: categoryId,
      status: 'INACTIVE',
      title,
      description,
      district,
      base_price_thb: price,
      commission_rate: 15,
      images: imageUrls,
      cover_image: cover,
      metadata,
      available: false,
      is_featured: false,
      views: 0,
    }),
  })

  if (listingRes.ok) {
    const priceLine =
      price > 0 ? `${Number(price).toLocaleString(loc)} THB` : t.priceNotSet()
    const editUrl = buildLocalizedSiteUrl(lang, `/partner/listings/new?edit=${listingId}`)
    const listingsUrl = buildLocalizedSiteUrl(lang, '/partner/listings')
    const categoryLine = t.draftCategoryLabel(parsed.category_display, lang)

    await sendTelegram(
      chatId,
      t.lazyDraftCreated({
        title,
        priceLine,
        photoCount: imageUrls.length,
        categoryLine,
        editUrl,
        listingsUrl,
      }),
      withMainMenu(lang, { menuVariant: 'partner' })
    )
  } else {
    const error = await listingRes.text()
    console.error('[LISTING CREATE ERROR]', error)
    await sendTelegram(
      chatId,
      t.lazyDraftCreateError(),
      withMainMenu(lang, { menuVariant: 'partner' })
    )
  }
}

async function sendParseFailure(chatId, code, lang) {
  const t = getTelegramMessages(lang)
  if (code === 'NO_KEY') {
    await sendTelegram(chatId, t.lazyAiDisabled(), await withMainMenuForChat(lang, chatId))
  } else {
    await sendTelegram(chatId, t.lazyAiParseError(), await withMainMenuForChat(lang, chatId))
  }
}

async function processLazyRealtorPhotos(chatId, messages, firstName, lang) {
  const t = getTelegramMessages(lang)
  const { supabaseUrl, serviceKey, openaiApiKey } = telegramEnv()

  try {
    const partner = await fetchPartnerProfile(chatId, supabaseUrl, serviceKey)

    console.log(
      `[LAZY REALTOR] Partner lookup:`,
      partner ? { id: partner.id, email: partner.email, role: partner.role } : 'NOT FOUND'
    )

    if (!partner) {
      await sendTelegram(chatId, t.lazyNotLinked(lang), await withMainMenuForChat(lang, chatId))
      return
    }

    if (!['PARTNER', 'ADMIN'].includes(String(partner.role || '').toUpperCase())) {
      await sendTelegram(
        chatId,
        t.lazyNoRights(lang),
        withMainMenu(lang, { menuVariant: menuVariantFromRole(partner.role) })
      )
      return
    }

    const ownerId = partner.id
    if (!ownerId) {
      console.error('[LAZY REALTOR] Partner profile missing id')
      await sendTelegram(chatId, t.lazyDraftCreateError(), await withMainMenuForChat(lang, chatId))
      return
    }

    const caption = mergeAlbumCaptions(messages)
    const fileIds = collectLargestFileIds(messages)

    if (!caption.trim()) {
      setPendingPhotos(chatId, fileIds, firstName, lang)
      await sendTelegram(
        chatId,
        t.lazyPhotosAwaitingDescription(),
        withMainMenu(lang, { menuVariant: 'partner' })
      )
      return
    }

    const parsed = await parseListingCaption(caption, { lang, openaiApiKey })
    if (!parsed.ok) {
      await sendParseFailure(chatId, parsed.code, lang)
      return
    }

    await finalizeDraftListing({
      chatId,
      partner,
      ownerId,
      fileIds,
      firstName,
      lang,
      parsed,
      captionForResolve: caption,
      t,
    })
  } catch (e) {
    console.error('[PHOTO ERROR]', e)
    await sendTelegram(chatId, t.lazyPhotoError(), await withMainMenuForChat(lang, chatId))
  }
}

/**
 * Свободный текст после фото без подписи. true = сообщение обработано (не показывать «нужно фото»).
 */
export async function handlePartnerDescriptionAfterPhotos(chatId, text, firstName, lang) {
  if (!hasPendingPhotos(chatId)) return false

  const t = getTelegramMessages(lang)
  const { supabaseUrl, serviceKey, openaiApiKey } = telegramEnv()

  try {
    const partner = await fetchPartnerProfile(chatId, supabaseUrl, serviceKey)
    if (!partner) {
      clearPendingPhotos(chatId)
      return false
    }

    if (!['PARTNER', 'ADMIN'].includes(String(partner.role || '').toUpperCase())) {
      clearPendingPhotos(chatId)
      return false
    }

    const ownerId = partner.id
    if (!ownerId) {
      clearPendingPhotos(chatId)
      return false
    }

    const pending = takePendingPhotos(chatId)
    if (!pending) return false

    const body = String(text || '').trim()
    if (!body) {
      restorePendingPhotos(chatId, pending.fileIds, pending.firstName, pending.lang)
      await sendTelegram(
        chatId,
        t.lazyPhotosAwaitingDescription(),
        withMainMenu(lang, { menuVariant: 'partner' })
      )
      return true
    }

    const parsed = await parseListingCaption(body, {
      lang,
      openaiApiKey,
    })

    if (!parsed.ok) {
      restorePendingPhotos(chatId, pending.fileIds, pending.firstName, pending.lang)
      await sendParseFailure(chatId, parsed.code, lang)
      return true
    }

    await finalizeDraftListing({
      chatId,
      partner,
      ownerId,
      fileIds: pending.fileIds,
      firstName,
      lang,
      parsed,
      captionForResolve: body,
      t,
    })
    return true
  } catch (e) {
    console.error('[PENDING DESCRIPTION ERROR]', e)
    await sendTelegram(chatId, t.lazyPhotoError(), await withMainMenuForChat(lang, chatId))
    return true
  }
}

export async function handlePhotoUpload(chatId, message, firstName, lang) {
  return processLazyRealtorPhotos(chatId, [message], firstName, lang)
}

export async function flushLazyRealtorAlbum(chatId, messages, firstName, lang) {
  return processLazyRealtorPhotos(chatId, messages, firstName, lang)
}
