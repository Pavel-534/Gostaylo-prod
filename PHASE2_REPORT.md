# Phase 2 Report: Master Calendar Implementation

**Date:** 2026-03-13
**Status:** ✅ COMPLETED

---

## 📊 ACTION 1: API & Data Aggregation

### Created Routes:

1. **`/api/v2/partner/calendar/route.js`** (GET)
   - Fetches ALL listings belonging to `session.user.id`
   - Single optimized request aggregates:
     - Listing info (id, title, type, district, coverImage, basePriceThb)
     - Booking status (BOOKED/AVAILABLE/BLOCKED)
     - Guest names
     - `is_transition` flags for check-in/check-out overlaps
   - Returns 31 days by default (today + 30 days)

2. **`/api/v2/partner/calendar/block/route.js`** (POST, DELETE)
   - Create availability blocks (MAINTENANCE, OWNER_USE, OTHER)
   - Conflict detection with existing bookings
   - Owner verification before any operation

3. **`/api/v2/partner/calendar/manual-booking/route.js`** (POST)
   - Create offline bookings with auto-CONFIRMED status
   - Price calculation if not provided
   - Conflict detection with blocks and existing bookings

### Data Aggregation Logic:

```javascript
// /api/v2/partner/calendar/route.js

function processCalendarData(listings, bookings, blocks, startDate, endDate) {
  // Build day-by-day availability for each listing
  const calendarData = listings.map(listing => {
    const availability = {}
    
    dates.forEach(date => {
      // Check for booking overlap
      const booking = listingBookings.find(b => 
        isWithinInterval(dateObj, { start: checkIn, end: checkOut })
      )
      
      // Determine is_transition (check-out + check-in same day)
      const isTransition = (isCheckOut && hasCheckInToday) || (isCheckIn && hasCheckOutToday)
      
      availability[date] = {
        status: 'BOOKED',
        bookingId, guestName, bookingStatus, 
        isCheckIn, isCheckOut, isTransition
      }
    })
    
    return { listing, availability, bookingsCount, blocksCount }
  })
  
  return { dates, listings: calendarData, summary }
}
```

---

## 🎨 ACTION 2: UI Implementation (The Grid)

### Path: `/app/partner/calendar/page.js`

### Structure:

```
┌──────────────────────────────────────────────────────────────┐
│ Header: "Мастер-Календарь" | Today | Nav | Zoom | Refresh   │
├──────────────────────────────────────────────────────────────┤
│ Legend: ● Подтверждено ● Ожидание ● Заблокировано ◌ Transition│
├────────────┬─────────────────────────────────────────────────┤
│ STICKY     │ STICKY DATE HEADER (scrollable)                 │
│ LISTINGS   │ Пн Вт Ср Чт Пт Сб Вс Пн Вт Ср ...              │
│ COLUMN     │ 13 14 15 16 17 18 19 20 21 22 ...              │
├────────────┼─────────────────────────────────────────────────┤
│ 🏠 Villa   │ □ □ ■■■■■■■■ □ ■■■■■ □ □ □ □ □ ...             │
│   Rawai    │     Иван     Мария                              │
├────────────┼─────────────────────────────────────────────────┤
│ 🏢 Apt     │ □ □ □ □ □ ■■■■■■■ □ ▒▒▒ □ □ □ □ ...            │
│   Patong   │         Алексей   BLOCK                         │
├────────────┼─────────────────────────────────────────────────┤
│ ⛵ Yacht   │ □ □ □ □ □ □ □ ■ □ □ □ □ □ □ □ □ ...            │
│   Chalong  │               Дм                                │
├────────────┼─────────────────────────────────────────────────┤
│ 🏍 Bike    │ □ ■■■■■■■■■■■■■■■■ □ □ □ □ □ □ ...              │
│   Kata     │   Елена                                         │
└────────────┴─────────────────────────────────────────────────┘
```

### Visual Features:

1. **Teal-600 Palette**
   - CONFIRMED bookings: `bg-teal-500 text-white`
   - PENDING bookings: `bg-amber-400 text-amber-900`
   - BLOCKED: `bg-slate-300 text-slate-600`
   - Today highlight: `ring-2 ring-teal-400`

2. **Transition Logic**
   - Check-in/out same day: `border-l-2 border-l-dashed border-l-teal-400`
   - Check-in cell: `rounded-l`
   - Check-out cell: `rounded-r`

3. **View Modes**
   - Compact: 36px per day
   - Normal: 48px per day (default)
   - Wide: 64px per day

---

## ⚡ ACTION 3: Manual Management & Quick Actions

### Modal Flow:

```
Click Empty Cell → Select Action Modal
                      ↓
        ┌─────────────┴─────────────┐
        ↓                           ↓
   Block Dates              Create Booking
   - End date               - Check-out date
   - Type (Owner/Maint)     - Guest name *
   - Reason                 - Guest phone
                            - Guest email
                            - Price (THB)
                            - Notes
```

### Reactivity:

```javascript
// usePartnerCalendar.js

export function useCreateBlock() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (data) => { /* POST /api/v2/partner/calendar/block */ },
    onSuccess: () => toast.success('Даты заблокированы'),
    onSettled: () => {
      // Instant refresh via cache invalidation
      queryClient.invalidateQueries({ queryKey: partnerCalendarKeys.all })
    }
  })
}
```

---

## 🎯 ACTION 4: Professional UX

### Features Implemented:

1. **"Today" Jump Button**
   - Scrolls grid to today's column
   - Highlights today with teal ring

2. **Smooth Horizontal Scrolling**
   - Custom scrollbar styling
   - Drag-scroll support
   - 7-day navigation buttons (← →)

3. **Date Range Display**
   - Shows current view range: "13 мар — 12 апр 2026"
   - Russian locale formatting

4. **Keyboard Accessibility**
   - Form submission via Enter key
   - Modal close via Escape

---

## ✅ API Tests

### Calendar GET:
```bash
curl "http://localhost:3000/api/v2/partner/calendar?partnerId=partner-1"
# Returns: 4 listings × 31 days with availability data
```

### Block POST:
```bash
curl -X POST "/api/v2/partner/calendar/block?partnerId=partner-1" \
  -d '{"listingId": "lst-villa-001", "startDate": "2026-04-01", "endDate": "2026-04-03", "reason": "Личный визит"}'
# Returns: { status: "success", data: { id: "blk-xxx", ... } }
```

### Manual Booking POST:
```bash
curl -X POST "/api/v2/partner/calendar/manual-booking?partnerId=partner-1" \
  -d '{"listingId": "lst-yacht-003", "checkIn": "2026-04-05", "checkOut": "2026-04-06", "guestName": "Тест Гость", "priceThb": 45000}'
# Returns: { status: "success", data: { id: "bk-manual-xxx", status: "CONFIRMED", source: "MANUAL" } }
```

---

## 📁 Files Created

### API:
- `/app/api/v2/partner/calendar/route.js`
- `/app/api/v2/partner/calendar/block/route.js`
- `/app/api/v2/partner/calendar/manual-booking/route.js`

### Hooks:
- `/lib/hooks/use-partner-calendar.js`

### UI:
- `/app/partner/calendar/page.js` (complete rewrite)

---

## ⚠️ Notes

- **Mock Data Mode**: Calendar works with mock data when Supabase is not configured
- **Authentication**: UI requires login - test via API for now
- **Supabase Connection**: Need ENV variables for production data

---

**Next Steps:** 
- Phase 3: Dashboard with reactive widgets
- Connect Supabase for real data
- Add drag-select for multi-day range selection
