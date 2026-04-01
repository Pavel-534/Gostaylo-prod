/**
 * GoStayLo - Geo Detection API
 * GET /api/v2/geo - Detect user's location and recommended currency
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { GeoService } from '@/lib/services/geo.service';
import { ForexService, SUPPORTED_CURRENCIES } from '@/lib/services/forex.service';

export async function GET(request) {
  try {
    // Try to get IP from various headers
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ||
               request.headers.get('x-real-ip') ||
               request.headers.get('cf-connecting-ip');

    // Detect location
    const geoResult = await GeoService.detectLocation(ip);
    
    // Get currency info
    const recommendedCurrency = geoResult.recommendedCurrency;
    const currencyInfo = SUPPORTED_CURRENCIES[recommendedCurrency] || SUPPORTED_CURRENCIES.USD;

    // Get sample conversion
    const sampleThb = 10000;
    const conversion = await ForexService.convertFromThb(sampleThb, recommendedCurrency);

    return NextResponse.json({
      success: geoResult.success,
      location: {
        country: geoResult.country,
        countryCode: geoResult.countryCode,
        city: geoResult.city,
        region: geoResult.region,
        timezone: geoResult.timezone
      },
      currency: {
        code: recommendedCurrency,
        symbol: currencyInfo.symbol,
        name: currencyInfo.name,
        flag: currencyInfo.flag
      },
      sample: {
        thb: sampleThb,
        converted: conversion.converted,
        formatted: ForexService.formatPrice(conversion.converted, recommendedCurrency)
      },
      cached: geoResult.cached || false,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[GEO API ERROR]', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      currency: {
        code: 'USD',
        symbol: '$',
        name: 'US Dollar',
        flag: '🇺🇸'
      }
    }, { status: 200 }); // Still return 200 with fallback
  }
}
