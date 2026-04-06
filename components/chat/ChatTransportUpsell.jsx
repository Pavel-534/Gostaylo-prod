'use client'

/**
 * Upsell «Транспорт» в ленте чата (рентер), сразу под milestone подтверждения / оплаты.
 */

import Link from 'next/link'
import { Car } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function ChatTransportUpsell({ href, language = 'ru', className }) {
  const ru = language === 'ru'
  return (
    <div
      className={cn(
        'w-full max-w-sm rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm',
        className,
      )}
    >
      <div className="flex items-start gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-teal-600">
          <Car className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-xs font-semibold text-slate-900">
            {ru ? 'Нужен транспорт?' : 'Need transport?'}
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-slate-600">
            {ru
              ? 'Посмотрите доступные варианты рядом с вашим жильём'
              : 'Browse options near your stay'}
          </p>
          <Button
            asChild
            size="sm"
              className="mt-2 h-10 w-full rounded-2xl bg-teal-600 text-xs hover:bg-teal-700"
          >
            <Link href={href}>{ru ? 'Смотреть транспорт' : 'Browse transport'}</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
