/**
 * POST /api/admin/settings/legal/publish
 * Body: { doc: "guest"|"partner" }
 */

import { NextResponse } from 'next/server'
import { requireAccess } from '@/lib/security/access-guard'
import { LegalVersionsService } from '@/lib/services/legal-versions.service.js'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  const gate = await requireAccess({ roles: ['ADMIN'] })
  if (gate.error) return gate.error

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const doc = String(body?.doc || 'guest').toLowerCase()
  if (!['guest', 'partner'].includes(doc)) {
    return NextResponse.json({ success: false, error: 'doc must be guest or partner' }, { status: 400 })
  }

  const result = await LegalVersionsService.publishDraft(doc, gate.profile?.id || null)
  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error, message: result.message },
      { status: result.error === 'no_draft' ? 409 : 500 },
    )
  }

  return NextResponse.json({
    success: true,
    data: {
      ...result,
      message:
        'Версия опубликована. Все новые оплаты и согласия будут записываться под номером ' +
        result.version +
        '.',
    },
  })
}
