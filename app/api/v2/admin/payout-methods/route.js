import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase'
import { getSessionPayload } from '@/lib/services/session-service'
import { PayoutRailsService } from '@/lib/services/payout-rails.service'

export const dynamic = 'force-dynamic'
export const revalidate = 0

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
    return NextResponse.json(
      { success: true, data: methods },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    )
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
      .maybeSingle()

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    if (!data) {
      return NextResponse.json(
        { success: false, error: 'Не удалось создать метод: пустой ответ от базы' },
        { status: 500 },
      )
    }
    revalidatePath('/api/v2/payout-methods')
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
      .maybeSingle()

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    if (!data) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Метод с таким id не найден (возможно, удалён). Нажмите «Отмена» и добавьте метод заново.',
        },
        { status: 404 },
      )
    }
    revalidatePath('/api/v2/payout-methods')
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

    const { count: usedInProfiles, error: refsError } = await supabaseAdmin
      .from('partner_payout_profiles')
      .select('id', { count: 'exact', head: true })
      .eq('method_id', methodId)
    if (refsError) return NextResponse.json({ success: false, error: refsError.message }, { status: 400 })

    if ((usedInProfiles || 0) > 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Нельзя удалить метод: он используется в реквизитах партнёров. Сначала переведите профили на другой метод.',
          details: { usedInProfiles },
        },
        { status: 409 },
      )
    }

    const { error } = await supabaseAdmin
      .from('payout_methods')
      .delete()
      .eq('id', methodId)

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    revalidatePath('/api/v2/payout-methods')
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
