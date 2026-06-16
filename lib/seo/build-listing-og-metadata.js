/**
 * Stage 149.2 — build listing PDP Open Graph metadata (SSOT for layout + Guest-Gate).
 */

import { getUIText } from '@/lib/translations'
import { getSiteDisplayName } from '@/lib/site-url'
import { formatPrice, CURRENCIES } from '@/lib/currency'
import { getStorefrontDisplayRateMap } from '@/lib/pricing/fx-display'
import { getGuestDisplayPerNight } from '@/lib/pricing/guest-display-price'
import { getCommissionRate } from '@/lib/commission/get-commission-rate-server.js'
import { buildOgImageMetadata } from '@/lib/seo/resolve-og-image.js'

function interpolate(template, vars) {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] || '')
}

/**
 * @param {string} lang
 * @param {string} baseUrl
 */
export function buildListingNotFoundOgMetadata(lang, baseUrl) {
  const b = getSiteDisplayName()
  const title = `Listing | ${b}`
  const description = `Rentals on ${b}`
  const ogImages = buildOgImageMetadata(null, baseUrl, title)
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      images: ogImages,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ogImages.map((i) => i.url),
    },
  }
}

/**
 * @param {string} lang
 * @param {string} baseUrl
 */
export function buildListingModerationStubOgMetadata(lang, baseUrl) {
  const b = getSiteDisplayName()
  const title = interpolate(getUIText('listingOg_underModerationTitle', lang), { brand: b })
  const description = getUIText('listingOg_underModerationDesc', lang)
  const ogImages = buildOgImageMetadata(null, baseUrl, title)
  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      type: 'website',
      images: ogImages,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ogImages.map((i) => i.url),
    },
  }
}

/**
 * @param {object} params
 * @param {object} params.listing
 * @param {string} params.lang
 * @param {string} params.baseUrl
 * @param {string} params.listingId
 * @param {string} [params.currency]
 */
export async function buildListingDetailOgMetadata({
  listing,
  lang,
  baseUrl,
  listingId,
  currency = 'THB',
}) {
  const title = listing.title || 'Rental'
  const district = listing.district || listing.metadata?.city || 'Thailand'
  const md = listing.metadata && typeof listing.metadata === 'object' ? listing.metadata : {}

  const baseThb = parseFloat(listing.base_price_thb)
  const { guestServiceFeePercent } = await getCommissionRate()
  const guestDisplayThb = getGuestDisplayPerNight({
    base_price_thb: listing.base_price_thb,
    basePriceThb: baseThb,
    guestServiceFeePercent,
  })
  const hasPrice = Number.isFinite(guestDisplayThb) && guestDisplayThb > 0
  let rateMap = { THB: 1 }
  if (hasPrice) {
    try {
      rateMap = await getStorefrontDisplayRateMap()
    } catch {
      rateMap = { THB: 1 }
    }
  }
  const priceFormatted = hasPrice ? formatPrice(guestDisplayThb, currency, rateMap, lang) : ''
  const perNightSuffix = getUIText('listingMetaNightSuffix', lang)

  const titleTemplate = getUIText('listingPageTitle', lang)
  const descTemplate = getUIText('listingPageDesc', lang)
  const pricedTitleTpl = getUIText('listingMetaPricedTitle', lang)
  const pricedDescTpl = getUIText('listingMetaPricedDesc', lang)
  const seoPriceAppendTpl = getUIText('listingMetaSeoPriceAppend', lang)

  const seoRaw = md.seo && typeof md.seo === 'object' ? md.seo : {}
  const pickSeo = (block) =>
    block &&
    typeof block === 'object' &&
    String(block.title || '').trim() &&
    String(block.description || '').trim()
      ? block
      : null
  const seoBlock = pickSeo(seoRaw[lang]) || pickSeo(seoRaw.en) || pickSeo(seoRaw.ru) || null

  const priceVars = hasPrice
    ? { price: priceFormatted, perNight: perNightSuffix }
    : { price: '', perNight: '' }
  const priceWithUnit = hasPrice ? `${priceFormatted}${perNightSuffix}` : ''

  let metaTitle =
    (seoBlock?.title && String(seoBlock.title).trim()) ||
    (typeof md.seo_title === 'string' && md.seo_title.trim()) ||
    (hasPrice ? interpolate(pricedTitleTpl, { title, district, ...priceVars }) : null) ||
    interpolate(titleTemplate, { title, district })

  let metaDesc =
    (seoBlock?.description && String(seoBlock.description).trim()) ||
    (typeof md.seo_description === 'string' && md.seo_description.trim()) ||
    (hasPrice ? interpolate(pricedDescTpl, { title, district, ...priceVars }) : null) ||
    interpolate(descTemplate, { title, district })

  if (seoBlock && hasPrice && priceWithUnit) {
    const append = interpolate(seoPriceAppendTpl, { price: priceWithUnit }).trim()
    if (append && !String(metaDesc).includes(priceFormatted)) {
      metaDesc = `${metaDesc} ${append}`.trim()
    }
  }

  const imageUrl = listing.cover_image || listing.images?.[0]
  const ogImages = buildOgImageMetadata(imageUrl, baseUrl, metaTitle)
  const brand = getSiteDisplayName()
  if (!metaTitle.includes(brand) && !String(metaTitle).includes('|')) {
    metaTitle = `${metaTitle} | ${brand}`
  }

  return {
    title: metaTitle,
    description: metaDesc,
    openGraph: {
      title: metaTitle,
      description: metaDesc,
      type: 'website',
      images: ogImages,
      locale: lang === 'ru' ? 'ru_RU' : lang === 'zh' ? 'zh_CN' : lang === 'th' ? 'th_TH' : 'en_US',
      url: `${baseUrl.replace(/\/$/, '')}/listings/${listingId}/`,
    },
    twitter: {
      card: 'summary_large_image',
      title: metaTitle,
      description: metaDesc,
      images: ogImages.map((i) => i.url),
    },
  }
}

/**
 * @param {import('next/dist/server/web/spec-extension/cookies').ReadonlyRequestCookies} cookieStore
 */
export function resolveListingOgCurrency(cookieStore) {
  const currencyCodes = new Set(CURRENCIES.map((c) => c.code))
  const curCookie = cookieStore.get('gostaylo_currency')?.value
  return curCookie && currencyCodes.has(String(curCookie).toUpperCase())
    ? String(curCookie).toUpperCase()
    : 'THB'
}
