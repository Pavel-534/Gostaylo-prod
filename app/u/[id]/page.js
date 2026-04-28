/**
 * Посадочная `/u/[id]` — регион по заголовку Vercel (IP/country); пример дохода в локальной валюте —
 * иллюстрация через mid-market карту без розничной надбавки (`referralFair` parity с `?retail=0`).
 */

import { headers } from 'next/headers'
import { formatPrice } from '@/lib/currency'
import PublicUserProfileClient from './PublicUserProfileClient'
import { countryCodeToSuggestedCurrency } from '@/lib/finance/country-to-currency'
import { getReferralFairRateMapCached } from '@/lib/finance/currency-converter'

const DEMO_AMBASSADOR_MONTH_EXAMPLE_THB = 15000

export default async function PublicUserLandingPage() {
  const h = headers()
  const countryRaw = String(h.get('x-vercel-ip-country') || h.get('cf-ipcountry') || '').trim()
  const suggested = countryCodeToSuggestedCurrency(countryRaw ? countryRaw.slice(0, 2) : '')

  const landingEarningPreview = {
    ledgerBaseCurrency: 'THB',
    exampleAmountThb: DEMO_AMBASSADOR_MONTH_EXAMPLE_THB,
    visitorCurrencyCode: null,
    formattedConverted: null,
    formattedThbBaseline: formatPrice(DEMO_AMBASSADOR_MONTH_EXAMPLE_THB, 'THB', { THB: 1 }, 'en'),
  }

  try {
    if (suggested && suggested !== 'THB') {
      const map = await getReferralFairRateMapCached()
      const rate = map?.[suggested]
      if (Number.isFinite(rate) && rate > 0) {
        landingEarningPreview.visitorCurrencyCode = suggested
        landingEarningPreview.formattedConverted = formatPrice(DEMO_AMBASSADOR_MONTH_EXAMPLE_THB, suggested, map, 'en')
        landingEarningPreview.formattedThbBaseline = formatPrice(
          DEMO_AMBASSADOR_MONTH_EXAMPLE_THB,
          'THB',
          { THB: 1 },
          'en',
        )
      }
    }
  } catch (e) {
    console.warn('[u/landing FX]', e?.message || e)
  }

  return <PublicUserProfileClient visitorCountry={countryRaw} landingEarningPreview={landingEarningPreview} />
}
