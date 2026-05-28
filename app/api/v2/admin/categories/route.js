/**
 * GET/POST/PATCH /api/v2/admin/categories — управление `categories` (ADMIN, service role).
 * Stage 68.0: `parent_id`, `wizard_profile`.
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdminStaff } from '@/lib/security/admin-staff-access'

export const dynamic = 'force-dynamic'

async function requireAdmin(request) {
  const access = await requireAdminStaff(request)
  if (access.error) return { response: access.error }
  return { userId: access.profile.id }
}

function mapRow(c) {
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description ?? null,
    icon: c.icon ?? null,
    order: c.order ?? 0,
    isActive: c.is_active !== false,
    isComingSoon: c.is_coming_soon === true,
    isPreviewOnly: c.is_preview_only === true,
    wizardProfile: c.wizard_profile ?? null,
    parentId: c.parent_id ?? null,
    nameI18n: c.name_i18n && typeof c.name_i18n === 'object' ? c.name_i18n : null,
  }
}

const WIZARD_PROFILE_OPTIONS = [
  '',
  'stay',
  'transport',
  'transport_helicopter',
  'yacht',
  'tour',
  'nanny',
  'chef',
  'massage',
  'service_generic',
]

export async function GET(request) {
  const auth = await requireAdmin(request)
  if (auth.response) {
    return auth.response
  }

  const { data, error } = await supabaseAdmin
    .from('categories')
    .select('*')
    .order('order', { ascending: true })

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  const { data: waitlistRows, error: waitlistError } = await supabaseAdmin
    .from('leads_waiting_list')
    .select('category_slug')

  if (waitlistError) {
    return NextResponse.json({ success: false, error: waitlistError.message }, { status: 500 })
  }

  const waitlistCountBySlug = (waitlistRows || []).reduce((acc, row) => {
    const slug = String(row?.category_slug || '').trim().toLowerCase()
    if (!slug) return acc
    acc[slug] = (acc[slug] || 0) + 1
    return acc
  }, {})

  return NextResponse.json({
    success: true,
    data: (data || []).map((row) => {
      const mapped = mapRow(row)
      mapped.waitlistLeads = Number(waitlistCountBySlug[String(mapped.slug || '').toLowerCase()] || 0)
      return mapped
    }),
    wizardProfileOptions: WIZARD_PROFILE_OPTIONS.filter(Boolean),
  })
}

export async function POST(request) {
  const auth = await requireAdmin(request)
  if (auth.response) {
    return auth.response
  }

  try {
    const body = await request.json()
    const { name, slug, icon, description, order, parentId, wizardProfile, nameI18n, isComingSoon, isPreviewOnly } = body

    if (!name || !slug) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: name, slug' },
        { status: 400 },
      )
    }

    const pid = parentId && String(parentId).trim() ? String(parentId).trim() : null
    const wp =
      wizardProfile != null && String(wizardProfile).trim()
        ? String(wizardProfile).trim().toLowerCase()
        : null

    const ni =
      nameI18n && typeof nameI18n === 'object' && !Array.isArray(nameI18n)
        ? Object.fromEntries(
            Object.entries(nameI18n)
              .filter(([k]) => ['ru', 'en', 'zh', 'th'].includes(String(k).toLowerCase()))
              .map(([k, v]) => [String(k).toLowerCase(), typeof v === 'string' ? v.trim().slice(0, 200) : ''])
              .filter(([, v]) => v),
          )
        : null

    const insert = {
      name,
      slug: String(slug).trim().toLowerCase(),
      icon: icon || '📦',
      description: description ?? null,
      order: Number.isFinite(Number(order)) ? Number(order) : 0,
      is_active: true,
      is_coming_soon: isComingSoon === true,
      is_preview_only: isPreviewOnly === true,
      parent_id: pid,
      wizard_profile: wp,
      ...(ni && Object.keys(ni).length ? { name_i18n: ni } : {}),
    }

    const { data: category, error } = await supabaseAdmin
      .from('categories')
      .insert(insert)
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: mapRow(category) })
  } catch (e) {
    console.error('[ADMIN CATEGORIES POST]', e)
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}

export async function PATCH(request) {
  const auth = await requireAdmin(request)
  if (auth.response) {
    return auth.response
  }

  try {
    const body = await request.json()
    const {
      id,
      name,
      slug,
      icon,
      description,
      order,
      parentId,
      wizardProfile,
      isActive,
      isComingSoon,
      isPreviewOnly,
      nameI18n,
    } = body

    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 })
    }

    const patch = {}

    if (name !== undefined) patch.name = name
    if (slug !== undefined) patch.slug = String(slug).trim().toLowerCase()
    if (icon !== undefined) patch.icon = icon
    if (description !== undefined) patch.description = description
    if (order !== undefined && Number.isFinite(Number(order))) patch.order = Number(order)
    if (isActive !== undefined) patch.is_active = Boolean(isActive)
    if (isComingSoon !== undefined) patch.is_coming_soon = Boolean(isComingSoon)
    if (isPreviewOnly !== undefined) patch.is_preview_only = Boolean(isPreviewOnly)

    if (parentId !== undefined) {
      const pid = parentId && String(parentId).trim() ? String(parentId).trim() : null
      if (pid === String(id)) {
        return NextResponse.json({ success: false, error: 'Category cannot be its own parent' }, { status: 400 })
      }
      patch.parent_id = pid
    }

    if (wizardProfile !== undefined) {
      const w = String(wizardProfile || '').trim().toLowerCase()
      patch.wizard_profile = w || null
    }

    if (nameI18n !== undefined) {
      if (nameI18n === null) {
        patch.name_i18n = null
      } else if (typeof nameI18n === 'object' && !Array.isArray(nameI18n)) {
        const ni = Object.fromEntries(
          Object.entries(nameI18n)
            .filter(([k]) => ['ru', 'en', 'zh', 'th'].includes(String(k).toLowerCase()))
            .map(([k, v]) => [String(k).toLowerCase(), typeof v === 'string' ? v.trim().slice(0, 200) : ''])
            .filter(([, v]) => v),
        )
        patch.name_i18n = Object.keys(ni).length ? ni : null
      }
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 })
    }

    const { data: category, error } = await supabaseAdmin
      .from('categories')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: mapRow(category) })
  } catch (e) {
    console.error('[ADMIN CATEGORIES PATCH]', e)
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}
