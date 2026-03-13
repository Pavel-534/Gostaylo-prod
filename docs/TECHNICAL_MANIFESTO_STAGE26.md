# Gostaylo — Technical Manifesto (Stage 26)

> **Generated**: 2026-03-02T15:01:00Z | **Webhook Version**: 5.4 | **Status**: OPERATIONAL

---

## 1. DATABASE SCHEMA

### 1.1 Price Column (CRITICAL)

| Column Name | Status | Evidence |
|-------------|--------|----------|
| `base_price_thb` | ✅ **EXISTS** | Returns `35000.00` |
| `base_price` | ❌ **DOES NOT EXIST** | Error 42703 |

```sql
-- CORRECT usage:
INSERT INTO listings (base_price_thb) VALUES (35000);

-- WRONG (will fail):
INSERT INTO listings (base_price) VALUES (35000);  -- Error 42703
```

### 1.2 ID Column Types

| Table | ID Format | Type |
|-------|-----------|------|
| `listings` | `lst-f2b62ebd`, `lst-mm5nggz6` | **TEXT** (custom prefix) |
| `profiles` | `partner-1`, `admin-777` | **TEXT** (custom prefix) |
| `bookings` | `b-5024cd03`, `b-c8f894ce` | **TEXT** (custom prefix) |
| `categories` | `1`, `2`, `3` | **TEXT** (numeric string) |

**Pattern**: `{prefix}-{random_alphanumeric}`
- Listings: `lst-{hash}`
- Profiles: `{role}-{number}` or `{uuid}`
- Bookings: `b-{hash}`

**NOT using**: UUID, BigInt, Serial

---

## 2. MIDDLEWARE STATUS

### Current State: **NO MIDDLEWARE FILE**

```
/app/middleware.js  → DOES NOT EXIST
/app/middleware.ts  → DOES NOT EXIST
```

### Implications:
- ✅ `/api/webhooks/telegram` is **PUBLIC** (no auth required)
- ✅ All API routes use Next.js App Router default behavior
- ✅ Auth is handled per-route via Supabase session checks

### Webhook Route Config:
```javascript
// /app/api/webhooks/telegram/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
```

---

## 3. SUPABASE STATUS

### 3.1 Service Role Key

| Property | Value |
|----------|-------|
| Status | ✅ **ACTIVE** |
| Role | `service_role` |
| Issued (iat) | `1772029135` (2026-02-26) |
| Expires (exp) | `2087605135` (2036-02-26) |

**Key Prefix**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

### 3.2 Anon Key
- Status: ✅ ACTIVE
- Used for: Client-side queries, public data access

### 3.3 Project Details
- URL: `https://vtzzcdsjwudkaloxhvnw.supabase.co`
- Region: Default
- Storage: Enabled (for listing images)

---

## 4. TELEGRAM WEBHOOK STATUS

### 4.1 Health Check Response

```json
{
  "ok": true,
  "service": "Gostaylo Telegram Webhook",
  "version": "5.4",
  "runtime": "nodejs",
  "pattern": "immediate-response-async-processing",
  "commands": ["/start", "/help", "/link <email>", "/status"],
  "features": ["Lazy Realtor (photo → draft)"],
  "db_column": "base_price_thb",
  "app_url": "https://funnyrent.vercel.app"
}
```

### 4.2 Recent Logs (Success)

```
[WEBHOOK v5.4] Chat: 12345, User: Test, Text: /start
POST /api/webhooks/telegram 200 in 2451ms
```

### 4.3 Commands Status

| Command | Status | Function |
|---------|--------|----------|
| `/start` | ✅ Working | Welcome message |
| `/help` | ✅ Working | Instructions |
| `/link <email>` | ✅ Working | Links Telegram to profile |
| `/status` | ✅ Working | Shows link status |
| Photo upload | ✅ Working | Creates draft listing |

---

## 5. ENVIRONMENT VARIABLES

### Required for Telegram:
```bash
TELEGRAM_BOT_TOKEN=8702569258:AAFuj-Ob9otOVf6KiABQSiiWC0-8_KvkFqM
TELEGRAM_ADMIN_GROUP_ID=-1003832026983
```

### Required for Supabase:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://vtzzcdsjwudkaloxhvnw.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### Optional (Currently Empty):
```bash
RESEND_API_KEY=  # Email notifications (mock mode)
```

---

## 6. DEPLOYMENT STATUS

### Preview Environment
- URL: `https://gostaylo-502-fix.preview.emergentagent.com`
- Status: ✅ Running
- Frontend: Running on port 3000

### Vercel Production
- URL: `https://funnyrent.vercel.app`
- Webhook URL: `https://funnyrent.vercel.app/api/webhooks/telegram`

---

## 7. KNOWN ISSUES & WORKAROUNDS

| Issue | Workaround | Status |
|-------|------------|--------|
| Kubernetes 502 on some API routes | Direct Supabase REST calls | PERMANENT |
| Edge runtime timeouts | Use `runtime: 'nodejs'` | FIXED in v5.4 |
| Email notifications | Falls back to console.log | RESEND_API_KEY needed |

---

## 8. QUICK REFERENCE

### Create Listing via Telegram (Lazy Realtor):
1. User sends photo with caption
2. Bot extracts title (first line) and price (regex: `/\d+\s*(thb|бат|฿)/i`)
3. Creates listing with `status: 'DRAFT'`, `base_price_thb: {price}`
4. Sends confirmation with link to dashboard

### Link Account:
1. User sends `/link email@example.com`
2. Bot finds profile by email
3. Updates `telegram_id`, `telegram_username`, `telegram_linked_at`
4. Sends confirmation

---

**END OF TECHNICAL MANIFESTO — Stage 26**
