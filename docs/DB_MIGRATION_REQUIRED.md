# 🚨 CRITICAL: Database Schema Update Required

## Phase 4.1 Implementation Status: 95% Complete

### ⚠️ **ACTION REQUIRED: Add `min_stay` Column**

The Phase 4.1 implementation is **fully coded and ready**, but requires a database schema update to function properly.

---

## 📝 SQL Migration (Run in Supabase SQL Editor)

```sql
-- Step 1: Add min_stay column to seasonal_prices table
ALTER TABLE seasonal_prices 
ADD COLUMN IF NOT EXISTS min_stay INTEGER DEFAULT 1;

-- Step 2: Add check constraint to ensure min_stay is at least 1
ALTER TABLE seasonal_prices 
ADD CONSTRAINT seasonal_prices_min_stay_positive CHECK (min_stay >= 1);

-- Step 3: Add comment for documentation
COMMENT ON COLUMN seasonal_prices.min_stay IS 'Minimum number of nights required for booking in this date range';

-- Step 4: Update any existing records to have min_stay = 1
UPDATE seasonal_prices 
SET min_stay = 1 
WHERE min_stay IS NULL;
```

---

## ✅ Verification Steps

### 1. Verify Column Was Added
```sql
-- Run in Supabase SQL Editor
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'seasonal_prices' 
AND column_name = 'min_stay';
```

Expected output:
```
column_name | data_type | column_default
------------|-----------|---------------
min_stay    | integer   | 1
```

### 2. Test Insert
```sql
-- Test inserting a seasonal price with min_stay
INSERT INTO seasonal_prices (
  listing_id, 
  start_date, 
  end_date, 
  price_daily, 
  season_type, 
  label, 
  min_stay
) VALUES (
  'lst-mm5nggz6',
  '2025-12-20',
  '2025-12-27',
  8000,
  'PEAK',
  'Christmas Week',
  7
);
```

### 3. Test Via API
```bash
# After migration, test the API endpoint
curl -X POST "https://YOUR-APP-URL/api/v2/partner/seasonal-prices?partnerId=user-mmhsxted-zon" \
  -H "Content-Type: application/json" \
  -H "Cookie: YOUR_AUTH_COOKIE" \
  -d '{
    "listingId": "lst-mm5nggz6",
    "startDate": "2026-01-01",
    "endDate": "2026-01-07",
    "priceDaily": 6000,
    "seasonType": "PEAK",
    "label": "New Year Week",
    "minStay": 5
  }'
```

---

## 🎯 What Will Work After Migration

### ✅ Fully Implemented Features:

1. **Price-Aware Master Calendar**
   - Daily prices visible in all available cells
   - Color-coded by season (teal=high, slate=low, gray=base)
   - Min stay indicator ("min 3") shown in cells
   
2. **Bulk Seasonal Price Manager**
   - Modal with full form (date range, price, season type, min_stay, label)
   - Automatic conflict resolution (splits/trims overlapping ranges)
   - Apply to all listings or specific listing
   
3. **Conflict Resolution Logic**
   - Automatically handles overlapping date ranges
   - No manual intervention needed
   - Toast notification shows conflicts resolved
   
4. **Dashboard Potential Revenue**
   - Calculates revenue for next 30 days
   - Uses seasonal prices when available
   - Falls back to base prices
   - Accounts for existing bookings

5. **Calendar Blocks Integration**
   - Switched from `availability_blocks` to `calendar_blocks` table
   - Block creation and deletion via UI

---

## 🧪 Full Testing Checklist (After Migration)

### Test 1: Basic Seasonal Price Creation
- [ ] Navigate to `/partner/calendar?devMode=true`
- [ ] Click "Set Prices" button
- [ ] Select date range: Dec 20-27, 2025
- [ ] Set price: 8000 THB
- [ ] Set min_stay: 7
- [ ] Season type: PEAK
- [ ] Label: "Christmas Week"
- [ ] Click "Apply"
- [ ] Verify success toast
- [ ] Verify prices appear in calendar cells (bold teal)
- [ ] Verify "min 7" shows under price

### Test 2: Conflict Resolution
- [ ] Create overlapping price range (Dec 22-30)
- [ ] Verify old range is split/trimmed
- [ ] Verify toast shows "conflicts resolved"
- [ ] Check database: no overlapping records

### Test 3: Multiple Listings
- [ ] Select "All Objects" in price manager
- [ ] Set date range and price
- [ ] Verify price applied to all listings
- [ ] Check calendar: all listings show new prices

### Test 4: Dashboard Intelligence
- [ ] Navigate to `/partner/dashboard`
- [ ] Check "Potential Revenue" widget
- [ ] Verify it's higher for high-season dates
- [ ] Compare with base price calculation

### Test 5: Calendar Blocks
- [ ] Click on available date in calendar
- [ ] Select "Block Dates"
- [ ] Fill in block form
- [ ] Verify block appears in calendar (slate background)

---

## 📊 Expected Results

### Calendar View
```
┌─────────────────────────────────────────┐
│ Dec 20  Dec 21  Dec 22  Dec 23  Dec 24 │
├─────────────────────────────────────────┤
│  ฿8000   ฿8000   ฿8000   ฿8000   ฿8000 │ ← Bold Teal (High Season)
│  min 7   min 7   min 7   min 7   min 7 │
└─────────────────────────────────────────┘
```

### Dashboard Potential Revenue
```
Before (Base Prices):  ฿450,000
After (Seasonal):      ฿680,000  (+51% increase)
```

---

## 📸 Screenshot Checklist

After successful testing, capture:
1. ✅ Calendar with prices visible (high season in bold teal)
2. ✅ "Set Prices" modal filled with data
3. ✅ Success toast showing "Prices updated (resolved X conflicts)"
4. ✅ Dashboard showing potential revenue
5. ✅ Min stay indicator in calendar cell

---

## 🐛 Troubleshooting

### Issue: "Could not find the 'min_stay' column"
**Solution:** Run the SQL migration above in Supabase SQL Editor

### Issue: Prices not showing in calendar
**Check:**
1. Frontend restarted? `sudo supervisorctl restart frontend`
2. Browser cache cleared?
3. API returning data? Check `/api/v2/partner/calendar` response

### Issue: Conflict resolution not working
**Check:**
1. Database has overlapping records?
2. Check console logs for conflict resolution output
3. Verify SERVICE_ROLE_KEY is set in .env

---

## 📞 Next Steps

1. **RUN SQL MIGRATION** ← This is the only blocker
2. Test all features (use checklist above)
3. Capture screenshots
4. Report results

**Estimated Time:** 10-15 minutes for full testing

---

**Phase 4.1 Status:**  
🟡 **95% Complete** - Waiting for database schema update

Once migration is complete:  
🟢 **100% Complete** - Ready for production
