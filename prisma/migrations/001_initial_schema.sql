-- FunnyRent 2.1 Initial Schema Migration
-- Run this SQL in your Supabase SQL Editor

-- Create ENUMs
CREATE TYPE "Role" AS ENUM ('RENTER', 'PARTNER', 'ADMIN');
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');
CREATE TYPE "Currency" AS ENUM ('THB', 'RUB', 'USD', 'USDT');
CREATE TYPE "ListingStatus" AS ENUM ('PENDING', 'ACTIVE', 'BOOKED', 'INACTIVE', 'REJECTED');
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'REFUNDED');

-- Profiles Table
CREATE TABLE "profiles" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" VARCHAR(255) UNIQUE NOT NULL,
  "phone" VARCHAR(50) UNIQUE,
  "role" "Role" DEFAULT 'RENTER' NOT NULL,
  "verificationStatus" "VerificationStatus" DEFAULT 'PENDING' NOT NULL,
  "referralCode" VARCHAR(20) UNIQUE NOT NULL,
  "referredBy" VARCHAR(20),
  "balancePoints" DECIMAL(10,2) DEFAULT 0 NOT NULL,
  "balanceUsdt" DECIMAL(10,2) DEFAULT 0 NOT NULL,
  "preferredCurrency" "Currency" DEFAULT 'THB' NOT NULL,
  "firstName" VARCHAR(100),
  "lastName" VARCHAR(100),
  "avatar" TEXT,
  "language" VARCHAR(5) DEFAULT 'ru' NOT NULL,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "lastLoginAt" TIMESTAMP
);

CREATE INDEX "idx_profiles_email" ON "profiles"("email");
CREATE INDEX "idx_profiles_referralCode" ON "profiles"("referralCode");
CREATE INDEX "idx_profiles_role" ON "profiles"("role");

-- Categories Table
CREATE TABLE "categories" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" VARCHAR(100) UNIQUE NOT NULL,
  "slug" VARCHAR(100) UNIQUE NOT NULL,
  "description" TEXT,
  "icon" VARCHAR(50),
  "order" INTEGER DEFAULT 0 NOT NULL,
  "active" BOOLEAN DEFAULT true NOT NULL,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX "idx_categories_slug" ON "categories"("slug");
CREATE INDEX "idx_categories_active" ON "categories"("active");

-- Listings Table
CREATE TABLE "listings" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "ownerId" UUID NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "categoryId" UUID NOT NULL REFERENCES "categories"("id"),
  "status" "ListingStatus" DEFAULT 'PENDING' NOT NULL,
  "title" VARCHAR(255) NOT NULL,
  "description" TEXT NOT NULL,
  "district" VARCHAR(100) NOT NULL,
  "latitude" DECIMAL(10,7),
  "longitude" DECIMAL(10,7),
  "address" TEXT,
  "basePriceThb" DECIMAL(10,2) NOT NULL,
  "commissionRate" DECIMAL(5,2) DEFAULT 15 NOT NULL,
  "images" TEXT[] DEFAULT '{}',
  "coverImage" TEXT,
  "metadata" JSONB,
  "available" BOOLEAN DEFAULT true NOT NULL,
  "minBookingDays" INTEGER DEFAULT 1 NOT NULL,
  "maxBookingDays" INTEGER,
  "views" INTEGER DEFAULT 0 NOT NULL,
  "bookingsCount" INTEGER DEFAULT 0 NOT NULL,
  "rating" DECIMAL(3,2) DEFAULT 0 NOT NULL,
  "reviewsCount" INTEGER DEFAULT 0 NOT NULL,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "publishedAt" TIMESTAMP
);

CREATE INDEX "idx_listings_ownerId" ON "listings"("ownerId");
CREATE INDEX "idx_listings_categoryId" ON "listings"("categoryId");
CREATE INDEX "idx_listings_status" ON "listings"("status");
CREATE INDEX "idx_listings_district" ON "listings"("district");
CREATE INDEX "idx_listings_available" ON "listings"("available");
CREATE INDEX "idx_listings_basePriceThb" ON "listings"("basePriceThb");

-- Bookings Table
CREATE TABLE "bookings" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "listingId" UUID NOT NULL REFERENCES "listings"("id"),
  "renterId" UUID NOT NULL REFERENCES "profiles"("id"),
  "status" "BookingStatus" DEFAULT 'PENDING' NOT NULL,
  "checkIn" TIMESTAMP NOT NULL,
  "checkOut" TIMESTAMP NOT NULL,
  "priceThb" DECIMAL(10,2) NOT NULL,
  "currency" "Currency" NOT NULL,
  "pricePaid" DECIMAL(10,2) NOT NULL,
  "exchangeRate" DECIMAL(10,4) NOT NULL,
  "commissionThb" DECIMAL(10,2) NOT NULL,
  "commissionPaid" BOOLEAN DEFAULT false NOT NULL,
  "guestName" VARCHAR(255) NOT NULL,
  "guestPhone" VARCHAR(50) NOT NULL,
  "guestEmail" VARCHAR(255) NOT NULL,
  "specialRequests" TEXT,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "confirmedAt" TIMESTAMP,
  "cancelledAt" TIMESTAMP,
  "completedAt" TIMESTAMP
);

CREATE INDEX "idx_bookings_listingId" ON "bookings"("listingId");
CREATE INDEX "idx_bookings_renterId" ON "bookings"("renterId");
CREATE INDEX "idx_bookings_status" ON "bookings"("status");
CREATE INDEX "idx_bookings_checkIn" ON "bookings"("checkIn");
CREATE INDEX "idx_bookings_checkOut" ON "bookings"("checkOut");

-- Exchange Rates Table
CREATE TABLE "exchange_rates" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "currencyCode" "Currency" UNIQUE NOT NULL,
  "rateToThb" DECIMAL(10,4) NOT NULL,
  "source" VARCHAR(50) DEFAULT 'manual' NOT NULL,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX "idx_exchange_rates_currencyCode" ON "exchange_rates"("currencyCode");

-- Referrals Table
CREATE TABLE "referrals" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "referrerId" UUID NOT NULL REFERENCES "profiles"("id"),
  "referredId" UUID NOT NULL REFERENCES "profiles"("id"),
  "rewardPoints" DECIMAL(10,2) DEFAULT 0 NOT NULL,
  "rewardUsdt" DECIMAL(10,2) DEFAULT 0 NOT NULL,
  "rewardPaid" BOOLEAN DEFAULT false NOT NULL,
  "firstBookingId" UUID,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "rewardPaidAt" TIMESTAMP,
  UNIQUE("referrerId", "referredId")
);

CREATE INDEX "idx_referrals_referrerId" ON "referrals"("referrerId");
CREATE INDEX "idx_referrals_referredId" ON "referrals"("referredId");

-- Commissions Table
CREATE TABLE "commissions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "listingId" UUID NOT NULL REFERENCES "listings"("id"),
  "partnerId" UUID NOT NULL REFERENCES "profiles"("id"),
  "amountThb" DECIMAL(10,2) NOT NULL,
  "amountUsdt" DECIMAL(10,2) DEFAULT 0 NOT NULL,
  "paid" BOOLEAN DEFAULT false NOT NULL,
  "period" VARCHAR(20) NOT NULL,
  "bookingsCount" INTEGER DEFAULT 0 NOT NULL,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "paidAt" TIMESTAMP
);

CREATE INDEX "idx_commissions_partnerId" ON "commissions"("partnerId");
CREATE INDEX "idx_commissions_listingId" ON "commissions"("listingId");
CREATE INDEX "idx_commissions_paid" ON "commissions"("paid");
CREATE INDEX "idx_commissions_period" ON "commissions"("period");

-- Seed Initial Data

-- Insert Categories
INSERT INTO "categories" ("name", "slug", "description", "icon", "order") VALUES
('Property', 'property', 'Villas, Apartments, Houses', '🏠', 1),
('Vehicles', 'vehicles', 'Bikes, Cars, Scooters', '🏍️', 2),
('Tours', 'tours', 'Excursions, Activities', '🗺️', 3),
('Yachts', 'yachts', 'Yacht Rentals, Boat Tours', '⛵', 4);

-- Insert Exchange Rates (Sample rates)
INSERT INTO "exchange_rates" ("currencyCode", "rateToThb", "source") VALUES
('THB', 1.0000, 'base'),
('RUB', 0.3700, 'manual'),
('USD', 33.5000, 'manual'),
('USDT', 33.5000, 'manual');

-- Create function to generate unique referral code
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TEXT AS $$
DECLARE
  code TEXT;
  exists BOOLEAN := true;
BEGIN
  WHILE exists LOOP
    code := 'FR' || LPAD(FLOOR(RANDOM() * 100000)::TEXT, 5, '0');
    SELECT EXISTS(SELECT 1 FROM profiles WHERE "referralCode" = code) INTO exists;
  END LOOP;
  RETURN code;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate referral code
CREATE OR REPLACE FUNCTION set_referral_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."referralCode" IS NULL OR NEW."referralCode" = '' THEN
    NEW."referralCode" := generate_referral_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_referral_code
BEFORE INSERT ON "profiles"
FOR EACH ROW
EXECUTE FUNCTION set_referral_code();

-- Create trigger to update updatedAt
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_profiles_updated_at
BEFORE UPDATE ON "profiles"
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_update_categories_updated_at
BEFORE UPDATE ON "categories"
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_update_listings_updated_at
BEFORE UPDATE ON "listings"
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_update_bookings_updated_at
BEFORE UPDATE ON "bookings"
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_update_exchange_rates_updated_at
BEFORE UPDATE ON "exchange_rates"
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();