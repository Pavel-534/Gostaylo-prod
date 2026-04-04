# Gostaylo - Global Rental & Services Aggregator

## 🌴 Overview
Gostaylo is a premium rental and services aggregator platform for Phuket, Thailand. Built with Next.js 14, Prisma ORM, and designed for Supabase PostgreSQL.

## 🎯 Features
- **Multi-Category Rentals**: Property, Vehicles, Tours, Yachts
- **Multi-Currency Support**: THB, RUB, USD, USDT with real-time conversion
- **Multi-Auth Providers**: Email/Password, Google OAuth (Telegram, VK, Phone OTP ready)
- **Role-Based System**: Renter, Partner, Admin roles
- **Referral System**: Unique referral codes with rewards tracking
- **Commission Management**: Automated partner commission calculation
- **Russian Language Interface**: Primary UI in Russian

## 🏗️ Architecture

### Tech Stack
- **Frontend**: Next.js 14, React 18, Tailwind CSS, Shadcn UI
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL (Supabase)
- **ORM**: Prisma
- **Auth**: Mock Auth (ready for real implementation)

### Database Schema

#### 📊 Tables Overview

**1. profiles** - User Management
```sql
- id (UUID, PK)
- email (unique)
- phone (unique)
- role (RENTER | PARTNER | ADMIN)
- verificationStatus (PENDING | VERIFIED | REJECTED)
- referralCode (unique, auto-generated)
- referredBy (referral code of referrer)
- balancePoints, balanceUsdt
- preferredCurrency (THB | RUB | USD | USDT)
- firstName, lastName, avatar
- language (default: 'ru')
- Timestamps: createdAt, updatedAt, lastLoginAt
```

**2. categories** - Service Categories
```sql
- id (UUID, PK)
- name (Property, Vehicles, Tours, Yachts)
- slug (unique)
- description, icon
- order (display order)
- active (boolean)
```

**3. listings** - Rental Items
```sql
- id (UUID, PK)
- ownerId (FK → profiles)
- categoryId (FK → categories)
- status (PENDING | ACTIVE | BOOKED | INACTIVE | REJECTED)
- title, description
- district (Rawai, Patong, Kata, etc.)
- latitude, longitude, address
- basePriceThb (base price in THB)
- commissionRate (default: 15%)
- images (array), coverImage
- metadata (JSONB - category-specific data)
- available (boolean)
- minBookingDays, maxBookingDays
- Stats: views, bookingsCount, rating, reviewsCount
```

**4. bookings** - Rental Bookings
```sql
- id (UUID, PK)
- listingId (FK → listings)
- renterId (FK → profiles)
- status (PENDING | CONFIRMED | CANCELLED | COMPLETED | REFUNDED)
- checkIn, checkOut (dates)
- priceThb, currency, pricePaid, exchangeRate
- commissionThb, commissionPaid
- guestName, guestPhone, guestEmail
- specialRequests
- Timestamps: confirmedAt, cancelledAt, completedAt
```

**5. exchange_rates** - Currency Conversion
```sql
- id (UUID, PK)
- currencyCode (THB | RUB | USD | USDT, unique)
- rateToThb (conversion rate to THB)
- source (manual | api)
- updatedAt
```

**6. referrals** - Referral Tracking
```sql
- id (UUID, PK)
- referrerId (FK → profiles)
- referredId (FK → profiles)
- rewardPoints, rewardUsdt
- rewardPaid (boolean)
- firstBookingId
- Unique constraint: (referrerId, referredId)
```

**7. commissions** - Partner Earnings
```sql
- id (UUID, PK)
- listingId (FK → listings)
- partnerId (FK → profiles)
- amountThb, amountUsdt
- paid (boolean)
- period (e.g., "2025-01")
- bookingsCount
- paidAt
```

### 🔑 Key Features

#### Referral System
- Auto-generated unique referral codes (format: FR12345)
- Tracks referrer-referred relationships
- Commission/reward distribution tracking

#### Multi-Currency Support
- Base currency: THB (Thai Baht)
- Supported: RUB, USD, USDT
- Real-time conversion in UI
- Stored exchange rates in database

#### Role-Based Access
- **RENTER**: Browse and book listings
- **PARTNER**: Manage listings, view commissions
- **ADMIN**: Full system access

#### Commission System
- Default commission rate: 15%
- Automatic calculation on bookings
- Monthly tracking and payout management

## 📁 Project Structure

```
/app
├── app/
│   ├── api/[[...path]]/route.js   # API endpoints
│   ├── page.js                     # Landing page (Russian UI)
│   ├── layout.js                   # Root layout
│   └── globals.css                 # Global styles
├── lib/
│   ├── prisma.js                   # Prisma client singleton
│   ├── auth.js                     # Mock auth system
│   └── currency.js                 # Currency utilities
├── prisma/
│   ├── schema.prisma               # Database schema
│   └── migrations/
│       └── 001_initial_schema.sql  # SQL migration
├── components/ui/                  # Shadcn UI components
└── .env                            # Environment variables
```

## 🚀 Setup Instructions

### 1. Install Dependencies
```bash
cd /app
yarn install
```

### 2. Configure Supabase (When Ready)

Update `.env` with your Supabase credentials:
```env
DATABASE_URL=postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
DIRECT_URL=postgresql://postgres.[PROJECT_REF]:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT_REF].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Run SQL Migration

Go to Supabase Dashboard → SQL Editor and run:
```bash
/app/prisma/migrations/001_initial_schema.sql
```

This will create:
- All tables with proper relationships
- Indexes for optimized queries
- Triggers for auto-updating timestamps
- Auto-generate referral codes on user creation
- Seed data (categories, exchange rates)

### 4. Generate Prisma Client
```bash
npx prisma generate
```

### 5. (Optional) Use Prisma Studio
```bash
npx prisma studio
```

## 🔌 API Endpoints

### Categories
- `GET /api/categories` - Get all categories

### Listings
- `GET /api/listings` - Get all listings (with filters)
  - Query params: `category`, `district`, `minPrice`, `maxPrice`
- `GET /api/listings/:id` - Get single listing

### Auth (Mock)
- `POST /api/auth/register` - Register user
- `POST /api/auth/login` - Login user

### Bookings
- `POST /api/bookings` - Create booking

### Utilities
- `GET /api/exchange-rates` - Get currency rates
- `GET /api/districts` - Get all districts

## 🎨 UI/UX Features

### Design System
- **Colors**: 
  - Primary: Teal (#14B8A6)
  - Secondary: Sand (#F5E6D3)
  - Background: White / Slate
- **Typography**: Inter font with Cyrillic support
- **Components**: Shadcn UI (Tailwind-based)

### Key UI Elements
- **Sticky Header**: Currency switcher, auth button
- **Hero Section**: Luxury villa background with search
- **Category Cards**: Visual category navigation
- **Listing Cards**: Image, rating, price, location
- **Currency Switcher**: Real-time price conversion

## 📝 Next Steps

### Phase 1: Database Connection ✅
- [x] Create Prisma schema
- [x] Generate SQL migrations
- [x] Set up environment variables
- [ ] Connect to real Supabase instance

### Phase 2: Authentication
- [ ] Implement real Google OAuth
- [ ] Add Telegram login
- [ ] Add VK authentication
- [ ] Add phone OTP (Twilio/Firebase)

### Phase 3: Core Features
- [ ] Listing management (CRUD)
- [ ] Booking system
- [ ] Payment integration
- [ ] Referral rewards automation

### Phase 4: Partner Dashboard
- [ ] Listing management interface
- [ ] Commission tracking
- [ ] Analytics dashboard

### Phase 5: Admin Panel
- [ ] User management
- [ ] Listing approval workflow
- [ ] Commission payout management

## 🔒 Security Notes

### Current State (Development)
- Mock authentication active
- Environment variables use placeholders
- No password hashing (mock only)

### Production Requirements
- Implement proper password hashing (bcrypt)
- Enable Row Level Security (RLS) in Supabase
- Add rate limiting
- Implement CSRF protection
- Add input validation (Zod schemas)
- Enable HTTPS only

## 📊 Database Functions & Triggers

The migration includes several PostgreSQL functions:

1. **generate_referral_code()** - Generates unique FR##### codes
2. **set_referral_code()** - Trigger to auto-assign referral codes
3. **update_updated_at()** - Auto-updates updatedAt timestamps

## 🌐 Internationalization

Current: Russian (ru) interface
Prepared for: English (en)

To add languages:
- Update UI text files
- Add language switcher
- Update `profiles.language` field

## 📞 Support

For issues or questions about the database schema or implementation, refer to:
- Prisma Schema: `/app/prisma/schema.prisma`
- SQL Migration: `/app/prisma/migrations/001_initial_schema.sql`
- API Routes: `/app/app/api/[[...path]]/route.js`

## 🎯 Key Success Metrics

- **Listings**: Track views, bookings, ratings
- **Users**: Registration, verification, referrals
- **Bookings**: Conversion rate, average value
- **Commissions**: Partner earnings, platform revenue

---

**Built with ❤️ for Phuket luxury rentals**
.
