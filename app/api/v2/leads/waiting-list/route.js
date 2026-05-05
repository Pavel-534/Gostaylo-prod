import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendToAdmin } from '@/lib/services/notifications/telegram.service'

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim())
}

export async function POST(request) {
  try {
    const body = await request.json()
    const categorySlug = String(body?.categorySlug || '').trim().toLowerCase()
    const email = String(body?.email || '').trim().toLowerCase()
    const language = String(body?.language || '').trim().toLowerCase() || null
    const sourcePage = String(body?.sourcePage || '').trim() || '/?coming-soon'

    if (!categorySlug) {
      return NextResponse.json({ success: false, error: 'categorySlug is required' }, { status: 400 })
    }
    if (!isValidEmail(email)) {
      return NextResponse.json({ success: false, error: 'Invalid email' }, { status: 400 })
    }

    const { data: category, error: categoryError } = await supabaseAdmin
      .from('categories')
      .select('id, slug, is_coming_soon')
      .eq('slug', categorySlug)
      .maybeSingle()

    if (categoryError) {
      return NextResponse.json({ success: false, error: categoryError.message }, { status: 500 })
    }
    if (!category) {
      return NextResponse.json({ success: false, error: 'Category not found' }, { status: 404 })
    }
    if (category.is_coming_soon !== true) {
      return NextResponse.json({ success: false, error: 'Category is not coming soon' }, { status: 400 })
    }

    const row = {
      id: `lead_${crypto.randomUUID()}`,
      category_id: category.id,
      category_slug: category.slug,
      email,
      language,
      source_page: sourcePage,
      metadata: { source: 'coming-soon-modal' },
    }

    const { error: insertError } = await supabaseAdmin
      .from('leads_waiting_list')
      .insert(row)

    if (insertError) {
      if (String(insertError.code) === '23505') {
        return NextResponse.json({ success: true, alreadySubscribed: true })
      }
      return NextResponse.json({ success: false, error: insertError.message }, { status: 500 })
    }

    // Fire-and-forget admin ping (DM or FINANCE topic fallback).
    void sendToAdmin(
      `🆕 <b>Новый лид на категорию ${category.slug}</b>\nEmail: <code>${email}</code>`,
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message || 'Unexpected error' }, { status: 500 })
  }
}
