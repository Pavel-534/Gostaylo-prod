# FunnyRent 2.1 - Product Requirements Document

## Latest Update: 2026-02-28 - Stage 25.2 Complete ✅

### Stage 25.2 Changes (2026-02-28)

#### Admin Moderation Redesign (P0) ✅
- **Photo Carousel**: Implemented Embla Carousel for swipeable photo gallery
- **Mobile-First Design**: Responsive layout with proper spacing and touch-friendly buttons
- **Info Grid**: 2x2 grid showing Цена, Комиссия, Дата создания, Рекомендуем
- **Premium UI**: Gradient backgrounds, card shadows, modern typography

#### Chat System Activation (P0) ✅
- **New API Endpoints**:
  - `POST/GET /api/v2/conversations` - Create/List conversations
  - `GET/PATCH /api/v2/conversations/[id]` - Get/Update conversation
  - `POST/GET /api/v2/messages` - Send/Get messages
- **Admin Messages Page**: `/admin/messages` with conversation list and chat UI
- **Partner Messages**: Updated `/partner/messages/[id]` with Read Receipts

#### Read Receipts (NEW) ✅
- `is_read` boolean field in messages table
- Single checkmark (✓) = Sent
- Double checkmark (✓✓ blue) = Read
- Auto-mark as read when conversation is opened

#### Reject Flow (P0) ✅
- **Modal with Reason**: Textarea + quick reason badges
- **Quick Reasons**: Некачественные фото, Неполное описание, Неверная цена, Дубликат
- **Multi-Channel Notifications**:
  1. Creates conversation in `conversations` table
  2. Creates message with type='REJECTION' in `messages` table
  3. Sends Telegram notification if partner has `telegram_id`
  4. Shows admin alert if no telegram_id
- **Status Update**: Sets `metadata.is_rejected: true`

#### Message Owner Feature (NEW) ✅
- "Написать владельцу" button in moderation modal
- Opens message modal with textarea
- Creates conversation and sends message to internal chat

---

## Database Migration Required ⚠️

**File**: `/app/database/migration_stage_25.sql`

Execute in Supabase Dashboard → SQL Editor:

```sql
-- Key changes:
ALTER TABLE listings ADD COLUMN IF NOT EXISTS sync_settings JSONB DEFAULT '{}';
ALTER TABLE listings ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS telegram_id TEXT;

CREATE TABLE IF NOT EXISTS conversations (...);
CREATE TABLE IF NOT EXISTS messages (...);
```

---

## Previous Stage 24.4 Changes (2026-02-28)
- Fixed Admin Moderation crash (null dates)
- Added Seasonal Pricing UI
- Fixed iCal CalendarSyncManager API paths
- Increased photo limit to 30
- Fixed progress bar formula

---

## Working Features

### Moderation System ✅
- Premium mobile-first design
- Photo carousel with navigation
- Approve/Reject workflow
- Featured toggle (is_featured)
- Quick reject reasons
- Multi-channel notifications
- Admin ↔ Partner messaging

### Chat System ✅
- Conversations list
- Real-time messages
- Read receipts (✓ / ✓✓)
- Admin messages page
- Partner messages page
- Rejection messages with special styling

### Storage & Media ✅
- Supabase Storage bucket
- Client-side image compression
- Photo limit: 30
- Progress bar during upload

### Partner Portal ✅
- Create/Edit listings
- Save as Draft
- Media management
- iCal sync
- Seasonal pricing
- Messages with admin feedback

---

## Test Credentials
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@funnyrent.com | ChangeMe2025! |
| Partner | partner@test.com | ChangeMe2025! |

---

## Tech Stack
- **Framework:** Next.js 14.2.3 (App Router)
- **Database:** Supabase PostgreSQL
- **Storage:** Supabase Storage
- **Auth:** Supabase Auth
- **Bot:** Telegram Bot API
- **UI:** Tailwind CSS, Shadcn/UI, Embla Carousel
- **Image Processing:** browser-image-compression

---

## Code Architecture
```
/app/
├── app/
│   ├── api/v2/
│   │   ├── conversations/          # NEW - Chat API
│   │   │   ├── route.js
│   │   │   └── [id]/route.js
│   │   └── messages/route.js       # NEW - Messages API
│   ├── admin/
│   │   ├── moderation/page.js      # REWRITTEN - Carousel + Reject flow
│   │   ├── messages/page.js        # NEW - Admin chat UI
│   │   └── layout.js               # UPDATED - Added Messages link
│   └── partner/
│       └── messages/[id]/page.js   # UPDATED - Read Receipts
├── database/
│   └── migration_stage_25.sql      # NEW - SQL migration script
```

---

## Next Priority Tasks

### Upcoming (P1)
- **Stripe Integration** — Real payment processing
- **Email Notifications** — Resend integration
- **Background iCal Sync** — Cron job for auto-sync

### Future/Backlog (P2+)
- TRON/USDT Verification
- Advanced Analytics
- 404/Error page translations
- Move Supabase service key to env variables

---

## Preview URL
https://c325362c-1be1-450d-a1ad-cc1fb45ba828.preview.emergentagent.com
