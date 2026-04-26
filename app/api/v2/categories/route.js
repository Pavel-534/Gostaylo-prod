/**
 * GoStayLo - Categories API (v2)
 * GET /api/v2/categories — активные категории для каталога/поиска (публично).
 * Stage 68.0: `parentId`, опционально `?tree=1` — поле `dataTree` (корни с `children`).
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

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
    wizardProfile: c.wizard_profile ?? null,
    parentId: c.parent_id ?? null,
    nameI18n: c.name_i18n && typeof c.name_i18n === 'object' ? c.name_i18n : null,
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

    let query = supabaseAdmin.from('categories').select('*').order('order', { ascending: true })

    if (!includeInactive) {
      query = query.eq('is_active', true)
    }

    const { data: categories, error } = await query

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    const transformed = (categories || []).map(mapPublicCategory)

    const payload = {
      success: true,
      data: transformed,
      ...(asTree ? { dataTree: buildCategoryTree(transformed) } : {}),
    }

    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    })
  } catch (error) {
    console.error('[CATEGORIES GET ERROR]', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
