/**
 * GET  — квота генераций описания (по listing_id или черновик без id)
 * POST — генерация RU/EN/ZH/TH + SEO, лог ai_usage_logs, проверка квоты (≤3)
 */

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { verifyPartnerAccess } from '@/lib/services/session-service'
import { supabaseAdmin } from '@/lib/supabase'
import { generatePartnerListingDescriptionQuad } from '@/lib/openai/partner-listing-description'
import {
  insertAiUsageLog,
  countAiGenerationsForQuota,
  quotaLimit,
  quotaRemaining,
  TASK_LISTING_DESCRIPTION,
} from '@/lib/ai/usage-log'

export const dynamic = 'force-dynamic'

const JWT_SECRET = process.env.JWT_SECRET || 'gostaylo-secret-key-change-in-production'

async function getPartnerFromSession() {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get('gostaylo_session')
  if (!sessionCookie?.value) {
    return { error: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }) }
  }
  let decoded
  try {
    decoded = jwt.verify(sessionCookie.value, JWT_SECRET)
  } catch {
    return { error: NextResponse.json({ success: false, error: 'Invalid session' }, { status: 401 }) }
  }
  const partner = await verifyPartnerAccess(decoded.userId)
  if (!partner) {
    return { error: NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 }) }
  }
  return { userId: decoded.userId, role: partner.role }
}

async function assertListingAccess(userId, role, listingId) {
  if (!listingId || !String(listingId).trim()) return { ok: true }
  if (!supabaseAdmin) return { ok: true }
  const id = String(listingId).trim()
  const { data, error } = await supabaseAdmin.from('listings').select('owner_id').eq('id', id).maybeSingle()
  if (error || !data) return { ok: false, response: NextResponse.json({ success: false, error: 'Listing not found' }, { status: 404 }) }
  if (role === 'ADMIN') return { ok: true }
  if (String(data.owner_id) !== String(userId)) {
    return { ok: false, response: NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 }) }
  }
  return { ok: true }
}

export async function GET(request) {
  const auth = await getPartnerFromSession()
  if (auth.error) return auth.error

  const { searchParams } = new URL(request.url)
  const listingId = searchParams.get('listingId') || ''

  const access = await assertListingAccess(auth.userId, auth.role, listingId)
  if (!access.ok) return access.response

  const { count } = await countAiGenerationsForQuota(auth.userId, listingId || null, TASK_LISTING_DESCRIPTION)
  const limit = quotaLimit()
  const remaining = quotaRemaining(count)

  return NextResponse.json({
    success: true,
    data: {
      used: count,
      limit,
      remaining,
      exhausted: remaining <= 0,
    },
  })
}

export async function POST(request) {
  const auth = await getPartnerFromSession()
  if (auth.error) return auth.error

  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: 'AI description is not configured (OPENAI_API_KEY)' },
      { status: 503 },
    )
  }

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (title.length < 3) {
    return NextResponse.json(
      { success: false, error: 'title is required (min 3 characters)' },
      { status: 400 },
    )
  }

  const listingId =
    typeof body.listingId === 'string' && body.listingId.trim() ? body.listingId.trim() : null

  const access = await assertListingAccess(auth.userId, auth.role, listingId)
  if (!access.ok) return access.response

  const { count: used } = await countAiGenerationsForQuota(auth.userId, listingId, TASK_LISTING_DESCRIPTION)
  if (used >= quotaLimit()) {
    return NextResponse.json(
      {
        success: false,
        error: 'QUOTA_EXHAUSTED',
        data: { used, limit: quotaLimit(), remaining: 0 },
      },
      { status: 429 },
    )
  }

  try {
    const { locales, usage, model } = await generatePartnerListingDescriptionQuad(
      {
        title,
        district: typeof body.district === 'string' ? body.district.trim() : '',
        categorySlug: typeof body.categorySlug === 'string' ? body.categorySlug.trim() : '',
        basePriceThb: body.basePriceThb,
        metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : {},
        existingDescription:
          typeof body.existingDescription === 'string' ? body.existingDescription : '',
      },
      apiKey,
    )

    await insertAiUsageLog({
      userId: auth.userId,
      listingId,
      taskType: TASK_LISTING_DESCRIPTION,
      model,
      usage,
      metadata: { titleLen: title.length },
    })

    const slice = (s) => String(s || '').slice(0, 2000)
    const ru = slice(locales.ru.body)
    const en = slice(locales.en.body)
    const zh = slice(locales.zh.body)
    const th = slice(locales.th.body)

    const after = await countAiGenerationsForQuota(auth.userId, listingId, TASK_LISTING_DESCRIPTION)

    return NextResponse.json({
      success: true,
      data: {
        descriptionRu: ru,
        descriptionEn: en,
        descriptionZh: zh,
        descriptionTh: th,
        seo: {
          ru: { title: locales.ru.seoTitle, description: locales.ru.seoDescription },
          en: { title: locales.en.seoTitle, description: locales.en.seoDescription },
          zh: { title: locales.zh.seoTitle, description: locales.zh.seoDescription },
          th: { title: locales.th.seoTitle, description: locales.th.seoDescription },
        },
        quota: {
          used: after.count,
          limit: quotaLimit(),
          remaining: quotaRemaining(after.count),
          exhausted: quotaRemaining(after.count) <= 0,
        },
      },
    })
  } catch (e) {
    console.error('[PARTNER-AI-DESCRIPTION]', e?.message || e)
    return NextResponse.json(
      { success: false, error: e?.message || 'Generation failed' },
      { status: 502 },
    )
  }
}
