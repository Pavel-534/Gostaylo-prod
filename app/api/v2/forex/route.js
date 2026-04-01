/**
 * GoStayLo - Forex API
 * GET /api/v2/forex - Get exchange rates
 * GET /api/v2/forex?convert=1000&from=THB&to=RUB - Convert amount
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { ForexService } from '@/lib/services/forex.service';
import { GeoService } from '@/lib/services/geo.service';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const convert = searchParams.get('convert');
  const from = searchParams.get('from') || 'THB';
  const to = searchParams.get('to');
  const autoDetect = searchParams.get('auto') === 'true';

  try {
    // Auto-detect user's currency if requested
    let targetCurrency = to;
    let geoData = null;
    
    if (autoDetect && !to) {
      const detectedCurrency = await GeoService.detectCurrencyFromRequest(request);
      targetCurrency = detectedCurrency;
      geoData = await GeoService.detectLocation();
    }

    // Convert specific amount
    if (convert) {
      const amount = parseFloat(convert);
      
      if (from === 'THB') {
        const result = await ForexService.convertFromThb(amount, targetCurrency || 'USD');
        return NextResponse.json({
          success: true,
          original: { amount, currency: 'THB' },
          converted: { 
            amount: result.converted, 
            currency: result.currency,
            formatted: ForexService.formatPrice(result.converted, result.currency)
          },
          rate: result.rate,
          funnyRate: result.funnyRate,
          geoDetected: geoData,
          timestamp: new Date().toISOString()
        });
      } else {
        const result = await ForexService.convertToThb(amount, from);
        return NextResponse.json({
          success: true,
          original: { amount, currency: from },
          converted: { 
            amount: result.converted, 
            currency: 'THB',
            formatted: ForexService.formatPrice(result.converted, 'THB')
          },
          rate: result.rate,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Get all rates
    const { rates, cached, age } = await ForexService.getRates();
    const currencies = await ForexService.getCurrencyList();

    return NextResponse.json({
      success: true,
      baseCurrency: 'THB',
      rates,
      currencies,
      cached,
      cacheAge: age,
      geoDetected: geoData,
      markup: '3.5% GoStayLo Rate applied to display prices',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[FOREX API ERROR]', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
