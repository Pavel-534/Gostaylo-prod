/**
 * Stage 116.0 — Product analytics MVP (PostHog primary, no-op fallback).
 * Не меняет экономику; события только для growth/воронки.
 */

const EVENTS = Object.freeze({
  PAGE_VIEW: 'page_view',
  SEARCH: 'search',
  LISTING_VIEW: 'listing_view',
  BOOKING_START: 'booking_start',
  PAYMENT_SUCCESS: 'payment_success',
  REFERRAL_CAPTURED: 'referral_captured',
  PARTNER_APPLY_SUBMIT: 'partner_apply_submit',
  LISTING_PUBLISH: 'listing_publish',
  GUEST_NEXT_STEPS_SHOWN: 'guest_next_steps_shown',
  GUEST_NEXT_STEPS_DISMISS: 'guest_next_steps_dismiss',
  CHECKOUT_ESCAPE_CLICK: 'checkout_escape_click',
  RECOMMENDATION_IMPRESSION: 'recommendation_impression',
  RECOMMENDATION_CLICK: 'recommendation_click',
})

let posthogPromise = null

function analyticsEnabled() {
  if (typeof window === 'undefined') return false
  const flag = String(process.env.NEXT_PUBLIC_ANALYTICS_ENABLED || 'true').toLowerCase()
  if (flag === '0' || flag === 'false' || flag === 'off') return false
  return Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY)
}

async function getPosthog() {
  if (!analyticsEnabled()) return null
  if (!posthogPromise) {
    posthogPromise = import('posthog-js')
      .then(({ default: posthog }) => {
        const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
        const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com'
        if (!key) return null
        if (!posthog.__loaded) {
          posthog.init(key, {
            api_host: host,
            capture_pageview: false,
            persistence: 'localStorage+cookie',
          })
        }
        return posthog
      })
      .catch(() => null)
  }
  return posthogPromise
}

/**
 * @param {string} eventName
 * @param {Record<string, unknown>} [properties]
 */
export async function trackProductEvent(eventName, properties = {}) {
  if (typeof window === 'undefined') return
  const ph = await getPosthog()
  if (ph) {
    ph.capture(eventName, properties)
    return
  }
  if (process.env.NODE_ENV !== 'production') {
    console.debug('[analytics]', eventName, properties)
  }
}

export async function initProductAnalytics() {
  await getPosthog()
}

export { EVENTS as ProductAnalyticsEvents }
