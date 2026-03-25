/**
 * Gostaylo - Rate Limiter
 * In-memory rate limiting for auth, search, and booking APIs
 * For production at scale: use Upstash Redis or Vercel KV
 */

const store = new Map();
const CLEANUP_INTERVAL = 60 * 1000; // 1 min

// Config per endpoint type
export const RATE_LIMITS = {
  auth: { windowMs: 15 * 60 * 1000, max: 10 },      // 10 req / 15 min
  search: { windowMs: 60 * 1000, max: 60 },        // 60 req / min
  booking: { windowMs: 60 * 1000, max: 20 },       // 20 req / min
  /** Тяжёлый парсинг внешних листингов (Apify / Playwright) */
  partner_import: { windowMs: 60 * 1000, max: 8 },
  default: { windowMs: 60 * 1000, max: 100 }
};

function getClientKey(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ip = forwarded?.split(',')[0]?.trim() || realIp || 'unknown';
  return ip;
}

function cleanup() {
  const now = Date.now();
  for (const [key, data] of store.entries()) {
    if (data.expiresAt < now) store.delete(key);
  }
}

let lastCleanup = Date.now();
if (typeof setInterval !== 'undefined') {
  setInterval(cleanup, CLEANUP_INTERVAL);
}

/**
 * Check rate limit. Returns { allowed: boolean, remaining: number, retryAfter?: number }
 */
export function checkRateLimit(request, type = 'default') {
  const config = RATE_LIMITS[type] || RATE_LIMITS.default;
  const key = `${type}:${getClientKey(request)}`;
  const now = Date.now();
  const windowStart = now - config.windowMs;

  let data = store.get(key);
  if (!data || data.expiresAt < now) {
    data = { count: 0, expiresAt: now + config.windowMs };
    store.set(key, data);
  }

  // Reset if window expired
  if (data.expiresAt < now) {
    data.count = 0;
    data.expiresAt = now + config.windowMs;
  }

  data.count++;
  const remaining = Math.max(0, config.max - data.count);
  const allowed = data.count <= config.max;

  if (Date.now() - lastCleanup > CLEANUP_INTERVAL) {
    cleanup();
    lastCleanup = Date.now();
  }

  return {
    allowed,
    remaining,
    limit: config.max,
    retryAfter: allowed ? undefined : Math.ceil((data.expiresAt - now) / 1000)
  };
}

/**
 * Returns { limited: true, status: 429, body, headers } if rate limited, null otherwise
 */
export function rateLimitCheck(request, type = 'default') {
  const result = checkRateLimit(request, type);
  if (!result.allowed) {
    return {
      limited: true,
      status: 429,
      body: {
        success: false,
        error: 'Too many requests. Please try again later.',
        retryAfter: result.retryAfter
      },
      headers: {
        'Retry-After': String(result.retryAfter || 60),
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': '0'
      }
    };
  }
  return null;
}
