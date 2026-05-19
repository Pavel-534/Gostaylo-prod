/**
 * GET /api/admin/settings/legal/export-zip — ZIP всех юр. документов (Stage 106.2).
 */

import { NextResponse } from 'next/server'
import { requireAccess } from '@/lib/security/access-guard'
import { buildLegalDocumentsExportZip } from '@/lib/services/legal-documents-export.service.js'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET() {
  const gate = await requireAccess({ roles: ['ADMIN'] })
  if (gate.error) return gate.error

  const built = await buildLegalDocumentsExportZip()
  if (!built.success || !built.buffer?.length) {
    return NextResponse.json(
      { success: false, error: built.error || 'Не удалось сформировать архив' },
      { status: 500 },
    )
  }

  return new NextResponse(built.buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${built.filename || 'legal-documents.zip'}"`,
      'Cache-Control': 'no-store',
    },
  })
}
