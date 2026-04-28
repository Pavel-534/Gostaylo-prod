/**
 * GoStayLo - Exchange Rates API (v2)
 * GET /api/v2/exchange-rates — `rateMap`: THB за 1 единицу валюты.
 * Сервер: сначала Supabase `exchange_rates`; ExchangeRate-API не чаще 1× / 2 ч,
 * после ответа — upsert в БД (`getDisplayRateMap`, `EXCHANGE_RATES_DB_TTL_MS`).
 * POST /api/v2/exchange-rates — ручная правка (admin).
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getDisplayRateMap } from '@/lib/services/currency.service'

export const dynamic = 'force-dynamic'

// Currency symbols mapping
const CURRENCY_SYMBOLS = {
  THB: '฿',
  RUB: '₽', 
  USD: '$',
  USDT: '₮',
  EUR: '€',
  GBP: '£',
  CNY: '¥'
};

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const applyRetailMarkup = searchParams.get('retail') !== '0'
    const rateMap = await getDisplayRateMap({ applyRetailMarkup });

    const { data: rates, error } = await supabaseAdmin
      .from('exchange_rates')
      .select('*');

    let ratesUpdatedAt = null

    if (error) {
      const transformed = Object.entries(rateMap)
        .filter(([code]) => code !== 'THB')
        .map(([code, rateToThb]) => ({
          code,
          rateToThb,
          symbol: CURRENCY_SYMBOLS[code] || code,
        }));
      return NextResponse.json({ success: true, data: transformed, rateMap, applyRetailMarkup, ratesUpdatedAt });
    }

    const transformed = rates.map((r) => ({
      code: r.currency_code,
      rateToThb: parseFloat(r.rate_to_thb),
      symbol: CURRENCY_SYMBOLS[r.currency_code] || r.currency_code,
    }));
    for (const row of rates || []) {
      if (!row?.updated_at) continue
      if (!ratesUpdatedAt || new Date(row.updated_at).getTime() > new Date(ratesUpdatedAt).getTime()) {
        ratesUpdatedAt = row.updated_at
      }
    }

    return NextResponse.json({ success: true, data: transformed, rateMap, applyRetailMarkup, ratesUpdatedAt });
  } catch (error) {
    console.error('[EXCHANGE RATES ERROR]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { currency_code, rate_to_thb } = body;
    
    if (!currency_code || !rate_to_thb) {
      return NextResponse.json({ 
        success: false, 
        error: 'currency_code and rate_to_thb are required' 
      }, { status: 400 });
    }
    
    // Upsert the rate
    const { data, error } = await supabaseAdmin
      .from('exchange_rates')
      .upsert({
        id: `rate-${currency_code.toLowerCase()}-${Date.now()}`,
        currency_code: currency_code.toUpperCase(),
        rate_to_thb: parseFloat(rate_to_thb),
        source: 'manual',
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'currency_code'
      })
      .select()
      .single();
    
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ success: true, data });
    
  } catch (error) {
    console.error('[EXCHANGE RATES POST ERROR]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
