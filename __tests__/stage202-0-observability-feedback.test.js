/**
 * Stage 202.0 — observability + feedback surface guards.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage202-0-observability-feedback.test.js
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

function read(rel) {
  return readFileSync(join(root, rel), 'utf8')
}

describe('Stage 202.0 — Sentry scrub + TG bridge', () => {
  it('DSN empty → init options disabled', async () => {
    const prevS = process.env.SENTRY_DSN
    const prevP = process.env.NEXT_PUBLIC_SENTRY_DSN
    delete process.env.SENTRY_DSN
    delete process.env.NEXT_PUBLIC_SENTRY_DSN
    try {
      const { resolveSentryDsn, isSentryConfigured } = await import('../lib/observability/sentry-dsn.js')
      const { buildSentryInitOptions } = await import('../lib/observability/sentry-init-options.js')
      assert.equal(resolveSentryDsn(), '')
      assert.equal(isSentryConfigured(), false)
      const opts = buildSentryInitOptions('client')
      assert.equal(opts.enabled, false)
      assert.equal(opts.tracesSampleRate, 0)
      assert.doesNotMatch(JSON.stringify(opts.integrations?.([]) || []), /Replay/i)
    } finally {
      if (prevS != null) process.env.SENTRY_DSN = prevS
      else delete process.env.SENTRY_DSN
      if (prevP != null) process.env.NEXT_PUBLIC_SENTRY_DSN = prevP
      else delete process.env.NEXT_PUBLIC_SENTRY_DSN
    }
  })

  it('scrubs deny-list query keys and emails', async () => {
    const { scrubSentryUrl, scrubSentryEvent, isSentryEventChunkNoise } = await import(
      '../lib/observability/sentry-scrub.js'
    )
    const url = scrubSentryUrl('https://airento.ru/checkout?token=abc&txid=1&ok=1')
    assert.match(url, /token=%5BREDACTED%5D|token=\[REDACTED\]/)
    assert.match(url, /txid=%5BREDACTED%5D|txid=\[REDACTED\]/)
    assert.match(url, /ok=1/)

    const event = scrubSentryEvent({
      message: 'fail for user@example.com',
      request: {
        url: 'https://x/y?wallet=0xdead',
        headers: { authorization: 'Bearer x', 'content-type': 'application/json' },
        data: { amount: 1 },
      },
      user: { email: 'a@b.co', id: 'u1' },
    })
    assert.match(String(event.message), /REDACTED_EMAIL/)
    assert.equal(event.request.headers.authorization, '[REDACTED]')
    assert.equal(event.request.data, '[REDACTED_BODY]')
    assert.equal(event.user.email, '[REDACTED_EMAIL]')

    assert.equal(
      isSentryEventChunkNoise(
        { exception: { values: [{ type: 'ChunkLoadError', value: 'Loading chunk 5 failed' }] } },
        {},
      ),
      true,
    )
  })

  it('telegram bridge skips chunk noise and respects fingerprint cooldown', async () => {
    const {
      shouldNotifySentryTelegram,
      allowSentryTelegramFingerprint,
      buildSentryTelegramFingerprint,
    } = await import('../lib/observability/sentry-telegram-bridge.js')

    assert.equal(
      shouldNotifySentryTelegram(
        {
          level: 'error',
          exception: { values: [{ type: 'ChunkLoadError', value: 'Loading chunk failed' }] },
        },
        {},
      ),
      false,
    )

    const event = {
      level: 'error',
      exception: { values: [{ type: 'TypeError', value: 'x is not a function' }] },
      request: { url: 'https://airento.ru/listings/' },
    }
    assert.equal(shouldNotifySentryTelegram(event, {}), true)
    const fp = buildSentryTelegramFingerprint(event)
    const t0 = 1_000_000
    assert.equal(allowSentryTelegramFingerprint(fp, t0), true)
    assert.equal(allowSentryTelegramFingerprint(fp, t0 + 60_000), false)
    assert.equal(allowSentryTelegramFingerprint(fp, t0 + 5 * 60_000 + 1), true)
  })

  it('wiring: captureException + no Replay + notifySystemAlert [SENTRY]', () => {
    const boundary = read('components/product/AppErrorBoundaryView.jsx')
    assert.match(boundary, /Sentry\.captureException/)
    const globalErr = read('app/global-error.js')
    assert.match(globalErr, /Sentry\.captureException/)
    const init = read('lib/observability/sentry-init-options.js')
    assert.match(init, /Replay|Profiling/)
    assert.match(init, /tracesSampleRate:\s*enabled\s*\?\s*0\.05/)
    const bridge = read('lib/observability/sentry-telegram-bridge.js')
    assert.match(bridge, /\[SENTRY\]/)
    assert.match(bridge, /notifySystemAlert/)
    assert.match(bridge, /isSentryEventChunkNoise/)
    const instr = read('instrumentation.js')
    assert.match(instr, /sentry\.server\.config/)
    assert.match(instr, /onRequestError/)
  })
})

describe('Stage 202.0 — feedback surface', () => {
  it('CTA on home footer + help; currency + feedback topic', async () => {
    const home = read('components/PlatformHomeContent.jsx')
    assert.match(home, /ProductFeedbackCta/)
    const help = read('components/help/HelpContent.jsx')
    assert.match(help, /ProductFeedbackCta/)
    assert.match(help, /mailto:/)

    const tg = read('lib/services/notifications/telegram.service.js')
    assert.match(tg, /TELEGRAM_USER_FEEDBACK_TOPIC_ID/)
    assert.match(tg, /resolveSystemAlertThreadId/)
    assert.match(tg, /userFeedbackTopic/)

    const deliver = read('lib/feedback/submit-product-feedback.js')
    assert.match(deliver, /userFeedbackTopic:\s*true/)
    assert.match(deliver, /currency/)

    const {
      normalizeProductFeedbackCurrency,
      validateProductFeedbackBody,
    } = await import('../lib/feedback/product-feedback-options.js')
    assert.equal(normalizeProductFeedbackCurrency('rub'), 'RUB')
    assert.equal(normalizeProductFeedbackCurrency('HACK'), null)
    const ok = validateProductFeedbackBody(
      {
        category: 'idea',
        details: 'Need a darker map popup contrast please',
        currency: 'USD',
        language: 'en',
      },
      { userId: 'u1', email: null, role: 'RENTER' },
    )
    assert.equal(ok.ok, true)
    assert.equal(ok.payload.currency, 'USD')
  })
})

describe('Stage 202.0-C — PostHog opt-in smoke (no refactor)', () => {
  it('ProductAnalyticsInit + product-analytics keep key gate', () => {
    const init = read('components/analytics/ProductAnalyticsInit.jsx')
    assert.match(init, /initProductAnalytics/)
    assert.match(init, /PAGE_VIEW/)
    const analytics = read('lib/analytics/product-analytics.js')
    assert.match(analytics, /NEXT_PUBLIC_POSTHOG_KEY/)
    assert.match(analytics, /analyticsEnabled/)
    assert.match(analytics, /capture_pageview:\s*false/)
    assert.doesNotMatch(analytics, /clarity|yandex|metrika/i)
  })
})
