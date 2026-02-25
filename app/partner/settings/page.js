'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Copy, Check, ExternalLink, Bell, Mail, MessageSquare, Shield, Loader2 } from 'lucide-react'
import { generateLinkingCode } from '@/lib/telegram'
import { toast } from 'sonner'

export default function PartnerSettings() {
  const [linkingCode, setLinkingCode] = useState('')
  const [telegramLinked, setTelegramLinked] = useState(false)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)

  // Partner settings state
  const [settings, setSettings] = useState({
    agencyName: 'Иван Партнёров',
    email: 'partner@funnyrent.com',
    phone: '+7 999 123 4567',
    notifyTelegram: true,
    notifyEmail: true,
    notifyNewBooking: true,
    notifyNewMessage: true,
    notifyStatusChange: true,
    verificationStatus: 'VERIFIED',
    taxId: '',
  })

  function generateCode() {
    const code = generateLinkingCode()
    setLinkingCode(code)
    toast.info('Код сгенерирован! Отправьте его боту.')
  }

  function copyCode() {
    navigator.clipboard.writeText(linkingCode)
    setCopied(true)
    toast.success('Код скопирован!')
    setTimeout(() => setCopied(false), 2000)
  }

  function handleSaveSettings() {
    setLoading(true)
    // Mock save
    setTimeout(() => {
      setLoading(false)
      toast.success('Настройки сохранены!')
    }, 1000)
  }

  const verificationColors = {
    PENDING: 'bg-yellow-100 text-yellow-700',
    VERIFIED: 'bg-green-100 text-green-700',
    REJECTED: 'bg-red-100 text-red-700',
  }

  const verificationLabels = {
    PENDING: 'На модерации',
    VERIFIED: 'Подтверждён',
    REJECTED: 'Отклонён',
  }

  return (
    <div className="p-4 lg:p-8 space-y-8 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Настройки</h1>
        <p className="text-slate-600 mt-1">
          Управление профилем и уведомлениями
        </p>
      </div>

      {/* Profile Info */}
      <Card>
        <CardHeader>
          <CardTitle>Информация о профиле</CardTitle>
          <CardDescription>
            Основные данные вашего аккаунта
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="agencyName">Имя / Название агентства</Label>
            <Input
              id="agencyName"
              value={settings.agencyName}
              onChange={(e) => setSettings({ ...settings, agencyName: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={settings.email}
                onChange={(e) => setSettings({ ...settings, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Телефон</Label>
              <Input
                id="phone"
                value={settings.phone}
                onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <div>
              <p className="font-medium text-slate-900">Статус верификации</p>
              <p className="text-sm text-slate-600">Проверка личности и документов</p>
            </div>
            <Badge className={verificationColors[settings.verificationStatus]}>
              <Shield className="h-3 w-3 mr-1" />
              {verificationLabels[settings.verificationStatus]}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* KYC Verification */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-teal-600" />
            Верификация партнёра (KYC)
          </CardTitle>
          <CardDescription>
            Подтвердите личность для получения значка "Verified Partner"
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {settings.verificationStatus === 'VERIFIED' ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="bg-green-600 rounded-full p-2">
                  <Check className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-green-900 text-lg">Вы верифицированы!</p>
                  <p className="text-sm text-green-700">Значок "Verified" отображается на всех ваших объявлениях</p>
                </div>
              </div>
              <Badge className="bg-teal-600 text-white">
                <Shield className="h-3 w-3 mr-1" />
                Verified Partner
              </Badge>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h4 className="font-semibold text-amber-900 mb-2">Почему это важно?</h4>
                <ul className="text-sm text-amber-800 space-y-1 list-disc list-inside">
                  <li>Ваши объявления получат приоритет в поиске</li>
                  <li>Значок "Verified" повышает доверие арендаторов</li>
                  <li>Доступ к расширенным функциям платформы</li>
                </ul>
              </div>

              <div className="space-y-3">
                <Label>Загрузите документы</Label>
                <p className="text-sm text-slate-600">
                  Паспорт, водительские права или бизнес-лицензия
                </p>
                
                <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-teal-400 transition cursor-pointer">
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    id="kyc-upload"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        toast.success('Документ загружен (mock)')
                      }
                    }}
                  />
                  <label htmlFor="kyc-upload" className="cursor-pointer">
                    <Shield className="h-12 w-12 text-slate-400 mx-auto mb-3" />
                    <p className="font-medium text-slate-900 mb-1">Нажмите для загрузки</p>
                    <p className="text-sm text-slate-500">PNG, JPG или PDF до 10MB</p>
                  </label>
                </div>

                <Button
                  className="w-full bg-teal-600 hover:bg-teal-700"
                  onClick={() => {
                    toast.success('Документы отправлены на проверку!')
                    setSettings({ ...settings, verificationStatus: 'PENDING' })
                  }}
                >
                  Отправить на проверку
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Telegram Integration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-teal-600" />
            Telegram уведомления
          </CardTitle>
          <CardDescription>
            Получайте важные уведомления в Telegram
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {telegramLinked ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Check className="h-5 w-5 text-green-600" />
                <span className="font-semibold text-green-900">Telegram подключён</span>
              </div>
              <p className="text-sm text-green-700">
                Вы будете получать уведомления о новых бронированиях и сообщениях
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 border-red-200 text-red-600 hover:bg-red-50"
                onClick={() => setTelegramLinked(false)}
              >
                Отключить
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-slate-900 mb-2">Как подключить?</h4>
                <ol className="text-sm text-slate-700 space-y-1 list-decimal list-inside">
                  <li>Нажмите "Сгенерировать код"</li>
                  <li>Откройте бот @FunnyRentBot в Telegram</li>
                  <li>Отправьте команду /link с вашим кодом</li>
                  <li>Готово! Уведомления настроены</li>
                </ol>
              </div>

              {!linkingCode ? (
                <Button
                  onClick={generateCode}
                  className="w-full bg-teal-600 hover:bg-teal-700"
                >
                  Сгенерировать код подключения
                </Button>
              ) : (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      value={linkingCode}
                      readOnly
                      className="font-mono text-2xl text-center"
                    />
                    <Button
                      onClick={copyCode}
                      variant="outline"
                      className="flex-shrink-0"
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <Button
                    asChild
                    variant="outline"
                    className="w-full"
                  >
                    <a href="https://t.me/FunnyRentBot" target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Открыть бот в Telegram
                    </a>
                  </Button>
                  <Button
                    onClick={() => {
                      setTelegramLinked(true)
                      toast.success('Telegram подключён! (mock)')
                    }}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    Я отправил код ✓
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Telegram Bot for Listings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-teal-600" />
            Telegram Bot - Создание объявлений
          </CardTitle>
          <CardDescription>
            Публикуйте объявления прямо из Telegram
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${telegramLinked ? 'bg-green-500' : 'bg-slate-300'} animate-pulse`}></div>
              <div>
                <p className="font-semibold text-slate-900">Статус бота</p>
                <p className="text-sm text-slate-600">
                  {telegramLinked ? 'Подключён и готов к работе' : 'Не подключён'}
                </p>
              </div>
            </div>
            <Badge className={telegramLinked ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'}>
              {telegramLinked ? 'Connected' : 'Not Connected'}
            </Badge>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
              📱 Как создать объявление через бот?
            </h4>
            <div className="space-y-3 text-sm text-slate-700">
              <p className="font-medium">Формат сообщения:</p>
              <div className="bg-white p-3 rounded border border-blue-200 font-mono text-xs">
                Amazing villa with pool and garden.<br/>
                Price: 15000<br/>
                District: Rawai
              </div>
              <div className="space-y-1 mt-3">
                <p className="font-medium">Правила:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Первая строка = заголовок объявления</li>
                  <li><code className="bg-white px-1">Price: [число]</code> - цена в THB</li>
                  <li><code className="bg-white px-1">District: [название]</code> - район Пхукета</li>
                  <li>Прикрепите фото (опционально)</li>
                </ul>
              </div>
              <div className="bg-amber-50 p-2 rounded border border-amber-200 mt-3">
                <p className="text-xs text-amber-800">
                  ⚠️ Объявления создаются со статусом <strong>PENDING</strong> (черновик). 
                  Подтвердите их в панели управления перед публикацией.
                </p>
              </div>
            </div>
          </div>

          {telegramLinked && (
            <Button asChild className="w-full bg-teal-600 hover:bg-teal-700">
              <a href="https://t.me/FunnyRentBot" target="_blank" rel="noopener noreferrer">
                <MessageSquare className="h-4 w-4 mr-2" />
                Открыть бот и создать объявление
              </a>
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-teal-600" />
            Настройки уведомлений
          </CardTitle>
          <CardDescription>
            Выберите, какие уведомления вы хотите получать
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Channels */}
          <div className="space-y-4">
            <h4 className="font-semibold text-slate-900">Каналы уведомлений</h4>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MessageSquare className="h-5 w-5 text-slate-400" />
                <div>
                  <p className="font-medium text-slate-900">Telegram</p>
                  <p className="text-sm text-slate-600">Мгновенные push-уведомления</p>
                </div>
              </div>
              <Switch
                checked={settings.notifyTelegram}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, notifyTelegram: checked })
                }
                disabled={!telegramLinked}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-slate-400" />
                <div>
                  <p className="font-medium text-slate-900">Email</p>
                  <p className="text-sm text-slate-600">Ежедневная сводка</p>
                </div>
              </div>
              <Switch
                checked={settings.notifyEmail}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, notifyEmail: checked })
                }
              />
            </div>
          </div>

          <Separator />

          {/* Event Types */}
          <div className="space-y-4">
            <h4 className="font-semibold text-slate-900">События</h4>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900">Новые бронирования</p>
                <p className="text-sm text-slate-600">Запросы на бронирование</p>
              </div>
              <Switch
                checked={settings.notifyNewBooking}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, notifyNewBooking: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900">Новые сообщения</p>
                <p className="text-sm text-slate-600">Сообщения в чате</p>
              </div>
              <Switch
                checked={settings.notifyNewMessage}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, notifyNewMessage: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900">Изменение статуса</p>
                <p className="text-sm text-slate-600">Подтверждения и отмены</p>
              </div>
              <Switch
                checked={settings.notifyStatusChange}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, notifyStatusChange: checked })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSaveSettings}
          disabled={loading}
          className="bg-teal-600 hover:bg-teal-700"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Сохранение...
            </>
          ) : (
            'Сохранить изменения'
          )}
        </Button>
      </div>
    </div>
  )
}