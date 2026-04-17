/**
 * GoStayLo — Partner application (legacy alias, Phase 1.8)
 * POST /api/v2/partner/apply
 *
 * Delegates to the same handler as POST /api/v2/partner/applications.
 * Success JSON includes redirectTo for /profile flow.
 */

import { handlePartnerApplicationPost } from '@/lib/services/partner-application.service'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  return handlePartnerApplicationPost(request)
}
