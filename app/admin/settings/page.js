'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, Settings as SettingsIcon, DollarSign, Power, Home, Type } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function SettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState({
    defaultCommissionRate: 15,
    maintenanceMode: false,
    heroTitle: '',
    heroSubtitle: '',
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
        setSettings(data.data);
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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Глобальные настройки</h1>
        <p className="text-gray-600 mt-1">Управление параметрами платформы</p>
      </div>

      {/* Homepage Hero Content */}
      <Card className="shadow-xl border-2 border-indigo-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Home className="w-6 h-6 text-indigo-600" />
            Контент главной страницы
          </CardTitle>
          <CardDescription>
            Редактируйте заголовок и подзаголовок Hero-секции на главной
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label htmlFor="heroTitle" className="text-base flex items-center gap-2">
              <Type className="w-4 h-4" />
              Заголовок (Hero Title)
            </Label>
            <Input
              id="heroTitle"
              value={settings.heroTitle}
              onChange={(e) => setSettings({ ...settings, heroTitle: e.target.value })}
              placeholder="Luxury Rentals in Phuket"
              className="mt-2 text-lg font-semibold"
            />
            <p className="text-sm text-gray-600 mt-2">
              Основной заголовок на главной странице
            </p>
          </div>

          <div>
            <Label htmlFor="heroSubtitle" className="text-base">
              Подзаголовок (Hero Subtitle)
            </Label>
            <Input
              id="heroSubtitle"
              value={settings.heroSubtitle}
              onChange={(e) => setSettings({ ...settings, heroSubtitle: e.target.value })}
              placeholder="Villas, Bikes, Yachts & Tours"
              className="mt-2"
            />
            <p className="text-sm text-gray-600 mt-2">
              Краткое описание под заголовком
            </p>
          </div>

          {/* Preview Box */}
          <div className="p-6 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl shadow-lg">
            <div className="text-center text-white">
              <h2 className="text-4xl font-bold mb-3">
                {settings.heroTitle || 'Luxury Rentals in Phuket'}
              </h2>
              <p className="text-xl opacity-90">
                {settings.heroSubtitle || 'Villas, Bikes, Yachts & Tours'}
              </p>
            </div>
            <p className="text-center text-indigo-100 text-xs mt-4">
              👆 Live Preview - Так будет выглядеть на сайте
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Commission Settings */}
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-green-600" />
            Настройки комиссии
          </CardTitle>
          <CardDescription>
            Базовая комиссия для новых партнеров и объявлений
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label htmlFor="commission" className="text-base">
              Комиссия платформы по умолчанию (%)
            </Label>
            <div className="flex items-center gap-4 mt-3">
              <Input
                id="commission"
                type="number"
                min="0"
                max="100"
                value={settings.defaultCommissionRate}
                onChange={(e) =>
                  setSettings({ ...settings, defaultCommissionRate: parseFloat(e.target.value) })
                }
                className="max-w-xs text-lg font-semibold"
              />
              <span className="text-2xl font-bold text-indigo-600">%</span>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              Текущая: <strong>{settings.defaultCommissionRate}%</strong> от стоимости бронирования.
              Партнеры получают {100 - settings.defaultCommissionRate}%.
            </p>
          </div>

          <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900">
              <strong>ℹ️ Важно:</strong> Изменение комиссии не повлияет на существующие объявления.
              Каждый партнер может установить свою индивидуальную ставку.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Maintenance Mode */}
      <Card className="shadow-xl border-2 border-orange-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Power className="w-6 h-6 text-orange-600" />
            Режим обслуживания
          </CardTitle>
          <CardDescription>
            Временно отключите сайт для всех пользователей (кроме админов)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-6 bg-gradient-to-r from-orange-50 to-red-50 rounded-lg border-2 border-orange-300">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <AlertTriangle className="w-8 h-8 text-orange-600" />
                <div>
                  <Label htmlFor="maintenance" className="text-xl font-bold text-gray-900 cursor-pointer">
                    Maintenance Mode
                  </Label>
                  <p className="text-sm text-gray-600 mt-1">
                    {settings.maintenanceMode
                      ? '🔴 Сайт ВЫКЛЮЧЕН для пользователей'
                      : '🟢 Сайт работает нормально'}
                  </p>
                </div>
              </div>
            </div>
            <Switch
              id="maintenance"
              checked={settings.maintenanceMode}
              onCheckedChange={(checked) => setSettings({ ...settings, maintenanceMode: checked })}
              className="scale-150"
            />
          </div>

          {settings.maintenanceMode && (
            <div className="bg-red-50 border-2 border-red-400 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
                <div>
                  <p className="font-bold text-red-900 mb-2">⚠️ ВНИМАНИЕ: Режим обслуживания ВКЛЮЧЕН</p>
                  <p className="text-sm text-red-800">
                    Все пользователи (кроме админов) видят страницу "We are updating".
                    Бронирования, платежи и регистрация недоступны.
                  </p>
                  <p className="text-xs text-red-700 mt-2">
                    Не забудьте выключить этот режим после завершения работ!
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-sm text-gray-700">
              <strong>Когда использовать:</strong>
              <br />
              • Плановое обновление базы данных
              <br />
              • Критические изменения в коде
              <br />
              • Миграция серверов
              <br />• Устранение критических багов
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" size="lg" onClick={() => window.location.reload()}>
          Отменить
        </Button>
        <Button
          size="lg"
          onClick={handleSave}
          disabled={saving}
          className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 px-8"
        >
          {saving ? 'Сохранение...' : '✅ Сохранить все настройки'}
        </Button>
      </div>

      {/* Info Card */}
      <Card className="border-2 border-blue-200 bg-blue-50">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <SettingsIcon className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
            <div>
              <p className="font-semibold text-blue-900 mb-1">О настройках</p>
              <p className="text-sm text-blue-800">
                Все изменения применяются мгновенно. Логируется каждое действие админа.
                История изменений доступна в системных логах.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
