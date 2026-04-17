import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSessionPayload } from '@/lib/services/session-service'
import { PayoutRailsService } from '@/lib/services/payout-rails.service'

export const dynamic = 'force-dynamic'

async function requireAdmin() {
  const session = await getSessionPayload()
  if (!session?.userId) return { error: 'Unauthorized', status: 401 }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', session.userId)
    .maybeSingle()
  if (error) return { error: error.message, status: 500 }

  if (String(data?.role || '').toUpperCase() !== 'ADMIN') {
    return { error: 'Admin access required', status: 403 }
  }
  return { userId: session.userId }
}

export async function GET() {
  const auth = await requireAdmin()
  if (auth.error) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }

  try {
    const methods = await PayoutRailsService.listPayoutMethods({ activeOnly: false })
    return NextResponse.json({ success: true, data: methods })
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function POST(request) {
  const auth = await requireAdmin()
  if (auth.error) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }

  try {
    const body = await request.json()
    const method = PayoutRailsService.normalizeMethodPayload(body)
    if (!method.name) {
      return NextResponse.json({ success: false, error: 'Method name is required' }, { status: 400 })
    }

    const id = body.id || PayoutRailsService.makeMethodId()
    const { data, error } = await supabaseAdmin
      .from('payout_methods')
      .insert({ id, ...method })
      .select()
      .single()

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function PUT(request) {
  const auth = await requireAdmin()
  if (auth.error) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }

  try {
    const body = await request.json()
    const methodId = body.id
    if (!methodId) {
      return NextResponse.json({ success: false, error: 'Method id is required' }, { status: 400 })
    }

    const patch = PayoutRailsService.normalizeMethodPayload(body)
    patch.updated_at = new Date().toISOString()

    const { data, error } = await supabaseAdmin
      .from('payout_methods')
      .update(patch)
      .eq('id', methodId)
      .select()
      .single()

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function DELETE(request) {
  const auth = await requireAdmin()
  if (auth.error) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }

  try {
    const { searchParams } = new URL(request.url)
    const methodId = searchParams.get('id')
    if (!methodId) {
      return NextResponse.json({ success: false, error: 'Method id is required' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('payout_methods')
      .delete()
      .eq('id', methodId)

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
