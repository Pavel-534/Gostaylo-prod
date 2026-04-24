import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { resolveAdminSecurityProfile } from '@/lib/admin-security-access'

export const dynamic = 'force-dynamic'

const SETTINGS_KEY = 'marketing_campaigns'

function normalizeCampaigns(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .map((row) => {
      if (!row || typeof row !== 'object') return null
      const promoCodeIds = Array.isArray(row.promoCodeIds)
        ? row.promoCodeIds.map((x) => String(x || '').trim()).filter(Boolean)
        : []
      return {
        id: String(row.id || '').trim(),
        title: String(row.title || '').trim(),
        subtitle: String(row.subtitle || '').trim(),
        promoCodeIds,
        startsAtIso: row.startsAtIso ? String(row.startsAtIso) : null,
        endsAtIso: row.endsAtIso ? String(row.endsAtIso) : null,
        createdAtIso: row.createdAtIso ? String(row.createdAtIso) : null,
        createdBy: row.createdBy ? String(row.createdBy) : null,
      }
    })
    .filter((row) => row && row.id && row.title && row.promoCodeIds.length > 0)
}

async function readCampaigns() {
  const { data, error } = await supabaseAdmin
    .from('system_settings')
    .select('value')
    .eq('key', SETTINGS_KEY)
    .maybeSingle()
  if (error) throw error
  return normalizeCampaigns(data?.value)
}

async function writeCampaigns(campaigns) {
  const { error } = await supabaseAdmin.from('system_settings').upsert(
    {
      key: SETTINGS_KEY,
      value: campaigns,
    },
    { onConflict: 'key' },
  )
  if (error) throw error
}

export async function GET() {
  const session = await resolveAdminSecurityProfile()
  if (session.error) {
    return NextResponse.json({ error: session.error.message }, { status: session.error.status })
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
  }
  try {
    const campaigns = await readCampaigns()
    return NextResponse.json({ data: campaigns })
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Failed to load campaigns' }, { status: 500 })
  }
}

export async function POST(request) {
  const session = await resolveAdminSecurityProfile()
  if (session.error) {
    return NextResponse.json({ error: session.error.message }, { status: session.error.status })
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const title = String(body?.title || '').trim()
  const subtitle = String(body?.subtitle || '').trim()
  const promoCodeIds = Array.isArray(body?.promoCodeIds)
    ? [...new Set(body.promoCodeIds.map((x) => String(x || '').trim()).filter(Boolean))]
    : []
  const startsAtIso = body?.startsAtIso ? String(body.startsAtIso) : null
  const endsAtIso = body?.endsAtIso ? String(body.endsAtIso) : null

  if (!title || promoCodeIds.length < 1) {
    return NextResponse.json({ error: 'title and promoCodeIds are required' }, { status: 400 })
  }

  const { data: promoRows, error: promoError } = await supabaseAdmin
    .from('promo_codes')
    .select('id,created_by_type')
    .in('id', promoCodeIds)
  if (promoError) {
    return NextResponse.json({ error: promoError.message }, { status: 500 })
  }
  const rows = Array.isArray(promoRows) ? promoRows : []
  if (rows.length !== promoCodeIds.length) {
    return NextResponse.json({ error: 'Some promo codes were not found' }, { status: 400 })
  }
  const hasNonPlatform = rows.some(
    (row) => String(row.created_by_type || '').toUpperCase() !== 'PLATFORM',
  )
  if (hasNonPlatform) {
    return NextResponse.json(
      { error: 'Global campaign supports PLATFORM promo codes only' },
      { status: 400 },
    )
  }

  try {
    const campaigns = await readCampaigns()
    const next = [
      {
        id: `campaign_${Date.now().toString(36)}`,
        title,
        subtitle: subtitle || null,
        promoCodeIds,
        startsAtIso,
        endsAtIso,
        createdAtIso: new Date().toISOString(),
        createdBy: session.profile?.id || null,
      },
      ...campaigns,
    ]
    await writeCampaigns(next)
    return NextResponse.json({ data: next[0] }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Failed to create campaign' }, { status: 500 })
  }
}

