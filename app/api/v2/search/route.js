/**
 * GoStayLo - Search API (v2) - Smart Search
 * GET /api/v2/search - Search listings with availability, geo, full-text
 *
 * @updated 2026-03-24 — logic shared with GET /api/v2/listings/search
 */

export const dynamic = 'force-dynamic';

import { runListingsSearchGet } from '@/lib/api/run-listings-search-get';

export async function GET(request) {
  return runListingsSearchGet(request);
}
