/**
 * GET /api/admin/settings/legal/pdf — справка PDF по активным версиям (ADMIN).
 */

import { NextResponse } from 'next/server'
import { requireAdminStaff } from '@/lib/security/admin-staff-access'
import { LegalVersionsService } from '@/lib/services/legal-versions.service.js'
import { renderLegalRegistryPdf } from '@/lib/services/legal-registry-pdf.service.js'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const gate = await requireAdminStaff(request)
  if (gate.error) return gate.error

  const registry = await LegalVersionsService.getRegistry()
  const buffer = await renderLegalRegistryPdf({ registry })

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="legal-documents-${new Date().toISOString().slice(0, 10)}.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
}
