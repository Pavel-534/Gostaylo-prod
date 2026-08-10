/**
 * GET /api/v2/admin/concierge/prompt
 * ADR-210 Slice 7 — copyable LLM extractor prompt for admin UI.
 */

import { NextResponse } from 'next/server'
import { requireConciergeAdmin } from '@/lib/services/concierge/require-concierge-admin.js'
import { CONCIERGE_AI_EXTRACTOR_PROMPT_COPY } from '@/lib/services/concierge/ai-extractor-prompt-text.js'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const { error } = await requireConciergeAdmin(request)
  if (error) return error

  return NextResponse.json({
    success: true,
    prompt: CONCIERGE_AI_EXTRACTOR_PROMPT_COPY,
    sourceDoc: 'docs/runbooks/CONCIERGE_AI_EXTRACTOR_PROMPT.md',
  })
}
