/**
 * Gostaylo - Listing Detail Layout
 * Provides dynamic multilingual SEO metadata (generateMetadata)
 */

import { cookies, headers } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase';
import { getUIText, getLangFromRequest } from '@/lib/translations';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.gostaylo.com';

async function getListing(id) {
  const { data, error } = await supabaseAdmin
    .from('listings')
    .select('id, title, description, district, cover_image, images, metadata')
    .eq('id', id)
    .eq('status', 'ACTIVE')
    .single();

  if (error || !data) return null;
  return data;
}

function interpolate(template, vars) {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] || '');
}

export async function generateMetadata({ params }) {
  const listing = await getListing(params.id);
  if (!listing) {
    return {
      title: 'Listing | Gostaylo',
      description: 'Premium rentals on Gostaylo'
    };
  }

  const cookieStore = await cookies();
  const headersList = await headers();
  const lang = getLangFromRequest(cookieStore, headersList);

  const title = listing.title || 'Rental';
  const district = listing.district || listing.metadata?.city || 'Thailand';

  const titleTemplate = getUIText('listingPageTitle', lang);
  const descTemplate = getUIText('listingPageDesc', lang);

  const metaTitle = interpolate(titleTemplate, { title, district });
  const metaDesc = interpolate(descTemplate, { title, district });

  const imageUrl = listing.cover_image || listing.images?.[0];
  const ogImage = imageUrl?.startsWith('http') ? imageUrl : imageUrl ? `${BASE_URL}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}` : null;

  return {
    title: metaTitle,
    description: metaDesc,
    openGraph: {
      title: metaTitle,
      description: metaDesc,
      type: 'website',
      ...(ogImage && { images: [{ url: ogImage, width: 1200, height: 630 }] }),
      locale: lang === 'ru' ? 'ru_RU' : lang === 'zh' ? 'zh_CN' : lang === 'th' ? 'th_TH' : 'en_US',
      url: `${BASE_URL}/listings/${params.id}`
    },
    twitter: {
      card: 'summary_large_image',
      title: metaTitle,
      description: metaDesc,
      ...(ogImage && { images: [ogImage] })
    }
  };
}

export default function ListingLayout({ children }) {
  return children;
}
