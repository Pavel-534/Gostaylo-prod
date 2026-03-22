'use client'

import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Building2, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Липкий контекст чата: фото листинга, название, даты и статус брони.
 * Для админа/модератора — полоса «Admin View».
 */
export function StickyChatHeader({
  listing,
  booking,
  isAdminView = false,
  /** Имя собеседника (клиент / партнёр) */
  contactName,
  /** null — не показывать индикатор; иначе зелёный/серый = online/offline */
  presenceOnline = null,
  className,
  children,
}) {
  const img = listing?.images?.[0]
  const title = listing?.title || '—'

  const from = booking?.check_in
  const to = booking?.check_out
  const status = booking?.status

  let dateLine = null
  if (from || to || status) {
    const a = from ? safeFormat(from) : null
    const b = to ? safeFormat(to) : null
    dateLine = (
      <p className="text-sm text-slate-600 flex flex-wrap items-center gap-x-1 gap-y-1">
        {a}
        {a && b ? ' — ' : null}
        {b}
        {status ? (
          <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-800">
            {status}
          </span>
        ) : null}
      </p>
    )
  }

  return (
    <div className={cn('sticky top-0 z-20 bg-white/95 backdrop-blur border-b shadow-sm', className)}>
      {isAdminView && (
        <div className="bg-amber-50 border-b border-amber-200/80 px-4 py-2 text-center text-xs font-medium text-amber-950 flex items-center justify-center gap-2">
          <Shield className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>Admin View — доступ супервизора ко всем сообщениям в этом диалоге</span>
        </div>
      )}
      <div className="px-4 py-3 flex gap-3 items-start">
        {img ? (
          <img src={img} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0 border border-slate-100" />
        ) : (
          <div className="w-14 h-14 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
            <Building2 className="h-7 w-7 text-slate-400" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-900 truncate">{title}</p>
          {listing?.district ? (
            <p className="text-xs text-slate-500 truncate">{listing.district}</p>
          ) : null}
          {contactName ? (
            <p className="text-sm font-medium text-slate-800 mt-0.5 flex items-center gap-2">
              {contactName}
              {presenceOnline !== null && (
                <span
                  className={`inline-block w-2 h-2 rounded-full shrink-0 ${
                    presenceOnline ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                  title={presenceOnline ? 'Online' : 'Offline'}
                  aria-hidden
                />
              )}
            </p>
          ) : null}
          {dateLine}
        </div>
        {children ? <div className="shrink-0 flex items-center gap-2">{children}</div> : null}
      </div>
    </div>
  )
}

function safeFormat(iso) {
  try {
    return format(new Date(iso), 'd MMM yyyy', { locale: ru })
  } catch {
    return null
  }
}
