# 🔍 SEARCH & FILTERING SYSTEM - TECHNICAL AUDIT
## Gostaylo Platform

**Date:** 2026-03-12
**Purpose:** Deep technical audit before integration of GostayloCalendar into search

---

## 1. 📁 FILE STRUCTURE

### 1.1 Search Bar Component (Home Page)
| File | Purpose | Location in UI |
|------|---------|----------------|
| `/app/components/GostayloHomeContent.jsx` | **Main search bar** on hero section | Lines 226-316 |

**Search Bar Elements:**
- Text search input (Lines 231-242)
- Date range picker (Lines 244-276)
- Category selector (Lines 278-291)
- District selector (Lines 293-304)
- Search button (Lines 306-313)

### 1.2 Search Results Page
| File | Purpose |
|------|---------|
| `/app/app/listings/page.js` | **Dedicated listings page** with filters |

**Filter Elements on Results Page:**
- Search input (text)
- Category selector
- District selector
- Sort options (newest, price_asc, price_desc, rating)
- View mode toggle (grid/list)

**⚠️ NO DATE FILTER on listings page!** Only main page has date picker.

### 1.3 Data Fetching Layer
| File | Purpose |
|------|---------|
| `/app/lib/client-data.js` | Client-side direct Supabase fetch |

---

## 2. 📅 CALENDAR LIBRARY IN SEARCH

### Current Implementation

**File:** `/app/components/GostayloHomeContent.jsx`
**Lines:** 244-276

```jsx
import { DayPicker } from 'react-day-picker'
import { format, differenceInDays, isSameDay } from 'date-fns'
import { ru, enUS } from 'date-fns/locale'

// Inside component:
<Popover>
  <PopoverTrigger asChild>
    <Button variant="outline" className="h-10 w-full justify-start...">
      <CalendarIcon />
      {/* Date range display */}
    </Button>
  </PopoverTrigger>
  <PopoverContent className="w-auto p-4" align="start">
    <DayPicker
      mode="range"
      selected={dateRange}
      onSelect={setDateRange}
      locale={language === 'ru' ? ru : enUS}
      numberOfMonths={1}
      disabled={{ before: new Date() }}
    />
  </PopoverContent>
</Popover>
```

**Libraries Used:**
| Library | Version | Purpose |
|---------|---------|---------|
| `react-day-picker` | ^9.x | Calendar component |
| `date-fns` | ^3.x | Date formatting |
| `@/components/ui/popover` | Shadcn | Dropdown wrapper |

### ⚠️ CRITICAL ISSUE
**Date selection does NOT affect search results!**

The `dateRange` state is captured but NEVER used:
1. Not passed to API
2. Not used in filtering
3. No availability check
4. Purely cosmetic currently

---

## 3. 🔌 API LAYER

### 3.1 Search/Listings Endpoints

| Endpoint | Method | Purpose | Used By |
|----------|--------|---------|---------|
| `GET /api/v2/listings` | API Route | Server-side filtered listing fetch | Admin panels |
| Direct Supabase REST | Client | `fetchListings()` in client-data.js | Home & Listings pages |

### 3.2 Current API Query Structure

**API Route (`/app/app/api/v2/listings/route.js`):**
```javascript
// Supported filters:
const category = searchParams.get('category');
const district = searchParams.get('district');
const minPrice = searchParams.get('minPrice');
const maxPrice = searchParams.get('maxPrice');
const search = searchParams.get('search');  // Text search
const status = searchParams.get('status');  // Default: ACTIVE
const limit = searchParams.get('limit');    // Default: 50

// NO DATE FILTER SUPPORT!
```

**Client Direct Fetch (`/app/lib/client-data.js`):**
```javascript
export async function fetchListings(filters = {}) {
  let params = 'status=eq.ACTIVE&order=...&limit=50';
  
  if (filters.category) { /* category filter */ }
  if (filters.district) { /* district filter */ }
  
  // NO DATE FILTER!
  // NO AVAILABILITY CHECK!
}
```

### ⚠️ CRITICAL GAP
**Neither API nor client data supports date-based availability filtering!**

---

## 4. 🎯 FILTERING LOGIC ANALYSIS

### 4.1 Current Client-Side Filtering

**File:** `/app/components/GostayloHomeContent.jsx`
**Lines:** 177-198

```javascript
const filteredListings = listings.filter(listing => {
  // 1. Text search filter
  if (searchQuery) {
    const query = searchQuery.toLowerCase()
    const matchesSearch = 
      listing.title?.toLowerCase().includes(query) ||
      listing.description?.toLowerCase().includes(query) ||
      listing.district?.toLowerCase().includes(query)
    if (!matchesSearch) return false
  }
  
  // 2. Category filter
  if (selectedCategory !== 'all') {
    const cat = categories.find(c => c.slug === selectedCategory)
    if (cat && listing.category_id !== cat.id) return false
  }
  
  // 3. District filter
  if (selectedDistrict !== 'all' && listing.district !== selectedDistrict) {
    return false
  }
  
  // ⚠️ NO DATE AVAILABILITY CHECK!
  
  return true
})
```

### 4.2 What's Missing

| Feature | Status | Impact |
|---------|--------|--------|
| Date range filter | ❌ NOT IMPLEMENTED | Users see all listings regardless of availability |
| Availability check | ❌ NOT IMPLEMENTED | No `bookings` table integration |
| Calendar blocks check | ❌ NOT IMPLEMENTED | No `calendar_blocks` integration |
| Price by season | ❌ NOT IMPLEMENTED | No `seasonal_prices` integration |

### 4.3 "Search" Button Behavior

```javascript
function handleSearch() {
  // Current behavior: JUST SCROLLS TO LISTINGS!
  const listingsSection = document.getElementById('listings-section')
  if (listingsSection) {
    listingsSection.scrollIntoView({ behavior: 'smooth' })
  }
  // Does NOT filter by dates!
}
```

---

## 5. 🔗 PARAMETER PASSING

### 5.1 Current Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                   GostayloHomeContent.jsx                        │
│                                                                  │
│  useState:                                                       │
│  - searchQuery (text)                                           │
│  - dateRange { from, to }  ← CAPTURED BUT UNUSED!               │
│  - selectedCategory                                              │
│  - selectedDistrict                                              │
│                                                                  │
│  ↓ handleSearch() → scrollIntoView() only                       │
│                                                                  │
│  filteredListings = client-side filter (NO dates)               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Click on listing card
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   /listings/[id]/page.js                         │
│                                                                  │
│  NO PARAMS RECEIVED FROM SEARCH!                                │
│  - Date range: NOT passed                                        │
│  - Guests: NOT passed                                            │
│  - Filters: NOT passed                                           │
│                                                                  │
│  Calendar starts fresh (no pre-selection)                        │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 State Management

| Method | Used? | Details |
|--------|-------|---------|
| URL Query Params | ❌ No | Not used for search params |
| React Context | ❌ No | No search context exists |
| Zustand/Redux | ❌ No | No state manager |
| localStorage | ⚠️ Partial | Only language/currency |
| Component State | ✅ Yes | Local useState only |

### 5.3 Navigation Patterns

**Home → Category Page:**
```javascript
onClick={() => router.push(`/listings?category=${cat.slug}`)}
// Only category passed!
```

**Home → Listing Detail:**
```javascript
<Link href={`/listings/${listing.id}`}>
// NO params passed!
```

---

## 6. 🏗️ ARCHITECTURE GAPS ("Скелеты в шкафу")

### 6.1 Critical Issues

| # | Issue | Severity | Impact |
|---|-------|----------|--------|
| 1 | **Date picker is decorative** | 🔴 HIGH | Users select dates but nothing happens |
| 2 | **No availability filtering** | 🔴 HIGH | All listings shown regardless of bookings |
| 3 | **Search params not persisted** | 🟡 MEDIUM | Dates lost when navigating to detail page |
| 4 | **Dual data fetching** | 🟡 MEDIUM | Both API and direct Supabase used inconsistently |
| 5 | **No guests count** | 🟠 LOW | Can't filter by capacity |

### 6.2 Dead Code / Unused Features

| Code | File | Status |
|------|------|--------|
| `dateRange` state | GostayloHomeContent.jsx | Captured but never used |
| `handleSearch()` | GostayloHomeContent.jsx | Only scrolls, doesn't filter |
| DayPicker in Popover | GostayloHomeContent.jsx | Purely visual |

---

## 7. 📋 RECOMMENDED MIGRATION PLAN

### Phase 1: API Enhancement
1. **Update `/api/v2/listings`** to accept:
   - `checkIn` - Start date
   - `checkOut` - End date
   - `guests` - Guest count (optional)

2. **Add availability check:**
   - For each listing, call `CalendarService.checkAvailability()`
   - Filter out unavailable listings
   - Return only available ones

### Phase 2: Search Bar Upgrade
1. **Replace DayPicker** with `GostayloCalendar` (simplified version without booking)
2. **Or create** `GostayloSearchCalendar` component:
   - Same visual style
   - No per-listing blocked dates (generic calendar)
   - Passes selected dates to API

### Phase 3: State Persistence
1. **Option A:** URL Query Params (recommended)
   ```
   /listings?checkIn=2026-03-15&checkOut=2026-03-17&district=Rawai
   ```

2. **Option B:** Search Context Provider
   ```jsx
   <SearchProvider>
     <GostayloHomeContent />
   </SearchProvider>
   ```

### Phase 4: Listing Detail Integration
1. **Pre-fill dates** in `GostayloCalendar` from URL params
2. **Auto-calculate** price on page load
3. **Validate** dates against listing's calendar

---

## 8. 📊 FILES TO MODIFY

| File | Action | Priority |
|------|--------|----------|
| `/app/app/api/v2/listings/route.js` | Add date filter + availability check | 🔴 P0 |
| `/app/components/GostayloHomeContent.jsx` | Replace DayPicker, wire up search | 🔴 P0 |
| `/app/lib/client-data.js` | Add date params support | 🟡 P1 |
| `/app/app/listings/page.js` | Add date filter UI | 🟡 P1 |
| `/app/app/listings/[id]/page.js` | Read URL params, pre-fill calendar | 🟡 P1 |

---

## 9. 🎯 SUMMARY

### What Works
- ✅ Text search (client-side)
- ✅ Category filter
- ✅ District filter
- ✅ Sort options

### What's Broken/Missing
- ❌ Date-based availability filtering
- ❌ Search params persistence
- ❌ Pre-filled dates on listing page
- ❌ Guests count filter

### Recommended Approach
1. **Keep existing filtering** for text/category/district
2. **Add new date filter** via `/api/v2/listings` with CalendarService
3. **Use URL params** for state persistence
4. **Create simplified** search calendar (no per-listing blocks)

---

**Report Generated:** 2026-03-12
**Author:** E1 Agent
**Next Step:** Await approval before implementing changes
