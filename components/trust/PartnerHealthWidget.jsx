'use client'

import { useEffect, useState, useCallback } from 'react'
import { Loader2, AlertTriangle, TrendingUp, Shield, ImageIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getUIText } from '@/lib/translations'
import { inferListingServiceTypeFromCategorySlug } from '@/lib/partner/listing-service-type'
import { getPartnerSlaResponseContextLine } from '@/lib/config/partner-category-sla-hints'
import { ListingCategoryIcon } from '@/components/booking/ListingCategoryIcon'

function factorLabel(key, language) {
  const k = `partnerHealth_factor_${key}`
  const t = getUIText(k, language)
  return t === k ? key : t
}

/**
 * @param {object} props
 * @param {string} [props.language]
 * @param {{ data: object | null, loading: boolean, error: string, reload: () => void } | null} [props.remote] — when set, skips internal fetch (Stage 19 dashboard bundle).
 */
export function PartnerHealthWidget({ language = 'ru', remote = null }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [data, setData] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/v2/partner/reputation-health', { credentials: 'include' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.success) {
        setError(json.error || 'load_failed')
        setData(null)
        return
      }
      setData(json.data)
    } catch {
      setError('network')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (remote) return
    void load()
  }, [load, remote])

  const effLoading = remote ? remote.loading : loading
  const effError = remote ? remote.error : error
  const effData = remote ? remote.data : data

  if (effLoading) {
    return (
      <Card className="border-teal-100 shadow-sm">
        <CardContent className="py-10 flex justify-center text-teal-700">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    )
  }

  if (effError || !effData?.snapshot) {
    return (
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-5 w-5 text-teal-600" />
            {getUIText('partnerHealth_title', language)}
          </CardTitle>
          <CardDescription>{getUIText('partnerHealth_loadError', language)}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const snap = effData.snapshot
  const pct = snap.reliabilityPercent
  const tier = String(snap.tier || 'NEW').toUpperCase()
  const factors = Array.isArray(effData.criticalFactors) ? effData.criticalFactors : []
  const path = effData.pathToTop || {}
  const dominantKind = inferListingServiceTypeFromCategorySlug(effData.dominantCategorySlug ?? null)
  const slaCategoryLine = getPartnerSlaResponseContextLine(dominantKind, language)
  const instr = effData.instructionPhotos
  const showInstructionHint =
    instr &&
    Number(instr.activeListingCount) > 0 &&
    Number(instr.listingsBelow3) > 0

  return (
    <Card className="border-teal-100 shadow-sm bg-gradient-to-br from-white to-teal-50/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Shield className="h-5 w-5 text-teal-600" />
          {getUIText('partnerHealth_title', language)}
        </CardTitle>
        <CardDescription>{getUIText('partnerHealth_subtitle', language)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {getUIText('partnerHealth_reliability', language)}
            </p>
            <p className="text-3xl font-bold text-slate-900 tabular-nums">
              {pct != null && Number.isFinite(pct) ? `${pct}%` : '—'}
            </p>
          </div>
          <Badge variant="secondary" className="mb-1 bg-teal-100 text-teal-900 border-teal-200">
            {tier}
          </Badge>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2 space-y-1">
          <p className="text-xs font-semibold text-slate-800">{getUIText('partnerHealth_responseSpeedTitle', language)}</p>
          <p className="text-sm text-slate-700 tabular-nums">
            {snap.initialResponseSampleCount30d > 0 && snap.avgInitialResponseMinutes30d != null ? (
              <>
                {getUIText('partnerHealth_responseSpeedAvg', language).replace(
                  '{{mins}}',
                  String(Math.round(Number(snap.avgInitialResponseMinutes30d) * 10) / 10),
                )}{' '}
                <span className="text-slate-500 text-xs">
                  {getUIText('partnerHealth_responseSpeedSamples', language).replace(
                    '{{n}}',
                    String(snap.initialResponseSampleCount30d),
                  )}
                </span>
              </>
            ) : (
              <span className="text-slate-500">{getUIText('partnerHealth_responseSpeedNoData', language)}</span>
            )}
          </p>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            {getUIText('partnerHealth_responseRankingHint', language)}
          </p>
          <div
            className={`mt-2 flex gap-2.5 rounded-lg border px-3 py-2.5 ${
              dominantKind === 'service'
                ? 'border-amber-300 bg-gradient-to-br from-amber-50 via-white to-orange-50 shadow-sm'
                : 'border-teal-200 bg-teal-50/80'
            }`}
          >
            <ListingCategoryIcon
              categorySlug={effData.dominantCategorySlug}
              className={`h-5 w-5 shrink-0 mt-0.5 ${dominantKind === 'service' ? 'text-amber-800' : 'text-teal-800'}`}
            />
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="text-xs font-medium text-slate-900 leading-relaxed">{slaCategoryLine}</p>
              {dominantKind === 'service' ? (
                <p className="text-[11px] font-semibold text-amber-950 leading-snug border border-amber-200/80 rounded-md bg-amber-100/60 px-2 py-1.5">
                  {getUIText('partnerHealth_slaServiceEmphasis', language)}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        {showInstructionHint ? (
          <div className="rounded-xl border border-sky-200 bg-sky-50/90 px-3 py-2.5 space-y-1">
            <p className="text-xs font-semibold text-sky-950 flex items-center gap-1.5">
              <ImageIcon className="h-3.5 w-3.5 shrink-0" />
              {getUIText('partnerHealth_instructionQualityTitle', language)}
            </p>
            <p className="text-[11px] text-sky-950/90 leading-relaxed">
              {getUIText('partnerHealth_instructionPhotosTrustHint', language)}
            </p>
            {instr.avgInstructionPhotos != null ? (
              <p className="text-[11px] text-sky-900/80 tabular-nums">
                {getUIText('partnerHealth_instructionScoreLabel', language).replace(
                  '{{score}}',
                  String(instr.avgInstructionPhotos),
                )}
              </p>
            ) : null}
          </div>
        ) : null}

        {factors.length > 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 space-y-1.5">
            <p className="text-xs font-semibold text-amber-950 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {getUIText('partnerHealth_criticalFactors', language)}
            </p>
            <ul className="text-xs text-amber-950 space-y-1 pl-4 list-disc">
              {factors.map((f) => (
                <li key={f.key}>
                  {factorLabel(f.key, language)}
                  {typeof f.impact === 'number' && f.key !== 'guest_reviews_top_floor' ? (
                    <span className="text-amber-800/90"> (~{f.impact} pts)</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            {getUIText('partnerHealth_noCritical', language)}
          </p>
        )}

        {!path.atTop ? (
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 space-y-1.5">
            <p className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-teal-600" />
              {getUIText('partnerHealth_pathToTop', language)}
            </p>
            <ul className="text-xs text-slate-600 space-y-1 pl-4 list-disc">
              {path.needMoreCleanStays > 0 ? (
                <li>
                  {getUIText('partnerHealth_pathCleanStays', language).replace(
                    '{{n}}',
                    String(path.needMoreCleanStays),
                  )}
                </li>
              ) : null}
              {path.pointsToTargetPercent != null && path.pointsToTargetPercent > 0 ? (
                <li>
                  {getUIText('partnerHealth_pathScore', language).replace(
                    '{{n}}',
                    String(path.pointsToTargetPercent),
                  )}
                </li>
              ) : null}
              {!path.disputesOk ? <li>{getUIText('partnerHealth_pathDisputes', language)}</li> : null}
              {!path.penaltiesOk ? <li>{getUIText('partnerHealth_pathPenalties', language)}</li> : null}
              {!path.slaTopOk ? <li>{getUIText('partnerHealth_pathSla', language)}</li> : null}
              {!path.guestReviewsTopOk ? <li>{getUIText('partnerHealth_pathGuestReviews', language)}</li> : null}
              {!path.guestStarsTopFloorOk ? (
                <li>{getUIText('partnerHealth_pathGuestStarsTop', language)}</li>
              ) : null}
              {path.needMoreCleanStays <= 0 &&
              path.pointsToTargetPercent <= 0 &&
              path.disputesOk &&
              path.penaltiesOk &&
              path.slaTopOk &&
              path.guestReviewsTopOk &&
              path.guestStarsTopFloorOk ? (
                <li>{getUIText('partnerHealth_pathKeep', language)}</li>
              ) : null}
            </ul>
          </div>
        ) : (
          <p className="text-sm font-medium text-emerald-800 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            {getUIText('partnerHealth_atTop', language)}
          </p>
        )}

        <p className="text-[11px] text-slate-500 leading-relaxed">{getUIText('partnerHealth_recencyHint', language)}</p>
      </CardContent>
    </Card>
  )
}
