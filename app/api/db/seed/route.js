import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { PLATFORM_SPLIT_FEE_DEFAULTS } from '@/lib/config/platform-split-fee-defaults.js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DB_SEED_ROUTE_SECRET = String(process.env.DB_SEED_ROUTE_SECRET || '').trim();

function assertSeedAccess(request) {
  if (!DB_SEED_ROUTE_SECRET) {
    return {
      ok: false,
      status: 503,
      error: 'DB seed route disabled: DB_SEED_ROUTE_SECRET is not configured',
    };
  }
  const headerSecret = request.headers.get('x-seed-secret') || '';
  const bearer = request.headers.get('authorization') || '';
  const bearerSecret = bearer.toLowerCase().startsWith('bearer ') ? bearer.slice(7).trim() : '';
  const candidate = String(headerSecret || bearerSecret);
  try {
    const a = Buffer.from(DB_SEED_ROUTE_SECRET, 'utf8');
    const b = Buffer.from(candidate, 'utf8');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, status: 401, error: 'Unauthorized' };
    }
    return { ok: true };
  } catch {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }
}

async function insertIfNotExists(table, data, uniqueField = 'id') {
  // Check if exists
  const checkResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}?${uniqueField}=eq.${encodeURIComponent(data[uniqueField])}`,
    {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      }
    }
  );
  
  if (checkResponse.ok) {
    const existing = await checkResponse.json();
    if (existing && existing.length > 0) {
      return { action: 'skipped', data: existing[0] };
    }
  }
  
  // Insert
  const insertResponse = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(data)
  });
  
  if (insertResponse.ok) {
    const result = await insertResponse.json();
    return { action: 'created', data: result[0] || result };
  } else {
    const error = await insertResponse.text();
    return { action: 'error', error };
  }
}

export async function POST(request) {
  const access = assertSeedAccess(request);
  if (!access.ok) {
    return NextResponse.json({ success: false, error: access.error }, { status: access.status });
  }

  const results = {
    categories: [],
    exchange_rates: [],
    profiles: [],
    promo_codes: [],
    system_settings: [],
    payout_methods: [],
  };
  
  // 1. Seed Categories
  const categories = [
    { id: 'cat-property', name: 'Property', slug: 'property', icon: 'Home', order: 1, is_active: true },
    { id: 'cat-vehicles', name: 'Vehicles', slug: 'vehicles', icon: 'Car', order: 2, is_active: true },
    { id: 'cat-tours', name: 'Tours', slug: 'tours', icon: 'Map', order: 3, is_active: true },
    { id: 'cat-yachts', name: 'Yachts', slug: 'yachts', icon: 'Anchor', order: 4, is_active: false }
  ];
  
  for (const cat of categories) {
    const result = await insertIfNotExists('categories', cat);
    results.categories.push({ name: cat.name, ...result });
  }
  
  // 2. Seed Exchange Rates
  const rates = [
    { currency_code: 'THB', rate_to_thb: 1.0 },
    { currency_code: 'RUB', rate_to_thb: 0.37 },
    { currency_code: 'USD', rate_to_thb: 35.5 },
    { currency_code: 'USDT', rate_to_thb: 35.5 }
  ];
  
  for (const rate of rates) {
    const result = await insertIfNotExists('exchange_rates', rate, 'currency_code');
    results.exchange_rates.push({ code: rate.currency_code, ...result });
  }
  
  // 3. Seed Admin User
  const admin = {
    id: 'admin-777',
    email: 'admin@gostaylo.com',
    role: 'ADMIN',
    is_verified: true,
    verification_status: 'VERIFIED',
    first_name: 'Pavel',
    last_name: 'B.',
    referral_code: 'FRADMIN',
    preferred_currency: 'THB',
    notification_preferences: { email: true, telegram: true, telegramChatId: '999888777' }
  };
  
  const adminResult = await insertIfNotExists('profiles', admin);
  results.profiles.push({ email: admin.email, ...adminResult });
  
  // 4. Seed Partner User
  const partner = {
    id: 'partner-1',
    email: 'partner@gostaylo.com',
    role: 'PARTNER',
    is_verified: true,
    verification_status: 'VERIFIED',
    first_name: 'Ivan',
    last_name: 'Partnerov',
    referral_code: 'FR12345',
    preferred_currency: 'THB',
    available_balance: 25000,
    notification_preferences: { email: true, telegram: false }
  };
  
  const partnerResult = await insertIfNotExists('profiles', partner);
  results.profiles.push({ email: partner.email, ...partnerResult });
  
  // 5. Seed Promo Codes
  const promos = [
    { code: 'SAVE100', promo_type: 'FIXED', value: 100, is_active: true },
    { code: 'WELCOME10', promo_type: 'PERCENTAGE', value: 10, is_active: true }
  ];
  
  for (const promo of promos) {
    const result = await insertIfNotExists('promo_codes', promo, 'code');
    results.promo_codes.push({ code: promo.code, ...result });
  }
  
  // 6. Seed System Settings
  const settings = {
    key: 'general',
    value: {
      defaultCommissionRate: 15,
      guestServiceFeePercent: PLATFORM_SPLIT_FEE_DEFAULTS.guestServiceFeePercent,
      hostCommissionPercent: PLATFORM_SPLIT_FEE_DEFAULTS.hostCommissionPercentFromGeneral,
      insuranceFundPercent: PLATFORM_SPLIT_FEE_DEFAULTS.insuranceFundPercent,
      maintenanceMode: false,
      heroTitle: 'Luxury Rentals in Phuket',
      heroSubtitle: 'Villas, Bikes, Yachts & Tours',
      serviceFeePercent: PLATFORM_SPLIT_FEE_DEFAULTS.guestServiceFeePercent,
    }
  };
  
  const settingsResult = await insertIfNotExists('system_settings', settings, 'key');
  results.system_settings.push({ key: settings.key, ...settingsResult });

  // 7. Seed payout methods (Phase 1.4)
  const payoutMethods = [
    { id: 'pm-card-ru', name: 'Карта РФ', channel: 'CARD', fee_type: 'fixed', value: 3.5, currency: 'RUB', min_payout: 500, is_active: true },
    { id: 'pm-bank-ru', name: 'Банк РФ', channel: 'BANK', fee_type: 'fixed', value: 25, currency: 'RUB', min_payout: 1000, is_active: true },
    { id: 'pm-bank-th', name: 'Thai Bank Transfer', channel: 'BANK', fee_type: 'percentage', value: 0.8, currency: 'THB', min_payout: 500, is_active: true },
    { id: 'pm-usdt-trc20', name: 'USDT TRC20', channel: 'CRYPTO', fee_type: 'fixed', value: 1, currency: 'USDT', min_payout: 30, is_active: true },
  ];
  for (const method of payoutMethods) {
    const result = await insertIfNotExists('payout_methods', method);
    results.payout_methods.push({ id: method.id, ...result });
  }
  
  return NextResponse.json({
    success: true,
    message: 'Database seeded successfully',
    results
  });
}

export async function GET(request) {
  const access = assertSeedAccess(request);
  if (!access.ok) {
    return NextResponse.json({ success: false, error: access.error }, { status: access.status });
  }

  // Return current data counts
  const tables = ['profiles', 'categories', 'listings', 'bookings', 'promo_codes', 'exchange_rates', 'system_settings', 'payout_methods', 'partner_payout_profiles'];
  const counts = {};
  
  for (const table of tables) {
    try {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/${table}?select=id`,
        {
          headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Prefer': 'count=exact'
          }
        }
      );
      
      if (response.ok) {
        const count = response.headers.get('content-range');
        counts[table] = count ? parseInt(count.split('/')[1]) || 0 : (await response.json()).length;
      } else {
        counts[table] = 'table_missing';
      }
    } catch (error) {
      counts[table] = 'error';
    }
  }
  
  // Get admin user details
  let adminUser = null;
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.admin-777`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
      }
    );
    if (response.ok) {
      const data = await response.json();
      if (data && data.length > 0) {
        adminUser = {
          id: data[0].id,
          email: data[0].email,
          role: data[0].role,
          name: `${data[0].first_name} ${data[0].last_name}`
        };
      }
    }
  } catch {}
  
  return NextResponse.json({
    supabaseUrl: SUPABASE_URL,
    tableCounts: counts,
    adminUser
  });
}
