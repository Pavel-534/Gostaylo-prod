/**
 * POST /api/admin/settings/legal/test-act — сгенерировать тестовый PDF-акт (smoke / демо).
 * Body: { partnerId?: string, amountThb?: number }
 */

import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { requireAccess } from '@/lib/security/access-guard'
import { supabaseAdmin } from '@/lib/supabase'
import { generatePayoutRequestDocuments } from '@/lib/services/payout-document.service.js'
import { createStorageSignedUrl } from '@/lib/storage/storage-upload.server.js'

export const dynamic = 'force-dynamic'

const BUCKET = 'payout-documents'

export async function POST(request) {
  const gate = await requireAccess({ roles: ['ADMIN'] })
  if (gate.error) return gate.error

  if (!supabaseAdmin) {
    return NextResponse.json({ success: false, error: 'no_db' }, { status: 503 })
  }

  let body = {}
  try {
    body = await request.json().catch(() => ({}))
  } catch {
    body = {}
  }

  let partnerId = body?.partnerId?.trim() || null
  if (!partnerId) {
    const { data: p } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('role', 'PARTNER')
      .eq('is_verified', true)
      .limit(1)
      .maybeSingle()
    partnerId = p?.id || null
  }
  if (!partnerId) {
    return NextResponse.json(
      { success: false, error: 'no_partner', message: 'Укажите partnerId или создайте верифицированного партнёра.' },
      { status: 400 },
    )
  }

  const amountThb = Math.max(1, Number(body?.amountThb) || 1000)
  const payoutId = `smoke-act-${randomUUID().slice(0, 8)}`

  const { data: payout, error: insErr } = await supabaseAdmin
    .from('payouts')
    .insert({
      id: payoutId,
      partner_id: partnerId,
      amount: amountThb,
      gross_amount: amountThb,
      currency: 'THB',
      status: 'PAID',
      processed_at: new Date().toISOString(),
      metadata: { smoke_test_act: true, generated_by: gate.profile?.id || null },
    })
    .select('*')
    .maybeSingle()

  if (insErr) {
    return NextResponse.json({ success: false, error: insErr.message }, { status: 500 })
  }

  const gen = await generatePayoutRequestDocuments(payout)
  if (!gen.success) {
    return NextResponse.json({ success: false, error: gen.error }, { status: 500 })
  }

  const path = gen.documents?.act?.path
  let signedUrl = null
  if (path) {
    const signed = await createStorageSignedUrl(BUCKET, path, 3600)
    if (signed.success) signedUrl = signed.signedUrl
  }

  return NextResponse.json({
    success: true,
    data: {
      payoutId,
      partnerId,
      documents: gen.documents,
      signedUrl,
      message: 'Тестовый акт сформирован. Ссылка действует 1 час.',
    },
  })
}
