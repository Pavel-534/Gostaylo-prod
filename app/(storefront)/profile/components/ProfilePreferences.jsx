'use client'

import { Plane, Building2, Settings, LogOut, MessageSquare, CheckCircle, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getUIText } from '@/lib/translations'

export function ProfilePreferences({
  user,
  isPartner,
  onLogout,
  router,
  onOpenPartnerDashboard,
  partnerNavBusy,
  partnerNavLanguage = 'ru',
}) {
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-base">Быстрые действия</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Button variant="outline" className="w-full justify-start" onClick={() => router.push('/my-bookings')}>
          <Plane className="h-4 w-4 mr-2 text-slate-500" />
          Мои бронирования
        </Button>
        {isPartner && (
          <Button
            variant="outline"
            className="w-full justify-start"
            disabled={partnerNavBusy}
            onClick={() => onOpenPartnerDashboard?.()}
          >
            {partnerNavBusy ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin text-slate-500" />
            ) : (
              <Building2 className="h-4 w-4 mr-2 text-slate-500" />
            )}
            {partnerNavBusy
              ? getUIText('profile_partnerNavOpening', partnerNavLanguage)
              : 'Панель партнёра'}
          </Button>
        )}
        {user?.telegram_id ? (
          <div className="flex items-center justify-between gap-2 rounded-md border border-brand/20 bg-brand/5 p-2">
            <div className="flex min-w-0 items-center gap-2">
              <MessageSquare className="h-4 w-4 shrink-0 text-brand" />
              <span className="truncate text-sm text-brand">Telegram привязан</span>
            </div>
            <CheckCircle className="h-4 w-4 shrink-0 text-brand" />
          </div>
        ) : (
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => router.push('/profile#account-connections')}
          >
            <MessageSquare className="mr-2 h-4 w-4 text-slate-500" />
            Привязать способы входа
          </Button>
        )}
        <Button variant="outline" className="w-full justify-start" onClick={() => router.push('/settings')}>
          <Settings className="h-4 w-4 mr-2 text-slate-500" />
          Настройки
        </Button>
        <Button
          variant="outline"
          className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
          onClick={onLogout}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Выйти
        </Button>
      </CardContent>
    </Card>
  )
}
