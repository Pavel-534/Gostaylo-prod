'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Ticket, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  MOBILE_FLAT_CARD_CLASS,
  MOBILE_FLAT_CARD_CONTENT_CLASS,
  MOBILE_FLAT_CARD_HEADER_CLASS,
} from '@/lib/ui/mobile-flat-canvas'

export default function AdminBookingsLookupPage() {
  const router = useRouter()
  const [id, setId] = useState('')

  function go() {
    const trimmed = id.trim()
    if (!trimmed) return
    router.push(`/admin/bookings/${encodeURIComponent(trimmed)}`)
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 max-sm:px-0 md:p-0">
      <div className="flex items-center gap-2 text-slate-900">
        <Ticket className="h-7 w-7 text-brand" />
        <h1 className="text-2xl font-bold">Бронь по ID</h1>
      </div>
      <Card className={cn(MOBILE_FLAT_CARD_CLASS, 'sm:rounded-2xl sm:border-slate-200')}>
        <CardHeader className={MOBILE_FLAT_CARD_HEADER_CLASS}>
          <CardTitle className="text-base">Открыть карточку</CardTitle>
          <CardDescription>
            Вставьте UUID брони — откроется страница с Emergency Logs и настройками лимита.
          </CardDescription>
        </CardHeader>
        <CardContent className={cn(MOBILE_FLAT_CARD_CONTENT_CLASS, 'space-y-4')}>
          <div className="space-y-2">
            <Label htmlFor="bid">Booking ID</Label>
            <Input
              id="bid"
              className="min-h-[44px]"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={id}
              onChange={(e) => setId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && go()}
            />
          </div>
          <Button type="button" className="min-h-[44px] w-full" onClick={go}>
            Перейти
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
