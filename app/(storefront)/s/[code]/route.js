/**
 * Stage 207 — `/s/{code}?bg=beach|city|sea` — QR target of the Stories invite card.
 * Records a referral click tagged `utm_campaign=story_card` (utm_source=story_{bg}),
 * sets the attribution cookie and redirects to the ambassador landing.
 */
import { NextResponse } from 'next/server'
import { rateLimitCheck } from '@/lib/rate-limit'
import ReferralAttributionService from '@/lib/referral/attribution.service.js'

export const dynamic = 'force-dynamic'

const STORY_THEMES = new Set(['beach', 'city', 'sea'])

export async function GET(request, { params }) {
  const url = new URL(request.url)
  const code = String(params?.code || '').trim()
  const bgRaw = String(url.searchParams.get('bg') || '').trim().toLowerCase()
  const bg = STORY_THEMES.has(bgRaw) ? bgRaw : 'beach'

  if (!code) return NextResponse.redirect(new URL('/', url.origin))

  const rl = await rateLimitCheck(request, 'referral_track')
  if (rl) return NextResponse.redirect(new URL('/', url.origin))

  let result = null
  try {
    result = await ReferralAttributionService.recordClick({
      request,
      code,
      landingPath: `/s/${code}`,
      utmSource: `story_${bg}`,
      utmMedium: 'referral',
      utmCampaign: 'story_card',
    })
  } catch (e) {
    console.warn('[story invite track]', e?.message || e)
  }

  const referrerId = result?.success ? String(result.data?.referrerId || '').trim() : ''
  const target = referrerId
    ? new URL(`/u/${encodeURIComponent(referrerId)}?welcome=1`, url.origin)
    : new URL('/', url.origin)
  const res = NextResponse.redirect(target)
  if (result?.data?.setCookie) res.headers.append('Set-Cookie', result.data.setCookie)
  return res
}
