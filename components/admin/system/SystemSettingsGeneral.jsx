'use client'

import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Palmtree, Sparkles, ChevronRight, Shield, Bot, Zap } from 'lucide-react'

/** Overview: title row, AI dashboard shortcut, quick health cards. */
export function SystemSettingsGeneral({ maintenanceMode, webhookStatus }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Palmtree className="w-6 h-6 lg:w-8 lg:h-8 text-teal-600 flex-shrink-0" />
            <h1 className="text-xl lg:text-2xl font-bold text-slate-900 truncate">Центр управления</h1>
          </div>
          <p className="text-sm text-slate-600">Управление платформой и интеграциями</p>
        </div>
        <Badge
          variant={maintenanceMode ? 'destructive' : 'default'}
          className="self-start sm:self-auto text-xs px-2 py-1 flex-shrink-0"
        >
          {maintenanceMode ? '🔴 Обслуживание' : '🟢 Работает'}
        </Badge>
      </div>

      <Link href="/admin/system/ai" className="block group">
        <Card className="border-2 border-violet-200 bg-gradient-to-br from-violet-50 via-white to-indigo-50 transition-shadow hover:shadow-lg">
          <CardContent className="p-4 lg:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 lg:w-12 lg:h-12 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md group-hover:scale-[1.02] transition-transform">
                  <Sparkles className="w-5 h-5 lg:w-6 lg:h-6 text-white" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-base lg:text-lg text-slate-900">ИИ-аналитика</h3>
                  <p className="text-xs lg:text-sm text-slate-600">
                    Расходы OpenAI: Ленивый Риелтор (TG) и генератор описаний в кабинете партнёра
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 text-violet-700 font-medium text-sm self-end sm:self-auto">
                Открыть дашборд
                <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="bg-gradient-to-br from-teal-50 to-cyan-50 border-teal-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-teal-600 font-medium">Статус системы</p>
                <p className="text-lg font-bold text-teal-900">
                  {maintenanceMode ? 'Обслуживание' : 'Работает'}
                </p>
              </div>
              <Shield className={`w-8 h-8 ${maintenanceMode ? 'text-amber-500' : 'text-teal-500'}`} />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-600 font-medium">Статус бота</p>
                <p className="text-lg font-bold text-blue-900">
                  {webhookStatus?.hasError ? 'Ошибки' : webhookStatus?.isActive ? 'Подключён' : 'Офлайн'}
                </p>
              </div>
              <Bot
                className={`w-8 h-8 ${webhookStatus?.isActive && !webhookStatus?.hasError ? 'text-blue-500' : 'text-red-500'}`}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-purple-600 font-medium">В очереди</p>
                <p className="text-lg font-bold text-purple-900">{webhookStatus?.pendingUpdates || 0}</p>
              </div>
              <Zap className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
