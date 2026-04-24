/**
 * GET /api/v2/marketing/ui-strings?lang=ru — public strings for catalog Flash strip (Stage 40.0).
 */

import { NextResponse } from 'next/server'
import { resolveMarketingUiStrings } from '@/lib/marketing/marketing-ui-strings'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const lang = searchParams.get('lang') || 'ru'
    const data = await resolveMarketingUiStrings(lang)
    return NextResponse.json(
      { success: true, data },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
        },
      },
    )
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e?.message || 'Internal error' },
      { status: 500 },
    )
  }
}
