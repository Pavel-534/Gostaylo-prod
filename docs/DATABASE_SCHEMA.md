# Gostaylo - Database Schema Documentation

## 📋 Table of Contents
1. [Overview](#overview)
2. [Entity Relationship Diagram](#entity-relationship-diagram)
3. [Tables Detail](#tables-detail)
4. [Enums](#enums)
5. [Indexes](#indexes)
6. [Triggers & Functions](#triggers--functions)
7. [Seed Data](#seed-data)

## Overview

**Database Type**: PostgreSQL (Supabase)
**ORM**: Prisma
**Primary Currency**: Thai Baht (THB)
**Supported Currencies**: THB, RUB, USD, USDT

## Entity Relationship Diagram

```
┌─────────────┐
│  profiles   │
│ (Users)     │
└─────┬───────┘
      │
      ├──────────┐
      │          │
      │ ownerId  │ renterId
      ▼          ▼
┌──────────┐  ┌──────────┐
│ listings │  │ bookings │
└────┬─────┘  └────┬─────┘
     │             │
     │ categoryId  │ listingId
     ▼             ▼
┌──────────┐  ┌──────────┐
│categories│  │listings  │
└──────────┘  └──────────┘

┌──────────┐
│referrals │  (self-referencing profiles)
└──────────┘

┌────────────┐
│commissions │  (tracks partner earnings)
└────────────┘

┌────────────────┐
│exchange_rates  │  (currency conversion)
└────────────────┘
```

## Tables Detail

### 1. profiles
**Purpose**: User accounts with role-based access and referral system

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Auto-generated UUID |
| email | VARCHAR(255) | UNIQUE, NOT NULL | User email |
| phone | VARCHAR(50) | UNIQUE | Phone number |
| role | ENUM(Role) | NOT NULL, DEFAULT 'RENTER' | User role |
| verificationStatus | ENUM | NOT NULL, DEFAULT 'PENDING' | Verification status |
| referralCode | VARCHAR(20) | UNIQUE, NOT NULL | Auto-generated (FR#####) |
| referredBy | VARCHAR(20) | | Referral code of referrer |
| balancePoints | DECIMAL(10,2) | DEFAULT 0 | Loyalty points balance |
| balanceUsdt | DECIMAL(10,2) | DEFAULT 0 | USDT balance |
| preferredCurrency | ENUM(Currency) | DEFAULT 'THB' | User's currency preference |
| firstName | VARCHAR(100) | | First name |
| lastName | VARCHAR(100) | | Last name |
| avatar | TEXT | | Profile picture URL |
| language | VARCHAR(5) | DEFAULT 'ru' | UI language (ru/en) |
| createdAt | TIMESTAMP | DEFAULT NOW() | Account creation date |
| updatedAt | TIMESTAMP | AUTO UPDATE | Last update timestamp |
| lastLoginAt | TIMESTAMP | | Last login timestamp |

**Relations**:
- One-to-Many with `listings` (as owner)
- One-to-Many with `bookings` (as renter)
- One-to-Many with `commissions` (as partner)
- One-to-Many with `referrals` (as referrer/referred)

**Indexes**:
- `idx_profiles_email` on `email`
- `idx_profiles_referralCode` on `referralCode`
- `idx_profiles_role` on `role`

---

### 2. categories
**Purpose**: Service categories (Property, Vehicles, Tours, Yachts)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Category ID |
| name | VARCHAR(100) | UNIQUE, NOT NULL | Category name |
| slug | VARCHAR(100) | UNIQUE, NOT NULL | URL-friendly slug |
| description | TEXT | | Category description |
| icon | VARCHAR(50) | | Icon emoji/name |
| order | INTEGER | DEFAULT 0 | Display order |
| active | BOOLEAN | DEFAULT TRUE | Is category active |
| createdAt | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| updatedAt | TIMESTAMP | AUTO UPDATE | Last update timestamp |

**Relations**:
- One-to-Many with `listings`

**Indexes**:
- `idx_categories_slug` on `slug`
- `idx_categories_active` on `active`

**Default Categories**:
1. Property (🏠) - Villas, Apartments, Houses
2. Vehicles (🏍️) - Bikes, Cars, Scooters
3. Tours (🗺️) - Excursions, Activities
4. Yachts (⛵) - Yacht Rentals, Boat Tours

---

### 3. listings
**Purpose**: Rental items/services available for booking

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Listing ID |
| ownerId | UUID | FK → profiles, NOT NULL | Owner/partner ID |
| categoryId | UUID | FK → categories, NOT NULL | Category reference |
| status | ENUM(ListingStatus) | DEFAULT 'PENDING' | Listing status |
| title | VARCHAR(255) | NOT NULL | Listing title |
| description | TEXT | NOT NULL | Full description |
| district | VARCHAR(100) | NOT NULL | Location district |
| latitude | DECIMAL(10,7) | | GPS latitude |
| longitude | DECIMAL(10,7) | | GPS longitude |
| address | TEXT | | Full address |
| basePriceThb | DECIMAL(10,2) | NOT NULL | Base price in THB |
| commissionRate | DECIMAL(5,2) | DEFAULT 15 | Commission % (15%) |
| images | TEXT[] | DEFAULT '{}' | Array of image URLs |
| coverImage | TEXT | | Main cover image |
| metadata | JSONB | | Category-specific data |
| available | BOOLEAN | DEFAULT TRUE | Is available for booking |
| minBookingDays | INTEGER | DEFAULT 1 | Minimum booking days |
| maxBookingDays | INTEGER | | Maximum booking days |
| views | INTEGER | DEFAULT 0 | View count |
| bookingsCount | INTEGER | DEFAULT 0 | Total bookings |
| rating | DECIMAL(3,2) | DEFAULT 0 | Average rating (0-5) |
| reviewsCount | INTEGER | DEFAULT 0 | Number of reviews |
| createdAt | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| updatedAt | TIMESTAMP | AUTO UPDATE | Last update timestamp |
| publishedAt | TIMESTAMP | | Publishing timestamp |

**Metadata Examples**:
```json
// Property
{
  "bedrooms": 4,
  "bathrooms": 3,
  "area": 250,
  "amenities": ["pool", "wifi", "parking"]
}

// Vehicles
{
  "brand": "Honda",
  "model": "PCX",
  "year": 2023,
  "seats": 2,
  "transmission": "automatic"
}

// Tours
{
  "duration": "4 hours",
  "groupSize": 10,
  "included": ["lunch", "guide", "transport"],
  "meetingPoint": "Chalong Pier"
}

// Yachts
{
  "length": 45,
  "capacity": 12,
  "crew": true,
  "amenities": ["kitchen", "bathroom", "sunbed"]
}
```

**Relations**:
- Many-to-One with `profiles` (owner)
- Many-to-One with `categories`
- One-to-Many with `bookings`
- One-to-Many with `commissions`

**Indexes**:
- `idx_listings_ownerId` on `ownerId`
- `idx_listings_categoryId` on `categoryId`
- `idx_listings_status` on `status`
- `idx_listings_district` on `district`
- `idx_listings_available` on `available`
- `idx_listings_basePriceThb` on `basePriceThb`

---

### 4. bookings
**Purpose**: Track rental bookings and reservations

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Booking ID |
| listingId | UUID | FK → listings, NOT NULL | Rented listing |
| renterId | UUID | FK → profiles, NOT NULL | Renter user ID |
| status | ENUM(BookingStatus) | DEFAULT 'PENDING' | Booking status |
| checkIn | TIMESTAMP | NOT NULL | Check-in date/time |
| checkOut | TIMESTAMP | NOT NULL | Check-out date/time |
| priceThb | DECIMAL(10,2) | NOT NULL | Total price in THB |
| currency | ENUM(Currency) | NOT NULL | Payment currency |
| pricePaid | DECIMAL(10,2) | NOT NULL | Amount paid in currency |
| exchangeRate | DECIMAL(10,4) | NOT NULL | Exchange rate used |
| commissionThb | DECIMAL(10,2) | NOT NULL | Commission amount (THB) |
| commissionPaid | BOOLEAN | DEFAULT FALSE | Commission paid to partner |
| guestName | VARCHAR(255) | NOT NULL | Guest full name |
| guestPhone | VARCHAR(50) | NOT NULL | Guest phone |
| guestEmail | VARCHAR(255) | NOT NULL | Guest email |
| specialRequests | TEXT | | Special requests/notes |
| createdAt | TIMESTAMP | DEFAULT NOW() | Booking creation |
| updatedAt | TIMESTAMP | AUTO UPDATE | Last update |
| confirmedAt | TIMESTAMP | | Confirmation timestamp |
| cancelledAt | TIMESTAMP | | Cancellation timestamp |
| completedAt | TIMESTAMP | | Completion timestamp |

**Relations**:
- Many-to-One with `listings`
- Many-to-One with `profiles` (renter)

**Indexes**:
- `idx_bookings_listingId` on `listingId`
- `idx_bookings_renterId` on `renterId`
- `idx_bookings_status` on `status`
- `idx_bookings_checkIn` on `checkIn`
- `idx_bookings_checkOut` on `checkOut`

---

### 5. exchange_rates
**Purpose**: Currency conversion rates (base: THB)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Rate ID |
| currencyCode | ENUM(Currency) | UNIQUE, NOT NULL | Currency code |
| rateToThb | DECIMAL(10,4) | NOT NULL | Conversion rate to THB |
| source | VARCHAR(50) | DEFAULT 'manual' | Rate source |
| createdAt | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| updatedAt | TIMESTAMP | AUTO UPDATE | Last update |

**Default Rates**:
- THB: 1.0000 (base)
- RUB: 0.3700 (1 RUB = 0.37 THB)
- USD: 33.5000 (1 USD = 33.5 THB)
- USDT: 33.5000 (1 USDT = 33.5 THB)

**Index**:
- `idx_exchange_rates_currencyCode` on `currencyCode`

---

### 6. referrals
**Purpose**: Track referral relationships and rewards

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Referral ID |
| referrerId | UUID | FK → profiles, NOT NULL | Referrer user ID |
| referredId | UUID | FK → profiles, NOT NULL | Referred user ID |
| rewardPoints | DECIMAL(10,2) | DEFAULT 0 | Reward points earned |
| rewardUsdt | DECIMAL(10,2) | DEFAULT 0 | USDT reward earned |
| rewardPaid | BOOLEAN | DEFAULT FALSE | Reward paid status |
| firstBookingId | UUID | | First booking by referred |
| createdAt | TIMESTAMP | DEFAULT NOW() | Referral timestamp |
| rewardPaidAt | TIMESTAMP | | Reward payment timestamp |

**Constraints**:
- UNIQUE(referrerId, referredId) - prevents duplicate referrals

**Relations**:
- Many-to-One with `profiles` (referrer)
- Many-to-One with `profiles` (referred)

**Indexes**:
- `idx_referrals_referrerId` on `referrerId`
- `idx_referrals_referredId` on `referredId`

---

### 7. commissions
**Purpose**: Track partner earnings from bookings

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Commission ID |
| listingId | UUID | FK → listings, NOT NULL | Related listing |
| partnerId | UUID | FK → profiles, NOT NULL | Partner user ID |
| amountThb | DECIMAL(10,2) | NOT NULL | Commission in THB |
| amountUsdt | DECIMAL(10,2) | DEFAULT 0 | Commission in USDT |
| paid | BOOLEAN | DEFAULT FALSE | Payment status |
| period | VARCHAR(20) | NOT NULL | Period (YYYY-MM) |
| bookingsCount | INTEGER | DEFAULT 0 | Number of bookings |
| createdAt | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| paidAt | TIMESTAMP | | Payment timestamp |

**Relations**:
- Many-to-One with `listings`
- Many-to-One with `profiles` (partner)

**Indexes**:
- `idx_commissions_partnerId` on `partnerId`
- `idx_commissions_listingId` on `listingId`
- `idx_commissions_paid` on `paid`
- `idx_commissions_period` on `period`

---

## Enums

### Role
```sql
ENUM('RENTER', 'PARTNER', 'ADMIN')
```
- **RENTER**: Regular user who books listings
- **PARTNER**: Property/service owner who lists items
- **ADMIN**: Platform administrator

### VerificationStatus
```sql
ENUM('PENDING', 'VERIFIED', 'REJECTED')
```
- **PENDING**: Awaiting verification
- **VERIFIED**: Identity verified
- **REJECTED**: Verification failed

### Currency
```sql
ENUM('THB', 'RUB', 'USD', 'USDT')
```
- **THB**: Thai Baht (base currency)
- **RUB**: Russian Ruble
- **USD**: US Dollar
- **USDT**: Tether (cryptocurrency)

### ListingStatus
```sql
ENUM('PENDING', 'ACTIVE', 'BOOKED', 'INACTIVE', 'REJECTED')
```
- **PENDING**: Awaiting admin approval
- **ACTIVE**: Live and bookable
- **BOOKED**: Currently booked (not available)
- **INACTIVE**: Temporarily disabled by owner
- **REJECTED**: Rejected by admin

### BookingStatus
```sql
ENUM('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'REFUNDED')
```
- **PENDING**: Awaiting confirmation
- **CONFIRMED**: Booking confirmed
- **CANCELLED**: Cancelled by user/partner
- **COMPLETED**: Service completed
- **REFUNDED**: Payment refunded

---

## Indexes

All indexes are automatically created during migration:

### Performance-Critical Indexes
1. **profiles**: email, referralCode, role
2. **listings**: ownerId, categoryId, status, district, available, basePriceThb
3. **bookings**: listingId, renterId, status, checkIn, checkOut
4. **commissions**: partnerId, listingId, paid, period
5. **referrals**: referrerId, referredId

---

## Triggers & Functions

### 1. generate_referral_code()
**Purpose**: Generate unique referral code (FR#####)

```sql
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
```

### 2. set_referral_code() TRIGGER
**Purpose**: Auto-assign referral code on user creation

```sql
CREATE TRIGGER trigger_set_referral_code
BEFORE INSERT ON "profiles"
FOR EACH ROW
EXECUTE FUNCTION set_referral_code();
```

### 3. update_updated_at() TRIGGER
**Purpose**: Auto-update updatedAt timestamp on record update

Applied to tables:
- profiles
- categories
- listings
- bookings
- exchange_rates

---

## Seed Data

### Categories
```sql
INSERT INTO "categories" (name, slug, description, icon, order) VALUES
('Property', 'property', 'Villas, Apartments, Houses', '🏠', 1),
('Vehicles', 'vehicles', 'Bikes, Cars, Scooters', '🏍️', 2),
('Tours', 'tours', 'Excursions, Activities', '🗺️', 3),
('Yachts', 'yachts', 'Yacht Rentals, Boat Tours', '⛵', 4);
```

### Exchange Rates
```sql
INSERT INTO "exchange_rates" (currencyCode, rateToThb, source) VALUES
('THB', 1.0000, 'base'),
('RUB', 0.3700, 'manual'),
('USD', 33.5000, 'manual'),
('USDT', 33.5000, 'manual');
```

---

## Usage Examples

### Query Listings by Category
```sql
SELECT l.*, c.name as category_name, p.email as owner_email
FROM listings l
JOIN categories c ON l."categoryId" = c.id
JOIN profiles p ON l."ownerId" = p.id
WHERE c.slug = 'property' AND l.available = true
ORDER BY l."basePriceThb" ASC;
```

### Get User's Referral Statistics
```sql
SELECT 
  p.email,
  p."referralCode",
  COUNT(r.id) as total_referrals,
  SUM(r."rewardPoints") as total_points,
  SUM(r."rewardUsdt") as total_usdt
FROM profiles p
LEFT JOIN referrals r ON p.id = r."referrerId"
WHERE p.id = 'user-uuid-here'
GROUP BY p.id;
```

### Calculate Partner Commissions
```sql
SELECT 
  p.email as partner_email,
  COUNT(b.id) as total_bookings,
  SUM(b."commissionThb") as total_commission_thb,
  SUM(CASE WHEN b."commissionPaid" = true THEN b."commissionThb" ELSE 0 END) as paid_commission,
  SUM(CASE WHEN b."commissionPaid" = false THEN b."commissionThb" ELSE 0 END) as pending_commission
FROM profiles p
JOIN listings l ON p.id = l."ownerId"
JOIN bookings b ON l.id = b."listingId"
WHERE p.role = 'PARTNER'
GROUP BY p.id;
```

---

## Migration Instructions

### Step 1: Create Supabase Project
1. Go to https://supabase.com/dashboard
2. Create new project
3. Wait for project initialization (~2 minutes)

### Step 2: Get Connection String
1. Go to Project Settings → Database
2. Copy **Transaction Pooler** connection string (port 6543)
3. Update `.env` file with `DATABASE_URL`

### Step 3: Run SQL Migration
1. Go to Supabase Dashboard → SQL Editor
2. Open `/app/prisma/migrations/001_initial_schema.sql`
3. Copy entire SQL content
4. Paste and run in SQL Editor

### Step 4: Verify Schema
1. Go to Table Editor in Supabase Dashboard
2. Verify all 7 tables are created
3. Check seed data in `categories` and `exchange_rates`

### Step 5: Generate Prisma Client
```bash
cd /app
npx prisma generate
```

### Step 6: (Optional) View in Prisma Studio
```bash
npx prisma studio
```

---

## Backup & Maintenance

### Create Backup
```sql
-- Export as SQL dump from Supabase Dashboard
-- Database → Backups → Create Backup
```

### Update Exchange Rates
```sql
UPDATE "exchange_rates" 
SET "rateToThb" = 0.38, "updatedAt" = NOW()
WHERE "currencyCode" = 'RUB';
```

### Monthly Commission Report
```sql
SELECT 
  TO_CHAR(b."createdAt", 'YYYY-MM') as period,
  COUNT(*) as bookings,
  SUM(b."commissionThb") as total_commission
FROM bookings b
WHERE b.status = 'COMPLETED'
GROUP BY period
ORDER BY period DESC;
```

---

**Last Updated**: 2025-06-24
**Schema Version**: 1.0
**Prisma Version**: 7.4.1
