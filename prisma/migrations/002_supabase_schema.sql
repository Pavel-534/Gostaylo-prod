-- ============================================================================
-- FunnyRent 2.1 - Stage 15 SQL Migration
-- Supabase PostgreSQL Schema
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

CREATE TYPE user_role AS ENUM ('RENTER', 'PARTNER', 'ADMIN');
CREATE TYPE verification_status AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');
CREATE TYPE currency_type AS ENUM ('THB', 'RUB', 'USD', 'USDT');
CREATE TYPE listing_status AS ENUM ('PENDING', 'ACTIVE', 'BOOKED', 'INACTIVE', 'REJECTED');
CREATE TYPE booking_status AS ENUM ('PENDING', 'CONFIRMED', 'PAID', 'CANCELLED', 'COMPLETED', 'REFUNDED');
CREATE TYPE payment_method AS ENUM ('CARD', 'MIR', 'CRYPTO');
CREATE TYPE payment_status AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED');
CREATE TYPE payout_method AS ENUM ('PROMPTPAY', 'USDT');
CREATE TYPE payout_status AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'REJECTED');
CREATE TYPE season_type AS ENUM ('LOW', 'NORMAL', 'HIGH', 'PEAK');
CREATE TYPE promo_type AS ENUM ('PERCENTAGE', 'FIXED');
CREATE TYPE blacklist_type AS ENUM ('WALLET', 'PHONE', 'EMAIL', 'IP');

-- ============================================================================
-- TABLES
-- ============================================================================

-- 1. PROFILES (Users)
CREATE TABLE profiles (
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

CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_referral_code ON profiles(referral_code);

-- 2. CATEGORIES
CREATE TABLE categories (
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

CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_categories_active ON categories(is_active);

-- 3. LISTINGS
CREATE TABLE listings (
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
  commission_rate DECIMAL(5,2) DEFAULT 15,
  images TEXT[],
  cover_image TEXT,
  metadata JSONB,
  available BOOLEAN DEFAULT TRUE,
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

CREATE INDEX idx_listings_owner ON listings(owner_id);
CREATE INDEX idx_listings_category ON listings(category_id);
CREATE INDEX idx_listings_status ON listings(status);
CREATE INDEX idx_listings_district ON listings(district);
CREATE INDEX idx_listings_featured ON listings(is_featured);
CREATE INDEX idx_listings_price ON listings(base_price_thb);

-- 4. BOOKINGS
CREATE TABLE bookings (
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
  commission_paid BOOLEAN DEFAULT FALSE,
  guest_name VARCHAR(200),
  guest_phone VARCHAR(50),
  guest_email VARCHAR(255),
  special_requests TEXT,
  promo_code_used VARCHAR(50),
  discount_amount DECIMAL(12,2) DEFAULT 0,
  conversation_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  checked_in_at TIMESTAMPTZ
);

CREATE INDEX idx_bookings_listing ON bookings(listing_id);
CREATE INDEX idx_bookings_renter ON bookings(renter_id);
CREATE INDEX idx_bookings_partner ON bookings(partner_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_dates ON bookings(check_in, check_out);

-- 5. PAYMENTS
CREATE TABLE payments (
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

CREATE INDEX idx_payments_booking ON payments(booking_id);
CREATE INDEX idx_payments_status ON payments(status);

-- 6. CONVERSATIONS
CREATE TABLE conversations (
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

CREATE INDEX idx_conversations_renter ON conversations(renter_id);
CREATE INDEX idx_conversations_partner ON conversations(partner_id);

-- 7. MESSAGES
CREATE TABLE messages (
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

CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_sender ON messages(sender_id);

-- 8. SEASONAL_PRICES
CREATE TABLE seasonal_prices (
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

CREATE INDEX idx_seasonal_listing ON seasonal_prices(listing_id);
CREATE INDEX idx_seasonal_dates ON seasonal_prices(start_date, end_date);

-- 9. PROMO_CODES
CREATE TABLE promo_codes (
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
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_promo_code ON promo_codes(code);
CREATE INDEX idx_promo_active ON promo_codes(is_active);

-- 10. BLACKLIST
CREATE TABLE blacklist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  blacklist_type blacklist_type NOT NULL,
  value VARCHAR(255) NOT NULL,
  reason TEXT,
  added_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_blacklist_type ON blacklist(blacklist_type);
CREATE INDEX idx_blacklist_value ON blacklist(value);

-- 11. PAYOUTS
CREATE TABLE payouts (
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

CREATE INDEX idx_payouts_partner ON payouts(partner_id);
CREATE INDEX idx_payouts_status ON payouts(status);

-- 12. EXCHANGE_RATES
CREATE TABLE exchange_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  currency_code currency_type UNIQUE NOT NULL,
  rate_to_thb DECIMAL(12,6) NOT NULL,
  source VARCHAR(50) DEFAULT 'manual',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. SYSTEM_SETTINGS
CREATE TABLE system_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key VARCHAR(100) UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES profiles(id)
);

-- 14. REFERRALS
CREATE TABLE referrals (
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

CREATE INDEX idx_referrals_referrer ON referrals(referrer_id);

-- 15. ACTIVITY_LOG
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  activity_type VARCHAR(50) NOT NULL,
  description TEXT,
  user_id UUID REFERENCES profiles(id),
  user_name VARCHAR(200),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_type ON activity_log(activity_type);
CREATE INDEX idx_activity_date ON activity_log(created_at DESC);

-- 16. TELEGRAM_LINK_CODES
CREATE TABLE telegram_link_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id),
  code VARCHAR(10) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_telegram_code ON telegram_link_codes(code);

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Auto-generate referral code
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

-- Trigger to set referral code on insert
CREATE OR REPLACE FUNCTION set_referral_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.referral_code IS NULL OR NEW.referral_code = '' THEN
    NEW.referral_code := generate_referral_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_referral_code
BEFORE INSERT ON profiles
FOR EACH ROW EXECUTE FUNCTION set_referral_code();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_categories_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_listings_updated_at BEFORE UPDATE ON listings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_bookings_updated_at BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_seasonal_updated_at BEFORE UPDATE ON seasonal_prices FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Categories
INSERT INTO categories (id, name, slug, icon, "order", is_active) VALUES
  ('cat-property', 'Property', 'property', 'Home', 1, true),
  ('cat-vehicles', 'Vehicles', 'vehicles', 'Car', 2, true),
  ('cat-tours', 'Tours', 'tours', 'Map', 3, true),
  ('cat-yachts', 'Yachts', 'yachts', 'Anchor', 4, false);

-- Exchange Rates
INSERT INTO exchange_rates (currency_code, rate_to_thb) VALUES
  ('THB', 1.0),
  ('RUB', 0.37),
  ('USD', 35.5),
  ('USDT', 35.5);

-- System Settings
INSERT INTO system_settings (key, value) VALUES
  ('general', '{"defaultCommissionRate": 15, "maintenanceMode": false, "heroTitle": "Luxury Rentals in Phuket", "heroSubtitle": "Villas, Bikes, Yachts & Tours", "serviceFeePercent": 5}'),
  ('notifications', '{"emailEnabled": true, "telegramEnabled": true}'),
  ('payments', '{"stripeEnabled": false, "cryptoEnabled": true, "mirEnabled": true}');

-- Promo Codes
INSERT INTO promo_codes (code, promo_type, value, is_active) VALUES
  ('SAVE100', 'FIXED', 100, true),
  ('WELCOME10', 'PERCENTAGE', 10, true);

-- Admin User
INSERT INTO profiles (id, email, password_hash, role, is_verified, verification_status, first_name, last_name, referral_code) VALUES
  ('admin-777', 'admin@funnyrent.com', 'hashed_password', 'ADMIN', true, 'VERIFIED', 'Pavel', 'B.', 'FRADMIN');

-- ============================================================================
-- ROW LEVEL SECURITY (Optional - Enable later)
-- ============================================================================

-- ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- DONE! Schema ready for FunnyRent 2.1 Stage 15
-- ============================================================================
