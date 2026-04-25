/**
 * GET /api/v2/listings/search — same behavior as /api/v2/search with:
 * - safe defaults when no meaningful filters (featured + limit)
 * - guaranteed category.slug on each listing (map privacy)
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { runListingsSearchGet } from '@/lib/api/run-listings-search-get';

const DEFAULT_BROWSE_LIMIT = 12;

function hasMeaningfulSearchParams(sp) {
  const keys = [
    'q',
    'where',
    'location',
    'city',
    'lat',
    'lon',
    'south',
    'north',
    'west',
    'east',
    'category',
    'checkIn',
    'checkOut',
    'guests',
    'minPrice',
    'maxPrice',
    'min_price',
    'max_price',
    'bedrooms',
    'bedrooms_min',
    'bathrooms',
    'bathrooms_min',
    'amenities',
    'instant_booking',
    'instantBooking',
    'transmission',
    'fuel_type',
    'fuelType',
    'engine_cc_min',
    'engineCcMin',
    'nanny_langs',
    'nanny_experience_min',
    'nannyExperienceMin',
    'nanny_specialization',
    'nannySpecialization',
  ];
  for (const k of keys) {
    const v = sp.get(k);
    if (v != null && v !== '' && String(v).toLowerCase() !== 'all') return true;
  }
  return false;
}

function mergeQueryForListingsRoute(url) {
  const next = new URL(url.toString());
  const sp = next.searchParams;
  if (!hasMeaningfulSearchParams(sp)) {
    if (!sp.get('limit')) sp.set('limit', String(DEFAULT_BROWSE_LIMIT));
    if (!sp.has('featured')) sp.set('featured', 'true');
  }
  const lim = parseInt(sp.get('limit'), 10);
  if (Number.isFinite(lim)) {
    if (lim > 200) sp.set('limit', '200');
    if (lim < 1) sp.set('limit', '1');
  }
  return next;
}

function ensureCategorySlugOnPayload(payload) {
  if (!payload || typeof payload !== 'object' || payload.success !== true) return payload;
  const data = payload.data;
  if (!data?.listings || !Array.isArray(data.listings)) return payload;

  const listings = data.listings.map(l => {
    const slug = l.categorySlug ?? l.category?.slug ?? null;
    const base = l.category && typeof l.category === 'object' ? { ...l.category } : {};
    const category = {
      ...base,
      slug: base.slug ?? slug ?? null,
    };
    if (category.id == null && l.categoryId != null) category.id = l.categoryId;
    return {
      ...l,
      categorySlug: l.categorySlug ?? slug,
      category,
    };
  });

  return {
    ...payload,
    data: {
      ...data,
      listings,
    },
  };
}

function emptyOkResponse() {
  return NextResponse.json({
    success: true,
    data: {
      listings: [],
      filters: { applied: {}, hasDateFilter: false },
      meta: { total: 0, available: 0, fallback: true },
    },
  });
}

export async function GET(request) {
  const url = mergeQueryForListingsRoute(new URL(request.url));
  const forward = new Request(url.toString(), { method: 'GET', headers: request.headers });

  try {
    const res = await runListingsSearchGet(forward);
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      return res;
    }

    const json = await res.json();
    const body = ensureCategorySlugOnPayload(json);

    if (!res.ok) {
      if (res.status === 429) {
        return NextResponse.json(body, { status: res.status, headers: new Headers(res.headers) });
      }
      console.warn('[listings/search] upstream error', res.status, body?.error || body);
      return emptyOkResponse();
    }

    return NextResponse.json(body, {
      status: 200,
      headers: new Headers(res.headers),
    });
  } catch (e) {
    console.error('[listings/search]', e);
    return emptyOkResponse();
  }
}
