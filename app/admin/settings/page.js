'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, Settings as SettingsIcon, DollarSign, Power, Home, Type, Phone, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function SettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState({
    defaultCommissionRate: 15,
    guestServiceFeePercent: 5,
    hostCommissionPercent: 0,
    insuranceFundPercent: 0.5,
    chatInvoiceRateMultiplier: 1.02,
    maintenanceMode: false,
    heroTitle: '',
    heroSubtitle: '',
    sitePhone: '',
    chatSafety: {
      autoShadowbanEnabled: false,
      strikeThreshold: 5,
      estimatedBookingValueThb: 8000,
    },
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const res = await fetch('/api/admin/settings');
      if (res.ok) {
        const data = await res.json();
        const d = data.data || {};
        setSettings({
          ...d,
          chatSafety: {
            autoShadowbanEnabled: false,
            strikeThreshold: 5,
            estimatedBookingValueThb: 8000,
            ...(d.chatSafety && typeof d.chatSafety === 'object' ? d.chatSafety : {}),
          },
        });
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (res.ok) {
        toast({
          title: '✅ Настройки сохранены',
          description: 'Все изменения применены',
        });
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось сохранить настройки',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Глобальные настройки</h1>
        <p className="text-sm sm:text-base text-gray-600 mt-1">Управление параметрами платформы</p>
      </div>

      {/* Homepage Hero Content - Mobile Responsive */}
      <Card className="shadow-xl border-2 border-indigo-200">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Home className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600" />
            Контент главной
          </CardTitle>
          <CardDescription className="text-sm">
            Hero-секция на главной странице
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0 space-y-4 sm:space-y-6">
          <div>
            <Label htmlFor="heroTitle" className="text-sm sm:text-base flex items-center gap-2">
              <Type className="w-4 h-4" />
              Заголовок
            </Label>
            <Input
              id="heroTitle"
              value={settings.heroTitle}
              onChange={(e) => setSettings({ ...settings, heroTitle: e.target.value })}
              placeholder="Luxury Rentals in Phuket"
              className="mt-2 text-sm sm:text-lg font-semibold"
            />
          </div>

          <div>
            <Label htmlFor="heroSubtitle" className="text-sm sm:text-base">
              Подзаголовок
            </Label>
            <Input
              id="heroSubtitle"
              value={settings.heroSubtitle}
              onChange={(e) => setSettings({ ...settings, heroSubtitle: e.target.value })}
              placeholder="Villas, Bikes, Yachts & Tours"
              className="mt-2 text-sm"
            />
          </div>

          {/* Preview Box - Mobile Responsive */}
          <div className="p-4 sm:p-6 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl shadow-lg">
            <div className="text-center text-white">
              <h2 className="text-xl sm:text-2xl lg:text-4xl font-bold mb-2 sm:mb-3">
                {settings.heroTitle || 'Luxury Rentals in Phuket'}
              </h2>
              <p className="text-sm sm:text-base lg:text-xl opacity-90">
                {settings.heroSubtitle || 'Villas, Bikes, Yachts & Tours'}
              </p>
            </div>
            <p className="text-center text-indigo-100 text-xs mt-3 sm:mt-4">
              👆 Предпросмотр
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Commission Settings - Mobile Responsive */}
      <Card className="shadow-xl">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
            Настройки комиссии
          </CardTitle>
          <CardDescription className="text-sm">
            Базовая комиссия для партнеров
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0 space-y-4 sm:space-y-6">
          <div>
            <Label htmlFor="commission" className="text-sm sm:text-base">
              Legacy defaultCommissionRate (%)
            </Label>
            <div className="flex items-center gap-3 sm:gap-4 mt-2 sm:mt-3">
              <Input
                id="commission"
                type="number"
                min="0"
                max="100"
                value={settings.defaultCommissionRate}
                onChange={(e) =>
                  setSettings({ ...settings, defaultCommissionRate: parseFloat(e.target.value) })
                }
                className="max-w-[100px] sm:max-w-xs text-base sm:text-lg font-semibold"
              />
              <span className="text-xl sm:text-2xl font-bold text-indigo-600">%</span>
            </div>
            <p className="text-xs sm:text-sm text-gray-600 mt-2">
              Партнеры получают {100 - settings.defaultCommissionRate}%
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="guestFee" className="text-sm">Guest service fee %</Label>
              <Input
                id="guestFee"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={settings.guestServiceFeePercent}
                onChange={(e) =>
                  setSettings({ ...settings, guestServiceFeePercent: parseFloat(e.target.value) })
                }
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="hostFee" className="text-sm">Host commission %</Label>
              <Input
                id="hostFee"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={settings.hostCommissionPercent}
                onChange={(e) =>
                  setSettings({ ...settings, hostCommissionPercent: parseFloat(e.target.value) })
                }
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="insuranceFund" className="text-sm">Insurance fund %</Label>
              <Input
                id="insuranceFund"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={settings.insuranceFundPercent}
                onChange={(e) =>
                  setSettings({ ...settings, insuranceFundPercent: parseFloat(e.target.value) })
                }
                className="mt-2"
              />
            </div>
          </div>

          <div className="min-w-0">
            <Label htmlFor="chatInvoiceMult" className="text-sm sm:text-base">
              Розничный курс на витрине + чат (USD, RUB, USDT…)
            </Label>
            <p className="text-xs sm:text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-md px-2 py-2 mt-2 leading-snug">
              Один множитель для двух мест: <strong>цены на сайте</strong> в выбранной валюте (каталог, карточка, поиск) и{' '}
              <strong>счета в чате THB ↔ USDT</strong>. База — курсы из{' '}
              <code className="break-all text-[11px]">exchange_rates</code> (mid-market), затем к гостю применяется спред
              как у банка: при 1.025 гость видит примерно на 2.5% «дороже» в долларах/рублях за тот же бат. Сумма брони в
              THB и выплата партнёру в батах не зависят от выбора валюты отображения.
            </p>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-3">
              <Input
                id="chatInvoiceMult"
                type="number"
                min="1"
                max="1.5"
                step="0.001"
                value={settings.chatInvoiceRateMultiplier ?? 1.02}
                onChange={(e) => {
                  const v = parseFloat(e.target.value)
                  setSettings({
                    ...settings,
                    chatInvoiceRateMultiplier: Number.isFinite(v) ? v : settings.chatInvoiceRateMultiplier,
                  })
                }}
                className="max-w-[120px] sm:max-w-xs text-base sm:text-lg font-semibold shrink-0"
              />
              <span className="text-sm text-gray-600 min-w-0">
                1.0 = без надбавки к витринному курсу. 1.025 ≈ +2.5% в пользу платформы (гость платит больше в валюте за тот же THB).
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-gray-500 mt-3 break-words leading-relaxed">
              Ключ в БД:{' '}
              <code className="break-all rounded bg-slate-100 px-1 py-0.5 text-[10px] sm:text-[11px]">
                general.chatInvoiceRateMultiplier
              </code>
              . Env:{' '}
              <code className="break-all rounded bg-slate-100 px-1 py-0.5 text-[10px] sm:text-[11px]">
                CHAT_INVOICE_RATE_MULTIPLIER
              </code>
              .
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Безопасность чата: авто-shadowban по страйкам + оценка риска в админке */}
      <Card className="shadow-xl border-2 border-sky-200">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Shield className="h-5 w-5 shrink-0 text-sky-700 sm:h-6 sm:w-6" />
            Настройки безопасности чата
          </CardTitle>
          <CardDescription className="text-sm">
            Авто-shadowban: при включении сообщения с срабатыванием детектора контактов не показываются получателю,
            если у отправителя страйков не меньше порога (см. раздел «Анализ утечек»). Оценка комиссии в дашборде
            использует средний чек в THB и курсы из <code className="text-xs">exchange_rates</code> без витринной надбавки.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 p-4 pt-0 sm:p-6">
          <div className="flex flex-col gap-3 rounded-lg border border-sky-100 bg-sky-50/80 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Label htmlFor="autoShadowban" className="text-sm font-semibold text-slate-900">
                Enable Auto-Shadowban
              </Label>
              <p className="mt-1 text-xs text-slate-600">
                Только при включении: скрытие от получателя по порогу страйков (серверный GET + Realtime).
              </p>
            </div>
            <Switch
              id="autoShadowban"
              checked={settings.chatSafety?.autoShadowbanEnabled === true}
              onCheckedChange={(checked) =>
                setSettings({
                  ...settings,
                  chatSafety: { ...settings.chatSafety, autoShadowbanEnabled: checked },
                })
              }
            />
          </div>
          <div>
            <Label htmlFor="strikeThreshold" className="text-sm sm:text-base">
              Strike Threshold (нарушений до скрытия от получателя)
            </Label>
            <Input
              id="strikeThreshold"
              type="number"
              min={1}
              max={999}
              value={settings.chatSafety?.strikeThreshold ?? 5}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10)
                setSettings({
                  ...settings,
                  chatSafety: {
                    ...settings.chatSafety,
                    strikeThreshold: Number.isFinite(v) ? v : settings.chatSafety.strikeThreshold,
                  },
                })
              }}
              className="mt-2 max-w-[120px]"
            />
            <p className="mt-1 text-xs text-gray-500">По умолчанию 5. Страйки не начисляются сообщениям от ADMIN/MODERATOR.</p>
          </div>
          <div>
            <Label htmlFor="estBookingThb" className="text-sm sm:text-base">
              Средний чек для оценки риска (THB)
            </Label>
            <Input
              id="estBookingThb"
              type="number"
              min={0}
              step={100}
              value={settings.chatSafety?.estimatedBookingValueThb ?? 8000}
              onChange={(e) => {
                const v = parseFloat(e.target.value)
                setSettings({
                  ...settings,
                  chatSafety: {
                    ...settings.chatSafety,
                    estimatedBookingValueThb: Number.isFinite(v) && v >= 0 ? v : settings.chatSafety.estimatedBookingValueThb,
                  },
                })
              }}
              className="mt-2 max-w-[160px]"
            />
            <p className="mt-1 text-xs text-gray-500">
              Ключ в БД: <code className="rounded bg-slate-100 px-1">general.chatSafety</code>. Env{' '}
              <code className="rounded bg-slate-100 px-1">CONTACT_LEAK_ESTIMATED_BOOKING_THB</code>, если задан,
              переопределяет значение для дашборда.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Rich Results / Schema.org — телефон только в JSON-LD, не на карточке объекта */}
      <Card className="shadow-xl border-2 border-slate-200">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Phone className="w-5 h-5 sm:w-6 sm:h-6 text-slate-600" />
            Телефон для Google (Rich Results)
          </CardTitle>
          <CardDescription className="text-sm">
            Сохраняется в system_settings.general.sitePhone. Попадает только в микроразметку LodgingBusiness (поле
            telephone). На странице объявления для гостей не показывается.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0 space-y-3">
          <div>
            <Label htmlFor="sitePhone" className="text-sm sm:text-base">
              Контактный телефон
            </Label>
            <Input
              id="sitePhone"
              value={settings.sitePhone || ''}
              onChange={(e) => setSettings({ ...settings, sitePhone: e.target.value })}
              placeholder="+66 XX XXX XXXX"
              className="mt-2 font-mono text-sm"
            />
            <p className="text-xs text-gray-600 mt-2">
              Оставьте пустым — поле telephone в JSON-LD не выводится.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Maintenance Mode - Mobile Responsive */}
      <Card className="shadow-xl border-2 border-orange-200">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Power className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600" />
            Режим обслуживания
          </CardTitle>
          <CardDescription className="text-sm">
            Отключите сайт для пользователей
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0 space-y-4 sm:space-y-6">
          <div className="flex items-center justify-between p-3 sm:p-4 lg:p-6 bg-gradient-to-r from-orange-50 to-red-50 rounded-lg border-2 border-orange-300 gap-3">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <AlertTriangle className="w-6 h-6 sm:w-8 sm:h-8 text-orange-600 flex-shrink-0" />
              <div className="min-w-0">
                <Label htmlFor="maintenance" className="text-sm sm:text-base lg:text-xl font-bold text-gray-900 cursor-pointer">
                  Maintenance
                </Label>
                <p className="text-xs sm:text-sm text-gray-600 mt-1">
                  {settings.maintenanceMode
                    ? '🔴 Сайт ВЫКЛЮЧЕН'
                    : '🟢 Работает'}
                </p>
              </div>
            </div>
            <Switch
              id="maintenance"
              checked={settings.maintenanceMode}
              onCheckedChange={(checked) => setSettings({ ...settings, maintenanceMode: checked })}
              className="scale-100 sm:scale-125 lg:scale-150 flex-shrink-0"
            />
          </div>

          {settings.maintenanceMode && (
            <div className="bg-red-50 border-2 border-red-400 rounded-lg p-3 sm:p-4">
              <div className="flex items-start gap-2 sm:gap-3">
                <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-red-900 text-sm sm:text-base mb-1 sm:mb-2">⚠️ Режим обслуживания ВКЛЮЧЕН</p>
                  <p className="text-xs sm:text-sm text-red-800">
                    Все пользователи видят страницу "We are updating"
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save Button - Mobile Responsive */}
      <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
        <Button variant="outline" size="lg" onClick={() => window.location.reload()} className="w-full sm:w-auto">
          Отменить
        </Button>
        <Button
          size="lg"
          onClick={handleSave}
          disabled={saving}
          className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 w-full sm:w-auto"
        >
          {saving ? 'Сохранение...' : '✅ Сохранить'}
        </Button>
      </div>
    </div>
  );
}
