/**
 * Gostaylo - Dynamic Locations API
 * GET /api/v2/search/locations
 * Returns cities and districts from actual ACTIVE listings (for filters)
 * Enables City -> District hierarchy like Airbnb
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { PHUKET_DISTRICTS } from '@/lib/locations/city-district-map';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { data: listings, error } = await supabaseAdmin
      .from('listings')
      .select('district, metadata')
      .eq('status', 'ACTIVE');

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const districtsByCity = new Map(); // city -> Set(districts)
    const allDistricts = new Set();

    for (const l of listings || []) {
      const city = l.metadata?.city || (PHUKET_DISTRICTS.includes(l.district) ? 'Phuket' : null) || 'Other';
      const district = l.district?.trim();
      if (district) {
        allDistricts.add(district);
        if (!districtsByCity.has(city)) districtsByCity.set(city, new Set());
        districtsByCity.get(city).add(district);
      }
    }

    // Ensure Phuket exists if we have Phuket districts
    if (allDistricts.size > 0 && !districtsByCity.has('Phuket')) {
      const phuketDists = [...allDistricts].filter(d => PHUKET_DISTRICTS.includes(d));
      if (phuketDists.length > 0) {
        districtsByCity.set('Phuket', new Set(phuketDists));
      }
    }

    const cities = Array.from(districtsByCity.keys()).sort();
    const result = {
      cities,
      districtsByCity: Object.fromEntries(
        [...districtsByCity.entries()].map(([c, set]) => [c, Array.from(set).sort()])
      ),
      allDistricts: Array.from(allDistricts).sort(),
    };

    return NextResponse.json(
      { success: true, data: result },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
        },
      }
    );
  } catch (err) {
    console.error('[LOCATIONS API]', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
