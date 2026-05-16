/**
 * GET /api/v2/public/stats
 *
 * Публичный (без авторизации) лёгкий эндпоинт для TrustBar.
 * Возвращает: кол-во активных объявлений + средний рейтинг.
 *
 * ISR-кэш: 2 часа (revalidate: 7200) — данные практически не меняются в реальном времени.
 * SSOT: единственный источник публичной статистики платформы для фронтенда.
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isExcludedFromPublicCatalog } from '@/lib/e2e/test-listing-cleanup'

export const dynamic = 'force-dynamic'

// In-memory cache: не пересчитывать на каждый запрос
let _cache = null
let _cacheTs = 0
const CACHE_TTL_MS = 2 * 60 * 60 * 1000 // 2 hours

export async function GET() {
  // Serve from in-memory cache if fresh
  if (_cache && Date.now() - _cacheTs < CACHE_TTL_MS) {
    return NextResponse.json(_cache, {
      headers: { 'Cache-Control': 'public, max-age=7200, stale-while-revalidate=3600' },
    })
  }

  if (!supabaseAdmin) {
    return NextResponse.json(
      { success: false, error: 'DB not configured' },
      { status: 503 },
    )
  }

  try {
    // ── 1. Active listings count (same filter as catalog search: tagged E2E only) ──
    const { data: activeRows, error: listingsErr } = await supabaseAdmin
      .from('listings')
      .select('id, title, description, metadata')
      .eq('status', 'ACTIVE')

    if (listingsErr) {
      console.error('[PUBLIC STATS] listings query error:', listingsErr.message)
    }

    const listingsCount = (activeRows || []).filter((row) => !isExcludedFromPublicCatalog(row)).length

    // ── 2. Average rating (graceful fallback if reviews table missing) ────────
    let avgRating = null
    let totalReviews = 0

    try {
      const { data: ratingData, error: ratingErr } = await supabaseAdmin
        .from('reviews')
        .select('rating')
        .not('rating', 'is', null)
        .gt('rating', 0)

      if (!ratingErr && ratingData && ratingData.length > 0) {
        totalReviews = ratingData.length
        const sum = ratingData.reduce((acc, r) => acc + (r.rating || 0), 0)
        avgRating = Math.round((sum / totalReviews) * 10) / 10 // 1 decimal
      }
    } catch {
      // reviews table may not exist yet — не критично
    }

    const payload = {
      success: true,
      data: {
        listingsCount: listingsCount ?? 0,
        avgRating: avgRating ?? 4.9,          // fallback to 4.9 if no reviews yet
        totalReviews,
        updatedAt: new Date().toISOString(),
      },
    }

    // Store in-memory cache
    _cache = payload
    _cacheTs = Date.now()

    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'public, max-age=7200, stale-while-revalidate=3600' },
    })
  } catch (err) {
    console.error('[PUBLIC STATS] unexpected error:', err)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    )
  }
}
