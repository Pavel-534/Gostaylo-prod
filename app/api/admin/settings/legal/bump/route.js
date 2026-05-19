/**
 * POST /api/admin/settings/legal/bump
 * Body: { "doc": "guest" | "partner" }
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

  const doc = String(body?.doc || body?.type || 'guest').toLowerCase()
  if (!['guest', 'partner'].includes(doc)) {
    return NextResponse.json(
      { success: false, error: 'doc must be guest or partner' },
      { status: 400 },
    )
  }

  const result = await LegalVersionsService.bumpVersion(doc, gate.profile?.id || null)
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    data: {
      doc,
      version: result.version,
      publishedAt: result.publishedAt,
      registry: result.registry,
      message:
        doc === 'guest'
          ? 'Новая версия гостевой оферты активна. Новые акцепты будут записываться с этим номером. Обновите текст на сайте, если меняли условия.'
          : 'Новая версия условий для партнёров активна. Обновите страницу /legal/partner-terms/, если меняли текст.',
    },
  })
}
