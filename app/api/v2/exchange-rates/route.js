/**
 * FunnyRent 2.1 - Exchange Rates API (v2)
 * GET /api/v2/exchange-rates - Get currency rates from Supabase
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

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
      symbol: { THB: '฿', RUB: '₽', USD: '$', USDT: '₮' }[r.currency_code] || r.currency_code
    }));
    
    return NextResponse.json({ success: true, data: transformed });
    
  } catch (error) {
    console.error('[EXCHANGE RATES ERROR]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
