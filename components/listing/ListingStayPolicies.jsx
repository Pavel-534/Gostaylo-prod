'use client'

import { LogIn, LogOut, ScrollText, Home, ShieldCheck, MessageCircle } from 'lucide-react'
import { getUIText } from '@/lib/translations'
import {
  getListingGoodToKnow,
  resolveListingCancellationPolicy,
} from '@/lib/listing/listing-good-to-know'
import { normalizeCancellationPolicy } from '@/lib/cancellation-refund-rules'
import { ListingCancellationPolicy } from '@/components/listing/ListingCancellationPolicy'
import { cn } from '@/lib/utils'
import { MOBILE_FLAT_INSET_CLASS } from '@/lib/ui/mobile-flat-canvas'

/**
 * Stay vertical — «Важно знать»: tiles + house rules + cancellation in one card (no full-bleed separators).
 */
export function ListingStayPolicies({ listing, language = 'ru' }) {
  const info = getListingGoodToKnow(listing, language)
  const policyRaw = resolveListingCancellationPolicy(listing)
  const policy = policyRaw ? normalizeCancellationPolicy(policyRaw) : null
  const bodyKey = policy ? `listingCancellation_${policy}` : null

  if (!info.isStayVertical) return null
  if (!info.hasContent && !policy) return null

  const t = (key) => getUIText(key, language)

  const tiles = []

  if (info.checkInTime) {
    tiles.push({
      key: 'check-in',
      icon: LogIn,
      label: t('listingGoodToKnow_checkIn'),
      value: t('listingGoodToKnow_checkInAfter').replace(/\{\{time\}\}/g, info.checkInTime),
    })
  }

  if (info.checkOutTime) {
    tiles.push({
      key: 'check-out',
      icon: LogOut,
      label: t('listingGoodToKnow_checkOut'),
      value: t('listingGoodToKnow_checkOutBefore').replace(/\{\{time\}\}/g, info.checkOutTime),
    })
  }

  if (info.propertyType) {
    tiles.push({
      key: 'property-type',
      icon: Home,
      label: t('listingGoodToKnow_propertyType'),
      value: info.propertyType,
    })
  }

  const flexNotes = []
  if (info.earlyCheckInOnRequest) {
    flexNotes.push(t('listingGoodToKnow_earlyOnRequest'))
  }
  if (info.lateCheckOutOnRequest) {
    flexNotes.push(t('listingGoodToKnow_lateOnRequest'))
  }

  const showPolicyBlock = Boolean(policy && bodyKey)
  const showRulesBlock = info.hasHouseRules
  const showUnifiedCard = showRulesBlock || showPolicyBlock

  return (
    <section className="space-y-5">
      <h2 className="text-2xl font-medium tracking-tight text-slate-900">
        {t('listingGoodToKnow_title')}
      </h2>

      {tiles.length > 0 ? (
        <div className="grid grid-cols-1 max-sm:gap-0 sm:grid-cols-2 sm:gap-4">
          {tiles.map(({ key, icon: Icon, label, value }) => (
            <div
              key={key}
              className={cn(
                MOBILE_FLAT_INSET_CLASS,
                'flex items-start gap-3 space-y-0 max-sm:border-b max-sm:border-slate-100 max-sm:py-3 sm:bg-white sm:p-4',
              )}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/10">
                <Icon className="h-5 w-5 text-brand" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900">{label}</p>
                <p className="mt-0.5 text-sm text-slate-600">{value}</p>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {flexNotes.length > 0 ? (
        <div
          className={cn(
            MOBILE_FLAT_INSET_CLASS,
            'flex items-start gap-3 max-sm:py-3 sm:rounded-2xl sm:border sm:border-slate-200 sm:bg-slate-50/80 sm:p-4',
          )}
          data-testid="listing-arrival-flexibility"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/10">
            <MessageCircle className="h-5 w-5 text-brand" aria-hidden />
          </div>
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-medium text-slate-900">{t('listingGoodToKnow_flexTitle')}</p>
            <ul className="space-y-1 text-sm leading-relaxed text-slate-600">
              {flexNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
            <p className="text-xs leading-relaxed text-slate-500">{t('listingGoodToKnow_flexFooter')}</p>
          </div>
        </div>
      ) : null}

      {showUnifiedCard ? (
        <div
          className={cn(
            MOBILE_FLAT_INSET_CLASS,
            'overflow-hidden space-y-0 sm:bg-slate-50/90 sm:p-0',
          )}
        >
          {showRulesBlock ? (
            <div className="max-sm:px-0 max-sm:py-4 sm:p-4 md:p-5">
              <div className="mb-3 flex items-center gap-2">
                <ScrollText className="h-5 w-5 text-slate-500" aria-hidden />
                <h3 className="text-base font-semibold text-slate-900">
                  {t('listingGoodToKnow_houseRules')}
                </h3>
              </div>
              <ul className="space-y-2 text-sm leading-relaxed text-slate-600">
                {info.houseRules.map((rule) => (
                  <li key={rule} className="flex gap-2">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-slate-400" aria-hidden />
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {showRulesBlock && showPolicyBlock ? (
            <div className="border-t border-slate-200" role="separator" aria-hidden />
          ) : null}

          {showPolicyBlock ? (
            <div className="max-sm:px-0 max-sm:py-4 sm:p-4 md:p-5">
              <div className="flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 shrink-0 text-brand mt-0.5" aria-hidden />
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    {t('listingCancellation_title')}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{t(bodyKey)}</p>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

/**
 * Non-stay verticals — cancellation only (no check-in / house rules).
 */
export function ListingGuestPolicies({ listing, language = 'ru' }) {
  const info = getListingGoodToKnow(listing, language)
  const policy = resolveListingCancellationPolicy(listing)

  if (info.isStayVertical) {
    return <ListingStayPolicies listing={listing} language={language} />
  }

  if (!policy) return null

  return <ListingCancellationPolicy policy={policy} language={language} />
}
