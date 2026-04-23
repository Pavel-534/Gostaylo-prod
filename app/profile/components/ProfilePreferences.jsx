'use client'

import { Plane, Building2, Settings, LogOut, MessageSquare, CheckCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export function ProfilePreferences({ user, isPartner, onLogout, router }) {
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
          <Button variant="outline" className="w-full justify-start" onClick={() => router.push('/partner/dashboard')}>
            <Building2 className="h-4 w-4 mr-2 text-slate-500" />
            Панель партнёра
          </Button>
        )}
        {user?.telegram_id ? (
          <div className="flex items-center justify-between p-2 rounded-md bg-green-50 border border-green-200">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-green-600" />
              <span className="text-sm text-green-700">Telegram привязан</span>
            </div>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </div>
        ) : null}
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
