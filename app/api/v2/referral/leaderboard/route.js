import { NextResponse } from 'next/server'
import { getSessionPayload } from '@/lib/services/session-service'
import { supabaseAdmin } from '@/lib/supabase'
import { resolveReferralStatsTimeZone } from '@/lib/referral/resolve-referral-stats-timezone'
import { referralStatsCurrentMonthBoundsUtc } from '@/lib/referral/referral-stats-month-bounds'
import { buildReferralLeaderboard } from '@/lib/referral/build-referral-leaderboard'
import {
  formatReferralDateDdMmYyyyInTimeZone,
} from '@/lib/referral/format-referral-datetime'
import { listingYmdAtStartOfDayIso } from '@/lib/listing-date'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getSessionPayload()
  if (!session?.userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, iana_timezone')
    .eq('id', session.userId)
    .maybeSingle()

  if (profileError || !profile?.id) {
    return NextResponse.json(
      { success: false, error: profileError?.message || 'PROFILE_NOT_FOUND' },
      { status: 404 },
    )
  }

  const statsTz = resolveReferralStatsTimeZone(profile)
  const bounds = referralStatsCurrentMonthBoundsUtc(statsTz)
  const periodStartLabel = formatReferralDateDdMmYyyyInTimeZone(
    bounds.monthStartUtcIso,
    statsTz,
  )
  const lastDayIso =
    listingYmdAtStartOfDayIso(bounds.lastYmdInTz, statsTz) || bounds.monthStartUtcIso
  const periodEndLabel = formatReferralDateDdMmYyyyInTimeZone(lastDayIso, statsTz)

  const rows = await buildReferralLeaderboard(supabaseAdmin, {
    monthStartUtcIso: bounds.monthStartUtcIso,
    monthEndExclusiveUtcIso: bounds.monthEndExclusiveUtcIso,
    limit: 10,
  })

  return NextResponse.json({
    success: true,
    data: {
      statsCalendarIana: statsTz,
      /** Период лидерборда (календарный месяц в TZ статистики), подписи DD.MM.YYYY */
      periodStartDdMmYyyy: periodStartLabel,
      periodEndDdMmYyyy: periodEndLabel,
      yearMonthKey: bounds.ymKey,
      rows,
    },
  })
}
