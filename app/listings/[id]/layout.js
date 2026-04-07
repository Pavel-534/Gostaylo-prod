/**
 * GoStayLo - Listing Detail Layout
 * Provides dynamic multilingual SEO metadata (generateMetadata) + JSON-LD
 */

import { cookies, headers } from 'next/headers';
import { getUIText, getLangFromRequest } from '@/lib/translations';
import { getRequestSiteUrl } from '@/lib/server-site-url';
import { getCachedActiveListingForLayout } from '@/lib/seo/listing-layout-data';
import ListingSchema from '@/components/seo/ListingSchema';
import { formatPrice, CURRENCIES } from '@/lib/currency';
import { getDisplayRateMap } from '@/lib/services/currency.service';

function interpolate(template, vars) {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] || '');
}

export async function generateMetadata({ params }) {
  const listing = await getCachedActiveListingForLayout(params.id);
  const baseUrl = await getRequestSiteUrl();

  if (!listing) {
    return {
      title: 'Listing | GoStayLo',
      description: 'Premium rentals on GoStayLo'
    };
  }

  const cookieStore = await cookies();
  const headersList = await headers();
  const lang = getLangFromRequest(cookieStore, headersList);

  const title = listing.title || 'Rental';
  const district = listing.district || listing.metadata?.city || 'Thailand';
  const md = listing.metadata && typeof listing.metadata === 'object' ? listing.metadata : {};

  const currencyCodes = new Set(CURRENCIES.map((c) => c.code));
  const curCookie = cookieStore.get('gostaylo_currency')?.value;
  const currency =
    curCookie && currencyCodes.has(String(curCookie).toUpperCase())
      ? String(curCookie).toUpperCase()
      : 'THB';

  const baseThb = parseFloat(listing.base_price_thb);
  const hasPrice = Number.isFinite(baseThb) && baseThb > 0;
  let rateMap = { THB: 1 };
  if (hasPrice) {
    try {
      rateMap = await getDisplayRateMap();
    } catch {
      rateMap = { THB: 1 };
    }
  }
  const priceFormatted = hasPrice ? formatPrice(baseThb, currency, rateMap, lang) : '';
  const perNightSuffix = getUIText('listingMetaNightSuffix', lang);

  const titleTemplate = getUIText('listingPageTitle', lang);
  const descTemplate = getUIText('listingPageDesc', lang);
  const pricedTitleTpl = getUIText('listingMetaPricedTitle', lang);
  const pricedDescTpl = getUIText('listingMetaPricedDesc', lang);
  const seoPriceAppendTpl = getUIText('listingMetaSeoPriceAppend', lang);

  // Priority: metadata.seo[lang] (полный блок) → en → ru → устаревшие ключи → шаблон
  const seoRaw = md.seo && typeof md.seo === 'object' ? md.seo : {}
  const pickSeo = (block) =>
    block &&
    typeof block === 'object' &&
    String(block.title || '').trim() &&
    String(block.description || '').trim()
      ? block
      : null
  const seoBlock =
    pickSeo(seoRaw[lang]) || pickSeo(seoRaw.en) || pickSeo(seoRaw.ru) || null

  const priceVars = hasPrice
    ? { price: priceFormatted, perNight: perNightSuffix }
    : { price: '', perNight: '' };
  const priceWithUnit = hasPrice ? `${priceFormatted}${perNightSuffix}` : '';

  let metaTitle =
    (seoBlock?.title && String(seoBlock.title).trim()) ||
    (typeof md.seo_title === 'string' && md.seo_title.trim()) ||
    (hasPrice ? interpolate(pricedTitleTpl, { title, district, ...priceVars }) : null) ||
    interpolate(titleTemplate, { title, district });

  let metaDesc =
    (seoBlock?.description && String(seoBlock.description).trim()) ||
    (typeof md.seo_description === 'string' && md.seo_description.trim()) ||
    (hasPrice ? interpolate(pricedDescTpl, { title, district, ...priceVars }) : null) ||
    interpolate(descTemplate, { title, district });

  if (seoBlock && hasPrice && priceWithUnit) {
    const append = interpolate(seoPriceAppendTpl, { price: priceWithUnit }).trim();
    if (append && !String(metaDesc).includes(priceFormatted)) {
      metaDesc = `${metaDesc} ${append}`.trim();
    }
  }

  const imageUrl = listing.cover_image || listing.images?.[0];
  const ogImage = imageUrl?.startsWith('http') ? imageUrl : imageUrl ? `${baseUrl}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}` : null;

  return {
    title: metaTitle,
    description: metaDesc,
    openGraph: {
      title: metaTitle,
      description: metaDesc,
      type: 'website',
      ...(ogImage && { images: [{ url: ogImage, width: 1200, height: 630 }] }),
      locale: lang === 'ru' ? 'ru_RU' : lang === 'zh' ? 'zh_CN' : lang === 'th' ? 'th_TH' : 'en_US',
      url: `${baseUrl.replace(/\/$/, '')}/listings/${params.id}/`
    },
    twitter: {
      card: 'summary_large_image',
      title: metaTitle,
      description: metaDesc,
      ...(ogImage && { images: [ogImage] })
    }
  };
}

export default async function ListingLayout({ children, params }) {
  const listing = await getCachedActiveListingForLayout(params.id);

  return (
    <>
      {listing ? <ListingSchema listing={listing} /> : null}
      {children}
    </>
  );
}
