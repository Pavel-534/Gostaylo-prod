# Search Engine Architecture Cleanup Report

**Date:** 2026-03-12
**Stage:** Post-Migration Sterilization

## Summary

After migrating to Search Engine v2 with CalendarService integration, we performed a codebase cleanup to remove legacy patterns and ensure a single source of truth for search functionality.

---

## Changes Made

### 1. API Endpoints

| Endpoint | Status | Action |
|----------|--------|--------|
| `GET /api/v2/listings` | **DEPRECATED** | Marked as deprecated with console warning. Added JSDoc deprecation notice. Use `/api/v2/search` instead. |
| `POST /api/v2/listings` | **ACTIVE** | Kept - required for creating new listings |
| `GET /api/v2/search` | **PRIMARY** | New search API with CalendarService integration |

**File Modified:** `/app/app/api/v2/listings/route.js`

### 2. Client Data Library

| Function | Status | Notes |
|----------|--------|-------|
| `fetchListings()` | **DEPRECATED** | Marked with JSDoc deprecation. Kept for backward compatibility with Home page. |
| `fetchCategories()` | ACTIVE | Used by Home page |
| `fetchExchangeRates()` | ACTIVE | Used by all pages |
| `fetchDistricts()` | ACTIVE | Used by Home page |

**File Modified:** `/app/lib/client-data.js`

### 3. Components

| Component | File | Status |
|-----------|------|--------|
| `GostayloHomeContent.jsx` | `/app/components/` | **KEPT** - Still uses `fetchListings` for displaying all listings on home page (no date filtering needed) |
| Listings page | `/app/app/listings/page.js` | **CLEAN** - Uses `/api/v2/search` with full CalendarService filtering |

---

## Architecture After Cleanup

```
Search Flow:
┌─────────────────┐
│   Home Page     │  ──(fetchListings)──> Supabase Direct (all listings, no date filter)
└─────────────────┘
         │
         │ (handleSearch → URL Bridge)
         ▼
┌─────────────────┐
│ /listings page  │  ──(fetchListingsFromAPI)──> GET /api/v2/search
└─────────────────┘                                     │
         │                                              │
         │                                              ▼
         │                                    ┌─────────────────────┐
         │                                    │   CalendarService   │
         │                                    │   (Availability)    │
         │                                    └─────────────────────┘
         │
         │ (Link with URL params)
         ▼
┌─────────────────┐
│  Detail Page    │  ←── reads checkIn, checkOut, guests from URL
│  [id]/page.js   │  ──> pre-populates GostayloCalendar
└─────────────────┘
```

---

## Deleted Code

**None permanently deleted.** All legacy code was marked as deprecated rather than removed to ensure:
1. Backward compatibility with existing pages
2. Gradual migration path
3. No breaking changes

---

## Verification

- [x] `/listings` page uses `/api/v2/search` exclusively
- [x] Home page continues to work with `fetchListings` (no date filtering needed)
- [x] `/api/v2/listings` POST still works for creating listings
- [x] No orphaned imports or unused functions
- [x] All lint checks pass

---

## Recommendations for Future

1. **Phase out `fetchListings`:** When Home page is redesigned, switch to `/api/v2/search` with default parameters
2. **Remove GET `/api/v2/listings`:** After verifying no external consumers depend on it
3. **Add monitoring:** Track usage of deprecated endpoints to measure migration progress

---

## Files Reference

- Primary Search API: `/app/app/api/v2/search/route.js`
- Calendar Service: `/app/lib/services/calendar.service.js`
- Search Results Page: `/app/app/listings/page.js`
- Home Page: `/app/components/GostayloHomeContent.jsx`
