'use client'

import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Globe, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  MOBILE_FLAT_CARD_CLASS,
  MOBILE_FLAT_CARD_CONTENT_CLASS,
  MOBILE_FLAT_CARD_HEADER_CLASS,
} from '@/lib/ui/mobile-flat-canvas'

/** Налоги, комиссии, валюты — канон в `/admin/settings` (не дублируем формы здесь). */
export function SystemSettingsFinance() {
  return (
    <Card className={cn(MOBILE_FLAT_CARD_CLASS, 'sm:border-2 sm:border-emerald-200 sm:bg-gradient-to-br sm:from-emerald-50 sm:to-white')}>
      <CardHeader className={MOBILE_FLAT_CARD_HEADER_CLASS}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 lg:w-12 lg:h-12 bg-gradient-to-br from-emerald-600 to-brand-hover rounded-xl flex items-center justify-center flex-shrink-0">
            <Globe className="w-5 h-5 lg:w-6 lg:h-6 text-white" />
          </div>
          <div>
            <CardTitle className="text-base lg:text-lg">Финансы и валюта</CardTitle>
            <CardDescription className="text-xs lg:text-sm">
              Ставка налога, комиссии платформы, отображение валют — единая страница настроек.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className={MOBILE_FLAT_CARD_CONTENT_CLASS}>
        <Button asChild className="min-h-[44px] max-sm:w-full bg-emerald-600 hover:bg-emerald-700">
          <Link href="/admin/settings">
            Открыть «Настройки сайта»
            <ExternalLink className="w-4 h-4 ml-2 inline" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}
