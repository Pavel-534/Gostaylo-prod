import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAccess } from '@/lib/security/access-guard'

export const dynamic = 'force-dynamic'

async function requireAdmin() {
  const access = await requireAccess({ roles: ['ADMIN'] })
  if (access.error) return { response: access.error }
  return { ok: true }
}

function toCsv(rows) {
  const header = ['Email', 'Category', 'Language', 'SubscribedAt']
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const lines = rows.map((r) => [
    esc(r.email),
    esc(r.categorySlug),
    esc(r.language || ''),
    esc(r.createdAt || ''),
  ].join(','))
  return [header.join(','), ...lines].join('\n')
}

export async function GET(request) {
  const auth = await requireAdmin()
  if (auth.response) {
    return auth.response
  }

  const { searchParams } = new URL(request.url)
  const category = String(searchParams.get('category') || '').trim().toLowerCase()
  const format = String(searchParams.get('format') || '').trim().toLowerCase()

  let query = supabaseAdmin
    .from('leads_waiting_list')
    .select('id,email,category_slug,language,created_at')
    .order('created_at', { ascending: false })

  if (category) {
    query = query.eq('category_slug', category)
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  const rows = (data || []).map((r) => ({
    id: r.id,
    email: r.email,
    categorySlug: r.category_slug,
    language: r.language,
    createdAt: r.created_at,
  }))

  if (format === 'csv') {
    return new NextResponse(toCsv(rows), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="waitlist-leads.csv"',
      },
    })
  }

  return NextResponse.json({ success: true, data: rows })
}
