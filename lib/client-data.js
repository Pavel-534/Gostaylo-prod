/**
 * GoStayLo - Client-side Data Fetching
 * PostgREST через same-origin /_db → rewrites (см. next.config.js)
 */

import { toPublicImageUrl, mapPublicImageUrls } from '@/lib/public-image-url'

// Get Supabase credentials - these MUST be set at build time for Next.js
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Debug: log if credentials are missing
if (typeof window !== 'undefined') {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('[CLIENT-DATA] CRITICAL: Supabase credentials missing!', {
      url: SUPABASE_URL ? 'SET' : 'MISSING',
      key: SUPABASE_ANON_KEY ? 'SET' : 'MISSING'
    });
  }
}

// Phuket districts (static)
const DISTRICTS = [
  'Rawai', 'Chalong', 'Kata', 'Karon', 'Patong', 'Kamala', 
  'Surin', 'Bang Tao', 'Nai Harn', 'Panwa', 'Mai Khao', 'Nai Yang'
];

const CACHE_VERSION = 1;
const CACHE_PREFIX = `gostaylo_cache_v${CACHE_VERSION}_`;

function getCache(key) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.expiresAt !== 'number') return null;
    if (Date.now() > parsed.expiresAt) return null;
    return parsed.value;
  } catch {
    return null;
  }
}

function setCache(key, value, ttlMs) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      CACHE_PREFIX + key,
      JSON.stringify({ value, expiresAt: Date.now() + ttlMs })
    );
  } catch {
    // ignore quota / privacy mode
  }
}

async function supabaseFetch(table, params = '') {
  // Validate credentials
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error(`[CLIENT] Cannot fetch ${table}: Supabase not configured`);
    throw new Error('Supabase not configured');
  }
  
  // Same-origin прокси → rewrites в next.config.js на PostgREST Supabase
  const url = `/_db/${table}?${params}`;

  const response = await fetch(url, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    },
    // Let browser cache heuristics work; we also cache at app-level below.
    cache: 'force-cache'
  });
  
  if (!response.ok) {
    console.error(`[CLIENT] ${table} fetch failed:`, response.status, response.statusText);
    throw new Error(`Supabase fetch failed: ${response.status}`);
  }
  
  return response.json();
}

export async function fetchCategories() {
  try {
    const cached = getCache('categories_active');
    if (cached) return cached;

    // Use API route (faster, server-side) instead of direct Supabase
    const res = await fetch('/api/v2/categories');
    const json = await res.json();
    if (json.success && json.data) {
      const mapped = json.data.map(c => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        icon: c.icon,
        order: c.order,
        isActive: c.isActive ?? true
      }));
      setCache('categories_active', mapped, 1000 * 60 * 10); // 10 minutes
      return mapped;
    }
    return [];
  } catch (error) {
    console.error('[CLIENT] Categories fetch error:', error);
    return [];
  }
}

/**
 * @deprecated Use /api/v2/search API endpoint instead for availability filtering
 * This function fetches listings directly from Supabase without CalendarService
 * Kept for backward compatibility with Home page (GostayloHomeContent.jsx)
 */
export async function fetchListings(filters = {}) {
  try {
    let params = 'status=eq.ACTIVE&order=is_featured.desc,created_at.desc&limit=50';
    params += '&select=*,categories(id,name,slug,icon)';
    
    if (filters.category && filters.category !== 'all') {
      // Need to get category ID first
      const cats = await supabaseFetch('categories', `slug=eq.${filters.category}`);
      if (cats.length > 0) {
        params += `&category_id=eq.${cats[0].id}`;
      }
    }
    
    if (filters.district && filters.district !== 'all') {
      params += `&district=eq.${filters.district}`;
    }
    
    const data = await supabaseFetch('listings', params);
    
    return data.map(l => ({
      id: l.id,
      ownerId: l.owner_id,
      categoryId: l.category_id,
      category: l.categories,
      status: l.status,
      title: l.title,
      description: l.description,
      district: l.district,
      basePriceThb: parseFloat(l.base_price_thb),
      images: mapPublicImageUrls(l.images || []),
      coverImage: l.cover_image ? toPublicImageUrl(l.cover_image) : null,
      metadata: l.metadata || {},
      bedrooms: l.metadata?.bedrooms,
      bathrooms: l.metadata?.bathrooms,
      available: l.available,
      isFeatured: l.is_featured,
      views: l.views || 0,
      rating: parseFloat(l.rating) || 0,
      reviewsCount: l.reviews_count || 0,
      createdAt: l.created_at
    }));
  } catch (error) {
    console.error('[CLIENT] Listings fetch error:', error);
    return [];
  }
}

/** THB-only placeholder until /api/v2/exchange-rates returns rateMap (no numeric FX guesses in client code). */
const THB_ONLY_RATES = { THB: 1 }

export async function fetchExchangeRates() {
  try {
    const cached = getCache('exchange_rates');
    if (cached) return cached;

    const res = await fetch('/api/v2/exchange-rates', { cache: 'no-store' });
    const json = await res.json();
    if (json.success && json.rateMap && typeof json.rateMap === 'object') {
      const rates = { THB: 1, ...json.rateMap };
      setCache('exchange_rates', rates, 1000 * 60 * 10);
      return rates;
    }
    console.warn('[CLIENT] Exchange rates API missing rateMap');
    return THB_ONLY_RATES;
  } catch (error) {
    console.error('[CLIENT] Exchange rates fetch error:', error);
    return THB_ONLY_RATES;
  }
}

export function fetchDistricts() {
  return DISTRICTS;
}

// ============================================================================
// ADMIN DATA FUNCTIONS (for test-db and admin pages)
// ============================================================================

export async function fetchDatabaseStatus() {
  const tables = ['profiles', 'categories', 'listings', 'bookings', 'promo_codes', 'exchange_rates', 'system_settings'];
  const counts = {};
  
  for (const table of tables) {
    try {
      const response = await fetch(
        `/_db/${table}?select=id`,
        {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Prefer': 'count=exact'
          }
        }
      );
      
      if (response.ok) {
        const count = response.headers.get('content-range');
        counts[table] = count ? parseInt(count.split('/')[1]) || 0 : (await response.json()).length;
      } else {
        counts[table] = 'error';
      }
    } catch (error) {
      counts[table] = 'error';
    }
  }
  
  return {
    dataProxyBase: '/_db',
    tableCounts: counts
  };
}

export async function fetchAdminUser() {
  try {
    const data = await supabaseFetch('profiles', 'id=eq.admin-777');
    if (data && data.length > 0) {
      return {
        id: data[0].id,
        email: data[0].email,
        role: data[0].role,
        name: `${data[0].first_name || ''} ${data[0].last_name || ''}`.trim()
      };
    }
    return null;
  } catch (error) {
    console.error('[CLIENT] Admin user fetch error:', error);
    return null;
  }
}

export async function fetchAdminStats() {
  try {
    // Fetch counts
    const [profiles, listings, bookings] = await Promise.all([
      supabaseFetch('profiles', 'select=id,role'),
      supabaseFetch('listings', 'select=id,status'),
      supabaseFetch('bookings', 'select=id,status')
    ]);
    
    return {
      users: {
        total: profiles.length,
        admins: profiles.filter(p => p.role === 'ADMIN').length,
        partners: profiles.filter(p => p.role === 'PARTNER').length,
        renters: profiles.filter(p => p.role === 'USER').length
      },
      listings: {
        total: listings.length,
        active: listings.filter(l => l.status === 'ACTIVE').length,
        pending: listings.filter(l => l.status === 'PENDING').length
      },
      bookings: {
        total: bookings.length,
        confirmed: bookings.filter(b => b.status === 'CONFIRMED').length,
        pending: bookings.filter(b => b.status === 'PENDING').length,
        completed: bookings.filter(b => b.status === 'COMPLETED').length
      }
    };
  } catch (error) {
    console.error('[CLIENT] Admin stats fetch error:', error);
    return null;
  }
}

export async function fetchAllCategories() {
  try {
    const data = await supabaseFetch('categories', 'order=order.asc');
    return data.map(c => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      icon: c.icon,
      order: c.order,
      isActive: c.is_active
    }));
  } catch (error) {
    console.error('[CLIENT] All categories fetch error:', error);
    return [];
  }
}
