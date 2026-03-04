/**
 * FunnyRent 2.1 - Exchange Rates API (v2)
 * GET /api/v2/exchange-rates - Get currency rates from Supabase
 * POST /api/v2/exchange-rates - Add/update currency rate (Admin only)
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

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

export async function GET() {
  try {
    const { data: rates, error } = await supabaseAdmin
      .from('exchange_rates')
      .select('*');
    
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    
    // Transform for frontend
    const transformed = rates.map(r => ({
      code: r.currency_code,
      rateToThb: parseFloat(r.rate_to_thb),
      symbol: CURRENCY_SYMBOLS[r.currency_code] || r.currency_code
    }));
    
    return NextResponse.json({ success: true, data: transformed });
    
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
