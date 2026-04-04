# 💰 Payment Infrastructure - Ready for Production

**Status:** ⚠️ **PARTIALLY IMPLEMENTED** - Core structure exists, requires live API keys

**Last Updated:** March 17, 2026
**Platform:** Gostaylo Premium Rentals

---

## 📊 Executive Summary

### Payment Methods Supported:
1. **USDT TRC-20** (Crypto) - ✅ **LIVE API connected**
2. **Visa/Mastercard** (Stripe) - ⚠️ **Mock/Placeholder**
3. **MIR Cards** (Russian) - ⚠️ **Mock/Placeholder**
4. **Thai QR** (PromptPay) - ⚠️ **Mock/Placeholder**

### Security Status:
- ✅ Server-side price calculation (tamper-proof)
- ✅ TRON blockchain verification (live API)
- ✅ Escrow system implemented
- ⚠️ Stripe integration needs real API keys

---

## 🏗️ Architecture Overview

### Core Files:

#### 1. Payment Service (`/app/lib/services/payment.service.js`)
**Status:** ✅ **PRODUCTION-READY**
- Lines: 713
- Features:
  - Initialize payments
  - Verify crypto transactions
  - Escrow balance calculation
  - Payout management
  - Admin payment confirmation/rejection

**Key Functions:**
```javascript
PaymentService.initializePayment(bookingId, method, currency)
PaymentService.verifyCryptoPayment(bookingId, txid, expectedAmount)
PaymentService.submitTxid(bookingId, txid, paymentMethod)
PaymentService.confirmPayment(paymentId, verificationData)
```

#### 2. TRON Service (`/app/lib/services/tron.service.js`)
**Status:** ✅ **LIVE API CONNECTED**
- Lines: 332
- API: `https://apilist.tronscan.org/api/transaction-info`
- Wallet: `TXyfMKVxUNFkC8Q77GnbAqgnWFUWVaKwZ5`
- Contract: `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t` (USDT TRC-20)

**Verification Logic:**
- ✅ Confirms transaction on blockchain
- ✅ Validates recipient address
- ✅ Checks amount with 0.5% tolerance
- ✅ Ensures successful execution (`SUCCESS` status)

#### 3. Payment APIs (`/app/app/api/v2/`)
**Status:** ✅ **Functional**

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/api/v2/payments/route.js` | GET/POST | List, confirm, reject payments | ✅ Working |
| `/api/v2/payments/submit-txid/route.js` | POST | Submit TRON transaction ID | ✅ Working |
| `/api/v2/payments/verify-tron/route.js` | POST | Verify TRON transaction | ✅ Working |
| `/api/v2/bookings/[id]/payment/initiate/route.js` | POST | Initialize payment | ⚠️ Stripe mock |
| `/api/v2/bookings/[id]/payment/confirm/route.js` | POST | Confirm payment | ✅ Working |
| `/api/webhooks/crypto/confirm/route.js` | POST | Webhook for crypto confirmation | ✅ Working |

---

## 🔒 Security Analysis

### Price Tampering Prevention:

#### ✅ **SECURE:** Server-Side Calculation
**File:** `/app/lib/services/payment.service.js:72`
```javascript
amount: booking.price_paid || booking.price_thb,
```

**File:** `/app/app/api/v2/bookings/[id]/payment/initiate/route.js:60-64`
```javascript
const priceThb = parseFloat(booking.price_thb);  // ✅ From DATABASE
const commissionRate = 15;
const serviceFee = priceThb * (commissionRate / 100);
const totalThb = priceThb + serviceFee;
const totalUsdt = (totalThb / USDT_TO_THB_RATE).toFixed(2);
```

**Conclusion:** ✅ **SECURE** - All prices calculated server-side from booking DB record. Frontend cannot manipulate.

### TRON Verification:

**File:** `/app/lib/services/tron.service.js:35-332`

**Verification Steps:**
1. ✅ Fetch transaction from TronScan API
2. ✅ Validate TXID format (64 chars)
3. ✅ Confirm recipient = `GOSTAYLO_WALLET`
4. ✅ Verify contract = USDT TRC-20
5. ✅ Check amount matches (0.5% tolerance)
6. ✅ Ensure status = `SUCCESS`

**Conclusion:** ✅ **PRODUCTION-GRADE** - Live blockchain verification, not mockable.

---

## ⚠️ What's MOCK vs REAL

### ✅ REAL (Production-Ready):

1. **TRON/USDT Verification**
   - File: `/app/lib/services/tron.service.js`
   - API: `https://apilist.tronscan.org` (LIVE)
   - Wallet: `TXyfMKVxUNFkC8Q77GnbAqgnWFUWVaKwZ5` (REAL)
   - Status: ✅ **WORKING**

2. **Payment Database Schema**
   - Table: `payments`
   - Columns: `id`, `booking_id`, `amount`, `currency`, `method`, `status`, `tx_id`, `metadata`
   - Status: ✅ **WORKING**

3. **Escrow Logic**
   - File: `/app/lib/services/payment.service.js:547-597`
   - Function: `calculatePartnerBalance()`
   - Status: ✅ **WORKING**

### ⚠️ MOCK (Placeholder):

1. **Stripe Integration**
   - File: `/app/app/api/v2/bookings/[id]/payment/initiate/route.js:89-94`
   - Line 92: `checkoutUrl: 'https://checkout.stripe.com/mock/${paymentId}'`
   - **Action Required:** Replace with real Stripe Checkout Session API

2. **MIR Gateway**
   - Line 114: `gateway: 'RU_GATEWAY'`
   - **Action Required:** Integrate real Russian payment processor

3. **Thai QR (PromptPay)**
   - Line 119: `redirectUrl: '/checkout/${bookingId}/pay-qr'`
   - **Action Required:** Generate real PromptPay QR codes

---

## 🚀 Integration Checklist

### TRON/USDT (LIVE) ✅
- [x] Wallet address configured
- [x] TronScan API integrated
- [x] Amount verification working
- [x] Transaction history tracking
- [x] Admin verification flow

### Stripe (TODO) ⚠️
- [ ] Install `stripe` npm package: `yarn add stripe`
- [ ] Get Stripe API keys from dashboard.stripe.com
- [ ] Add to `/app/.env`:
  ```
  STRIPE_SECRET_KEY=sk_live_...
  STRIPE_WEBHOOK_SECRET=whsec_...
  ```
- [ ] Replace mock in `payment/initiate/route.js`:
  ```javascript
  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{ price_data: { ... }, quantity: 1 }],
    mode: 'payment',
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/booking/${bookingId}/success`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/booking/${bookingId}`,
    metadata: { bookingId }
  });
  ```
- [ ] Create webhook endpoint `/api/webhooks/stripe` for `checkout.session.completed`
- [ ] Update booking status on successful payment

### MIR Cards (TODO) ⚠️
- [ ] Choose Russian payment processor (e.g., YooKassa, Tinkoff)
- [ ] Get API credentials
- [ ] Add to `/app/.env`
- [ ] Implement gateway in `payment/initiate/route.js`

### Thai QR (TODO) ⚠️
- [ ] Integrate PromptPay QR generation
- [ ] Add Thai bank account details
- [ ] Implement QR code generation library
- [ ] Create `/checkout/[bookingId]/pay-qr` page

---

## 💡 How Payment Flow Works

### 1. User Creates Booking
**File:** `/app/app/api/v2/bookings/route.js`
- Booking created with status `PENDING`
- `price_thb` calculated server-side from listing + dates

### 2. User Initiates Payment
**File:** `/app/app/api/v2/bookings/[id]/payment/initiate/route.js`
- Calculates `total_price_thb` = `price_thb` + `service_fee` (15%)
- For CRYPTO: Converts to USDT, returns wallet address
- For CARD: Creates Stripe session (currently mocked)
- Booking status → `AWAITING_PAYMENT`

### 3. User Pays
**CRYPTO:**
- User sends USDT to `TXyfMKVxUNFkC8Q77GnbAqgnWFUWVaKwZ5`
- User submits TXID via `/api/v2/payments/submit-txid`
- Admin notified via Telegram Finance thread

**CARD:**
- User redirected to Stripe checkout
- Stripe webhook confirms payment
- Booking status → `CONFIRMED`

### 4. Admin Verifies (CRYPTO only)
**File:** `/app/app/admin/finances/page.js`
- Admin sees pending payments
- Clicks "Verify" → calls `/api/v2/payments/verify-tron`
- TRON service checks blockchain
- If valid: Booking status → `CONFIRMED`, Partner escrow updated

### 5. Escrow & Payouts
**File:** `/app/lib/services/payment.service.js:547-630`
- Confirmed payments go to escrow
- Partner can request payout
- Admin processes payout (manual or automated)

---

## 🎯 Critical Security Points

### ✅ SECURE:
1. **Price Source:** Always from `bookings.price_thb` (DB), never client
2. **Crypto Verification:** Live blockchain check, not trust-based
3. **Escrow:** Payments held until booking completion
4. **Role-Based Access:** Only admins can confirm/reject payments

### ⚠️ TODO:
1. **Stripe Webhook Verification:** Add signature validation
2. **Rate Limiting:** Prevent payment spam (e.g., 100 TXIDs/hour)
3. **TXID Uniqueness:** Prevent double-spend (same TXID for multiple bookings)
   - **Current:** Not enforced
   - **Fix:** Add unique constraint on `payments.tx_id`

---

## 📝 Quick Start for New Developer

### Testing TRON Payment:
1. Create a booking via `/api/v2/bookings`
2. Note `booking_id` and `price_thb`
3. Call `/api/v2/bookings/[id]/payment/initiate` with `method: 'CRYPTO'`
4. Get wallet address: `TXyfMKVxUNFkC8Q77GnbAqgnWFUWVaKwZ5`
5. Send USDT (testnet or real)
6. Submit TXID: `/api/v2/payments/submit-txid`
7. Admin verifies via dashboard or call `/api/v2/payments/verify-tron`

### Integrating Stripe:
1. Install: `yarn add stripe`
2. Get keys: https://dashboard.stripe.com/test/apikeys
3. Add to `.env`:
   ```
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```
4. Replace lines 88-94 in `/app/app/api/v2/bookings/[id]/payment/initiate/route.js`
5. Create webhook: `/app/app/api/webhooks/stripe/route.js`
6. Test with Stripe test cards

---

## 🔍 Monitoring & Logs

### Where to Check:
- **Payment Records:** `SELECT * FROM payments ORDER BY created_at DESC;`
- **Pending Payments:** `/api/v2/payments?pending=true`
- **Escrow Balances:** Partner dashboard `/partner/finances`
- **Telegram Alerts:** Finance thread (auto-notifies on payment submission)

### Admin Dashboard:
- **Finances Page:** `/app/app/admin/finances/page.js`
- **Pending Payments Badge:** Real-time count
- **Verification Button:** Manual TRON verification
- **Payout Management:** Approve/reject partner payouts

---

## ✅ Final Checklist

**Before Going Live:**
- [x] TRON verification tested with real transactions
- [x] Price tampering prevention verified
- [x] Escrow calculations tested
- [ ] Stripe integrated and tested
- [ ] Webhook signatures verified
- [ ] TXID uniqueness constraint added to DB
- [ ] Rate limiting implemented
- [ ] Payment reconciliation process documented
- [ ] Refund flow implemented (if needed)

---

## 🆘 Troubleshooting

### "Payment not found"
- Check `payments` table for `booking_id`
- Verify `/api/v2/bookings/[id]/payment/initiate` was called

### "TRON verification failed"
- Check TXID is 64 characters
- Verify amount matches (within 0.5%)
- Ensure recipient is `TXyfMKVxUNFkC8Q77GnbAqgnWFUWVaKwZ5`
- Confirm TronScan API is reachable

### "Escrow balance incorrect"
- Recalculate via `/api/v2/partner/finances`
- Check booking statuses (only `CONFIRMED`/`COMPLETED` count)
- Verify payout records are not double-counted

---

**Status:** ✅ Core infrastructure production-ready. Stripe integration is the main TODO.

**Contact:** For payment issues, check Telegram Finance thread or admin dashboard.
