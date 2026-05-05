/**
 * GoStayLo - Categories API (v2)
 * GET /api/v2/categories — активные категории для каталога/поиска (публично).
 * Stage 68.0: `parentId`, опционально `?tree=1` — поле `dataTree` (корни с `children`).
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSessionPayload } from '@/lib/services/session-service'

export const dynamic = 'force-dynamic'

function mapPublicCategory(c) {
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    icon: c.icon,
    order: c.order,
    isActive: c.is_active,
    isComingSoon: c.is_coming_soon === true,
    isPreviewOnly: c.is_preview_only === true,
    isPreview: false,
    wizardProfile: c.wizard_profile ?? null,
    parentId: c.parent_id ?? null,
    nameI18n: c.name_i18n && typeof c.name_i18n === 'object' ? c.name_i18n : null,
  }
}

async function resolveIsAdminRequest() {
  try {
    const session = await getSessionPayload()
    if (!session?.userId) return false
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', session.userId)
      .maybeSingle()
    if (error) return false
    return String(data?.role || '').toUpperCase() === 'ADMIN'
  } catch {
    return false
  }
}

/**
 * @param {Array<ReturnType<typeof mapPublicCategory>>} items
 */
function buildCategoryTree(items) {
  const byId = new Map(items.map((n) => [n.id, { ...n, children: [] }]))
  const roots = []
  for (const n of items) {
    const node = byId.get(n.id)
    if (n.parentId && byId.has(n.parentId)) {
      byId.get(n.parentId).children.push(node)
    } else {
      roots.push(node)
    }
  }
  const sortNested = (node) => {
    node.children.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))
    for (const ch of node.children) sortNested(ch)
  }
  roots.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))
  for (const r of roots) sortNested(r)
  return roots
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const includeInactive = searchParams.get('all') === 'true'
    const asTree = searchParams.get('tree') === '1'
    const isAdminRequest = await resolveIsAdminRequest()
    const forceAllForAdmin = includeInactive && isAdminRequest

    let query = supabaseAdmin.from('categories').select('*').order('order', { ascending: true })

    if (!forceAllForAdmin && !isAdminRequest) {
      query = query.or('is_active.eq.true,is_coming_soon.eq.true')
      query = query.eq('is_preview_only', false)
    }

    const { data: categories, error } = await query

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    const transformed = (categories || []).map((c) => {
      const mapped = mapPublicCategory(c)
      if (isAdminRequest) {
        const visibleForRegularUsers = (mapped.isActive || mapped.isComingSoon) && !mapped.isPreviewOnly
        mapped.isPreview = !visibleForRegularUsers
      }
      return mapped
    })

    const payload = {
      success: true,
      data: transformed,
      ...(asTree ? { dataTree: buildCategoryTree(transformed) } : {}),
    }

    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    console.error('[CATEGORIES GET ERROR]', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
