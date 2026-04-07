/**
 * GoStayLo - Geo Detection API
 * GET /api/v2/geo - Detect user's location and recommended currency
 * Конвертация примера: единый курс из CurrencyService (`getDisplayRateMap`), без отдельного ForexService.
 */

import { NextResponse } from 'next/server'
import { GeoService } from '@/lib/services/geo.service'
import { getDisplayRateMap } from '@/lib/services/currency.service'
import { formatPrice, getCurrencyDisplayMeta } from '@/lib/currency'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      request.headers.get('cf-connecting-ip')

    const geoResult = await GeoService.detectLocation(ip)

    const recommendedCurrency = geoResult.recommendedCurrency
    const currencyInfo = getCurrencyDisplayMeta(recommendedCurrency)

    const rateMap = await getDisplayRateMap()
    const sampleThb = 10000
    const r = rateMap[recommendedCurrency]
    const canConvert =
      recommendedCurrency === 'THB' ||
      (r != null && Number.isFinite(Number(r)) && Number(r) > 0)
    const formatted = canConvert
      ? formatPrice(sampleThb, recommendedCurrency, rateMap, 'en')
      : formatPrice(sampleThb, 'THB', rateMap, 'en')

    return NextResponse.json({
      success: geoResult.success,
      location: {
        country: geoResult.country,
        countryCode: geoResult.countryCode,
        city: geoResult.city,
        region: geoResult.region,
        timezone: geoResult.timezone,
      },
      currency: {
        code: recommendedCurrency,
        symbol: currencyInfo.symbol,
        name: currencyInfo.name,
        flag: currencyInfo.flag,
      },
      sample: {
        thb: sampleThb,
        formatted,
      },
      cached: geoResult.cached || false,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[GEO API ERROR]', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        currency: {
          code: 'USD',
          symbol: '$',
          name: 'US Dollar',
          flag: '🇺🇸',
        },
      },
      { status: 200 },
    )
  }
}
