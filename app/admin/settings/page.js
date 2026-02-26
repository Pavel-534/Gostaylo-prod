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
              Комиссия платформы (%)
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
