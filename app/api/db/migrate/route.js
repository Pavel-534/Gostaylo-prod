import { NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Split migration into smaller chunks to avoid timeout
const migrations = [
  // 1. Enable UUID extension and create ENUM types
  `
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
  
  DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('RENTER', 'PARTNER', 'ADMIN', 'MODERATOR');
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  
  DO $$ BEGIN
    CREATE TYPE verification_status AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  
  DO $$ BEGIN
    CREATE TYPE currency_type AS ENUM ('THB', 'RUB', 'USD', 'USDT');
  EXCEPTION WHEN duplicate_object THEN null; END $$;

  DO $$ BEGIN
    CREATE TYPE preferred_payout_currency_type AS ENUM ('RUB', 'THB', 'USDT', 'USD');
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  
  DO $$ BEGIN
    CREATE TYPE listing_status AS ENUM ('PENDING', 'ACTIVE', 'BOOKED', 'INACTIVE', 'REJECTED');
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  
  DO $$ BEGIN
    CREATE TYPE booking_status AS ENUM ('PENDING', 'CONFIRMED', 'PAID', 'CANCELLED', 'COMPLETED', 'REFUNDED');
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  
  DO $$ BEGIN
    CREATE TYPE payment_method AS ENUM ('CARD', 'MIR', 'CRYPTO');
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  
  DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED');
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  
  DO $$ BEGIN
    CREATE TYPE payout_method AS ENUM ('PROMPTPAY', 'USDT');
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  
  DO $$ BEGIN
    CREATE TYPE payout_status AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'REJECTED');
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  
  DO $$ BEGIN
    CREATE TYPE season_type AS ENUM ('LOW', 'NORMAL', 'HIGH', 'PEAK');
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  
  DO $$ BEGIN
    CREATE TYPE promo_type AS ENUM ('PERCENTAGE', 'FIXED');
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  
  DO $$ BEGIN
    CREATE TYPE promo_created_by_type AS ENUM ('PLATFORM', 'PARTNER');
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  
  DO $$ BEGIN
    CREATE TYPE blacklist_type AS ENUM ('WALLET', 'PHONE', 'EMAIL', 'IP');
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  `,

  // 2. Create profiles table
  `
  CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    phone VARCHAR(50) UNIQUE,
    role user_role DEFAULT 'RENTER',
    verification_status verification_status DEFAULT 'PENDING',
    is_verified BOOLEAN DEFAULT FALSE,
    verification_docs TEXT,
    telegram_id VARCHAR(100) UNIQUE,
    telegram_linked BOOLEAN DEFAULT FALSE,
    referral_code VARCHAR(20) UNIQUE NOT NULL,
    referred_by VARCHAR(20),
    balance_points DECIMAL(12,2) DEFAULT 0,
    balance_usdt DECIMAL(12,4) DEFAULT 0,
    escrow_balance DECIMAL(12,2) DEFAULT 0,
    available_balance DECIMAL(12,2) DEFAULT 0,
    preferred_currency currency_type DEFAULT 'THB',
    preferred_payout_currency preferred_payout_currency_type DEFAULT 'THB',
    custom_commission_rate DECIMAL(5,2),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    avatar TEXT,
    language VARCHAR(10) DEFAULT 'ru',
    external_cal_url TEXT,
    block_dates TEXT[],
    min_stay INT DEFAULT 1,
    max_stay INT DEFAULT 90,
    instant_booking BOOLEAN DEFAULT FALSE,
    notification_preferences JSONB DEFAULT '{"email": true, "telegram": false, "telegramChatId": null}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login_at TIMESTAMPTZ,
    verified_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    rejection_reason TEXT
  );
  
  CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
  CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
  CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON profiles(referral_code);
  `,

  // 3. Create categories table
  `
  CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    "order" INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  
  CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
  CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(is_active);
  `,

  // 4. Create listings table
  `
  CREATE TABLE IF NOT EXISTS listings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id),
    status listing_status DEFAULT 'PENDING',
    title VARCHAR(255) NOT NULL,
    description TEXT,
    district VARCHAR(100),
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    address TEXT,
    base_price_thb DECIMAL(12,2) NOT NULL,
    base_currency currency_type DEFAULT 'THB',
    commission_rate DECIMAL(5,2) DEFAULT 15,
    images TEXT[],
    cover_image TEXT,
    metadata JSONB,
    available BOOLEAN DEFAULT TRUE,
    instant_booking BOOLEAN DEFAULT FALSE,
    is_featured BOOLEAN DEFAULT FALSE,
    min_booking_days INT DEFAULT 1,
    max_booking_days INT,
    views INT DEFAULT 0,
    bookings_count INT DEFAULT 0,
    rating DECIMAL(3,2) DEFAULT 0,
    reviews_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    published_at TIMESTAMPTZ,
    moderated_at TIMESTAMPTZ
  );
  
  CREATE INDEX IF NOT EXISTS idx_listings_owner ON listings(owner_id);
  CREATE INDEX IF NOT EXISTS idx_listings_category ON listings(category_id);
  CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
  CREATE INDEX IF NOT EXISTS idx_listings_district ON listings(district);
  CREATE INDEX IF NOT EXISTS idx_listings_featured ON listings(is_featured);
  CREATE INDEX IF NOT EXISTS idx_listings_price ON listings(base_price_thb);
  `,

  // 5. Create bookings table
  `
  CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    listing_id UUID REFERENCES listings(id),
    renter_id UUID REFERENCES profiles(id),
    partner_id UUID REFERENCES profiles(id),
    status booking_status DEFAULT 'PENDING',
    check_in DATE NOT NULL,
    check_out DATE NOT NULL,
    price_thb DECIMAL(12,2) NOT NULL,
    currency currency_type,
    price_paid DECIMAL(12,2),
    exchange_rate DECIMAL(12,6),
    commission_thb DECIMAL(12,2),
    commission_rate DECIMAL(5,2) DEFAULT 15,
    applied_commission_rate DECIMAL(5,2),
    partner_earnings_thb DECIMAL(12,2),
    net_amount_local DECIMAL(12,2),
    listing_currency currency_type DEFAULT 'THB',
    commission_paid BOOLEAN DEFAULT FALSE,
    guest_name VARCHAR(200),
    guest_phone VARCHAR(50),
    guest_email VARCHAR(255),
    special_requests TEXT,
    promo_code_used VARCHAR(50),
    discount_amount DECIMAL(12,2) DEFAULT 0,
    pricing_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    conversation_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    checked_in_at TIMESTAMPTZ
  );
  
  CREATE INDEX IF NOT EXISTS idx_bookings_listing ON bookings(listing_id);
  CREATE INDEX IF NOT EXISTS idx_bookings_renter ON bookings(renter_id);
  CREATE INDEX IF NOT EXISTS idx_bookings_partner ON bookings(partner_id);
  CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
  CREATE INDEX IF NOT EXISTS idx_bookings_dates ON bookings(check_in, check_out);
  `,

  // 6. Create remaining tables
  `
  CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID UNIQUE REFERENCES bookings(id),
    amount DECIMAL(12,2) NOT NULL,
    currency currency_type,
    method payment_method,
    status payment_status DEFAULT 'PENDING',
    tx_id VARCHAR(255),
    gateway_ref VARCHAR(255),
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
  );
  
  CREATE INDEX IF NOT EXISTS idx_payments_booking ON payments(booking_id);
  CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
  
  CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    listing_id UUID REFERENCES listings(id),
    renter_id UUID REFERENCES profiles(id),
    partner_id UUID REFERENCES profiles(id),
    booking_id UUID REFERENCES bookings(id),
    booking_status booking_status,
    unread_renter INT DEFAULT 0,
    unread_partner INT DEFAULT 0,
    last_message_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  
  CREATE INDEX IF NOT EXISTS idx_conversations_renter ON conversations(renter_id);
  CREATE INDEX IF NOT EXISTS idx_conversations_partner ON conversations(partner_id);
  
  CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES profiles(id),
    sender_role user_role,
    sender_name VARCHAR(200),
    message TEXT NOT NULL,
    message_type VARCHAR(50) DEFAULT 'USER',
    metadata JSONB,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  
  CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
  CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
  `,

  // 7. Create more tables
  `
  CREATE TABLE IF NOT EXISTS seasonal_prices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    label VARCHAR(100),
    season_type season_type DEFAULT 'NORMAL',
    price_daily DECIMAL(12,2) NOT NULL,
    price_monthly DECIMAL(12,2),
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  
  CREATE INDEX IF NOT EXISTS idx_seasonal_listing ON seasonal_prices(listing_id);
  CREATE INDEX IF NOT EXISTS idx_seasonal_dates ON seasonal_prices(start_date, end_date);
  
  CREATE TABLE IF NOT EXISTS promo_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    promo_type promo_type NOT NULL,
    value DECIMAL(12,2) NOT NULL,
    min_amount DECIMAL(12,2) DEFAULT 0,
    max_uses INT,
    current_uses INT DEFAULT 0,
    valid_from TIMESTAMPTZ,
    valid_until TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    created_by_type promo_created_by_type NOT NULL DEFAULT 'PLATFORM',
    partner_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  
  CREATE INDEX IF NOT EXISTS idx_promo_code ON promo_codes(code);
  CREATE INDEX IF NOT EXISTS idx_promo_active ON promo_codes(is_active);
  CREATE INDEX IF NOT EXISTS idx_promo_codes_partner_id ON promo_codes(partner_id);
  
  CREATE TABLE IF NOT EXISTS blacklist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    blacklist_type blacklist_type NOT NULL,
    value VARCHAR(255) NOT NULL,
    reason TEXT,
    added_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  
  CREATE INDEX IF NOT EXISTS idx_blacklist_type ON blacklist(blacklist_type);
  CREATE INDEX IF NOT EXISTS idx_blacklist_value ON blacklist(value);
  `,

  // 8. Create final tables
  `
  CREATE TABLE IF NOT EXISTS payouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    partner_id UUID REFERENCES profiles(id),
    amount DECIMAL(12,2) NOT NULL,
    currency currency_type,
    method payout_method,
    status payout_status DEFAULT 'PENDING',
    wallet_address VARCHAR(255),
    bank_account VARCHAR(255),
    transaction_id VARCHAR(255),
    notes TEXT,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
  );
  
  CREATE INDEX IF NOT EXISTS idx_payouts_partner ON payouts(partner_id);
  CREATE INDEX IF NOT EXISTS idx_payouts_status ON payouts(status);
  
  CREATE TABLE IF NOT EXISTS exchange_rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    currency_code currency_type UNIQUE NOT NULL,
    rate_to_thb DECIMAL(12,6) NOT NULL,
    source VARCHAR(50) DEFAULT 'manual',
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  
  CREATE TABLE IF NOT EXISTS system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(100) UNIQUE NOT NULL,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES profiles(id)
  );
  
  CREATE TABLE IF NOT EXISTS referrals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    referrer_id UUID REFERENCES profiles(id),
    referred_id UUID REFERENCES profiles(id),
    reward_points DECIMAL(12,2) DEFAULT 0,
    reward_usdt DECIMAL(12,4) DEFAULT 0,
    reward_paid BOOLEAN DEFAULT FALSE,
    first_booking_id UUID REFERENCES bookings(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    reward_paid_at TIMESTAMPTZ,
    UNIQUE(referrer_id, referred_id)
  );
  
  CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
  
  CREATE TABLE IF NOT EXISTS activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    activity_type VARCHAR(50) NOT NULL,
    description TEXT,
    user_id UUID REFERENCES profiles(id),
    user_name VARCHAR(200),
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  
  CREATE INDEX IF NOT EXISTS idx_activity_type ON activity_log(activity_type);
  CREATE INDEX IF NOT EXISTS idx_activity_date ON activity_log(created_at DESC);
  
  CREATE TABLE IF NOT EXISTS telegram_link_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id),
    code VARCHAR(10) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  
  CREATE INDEX IF NOT EXISTS idx_telegram_code ON telegram_link_codes(code);
  `,

  // 9. Create functions and triggers
  `
  CREATE OR REPLACE FUNCTION generate_referral_code()
  RETURNS VARCHAR AS $$
  DECLARE
    new_code VARCHAR(20);
    code_exists BOOLEAN;
  BEGIN
    LOOP
      new_code := 'FR' || LPAD(FLOOR(RANDOM() * 100000)::TEXT, 5, '0');
      SELECT EXISTS(SELECT 1 FROM profiles WHERE referral_code = new_code) INTO code_exists;
      EXIT WHEN NOT code_exists;
    END LOOP;
    RETURN new_code;
  END;
  $$ LANGUAGE plpgsql;
  
  CREATE OR REPLACE FUNCTION set_referral_code()
  RETURNS TRIGGER AS $$
  BEGIN
    IF NEW.referral_code IS NULL OR NEW.referral_code = '' THEN
      NEW.referral_code := generate_referral_code();
    END IF;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;
  
  DROP TRIGGER IF EXISTS trigger_set_referral_code ON profiles;
  CREATE TRIGGER trigger_set_referral_code
  BEFORE INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_referral_code();
  
  CREATE OR REPLACE FUNCTION update_updated_at()
  RETURNS TRIGGER AS $$
  BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;
  
  DROP TRIGGER IF EXISTS trigger_profiles_updated_at ON profiles;
  CREATE TRIGGER trigger_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  
  DROP TRIGGER IF EXISTS trigger_categories_updated_at ON categories;
  CREATE TRIGGER trigger_categories_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  
  DROP TRIGGER IF EXISTS trigger_listings_updated_at ON listings;
  CREATE TRIGGER trigger_listings_updated_at BEFORE UPDATE ON listings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  
  DROP TRIGGER IF EXISTS trigger_bookings_updated_at ON bookings;
  CREATE TRIGGER trigger_bookings_updated_at BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  
  DROP TRIGGER IF EXISTS trigger_seasonal_updated_at ON seasonal_prices;
  CREATE TRIGGER trigger_seasonal_updated_at BEFORE UPDATE ON seasonal_prices FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  `,

  // 10. Stage 31.0 — promo owner scope + partner_id (идемпотентно для уже созданных БД)
  `
  DO $$ BEGIN
    CREATE TYPE promo_created_by_type AS ENUM ('PLATFORM', 'PARTNER');
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  
  ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS created_by_type promo_created_by_type NOT NULL DEFAULT 'PLATFORM';
  ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
  CREATE INDEX IF NOT EXISTS idx_promo_codes_partner_id ON promo_codes(partner_id);
  `,
];

async function executeSql(sql) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ sql })
  });
  
  // If RPC doesn't exist, try direct query via pg
  if (!response.ok) {
    // Fall back to using Supabase Management API
    return { success: false, error: 'RPC not available' };
  }
  
  return { success: true };
}

export async function POST(request) {
  const results = [];
  
  for (let i = 0; i < migrations.length; i++) {
    try {
      // Use Supabase's SQL execution capability
      const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        }
      });
      
      results.push({ step: i + 1, status: 'pending', note: 'SQL must be run in Supabase Dashboard' });
    } catch (error) {
      results.push({ step: i + 1, status: 'error', error: error.message });
    }
  }
  
  return NextResponse.json({
    success: false,
    message: 'SQL migrations must be executed directly in Supabase SQL Editor',
    instructions: [
      '1. Go to https://supabase.com/dashboard/project/vtzzcdsjwudkaloxhvnw/sql',
      '2. Copy the SQL from /app/prisma/migrations/002_supabase_schema.sql',
      '3. Paste and run in the SQL Editor',
      '4. Then call /api/db/seed to seed the data'
    ]
  });
}

export async function GET() {
  // Test connection and check tables
  const tables = ['profiles', 'categories', 'listings', 'bookings', 'promo_codes'];
  const results = {};
  
  for (const table of tables) {
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?limit=1`, {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
      });
      results[table] = response.ok ? 'exists' : 'missing';
    } catch {
      results[table] = 'error';
    }
  }
  
  return NextResponse.json({ 
    connected: true,
    supabaseUrl: SUPABASE_URL,
    tables: results
  });
}
