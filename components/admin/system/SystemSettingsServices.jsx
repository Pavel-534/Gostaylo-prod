'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Bot,
  RefreshCw,
  AlertTriangle,
  Activity,
  TestTube,
  Palmtree,
  MessageSquare,
  Zap,
  Wifi,
  WifiOff,
} from 'lucide-react'

function WebhookStatusBadge({ webhookStatus }) {
  if (!webhookStatus?.isActive) {
    return (
      <Badge variant="destructive" className="flex items-center gap-1 text-xs">
        <WifiOff className="w-3 h-3" /> Офлайн
      </Badge>
    )
  }
  if (webhookStatus?.hasError) {
    return (
      <Badge className="bg-amber-500 flex items-center gap-1 text-xs">
        <AlertTriangle className="w-3 h-3" /> Ошибки
      </Badge>
    )
  }
  return (
    <Badge className="bg-green-500 flex items-center gap-1 text-xs">
      <Wifi className="w-3 h-3" /> Онлайн
    </Badge>
  )
}

/** Telegram, outbox, диагностика интеграций. */
export function SystemSettingsServices({
  webhookStatus,
  webhookLoading,
  testingConnection,
  outboxStats,
  outboxWorkerLoading,
  outboxLastResult,
  onRelinkWebhook,
  onTestConnection,
  onSendAloha,
  onRefreshWebhook,
  onProcessOutbox,
  formatDate,
}) {
  return (
    <div className="space-y-4">
      <Card className="border-2 border-slate-200">
        <CardHeader className="p-4 lg:p-6 pb-2 lg:pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 lg:w-12 lg:h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center flex-shrink-0">
                <Bot className="w-5 h-5 lg:w-6 lg:h-6 text-white" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-base lg:text-lg">Вебхук Telegram-бота</CardTitle>
                <CardDescription className="text-xs lg:text-sm">Подключение и диагностика</CardDescription>
              </div>
            </div>
            <WebhookStatusBadge webhookStatus={webhookStatus} />
          </div>
        </CardHeader>
        <CardContent className="p-4 lg:p-6 pt-2 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-slate-100 p-3 rounded-lg">
              <Label className="text-xs text-slate-500 uppercase">URL вебхука</Label>
              <p className="text-xs font-mono mt-1 break-all leading-relaxed">
                {webhookStatus?.url || 'Не настроен'}
              </p>
            </div>
            <div className="bg-slate-100 p-3 rounded-lg">
              <Label className="text-xs text-slate-500 uppercase">Ожидающие обновления</Label>
              <p className="text-2xl font-bold text-slate-900 mt-1">{webhookStatus?.pendingUpdates || 0}</p>
            </div>
          </div>

          {webhookStatus?.lastError ? (
            <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg">
              <div className="flex items-center gap-2 text-amber-700 mb-1">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span className="font-medium text-sm">Последняя ошибка</span>
              </div>
              <p className="text-xs text-amber-600 break-all">{webhookStatus.lastError}</p>
              <p className="text-xs text-amber-500 mt-1">
                {webhookStatus.lastErrorDate ? formatDate(webhookStatus.lastErrorDate) : ''}
              </p>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={onRelinkWebhook}
              disabled={webhookLoading}
              size="sm"
              className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white text-xs"
            >
              {webhookLoading ? (
                <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="w-3 h-3 mr-1" />
              )}
              Переподключить
            </Button>
            <Button
              onClick={onTestConnection}
              disabled={testingConnection}
              size="sm"
              variant="outline"
              className="border-purple-500 text-purple-700 hover:bg-purple-50 text-xs"
            >
              {testingConnection ? (
                <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
              ) : (
                <TestTube className="w-3 h-3 mr-1" />
              )}
              Тест связи
            </Button>
            <Button onClick={onSendAloha} size="sm" variant="outline" className="border-teal-500 text-teal-700 hover:bg-teal-50 text-xs">
              <Palmtree className="w-3 h-3 mr-1" />
              Отправить &quot;Aloha&quot;
            </Button>
            <Button onClick={onRefreshWebhook} size="sm" variant="outline" className="text-xs">
              <Activity className="w-3 h-3 mr-1" />
              Обновить
            </Button>
          </div>

          <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg text-xs text-blue-700">
            <p className="font-medium mb-1">💡 Диагностика:</p>
            <ul className="list-disc list-inside space-y-0.5 text-blue-600">
              <li>502 ошибка = сервер перезапускается (подождите 30 сек)</li>
              <li>Используйте &quot;Тест связи&quot; для проверки соединения</li>
              <li>Кнопка &quot;Aloha&quot; отправляет сообщение напрямую</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card className="border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-slate-50">
        <CardHeader className="p-4 lg:p-6 pb-2 lg:pb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 lg:w-12 lg:h-12 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <MessageSquare className="w-5 h-5 lg:w-6 lg:h-6 text-white" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base lg:text-lg">Очередь уведомлений (outbox)</CardTitle>
              <CardDescription className="text-xs lg:text-sm">
                Требуется <code className="text-[11px]">NOTIFICATION_OUTBOX=1</code> и миграции Stage 57–60 (в т.ч.{' '}
                <code className="text-[11px]">updated_at</code> для reclaim). Cron:{' '}
                <code className="text-[11px]">/api/cron/notification-outbox</code> каждые 5 мин. Статистика обновляется
                каждые ~25 с.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 lg:p-6 pt-0 space-y-3">
          {outboxStats?.counts ? (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 rounded-lg border border-violet-100 bg-white/70 p-3 text-[11px] sm:text-xs">
              {[
                { key: 'pending', label: 'Ожидают' },
                { key: 'processing', label: 'В работе' },
                { key: 'failed', label: 'Ошибка' },
                { key: 'permanent_failure', label: 'Фатально' },
                { key: 'sent', label: 'Отправлено' },
              ].map(({ key, label }) => (
                <div key={key} className="rounded-md bg-violet-50/80 px-2 py-2 text-center">
                  <div className="font-medium text-violet-950 tabular-nums text-sm sm:text-base">
                    {outboxStats.counts[key] ?? 0}
                  </div>
                  <div className="text-slate-600 leading-tight">{label}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              Статистика очереди недоступна (проверьте сессию ADMIN и применение миграций).
            </p>
          )}
          <Button
            type="button"
            onClick={onProcessOutbox}
            disabled={outboxWorkerLoading}
            className="bg-violet-600 hover:bg-violet-700 text-white"
          >
            {outboxWorkerLoading ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin inline" />
            ) : (
              <Zap className="w-4 h-4 mr-2 inline" />
            )}
            Обработать очередь сейчас
          </Button>
          {outboxLastResult?.success ? (
            <p className="text-xs text-slate-600">
              Последний запуск: reclaim {outboxLastResult.reclaimed ?? 0}, claimed {outboxLastResult.claimed ?? 0}, sent{' '}
              {outboxLastResult.sent ?? 0}, retry {outboxLastResult.failed ?? 0}, permanent{' '}
              {outboxLastResult.permanentFailure ?? 0}, skipped {outboxLastResult.skipped ?? 0}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
