'use client'

import Link from 'next/link'
import { Key, MapPin, MessageSquare, Siren, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProxiedImage } from '@/components/proxied-image'
import { getUIText } from '@/lib/translations'
import { cn } from '@/lib/utils'

/**
 * Stage 196.0-A / 196.0-D — Day-of fulfillment (address / access / host chat / emergency).
 */
export function OrderCardCheckInAccessPack({
  language = 'ru',
  exactAddress = '',
  locationLabel = '',
  accessCode = '',
  instructionsText = '',
  photoUrls = [],
  chatHref = null,
  listingCategorySlug = null,
  wizardProfile = null,
  onPhotoClick,
  fromOfflineCache = false,
  showEmergency = false,
  emergencySending = false,
  onEmergencyClick = null,
}) {
  const addressLine = exactAddress || locationLabel
  const hasInstructions = Boolean(instructionsText || accessCode || (photoUrls && photoUrls.length > 0))
  if (!addressLine && !hasInstructions && !chatHref && !showEmergency) return null

  const uiCtx = {
    listingCategorySlug: listingCategorySlug || undefined,
    wizardProfile,
  }

  return (
    <div
      className="rounded-2xl border border-brand/25 bg-brand/5 px-3 py-3 space-y-3"
      data-testid="order-check-in-access-pack"
      data-offline-cache={fromOfflineCache ? '1' : '0'}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-hover">
          {getUIText('orderAccessPack_title', language)}
        </p>
        {fromOfflineCache ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-slate-200">
            <WifiOff className="h-3 w-3 shrink-0" aria-hidden />
            {getUIText('orderAccessPack_offlineSaved', language)}
          </span>
        ) : null}
      </div>

      {addressLine ? (
        <div className="flex items-start gap-2.5">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
          <div className="min-w-0 space-y-0.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              {exactAddress
                ? getUIText('orderAccessPack_exactAddress', language)
                : getUIText('orderAccessPack_area', language)}
            </p>
            <p className="text-sm font-medium text-slate-900 break-words leading-snug">{addressLine}</p>
            {exactAddress && locationLabel && locationLabel !== exactAddress ? (
              <p className="text-xs text-slate-500 break-words">{locationLabel}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {accessCode ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
          <Key className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden />
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              {getUIText('orderAccessPack_accessCode', language)}
            </p>
            <p className="font-mono text-base font-semibold tracking-wide text-slate-900 select-all">
              {accessCode}
            </p>
          </div>
        </div>
      ) : null}

      {instructionsText ? (
        <div className="space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
            <Key className="h-3.5 w-3.5 text-slate-400 shrink-0" aria-hidden />
            {getUIText('orderCheckInInstructions_title', language)}
          </p>
          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{instructionsText}</p>
        </div>
      ) : null}

      {photoUrls?.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[11px] font-medium text-slate-600">
            {getUIText('orderCheckInPhotos_caption', language, uiCtx)}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {photoUrls.map((url, idx) => (
              <button
                key={url}
                type="button"
                onClick={() => onPhotoClick?.(idx)}
                className={cn(
                  'relative aspect-[4/3] min-h-11 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm',
                  'outline-none ring-offset-2 transition hover:ring-2 hover:ring-brand/40 focus-visible:ring-2 focus-visible:ring-brand cursor-zoom-in',
                )}
                aria-label={getUIText('orderCheckInPhotos_openLightbox', language)}
              >
                <ProxiedImage src={url} alt="" fill className="object-cover" sizes="120px" />
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        {chatHref ? (
          <Button asChild variant="brand" className="min-h-11 w-full sm:flex-1">
            <Link href={chatHref}>
              <MessageSquare className="mr-2 h-4 w-4" aria-hidden />
              {getUIText('orderAccessPack_contactHost', language, uiCtx)}
            </Link>
          </Button>
        ) : null}
        {showEmergency && typeof onEmergencyClick === 'function' ? (
          <Button
            type="button"
            variant="destructive"
            className="min-h-11 w-full bg-red-700 hover:bg-red-800 sm:flex-1"
            disabled={emergencySending}
            onClick={onEmergencyClick}
            data-testid="order-access-pack-emergency"
          >
            <Siren className="mr-2 h-4 w-4" aria-hidden />
            {getUIText('orderHelp_emergencyContact', language)}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
