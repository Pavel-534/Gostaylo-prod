'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Power,
  RefreshCw,
  AlertTriangle,
  Activity,
  Clock,
  Calendar,
  XCircle,
  Lock,
  Eye,
  EyeOff,
  Key,
} from 'lucide-react'

/** Режим обслуживания, iCal, журнал, пароль админа. */
export function SystemSettingsMaintenance({
  maintenanceMode,
  onMaintenanceToggle,
  icalSyncStatus,
  icalSyncFrequency,
  icalSyncing,
  onGlobalIcalSync,
  onRefreshIcalStatus,
  onIcalFrequencyChange,
  recentActivity,
  formatDate,
  newPassword,
  setNewPassword,
  confirmPassword,
  setConfirmPassword,
  showNewPassword,
  setShowNewPassword,
  changingPassword,
  onPasswordChange,
}) {
  return (
    <div className="space-y-4">
      <Card className={`border-2 ${maintenanceMode ? 'border-red-400 bg-red-50' : 'border-teal-400 bg-teal-50'}`}>
        <CardContent className="p-4 lg:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3 min-w-0">
              <div
                className={`w-10 h-10 lg:w-12 lg:h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${maintenanceMode ? 'bg-red-500' : 'bg-teal-500'}`}
              >
                <Power className="w-5 h-5 lg:w-6 lg:h-6 text-white" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-base lg:text-lg">Режим обслуживания</h3>
                <p className="text-xs lg:text-sm text-slate-600">Глобальный выключатель публичного сайта</p>
              </div>
            </div>
            <div className="flex items-center gap-3 self-end sm:self-auto flex-shrink-0">
              <Label className={`text-sm font-bold ${maintenanceMode ? 'text-red-700' : 'text-teal-700'}`}>
                {maintenanceMode ? 'ВКЛ' : 'ВЫКЛ'}
              </Label>
              <Switch checked={maintenanceMode} onCheckedChange={onMaintenanceToggle} className="scale-110" />
            </div>
          </div>
          <div
            className={`mt-4 p-3 rounded-lg text-sm ${maintenanceMode ? 'bg-red-100 text-red-700' : 'bg-teal-100 text-teal-700'}`}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>
                {maintenanceMode
                  ? 'Сайт отключён. Доступ только для администраторов.'
                  : 'Платформа полностью функциональна. Все пользователи имеют доступ.'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50">
        <CardHeader className="p-4 lg:p-6 pb-2 lg:pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 lg:w-12 lg:h-12 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl flex items-center justify-center flex-shrink-0">
                <Calendar className="w-5 h-5 lg:w-6 lg:h-6 text-white" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-base lg:text-lg">iCal Синхронизация</CardTitle>
                <CardDescription className="text-xs lg:text-sm">Глобальная синхронизация календарей</CardDescription>
              </div>
            </div>
            <Badge
              className={
                icalSyncStatus?.error_count > 0 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
              }
            >
              {icalSyncStatus?.error_count > 0 ? 'Есть ошибки' : 'Работает'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-4 lg:p-6 pt-2 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-lg p-3 border border-orange-200 text-center">
              <div className="text-2xl font-bold text-orange-600">{icalSyncStatus?.listings_synced || 0}</div>
              <div className="text-xs text-slate-500">Объявлений</div>
            </div>
            <div className="bg-white rounded-lg p-3 border border-green-200 text-center">
              <div className="text-2xl font-bold text-green-600">{icalSyncStatus?.success_count || 0}</div>
              <div className="text-xs text-slate-500">Успешно</div>
            </div>
            <div className="bg-white rounded-lg p-3 border border-red-200 text-center">
              <div className="text-2xl font-bold text-red-600">{icalSyncStatus?.error_count || 0}</div>
              <div className="text-xs text-slate-500">Ошибок</div>
            </div>
            <div className="bg-white rounded-lg p-3 border border-slate-200 text-center">
              <div className="text-sm font-medium text-slate-700">
                {icalSyncStatus?.last_sync
                  ? new Date(icalSyncStatus.last_sync).toLocaleString('ru-RU', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'Никогда'}
              </div>
              <div className="text-xs text-slate-500">Последняя синхр.</div>
            </div>
          </div>

          <div className="flex items-center justify-between bg-white rounded-lg p-3 border border-orange-200">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-500" />
              <span className="text-sm font-medium">Частота синхронизации</span>
            </div>
            <Select value={icalSyncFrequency} onValueChange={onIcalFrequencyChange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15m">15 минут</SelectItem>
                <SelectItem value="30m">30 минут</SelectItem>
                <SelectItem value="1h">1 час</SelectItem>
                <SelectItem value="2h">2 часа</SelectItem>
                <SelectItem value="6h">6 часов</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={onGlobalIcalSync}
              disabled={icalSyncing}
              className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600"
            >
              {icalSyncing ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Синхронизация...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Синхронизировать все
                </>
              )}
            </Button>
            <Button onClick={onRefreshIcalStatus} variant="outline" className="border-orange-300">
              <Activity className="w-4 h-4" />
            </Button>
          </div>

          <div className="bg-orange-50 border border-orange-200 p-3 rounded-lg text-xs text-orange-700">
            <p className="font-medium mb-1">📅 О синхронизации:</p>
            <ul className="list-disc list-inside space-y-0.5 text-orange-600">
              <li>Импортирует занятые даты из Airbnb, Booking.com, VRBO</li>
              <li>Создаёт блокировки в календаре объявлений</li>
              <li>Автоматически удаляет устаревшие блокировки</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card className="border-2 border-slate-200">
        <CardHeader className="p-4 lg:p-6 pb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center flex-shrink-0">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-base lg:text-lg">Журнал активности</CardTitle>
              <CardDescription className="text-xs">Последние 10 событий</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 lg:p-6 pt-2">
          {recentActivity.length === 0 ? (
            <div className="text-center py-6 text-slate-500">
              <Clock className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Нет активности</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {recentActivity.slice(0, 10).map((event, idx) => (
                <div
                  key={event.id || idx}
                  className="flex items-start sm:items-center justify-between gap-2 p-2 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-start sm:items-center gap-2 min-w-0">
                    <div
                      className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 sm:mt-0 ${
                        event.action?.includes('ERROR')
                          ? 'bg-red-500'
                          : event.action?.includes('MAINTENANCE')
                            ? 'bg-amber-500'
                            : 'bg-green-500'
                      }`}
                    />
                    <div className="min-w-0">
                      <span className="font-medium text-xs text-slate-900 block truncate">
                        {event.action || 'Неизвестно'}
                      </span>
                      <p className="text-xs text-slate-500 truncate">{event.details || ''}</p>
                    </div>
                  </div>
                  <span className="text-xs text-slate-400 flex-shrink-0 whitespace-nowrap">
                    {formatDate(event.created_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-2 border-slate-200">
        <CardHeader className="p-4 lg:p-6 pb-2 lg:pb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 lg:w-12 lg:h-12 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center flex-shrink-0">
              <Key className="w-5 h-5 lg:w-6 lg:h-6 text-white" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base lg:text-lg">Безопасность</CardTitle>
              <CardDescription className="text-xs lg:text-sm">Управление паролем администратора</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 lg:p-6 pt-2 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="new-password" className="text-sm font-medium">
                Новый пароль
              </Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNewPassword ? 'text' : 'password'}
                  placeholder="Минимум 8 символов"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password" className="text-sm font-medium">
                Подтвердите пароль
              </Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="Повторите пароль"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>

          {newPassword && confirmPassword && newPassword !== confirmPassword ? (
            <div className="bg-red-50 border border-red-200 p-3 rounded-lg text-sm text-red-700 flex items-center gap-2">
              <XCircle className="w-4 h-4 flex-shrink-0" />
              <span>Пароли не совпадают</span>
            </div>
          ) : null}

          <Button
            onClick={onPasswordChange}
            disabled={changingPassword || !newPassword || newPassword !== confirmPassword || newPassword.length < 8}
            className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
          >
            {changingPassword ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Обновление...
              </>
            ) : (
              <>
                <Lock className="w-4 h-4 mr-2" />
                Обновить пароль
              </>
            )}
          </Button>

          <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-xs text-amber-700">
            <p className="font-medium mb-1">⚠️ Требования к паролю:</p>
            <ul className="list-disc list-inside space-y-0.5 text-amber-600">
              <li>Минимум 8 символов</li>
              <li>После смены потребуется повторный вход</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
