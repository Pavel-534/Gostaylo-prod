/**
 * Создаёт один листинг категории tours для E2E_PARTNER_EMAIL, если его ещё нет.
 * Вызывается из global-setup при LOADED секрете фикстур — снимает скипы tour / RBAC.
 */
import { createClient } from '@supabase/supabase-js'
import { E2E_EMAILS } from './constants'
import { E2E_TEST_DATA_TAG } from '../../lib/e2e/test-data-tag.js'

const TAG = `${E2E_TEST_DATA_TAG} [E2E_SEED_TOUR]`

export async function seedE2eTourListingIfNeeded(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const email = E2E_EMAILS.partner
  if (!url) {
    console.log('[Playwright] E2E tours seed: skip (NEXT_PUBLIC_SUPABASE_URL is missing)')
    return
  }
  if (!key) {
    console.warn('⚠️ SERVICE ROLE MISSING - TOURS TESTS WILL BE SKIPPED')
    console.log('[Playwright] E2E tours seed: skip (SUPABASE_SERVICE_ROLE_KEY is missing)')
    return
  }
  if (!email) {
    console.log(
      '[Playwright] E2E tours seed: skip (E2E_PARTNER_EMAIL/default partner email is missing)',
    )
    return
  }

  const sb = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: prof, error: pErr } = await sb.from('profiles').select('id').ilike('email', email).maybeSingle()
  if (pErr || !prof?.id) {
    console.warn('[Playwright] E2E tours seed: partner profile not found for', email)
    return
  }

  const { data: cat, error: cErr } = await sb.from('categories').select('id').eq('slug', 'tours').maybeSingle()
  if (cErr || !cat?.id) {
    console.warn('[Playwright] E2E tours seed: category tours not found')
    return
  }

  const { data: existing, error: eErr } = await sb
    .from('listings')
    .select('id, status, instant_booking, max_capacity, metadata')
    .eq('owner_id', prof.id)
    .eq('category_id', cat.id)
    .order('created_at', { ascending: false })
    .limit(5)

  if (eErr) {
    console.warn('[Playwright] E2E tours seed: query failed', eErr.message)
    return
  }
  if (existing?.length) {
    // Stage 171.41 — keep inquiry-capable shared tours listing for golden-path
    const row = existing[0]
    const meta =
      row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
        ? { ...row.metadata }
        : {}
    delete meta.is_deleted
    meta.group_size_min = meta.group_size_min ?? 1
    meta.group_size_max = meta.group_size_max ?? 10
    meta.test_data_tag = E2E_TEST_DATA_TAG

    const { error: upErr } = await sb
      .from('listings')
      .update({
        status: 'ACTIVE',
        title: `${TAG} Playwright`,
        instant_booking: false,
        max_capacity: Math.max(2, Number(row.max_capacity) || 10),
        available: true,
        district: 'Kata',
        latitude: 7.8208,
        longitude: 98.2987,
        metadata: meta,
      })
      .eq('id', row.id)
    if (upErr) {
      console.warn('[Playwright] E2E tours listing: patch failed', upErr.message)
    } else {
      console.log(
        `[Playwright] E2E tours listing: inquiry-ready id=${row.id} owner=${prof.id}`,
      )
    }
    return
  }

  const { error: insErr } = await sb.from('listings').insert({
    owner_id: prof.id,
    category_id: cat.id,
    status: 'ACTIVE',
    title: `${TAG} Playwright`,
    description: 'Автосид для Playwright; можно удалить.',
    district: 'Kata',
    latitude: 7.8208,
    longitude: 98.2987,
    base_price_thb: 1200,
    commission_rate: 15,
    instant_booking: false,
    images: [],
    cover_image: null,
    metadata: { group_size_min: 1, group_size_max: 10, test_data_tag: E2E_TEST_DATA_TAG },
    available: true,
    min_booking_days: 1,
    max_booking_days: 730,
    max_capacity: 10,
  })

  if (insErr) {
    console.warn('[Playwright] E2E tours seed: insert failed', insErr.message)
    return
  }

  console.log('[Playwright] E2E tours listing: seeded')
}
