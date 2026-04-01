/**
 * GoStayLo - Locations API (City -> District hierarchy)
 * GET /api/v2/locations - Returns unique cities and districts from ACTIVE listings
 * Used for dynamic search filters (Airbnb-style)
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { data: listings, error } = await supabaseAdmin
      .from('listings')
      .select('district, metadata')
      .eq('status', 'ACTIVE')
      .not('district', 'is', null);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const districtByCity = new Map(); // city -> Set(districts)
    for (const l of listings || []) {
      const city = l.metadata?.city || 'Phuket'; // Default Phuket for legacy
      const district = (l.district || '').trim();
      if (!district) continue;
      if (!districtByCity.has(city)) {
        districtByCity.set(city, new Set());
      }
      districtByCity.get(city).add(district);
    }

    const cities = Array.from(districtByCity.keys()).sort();
    const locations = cities.map(city => ({
      city,
      districts: Array.from(districtByCity.get(city)).sort()
    }));

    return NextResponse.json({
      success: true,
      data: { locations, cities }
    }, {
      headers: { 'Cache-Control': 'public, max-age=300' }
    });
  } catch (e) {
    console.error('[LOCATIONS API]', e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
