/**
 * GoStayLo - Listing Detail Layout
 * Provides dynamic multilingual SEO metadata (generateMetadata) + JSON-LD
 */

import { cookies, headers } from 'next/headers';
import { getUIText, getLangFromRequest } from '@/lib/translations';
import { getRequestSiteUrl } from '@/lib/server-site-url';
import { getCachedActiveListingForLayout } from '@/lib/seo/listing-layout-data';
import ListingSchema from '@/components/seo/ListingSchema';

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

  const titleTemplate = getUIText('listingPageTitle', lang);
  const descTemplate = getUIText('listingPageDesc', lang);

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

  const metaTitle =
    (seoBlock?.title && String(seoBlock.title).trim()) ||
    (typeof md.seo_title === 'string' && md.seo_title.trim()) ||
    interpolate(titleTemplate, { title, district });

  const metaDesc =
    (seoBlock?.description && String(seoBlock.description).trim()) ||
    (typeof md.seo_description === 'string' && md.seo_description.trim()) ||
    interpolate(descTemplate, { title, district });

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
