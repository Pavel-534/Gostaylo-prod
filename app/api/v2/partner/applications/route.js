/**
 * GoStayLo — Partner application (canonical, Phase 1.8)
 * POST /api/v2/partner/applications
 *
 * Body: phone, experience, socialLink?, portfolio?, verificationDocUrl (required)
 * User id: JWT session only (optional userId in body must match session).
 * Writes partner_applications.verification_doc_url, syncs profiles.phone, Telegram NEW_PARTNERS.
 */

import { handlePartnerApplicationPost } from '@/lib/services/partner-application.service'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  return handlePartnerApplicationPost(request)
}
