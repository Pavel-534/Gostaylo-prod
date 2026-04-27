/**
 * Shared helpers for calendar modules (Stage 70.5 split).
 */

import { createClient } from '@supabase/supabase-js';
import { addListingDays } from '@/lib/listing-date';

export function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export function getDateRange(startIso, endIso) {
  const dates = [];
  let cur = startIso;
  while (cur <= endIso) {
    dates.push(cur);
    cur = addListingDays(cur, 1);
  }
  return dates;
}

export function parseMaxCapacity(listing) {
  const n = parseInt(listing?.max_capacity, 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

export function parseGuestsCount(booking) {
  const n = parseInt(booking?.guests_count, 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

export function parseUnitsBlocked(block) {
  const n = parseInt(block?.units_blocked, 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

export function groupRowsByListingId(rows) {
  const map = new Map();
  for (const row of rows || []) {
    const id = String(row?.listing_id || '').trim();
    if (!id) continue;
    if (!map.has(id)) map.set(id, []);
    map.get(id).push(row);
  }
  return map;
}
