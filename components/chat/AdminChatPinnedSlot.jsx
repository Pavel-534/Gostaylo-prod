'use client'

import { Shield, Headphones, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getUIText } from '@/lib/translations'
import { labelForSlug, SUPPORT_DISPUTE_KINDS, SUPPORT_REASONS } from '@/lib/support-request-options'
import { cn } from '@/lib/utils'

function ticketLang(language) {
  return language === 'en' ? 'en' : 'ru'
}

/**
 * Закреплённый блок над лентой в админ-треде: баннер, кратко участники,
 * приоритет/запрос в поддержку, кнопка «Вступить в диалог».
 */
export function AdminChatPinnedSlot({
  language = 'ru',
  adminParticipants = null,
  showJoinAsSupport = false,
  joinSupportLoading = false,
  onJoinAsSupport,
  isPriority = false,
  supportTicket = null,
}) {
  const t = (key) => getUIText(key, language)
  const lang = ticketLang(language)

  const ticketLine =
    supportTicket?.category && supportTicket?.disputeType
      ? `${labelForSlug(SUPPORT_REASONS, supportTicket.category, lang)} · ${labelForSlug(
          SUPPORT_DISPUTE_KINDS,
          supportTicket.disputeType,
          lang
        )}`
      : null

  const parts = adminParticipants
    ? [
        adminParticipants.renterName ? `${t('adminGuestLabel')}: ${adminParticipants.renterName}` : null,
        adminParticipants.partnerName ? `${t('adminPartnerLabel')}: ${adminParticipants.partnerName}` : null,
        adminParticipants.bookingId ? `${t('adminBookingLabel')}: ${adminParticipants.bookingId}` : null,
      ].filter(Boolean)
    : []

  return (
    <div className="space-y-0 border-b border-slate-200/80 bg-white">
      <div className="flex items-start gap-2 border-b border-amber-200/70 bg-amber-50/95 px-2.5 py-1.5 sm:px-3">
        <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-800" aria-hidden />
        <p className="text-left text-[11px] font-medium leading-snug text-amber-950 sm:text-xs">{t('adminObserverBanner')}</p>
      </div>

      {adminParticipants ? (
        <div className="px-2.5 py-1.5 text-[11px] leading-snug text-slate-700 sm:px-3 sm:text-xs">
          {parts.length > 0 ? (
            <p className="break-words">{parts.join(' · ')}</p>
          ) : (
            <p className="text-slate-500">{t('adminNoParticipantNames')}</p>
          )}
        </div>
      ) : null}

      {isPriority ? (
        <div className="border-t border-amber-100/90 bg-amber-50/40 px-2.5 py-1.5 sm:px-3">
          {ticketLine ? (
            <p className="text-[11px] text-amber-950 sm:text-xs">
              <span className="font-semibold">{t('adminSupportTicketHint')}</span> {ticketLine}
            </p>
          ) : (
            <p className="text-[11px] text-amber-900/90 sm:text-xs">{t('adminPriorityGenericHint')}</p>
          )}
        </div>
      ) : null}

      {showJoinAsSupport ? (
        <div className="border-t border-slate-200/60 bg-slate-50/80 px-2.5 py-1.5 sm:px-3">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className={cn(
              'h-8 w-full gap-1.5 border border-slate-200/90 bg-white text-xs text-slate-800 shadow-sm',
              'hover:bg-slate-50 sm:w-auto sm:min-w-[10rem]'
            )}
            disabled={joinSupportLoading}
            onClick={() => onJoinAsSupport?.()}
          >
            {joinSupportLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Headphones className="h-3.5 w-3.5 text-teal-600" />
            )}
            {t('adminJoinAsSupport')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
