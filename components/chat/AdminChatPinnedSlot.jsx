'use client'

import { Shield, Headphones, Loader2, Wifi, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Закреплённый блок над лентой сообщений в админском треде:
 * баннер наблюдателя, участники, «Вступить в диалог», индикатор Realtime.
 */
export function AdminChatPinnedSlot({
  language = 'ru',
  adminParticipants = null,
  showJoinAsSupport = false,
  joinSupportLoading = false,
  onJoinAsSupport,
  isConnected = false,
}) {
  const isEn = language === 'en'

  return (
    <div className="space-y-0">
      <div className="flex items-center justify-center gap-2 border-b border-amber-200/80 bg-amber-50 px-3 py-2 text-center text-xs font-medium text-amber-950">
        <Shield className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>
          {isEn
            ? 'Admin view — supervisor access to all messages in this thread'
            : 'Admin View — доступ супервизора ко всем сообщениям в этом диалоге'}
        </span>
      </div>

      {adminParticipants ? (
        <div className="border-b border-slate-200/80 bg-slate-50 px-3 py-2.5 text-xs text-slate-700 leading-relaxed sm:px-4">
          <p className="mb-1 font-semibold text-slate-800">
            {isEn ? 'Participants' : 'Участники диалога'}
          </p>
          <ul className="list-inside list-disc space-y-0.5">
            {adminParticipants.renterName ? (
              <li>
                {isEn ? 'Guest' : 'Гость'}:{' '}
                <span className="font-medium">{adminParticipants.renterName}</span>
              </li>
            ) : null}
            {adminParticipants.partnerName ? (
              <li>
                {isEn ? 'Partner' : 'Партнёр'}:{' '}
                <span className="font-medium">{adminParticipants.partnerName}</span>
              </li>
            ) : null}
            {adminParticipants.bookingId ? (
              <li>
                {isEn ? 'Booking' : 'Бронь'}:{' '}
                <span className="font-mono text-[11px]">{adminParticipants.bookingId}</span>
              </li>
            ) : null}
            {!adminParticipants.renterName && !adminParticipants.partnerName ? (
              <li className="text-slate-500">
                {isEn ? 'No participant names on record' : 'Участники не указаны в карточке беседы'}
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 bg-slate-50/90 px-3 py-2 sm:px-4">
        <span
          className={`inline-flex items-center gap-1 text-xs ${isConnected ? 'text-green-600' : 'text-orange-500'}`}
        >
          {isConnected ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
          {isConnected ? 'Live' : '…'}
        </span>
        {showJoinAsSupport ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="gap-1.5 border border-slate-200/90 bg-white/80 text-slate-700 shadow-sm hover:bg-slate-50"
            disabled={joinSupportLoading}
            onClick={() => onJoinAsSupport?.()}
          >
            {joinSupportLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Headphones className="h-4 w-4 text-teal-600" />
            )}
            {isEn ? 'Join as Support' : 'Вступить в диалог'}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
