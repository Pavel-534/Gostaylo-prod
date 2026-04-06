/**
 * Создаёт один листинг категории tours для E2E_PARTNER_EMAIL, если его ещё нет.
 * Вызывается из global-setup при LOADED секрете фикстур — снимает скипы tour / RBAC.
 */
import { createClient } from '@supabase/supabase-js'
import { E2E_EMAILS } from './constants'

const TAG = '[E2E_SEED_TOUR]'

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
    .select('id')
    .eq('owner_id', prof.id)
    .eq('category_id', cat.id)
    .limit(1)

  if (eErr) {
    console.warn('[Playwright] E2E tours seed: query failed', eErr.message)
    return
  }
  if (existing?.length) {
    console.log('[Playwright] E2E tours listing: already present')
    return
  }

  const { error: insErr } = await sb.from('listings').insert({
    owner_id: prof.id,
    category_id: cat.id,
    status: 'ACTIVE',
    title: `${TAG} Playwright`,
    description: 'Автосид для Playwright; можно удалить.',
    district: 'Kata',
    base_price_thb: 1200,
    commission_rate: 15,
    images: [],
    cover_image: null,
    metadata: { group_size_min: 1, group_size_max: 10 },
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
