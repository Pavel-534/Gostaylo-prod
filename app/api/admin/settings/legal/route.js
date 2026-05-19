/**
 * GET /api/admin/settings/legal — обзор версий и ссылок (ADMIN).
 */

import { NextResponse } from 'next/server'
import { requireAccess } from '@/lib/security/access-guard'
import { LegalVersionsService } from '@/lib/services/legal-versions.service.js'
import { LEGAL_PAGES } from '@/lib/services/legal-registry-pdf.service.js'
import { getLegalPublisherDetails } from '@/lib/config/legal-details.js'
import { getPublicSiteUrl } from '@/lib/site-url.js'

export const dynamic = 'force-dynamic'

const LEGAL_DOC_LINKS = [
  { id: 'guest_offer', label: 'Публичная оферта (гости)', path: '/legal/public-offer/' },
  { id: 'partner_terms', label: 'Условия для партнёров', path: '/legal/partner-terms/' },
  { id: 'privacy', label: 'Конфиденциальность', path: '/legal/privacy/' },
  { id: 'refund', label: 'Возвраты', path: '/legal/refund/' },
  { id: 'terms', label: 'Пользовательское соглашение', path: '/terms/' },
]

export async function GET() {
  const gate = await requireAccess({ roles: ['ADMIN'] })
  if (gate.error) return gate.error

  const registry = await LegalVersionsService.getRegistry()
  const origin = getPublicSiteUrl()
  const publisher = getLegalPublisherDetails()

  return NextResponse.json({
    success: true,
    data: {
      registry,
      textMeta: registry.textMeta,
      publisher,
      documents: LEGAL_DOC_LINKS.map((d) => ({
        ...d,
        url: `${origin}${d.path}`,
      })),
      pdfExportUrl: '/api/admin/settings/legal/pdf',
      consentsUrl: '/api/admin/settings/legal/consents',
      publishWarning:
        'После публикации новой версии все новые оплаты и согласия фиксируются под новым номером версии. Обновите текст на сайте до или сразу после публикации.',
    },
  })
}
