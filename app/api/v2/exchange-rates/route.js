/**
 * GoStayLo - Exchange Rates API (v2)
 * GET /api/v2/exchange-rates — `rateMap`: THB за 1 единицу валюты.
 *
 * Query **retail** (Stage 110.4 SSOT):
 * - `retail=1` | `true` | `yes` (default) — витрина: mid + {@link resolveRetailMarkupMultiplier}
 * - `retail=0` | `false` | `no` — mid-market only (settlement, admin risk, referral)
 *
 * @see lib/pricing/fx-display.js
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  getDisplayRateMapForMode,
  parseRetailFxQueryParam,
  retailModeFromApplyFlag,
  resolveRetailMarkupMultiplier,
} from '@/lib/pricing/fx-display.js'
import {
  validateExchangeRateSemantics,
  logExchangeRateValidationFailure,
} from '@/lib/finance/exchange-rates-write-guard.js'
import {
  edgeCacheResponseHeaders,
  retailFxEdgeCacheControl,
} from '@/lib/api/public-edge-cache-control.js'

export const dynamic = 'force-dynamic'

const CURRENCY_SYMBOLS = {
  THB: '฿',
  RUB: '₽',
  USD: '$',
  USDT: '₮',
  EUR: '€',
  GBP: '£',
  CNY: '¥',
}

function fxJson(body, applyRetailMarkup, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: edgeCacheResponseHeaders(
      retailFxEdgeCacheControl({ applyRetailMarkup, status }),
    ),
  })
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const applyRetailMarkup = parseRetailFxQueryParam(searchParams.get('retail'))
    const retailMode = retailModeFromApplyFlag(applyRetailMarkup)
    const [rateMap, retailMarkupMultiplier] = await Promise.all([
      getDisplayRateMapForMode(applyRetailMarkup),
      resolveRetailMarkupMultiplier(),
    ])

    const { data: rates, error } = await supabaseAdmin.from('exchange_rates').select('*')

    let ratesUpdatedAt = null

    if (error) {
      const transformed = Object.entries(rateMap)
        .filter(([code]) => code !== 'THB')
        .map(([code, rateToThb]) => ({
          code,
          rateToThb,
          symbol: CURRENCY_SYMBOLS[code] || code,
        }))
      return fxJson(
        {
          success: true,
          data: transformed,
          rateMap,
          applyRetailMarkup,
          retail: applyRetailMarkup,
          retailMode,
          retailMarkupMultiplier,
          ratesUpdatedAt,
        },
        applyRetailMarkup,
      )
    }

    const transformed = rates.map((r) => ({
      code: r.currency_code,
      rateToThb: parseFloat(r.rate_to_thb),
      symbol: CURRENCY_SYMBOLS[r.currency_code] || r.currency_code,
    }))
    for (const row of rates || []) {
      if (!row?.updated_at) continue
      if (!ratesUpdatedAt || new Date(row.updated_at).getTime() > new Date(ratesUpdatedAt).getTime()) {
        ratesUpdatedAt = row.updated_at
      }
    }

    return fxJson(
      {
        success: true,
        data: transformed,
        rateMap,
        applyRetailMarkup,
        retail: applyRetailMarkup,
        retailMode,
        retailMarkupMultiplier,
        ratesUpdatedAt,
      },
      applyRetailMarkup,
    )
  } catch (error) {
    console.error('[EXCHANGE RATES ERROR]', error)
    return NextResponse.json(
      { success: false, error: error.message },
      {
        status: 500,
        headers: edgeCacheResponseHeaders(retailFxEdgeCacheControl({ status: 500 })),
      },
    )
  }
}

export async function POST(request) {
  try {
    const body = await request.json()
    const { currency_code, rate_to_thb } = body

    if (!currency_code || !rate_to_thb) {
      return NextResponse.json({
        success: false,
        error: 'currency_code and rate_to_thb are required',
      }, { status: 400 })
    }

    const code = String(currency_code).toUpperCase().trim()
    const rawRate = parseFloat(rate_to_thb)
    const check = validateExchangeRateSemantics(code, rawRate)
    if (!check.ok) {
      logExchangeRateValidationFailure(code, rawRate, 'POST /api/v2/exchange-rates')
      return NextResponse.json({
        success: false,
        error: check.error,
      }, { status: check.status })
    }

    const { data, error } = await supabaseAdmin
      .from('exchange_rates')
      .upsert(
        {
          id: `rate-${code.toLowerCase()}-${Date.now()}`,
          currency_code: code,
          rate_to_thb: check.normalizedRate,
          source: 'manual',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'currency_code' },
      )
      .select()
      .single()

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('[EXCHANGE RATES POST ERROR]', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
