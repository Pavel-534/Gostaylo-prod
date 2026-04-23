'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Ticket, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function AdminBookingsLookupPage() {
  const router = useRouter()
  const [id, setId] = useState('')

  function go() {
    const trimmed = id.trim()
    if (!trimmed) return
    router.push(`/admin/bookings/${encodeURIComponent(trimmed)}`)
  }

  return (
    <div className="max-w-lg mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-2 text-slate-900">
        <Ticket className="h-7 w-7 text-teal-600" />
        <h1 className="text-2xl font-bold">Бронь по ID</h1>
      </div>
      <Card className="rounded-2xl border-slate-200">
        <CardHeader>
          <CardTitle className="text-base">Открыть карточку</CardTitle>
          <CardDescription>Вставьте UUID брони — откроется страница с Emergency Logs и настройками лимита.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bid">Booking ID</Label>
            <Input
              id="bid"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={id}
              onChange={(e) => setId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && go()}
            />
          </div>
          <Button type="button" className="w-full bg-teal-600 hover:bg-teal-700" onClick={go}>
            Перейти
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
