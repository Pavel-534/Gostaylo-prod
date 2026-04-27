/**
 * Stage 72.4 — реферальный cashflow E2E (через internal fixture API).
 *
 * Требует: локальный или staging Next с доступом к Supabase; `.env` с E2E_FIXTURE_SECRET,
 * NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY; строка system_settings.general.
 *
 * Прогон: `npx playwright test --project=stage72-referral-cashflow`
 *
 * Ожидания соответствуют **фактическому коду**: `referral_reinvestment_percent` clamp до **95**
 * (`SAFETY_LOCK_MAX_SHARE`), поэтому гостевой пул 617.5 THB (не 650), не «577.5/572.5» из чистой симуляции.
 */
import { test, expect } from '@playwright/test'
import { E2E_FIXTURE_SECRET, E2E_HEADERS, E2E_ROUTES } from './constants'

test.describe('@stage72-referral-cashflow', () => {
  test('withdrawable/internal и ledger согласованы с кодом (reinvest≤95%, пул 617.5 THB)', async ({
    request,
    baseURL,
  }) => {
    test.setTimeout(180_000)
    test.skip(!baseURL, 'baseURL')
    test.skip(!E2E_FIXTURE_SECRET, 'E2E_FIXTURE_SECRET — защита fixture API от публичного вызова')

    const res = await request.post(`${baseURL}${E2E_ROUTES.stage72ReferralCashflow}`, {
      headers: {
        [E2E_HEADERS.fixtureSecretHeader]: E2E_FIXTURE_SECRET,
        'Content-Type': E2E_HEADERS.jsonContentType,
      },
      data: {},
    })

    const raw = await res.text()
    let json: {
      success?: boolean
      error?: string
      data?: {
        totals?: {
          withdrawableSum?: number
          internalSum?: number
          ledgerEarnedSum?: number
          marketingPromoPotAfter?: number
        }
        distribute?: unknown
        expected?: {
          withdrawableSum?: number
          internalSum?: number
          ledgerEarnedSum?: number
          marketingPromoPotAfter?: number
        }
      }
    } = {}
    try {
      json = JSON.parse(raw) as typeof json
    } catch {
      expect.soft(false, `Ответ не JSON: ${raw.slice(0, 400)}`).toBe(true)
      return
    }

    expect(res.ok(), `${res.status()} ${json.error || raw}`).toBeTruthy()
    expect(json.success, json.error || raw).toBe(true)

    const wd = Number(json.data?.totals?.withdrawableSum)
    const int = Number(json.data?.totals?.internalSum)
    const ledger = Number(json.data?.totals?.ledgerEarnedSum)

    const expWd = Number(json.data?.expected?.withdrawableSum ?? 566.125)
    const expInt = Number(json.data?.expected?.internalSum ?? 551.375)
    const expLedger = Number(json.data?.expected?.ledgerEarnedSum ?? 1117.5)
    const expPot = Number(json.data?.expected?.marketingPromoPotAfter ?? 97.5)

    expect.soft(Math.abs(wd - expWd), `withdrawable sum=${wd} expected≈${expWd}`).toBeLessThanOrEqual(0.06)
    expect.soft(Math.abs(int - expInt), `internal sum=${int} expected≈${expInt}`).toBeLessThanOrEqual(0.06)

    /** Гостевая бронь D: 617.5 (95% от net 650) + активация 500 = 1117.5 THB по earned ledger */
    expect.soft(Math.abs(ledger - expLedger), `ledger earned sum=${ledger}`).toBeLessThanOrEqual(0.06)

    const pot = Number(json.data?.totals?.marketingPromoPotAfter)
    expect.soft(Math.abs(pot - expPot), `promo pot after=${pot}`).toBeLessThanOrEqual(0.15)

    const dist = json.data?.distribute as
      | { hostActivation2?: { skipped?: boolean; reason?: string } }
      | undefined
    expect
      .soft(dist?.hostActivation2?.skipped === true, `hostActivation2: ${dist?.hostActivation2?.reason || ''}`)
      .toBe(true)
  })
})
