/**
 * FunnyRent 2.1 - Server-side Data Fetching
 * Fetches data directly from Supabase without going through external routing
 */

import { supabaseAdmin } from '@/lib/supabase';

// Phuket districts (static)
const DISTRICTS = [
  'Rawai', 'Chalong', 'Kata', 'Karon', 'Patong', 'Kamala', 
  'Surin', 'Bang Tao', 'Nai Harn', 'Panwa', 'Mai Khao', 'Nai Yang'
];

export async function getCategories() {
  try {
    const { data, error } = await supabaseAdmin
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('order');
    
    if (error) throw error;
    
    return data.map(c => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      icon: c.icon,
      order: c.order,
      isActive: c.is_active
    }));
  } catch (error) {
    console.error('[SSR] Categories fetch error:', error);
    return [];
  }
}

export async function getListings(filters = {}) {
  try {
    let query = supabaseAdmin
      .from('listings')
      .select(`*, categories (id, name, slug, icon)`)
      .eq('status', 'ACTIVE')
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (filters.category && filters.category !== 'all') {
      const { data: cat } = await supabaseAdmin
        .from('categories')
        .select('id')
        .eq('slug', filters.category)
        .single();
      if (cat) query = query.eq('category_id', cat.id);
    }
    
    if (filters.district && filters.district !== 'all') {
      query = query.eq('district', filters.district);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
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
      available: l.available,
      isFeatured: l.is_featured,
      views: l.views || 0,
      rating: parseFloat(l.rating) || 0,
      reviewsCount: l.reviews_count || 0,
      createdAt: l.created_at
    }));
  } catch (error) {
    console.error('[SSR] Listings fetch error:', error);
    return [];
  }
}

export async function getExchangeRates() {
  try {
    const { data, error } = await supabaseAdmin
      .from('exchange_rates')
      .select('*');
    
    if (error) throw error;
    
    const rates = {};
    data.forEach(r => {
      rates[r.currency_code] = parseFloat(r.rate_to_thb);
    });
    return rates;
  } catch (error) {
    console.error('[SSR] Exchange rates fetch error:', error);
    return { THB: 1, USD: 35.5, RUB: 0.37, USDT: 35.5 };
  }
}

export function getDistricts() {
  return DISTRICTS;
}

export async function getInitialPageData() {
  const [categories, listings, exchangeRates] = await Promise.all([
    getCategories(),
    getListings(),
    getExchangeRates()
  ]);
  
  return {
    categories,
    listings,
    exchangeRates,
    districts: DISTRICTS
  };
}
