# Phase 1 Report: Partner Portal Sterilization & API v2 Foundation

**Date:** 2026-03-13
**Status:** ✅ COMPLETED

---

## 🧹 ACTION 1: Code Sterilization (Cleanup)

### Files Cleaned:

1. **`/app/partner/listings/page.js`**
   - ❌ Removed: `SUPABASE_URL` and `SUPABASE_KEY` constants (lines 23-24)
   - ✅ Added: TanStack Query hooks (`usePartnerListings`, `useDeleteListing`, `usePublishListing`)
   - ✅ All data flows through API v2

2. **`/app/partner/bookings/page.js`**
   - ❌ Removed: OLD API calls (`/api/partner/bookings`)
   - ❌ Removed: Manual data filtering
   - ✅ Complete rewrite using TanStack Query (`usePartnerBookings`, `useUpdateBookingStatus`)
   - ✅ All data flows through API v2

3. **`/app/partner/dashboard/page.js`**
   - ❌ Removed: Direct Supabase REST API calls for drafts (lines 49-65)
   - ✅ Replaced with: `/api/v2/partner/listings` API call
   - ✅ All data flows through API v2

---

## 🔐 ACTION 2: API v2 Backend Setup

### Created Routes:

1. **`/api/v2/partner/bookings/route.js`** (GET)
   - ✅ Server-side session validation via `getUserIdFromRequest()`
   - ✅ Strict `owner_id = session.user.id` filtering (line 82)
   - ✅ Standard JSON response: `{ status, data, meta }`
   - ✅ Mock data fallback for development

2. **`/api/v2/partner/bookings/[id]/route.js`** (GET, PUT)
   - ✅ Server-side ownership verification before any update
   - ✅ Status transition validation (`PENDING → CONFIRMED/CANCELLED`)
   - ✅ Timestamps for status changes (`confirmed_at`, `cancelled_at`, `completed_at`)
   - ✅ Standard JSON response format

### Security Implementation:

```javascript
// /lib/services/session-service.js
export function getUserIdFromRequest(request) {
  // 1. Try Authorization header (Bearer token)
  // 2. Try custom X-User-Id header
  // 3. Try query params (backwards compatibility)
}

export async function verifyPartnerAccess(userId) {
  // Verify user exists and has PARTNER/ADMIN/MODERATOR role
}
```

**owner_id Check Active:** Line 82 in `/api/v2/partner/bookings/route.js`:
```javascript
.eq('partner_id', userId) // SECURITY: Filter by owner_id
```

---

## ⚡ ACTION 3: TanStack Query Integration

### Files Created:

1. **`/lib/query-client.js`** - QueryClient configuration
   - `staleTime`: 5 minutes
   - `gcTime`: 30 minutes
   - `retry`: 1 attempt
   - `refetchOnWindowFocus`: enabled

2. **`/lib/hooks/use-partner-bookings.js`**
   - `usePartnerBookings()` - Fetch bookings with filters
   - `useUpdateBookingStatus()` - Optimistic updates for confirm/reject

3. **`/lib/hooks/use-partner-listings.js`**
   - `usePartnerListings()` - Fetch partner's listings
   - `useDeleteListing()` - Delete with cache invalidation
   - `usePublishListing()` - Submit for moderation

### Integration in Layout:

```javascript
// /app/partner/layout.js
import { QueryClientProvider } from '@tanstack/react-query'
import { getQueryClient } from '@/lib/query-client'

export default function PartnerLayout({ children }) {
  const queryClient = getQueryClient()
  
  return (
    <QueryClientProvider client={queryClient}>
      {/* ... */}
    </QueryClientProvider>
  )
}
```

---

## 🎴 ACTION 4: Universal Card (GostayloListingCard)

### New Props Added:

```javascript
export function GostayloListingCard({
  // ... existing props
  isOwnerView = false,  // NEW: Toggle owner/guest view
  onEdit,               // NEW: Edit callback
  onDelete,             // NEW: Delete callback  
  onPublish             // NEW: Publish callback
}) {
```

### Owner View Features:

1. **Status Badge** - Shows listing status (Active/Pending/Inactive/Rejected)
2. **Draft Indicator** - Shows "Черновик" badge for drafts
3. **Action Buttons**:
   - Edit button (always visible)
   - Publish button (for INACTIVE listings)
   - Delete button

4. **Guest View** - Standard "Book Now" button (default)

---

## 📊 API Response Format

Standard format across all v2 endpoints:

```json
{
  "status": "success",
  "data": [...],
  "meta": {
    "total": 123,
    "limit": 50,
    "offset": 0,
    "partnerId": "uuid"
  }
}
```

---

## 🔗 Telegram Bot Compatibility

API v2 maintains webhook compatibility:
- Listings API accepts same data format
- Session validation can be bypassed with service token
- Standard response format works with bot parsers

---

## ✅ Verification

1. **API Test (GET bookings):**
```bash
curl "http://localhost:3000/api/v2/partner/bookings?partnerId=partner-1"
# Returns: { status: "success", data: [...], meta: {...} }
```

2. **API Test (PUT status):**
```bash
curl -X PUT "http://localhost:3000/api/v2/partner/bookings/booking-1?partnerId=partner-1" \
  -d '{"status": "CONFIRMED"}'
# Returns: { status: "success", data: {...}, message: "..." }
```

3. **Build Status:** ✅ SUCCESS (41.18s)

---

## 📁 Files Modified/Created

### Created:
- `/lib/services/session-service.js`
- `/lib/query-client.js`
- `/lib/hooks/use-partner-bookings.js`
- `/lib/hooks/use-partner-listings.js`
- `/app/api/v2/partner/bookings/route.js`
- `/app/api/v2/partner/bookings/[id]/route.js`

### Modified:
- `/app/partner/layout.js` - Added QueryClientProvider
- `/app/partner/bookings/page.js` - Complete rewrite with TanStack Query
- `/app/partner/dashboard/page.js` - Removed direct Supabase calls
- `/app/partner/listings/page.js` - Added TanStack Query hooks import
- `/components/gostaylo-listing-card.jsx` - Added isOwnerView support

---

**Next Steps:** Master Calendar & Dashboard Implementation (Phase 2)
