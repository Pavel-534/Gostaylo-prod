/**
 * Stage 131.3 — `/go/[vanity]` short link: track click → ambassador landing with welcome.
 */
import { headers } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import ReferralAttributionService from '@/lib/referral/attribution.service.js'
import { resolveReferrerByVanityCode } from '@/lib/services/marketing/referral-vanity.service.js'

export const dynamic = 'force-dynamic'

function buildMockRequestFromHeaders(h) {
  const hdrs = new Headers()
  for (const key of [
    'x-forwarded-for',
    'x-real-ip',
    'cf-connecting-ip',
    'user-agent',
    'x-vercel-ip-country',
  ]) {
    const v = h.get(key)
    if (v) hdrs.set(key, v)
  }
  return { headers: hdrs }
}

export default async function VanityGoPage({ params, searchParams }) {
  const vanity = String(params?.vanity || '').trim()
  if (!vanity) notFound()

  const resolved = await resolveReferrerByVanityCode(vanity)
  if (!resolved?.data?.referrerProfile?.id) notFound()

  const { referrerProfile, code, vanityCode } = resolved.data
  const h = headers()
  const mockRequest = buildMockRequestFromHeaders(h)

  try {
    await ReferralAttributionService.recordClick({
      request: mockRequest,
      code,
      landingPath: `/go/${vanityCode}`,
      utmSource: searchParams?.utm_source ? String(searchParams.utm_source) : 'vanity_go',
      utmMedium: searchParams?.utm_medium ? String(searchParams.utm_medium) : 'referral',
      utmCampaign: searchParams?.utm_campaign ? String(searchParams.utm_campaign) : vanityCode,
    })
  } catch (e) {
    console.warn('[go/vanity track]', e?.message || e)
  }

  const qs = new URLSearchParams({ vanity: vanityCode, welcome: '1' })
  redirect(`/u/${encodeURIComponent(referrerProfile.id)}?${qs.toString()}`)
}
