# 📅 AUDIT REPORT: Calendar Infrastructure
## Gostaylo - Single Source of Truth Architecture Migration

**Date:** 2026-03-12
**Purpose:** Prepare for unified `GET /api/v2/calendar` endpoint

---

## 1. 📁 FILES TO REFACTOR

### API Endpoints (app/api/)

| File | Purpose | Status | Action |
|------|---------|--------|--------|
| `/app/api/v2/listings/[id]/availability/route.js` | **MAIN** - Returns blocked nights for calendar | ✅ KEEP | → Migrate to `/api/v2/calendar` |
| `/app/api/v2/partner/listings/[id]/calendar/route.js` | Partner manual blocks CRUD | ✅ KEEP | → Extend for unified response |
| `/app/api/v2/listings/[id]/ical/route.js` | iCal EXPORT feed (for Airbnb/Booking) | ✅ KEEP | No changes needed |
| `/app/api/ical/sync/route.js` | iCal IMPORT sync logic | ⚠️ DEPRECATED | → Consolidate into new service |
| `/app/api/cron/ical-sync/route.js` | Cron job for auto-sync | ⚠️ DEPRECATED | → Use new sync service |
| `/app/api/v2/admin/ical/route.js` | Admin iCal management | ✅ KEEP | → Update to use new service |

### Frontend Components (components/)

| File | Purpose | Status | Action |
|------|---------|--------|--------|
| `/app/components/booking-date-picker.jsx` | Date selection with blocking | ✅ KEEP | → Consume new API |
| `/app/components/availability-calendar.jsx` | Partner calendar management | ✅ KEEP | → Consume new API |
| `/app/components/calendar-sync-manager.jsx` | iCal source management | ✅ KEEP | No changes needed |
| `/app/components/seasonal-price-manager.js` | Seasonal pricing config | ✅ KEEP | **PRESERVE** - Working logic |
| `/app/components/price-calendar-preview.js` | Price preview on calendar | ✅ KEEP | → Consume new API |

---

## 2. 📊 DATA SOURCES

### 2.1 Internal Bookings (TABLE: `bookings`)
```sql
SELECT id, listing_id, check_in, check_out, status
FROM bookings
WHERE listing_id = :listingId
  AND status IN ('PENDING', 'CONFIRMED', 'PAID')
  AND check_out >= CURRENT_DATE
```

**Fields used:**
- `check_in` - Start of stay (DATE)
- `check_out` - End of stay (DATE, exclusive for night calculation)
- `status` - Filter: PENDING, CONFIRMED, PAID

**Night calculation:**
```javascript
// Nights blocked = check_in to check_out - 1
// Example: 14-16 March = nights 14, 15 (2 nights)
function getBlockedNights(checkIn, checkOut) {
  const nights = [];
  let current = new Date(checkIn);
  const end = new Date(checkOut);
  while (current < end) {
    nights.push(format(current, 'yyyy-MM-dd'));
    current.setDate(current.getDate() + 1);
  }
  return nights;
}
```

---

### 2.2 Manual Blocks (TABLE: `calendar_blocks`)
```sql
SELECT id, listing_id, start_date, end_date, source, reason
FROM calendar_blocks
WHERE listing_id = :listingId
  AND end_date >= CURRENT_DATE
  AND source = 'manual'
```

**Fields used:**
- `start_date` - Block start (DATE, inclusive)
- `end_date` - Block end (DATE, inclusive)
- `source` - 'manual' | iCal URL
- `reason` - Description

**Date calculation:**
```javascript
// Manual blocks are INCLUSIVE - end_date is also blocked
function getBlockedDates(startDate, endDate) {
  const dates = [];
  let current = new Date(startDate);
  const end = new Date(endDate);
  while (current <= end) {
    dates.push(format(current, 'yyyy-MM-dd'));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}
```

---

### 2.3 External iCal Imports (TABLE: `calendar_blocks`)
```sql
SELECT id, listing_id, start_date, end_date, source, reason
FROM calendar_blocks
WHERE listing_id = :listingId
  AND end_date >= CURRENT_DATE
  AND source != 'manual'  -- iCal URL stored here
```

**Sync Settings (TABLE: `listings.sync_settings`):**
```json
{
  "sources": [
    {
      "id": "src-abc123",
      "url": "https://www.airbnb.com/calendar/ical/...",
      "platform": "Airbnb",
      "enabled": true,
      "last_sync": "2026-03-12T10:00:00Z",
      "events_count": 5
    }
  ],
  "auto_sync": true,
  "sync_interval_hours": 24,
  "last_sync": "2026-03-12T10:00:00Z"
}
```

**Sync Logs (TABLE: `ical_sync_logs`):**
- `listing_id` - Listing reference
- `source_url` - iCal URL
- `status` - 'success' | 'error'
- `events_count` - Number of events synced
- `error_message` - Error details
- `synced_at` - Timestamp

---

### 2.4 Seasonal Prices (TABLE: `seasonal_prices`) ⚠️ PRESERVE
```sql
SELECT id, listing_id, start_date, end_date, season_type, 
       price_daily, price_monthly, label, description
FROM seasonal_prices
WHERE listing_id = :listingId
ORDER BY start_date
```

**Season Types:**
- `LOW` - Low season (discount)
- `NORMAL` - Base price
- `HIGH` - High season (premium)
- `PEAK` - Peak season (max premium)

**Price Calculation (KEEP THIS LOGIC):**
```javascript
// From /app/lib/services/pricing.service.js
function calculateBookingPrice(basePriceThb, checkIn, checkOut, seasonalPricing) {
  const nights = differenceInDays(checkOut, checkIn);
  let totalPrice = 0;
  
  for (let i = 0; i < nights; i++) {
    const currentDate = addDays(checkIn, i);
    const dateStr = format(currentDate, 'yyyy-MM-dd');
    
    // Find applicable seasonal price
    const seasonal = seasonalPricing.find(s => 
      dateStr >= s.startDate && dateStr <= s.endDate
    );
    
    const pricePerNight = seasonal ? seasonal.priceDaily : basePriceThb;
    totalPrice += pricePerNight;
  }
  
  return { nights, totalPrice };
}
```

---

## 3. 🔄 CURRENT DATA FLOW

```
┌─────────────────────────────────────────────────────────────────┐
│                        DATA SOURCES                              │
├─────────────────────────────────────────────────────────────────┤
│  bookings         │  calendar_blocks  │  seasonal_prices        │
│  (PENDING/PAID)   │  (manual + iCal)  │  (price periods)        │
└────────┬──────────┴────────┬──────────┴────────┬────────────────┘
         │                   │                   │
         ▼                   ▼                   │
┌────────────────────────────────────────────┐   │
│  /api/v2/listings/[id]/availability        │   │
│  - Aggregates booking nights               │   │
│  - Aggregates calendar blocks              │   │
│  - Returns: blockedNights[]                │   │
└────────────────┬───────────────────────────┘   │
                 │                               │
                 ▼                               │
┌────────────────────────────────────────────┐   │
│  booking-date-picker.jsx                   │◄──┘
│  - SmartDayButton with blocking            │
│  - Night-based disable logic               │
│  - Price calculation (uses seasonal)       │
└────────────────────────────────────────────┘
```

---

## 4. 🎯 PROPOSED NEW ARCHITECTURE

### New Unified Endpoint: `GET /api/v2/calendar`

**Response Structure:**
```json
{
  "success": true,
  "data": {
    "blockedNights": ["2026-03-14", "2026-03-15", ...],
    "seasonalPrices": [
      {
        "startDate": "2026-12-15",
        "endDate": "2026-01-15",
        "priceDaily": 8000,
        "seasonType": "HIGH",
        "label": "Высокий сезон"
      }
    ],
    "basePriceThb": 5000,
    "minBookingDays": 1,
    "maxBookingDays": 30,
    "sources": {
      "bookings": 3,
      "manualBlocks": 2,
      "icalBlocks": 5
    },
    "meta": {
      "rangeStart": "2026-03-12",
      "rangeEnd": "2027-03-12",
      "logic": "night-based",
      "lastIcalSync": "2026-03-12T10:00:00Z"
    }
  }
}
```

### New Data Flow:
```
┌─────────────────────────────────────────────────────────────────┐
│                     GET /api/v2/calendar                         │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   CalendarService                         │   │
│  │  - fetchBlockedNights()                                   │   │
│  │  - fetchSeasonalPrices()                                  │   │
│  │  - fetchIcalBlocks()                                      │   │
│  │  - mergeAndDeduplicate()                                  │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                  ┌───────────────────────┐
                  │  Frontend Components  │
                  │  - booking-date-picker│
                  │  - price-calendar     │
                  │  - availability-cal   │
                  └───────────────────────┘
```

---

## 5. 📝 ACTION ITEMS FOR STEP 2

### 5.1 Create New Service
- [ ] `/app/lib/services/calendar.service.js` - Central calendar logic

### 5.2 Create New API
- [ ] `/app/api/v2/calendar/route.js` - Unified endpoint
- [ ] Parameters: `listingId`, `startDate`, `endDate`

### 5.3 Mark Deprecated
- [ ] Add `// DEPRECATED: Use /api/v2/calendar` to old endpoints
- [ ] Maintain backwards compatibility during migration

### 5.4 Update Frontend
- [ ] `booking-date-picker.jsx` - Use new API
- [ ] `availability-calendar.jsx` - Use new API

### 5.5 Preserve
- [ ] `seasonal-price-manager.js` - NO CHANGES (working logic)
- [ ] `calendar-sync-manager.jsx` - NO CHANGES (management UI)

---

## 6. 🔒 CONSTRAINTS

1. **Night-based logic must be preserved:**
   - Check-out day is available for new check-in
   - Bookings block nights, not days

2. **Seasonal pricing MUST work:**
   - Price varies by date
   - Different daily/monthly rates

3. **iCal sync must continue:**
   - Cron every 15 minutes
   - Support Airbnb, Booking.com, VRBO

4. **Performance:**
   - Single API call for all calendar data
   - Cache where possible

---

**Report Generated:** 2026-03-12
**Author:** E1 Agent
**Next Step:** Create CalendarService and unified API
