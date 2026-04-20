import { NextResponse } from 'next/server'
import { PayoutRailsService } from '@/lib/services/payout-rails.service'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const methods = await PayoutRailsService.listPayoutMethods({ activeOnly: true })
    return NextResponse.json(
      { success: true, data: methods },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    )
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
