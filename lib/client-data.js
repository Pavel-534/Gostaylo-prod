/**
 * FunnyRent 2.1 - Client-side Data Fetching
 * Fetches data directly from Supabase REST API (bypasses Kubernetes routing)
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Phuket districts (static)
const DISTRICTS = [
  'Rawai', 'Chalong', 'Kata', 'Karon', 'Patong', 'Kamala', 
  'Surin', 'Bang Tao', 'Nai Harn', 'Panwa', 'Mai Khao', 'Nai Yang'
];

async function supabaseFetch(table, params = '') {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${params}`;
  const response = await fetch(url, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    }
  });
  
  if (!response.ok) {
    throw new Error(`Supabase fetch failed: ${response.status}`);
  }
  
  return response.json();
}

export async function fetchCategories() {
  try {
    const data = await supabaseFetch('categories', 'is_active=eq.true&order=order.asc');
    return data.map(c => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      icon: c.icon,
      order: c.order,
      isActive: c.is_active
    }));
  } catch (error) {
    console.error('[CLIENT] Categories fetch error:', error);
    return [];
  }
}

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
      images: l.images || [],
      coverImage: l.cover_image,
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

// Default exchange rates (THB as base currency)
// Approximate rates as of 2026
const DEFAULT_EXCHANGE_RATES = {
  THB: 1,
  USD: 31.7,
  RUB: 0.41,
  USDT: 31.7,
  EUR: 34.5,
  GBP: 40.2,
  CNY: 4.35
};

export async function fetchExchangeRates() {
  try {
    const data = await supabaseFetch('exchange_rates');
    const rates = { ...DEFAULT_EXCHANGE_RATES }; // Start with defaults
    data.forEach(r => {
      rates[r.currency_code] = parseFloat(r.rate_to_thb);
    });
    return rates;
  } catch (error) {
    console.error('[CLIENT] Exchange rates fetch error:', error);
    return DEFAULT_EXCHANGE_RATES;
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
        `${SUPABASE_URL}/rest/v1/${table}?select=id`,
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
    supabaseUrl: SUPABASE_URL,
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
