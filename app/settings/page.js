'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Bell, Copy, Check, ExternalLink, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { telegramAccountLinkUrl, getTelegramBotUsername } from '@/lib/telegram-bot-public';

export default function SettingsPage() {
  const { toast } = useToast();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [telegramEnabled, setTelegramEnabled] = useState(false);
  const [telegramChatId, setTelegramChatId] = useState(null);
  const [linkingCode, setLinkingCode] = useState(null);
  const [codeCopied, setCodeCopied] = useState(false);

  useEffect(() => {
    loadUserSettings();
  }, []);

  const loadUserSettings = async () => {
    try {
      const res = await fetch('/api/profile');
      if (res.ok) {
        const data = await res.json();
        setUser(data);
        
        const prefs = data.notificationPreferences || {
          email: true,
          telegram: false,
          telegramChatId: null,
        };
        
        setEmailEnabled(prefs.email);
        setTelegramEnabled(prefs.telegram);
        setTelegramChatId(prefs.telegramChatId);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить настройки',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/profile/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailEnabled,
          telegram: telegramEnabled,
          telegramChatId,
        }),
      });

      if (res.ok) {
        toast({
          title: '✅ Сохранено',
          description: 'Настройки уведомлений обновлены',
        });
      } else {
        throw new Error('Failed to save');
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

  const generateLinkingCode = async () => {
    try {
      const res = await fetch('/api/telegram/link-code', {
        method: 'POST',
      });

      if (res.ok) {
        const data = await res.json();
        setLinkingCode(data.code);
        toast({
          title: '🔑 Код сгенерирован',
          description: 'Отправьте этот код боту в Telegram',
        });
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось сгенерировать код',
        variant: 'destructive',
      });
    }
  };

  const copyCode = () => {
    if (linkingCode) {
      navigator.clipboard.writeText(linkingCode);
      setCodeCopied(true);
      toast({
        title: '📋 Скопировано',
        description: 'Код скопирован в буфер обмена',
      });
      setTimeout(() => setCodeCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-8"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center">
            <Bell className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Настройки</h1>
            <p className="text-gray-600">Управление уведомлениями и профилем</p>
          </div>
        </div>

        {/* Notification Center Card */}
        <Card className="shadow-xl border-2">
          <CardHeader className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-t-lg">
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Bell className="w-6 h-6" />
              Центр уведомлений
            </CardTitle>
            <CardDescription className="text-indigo-100">
              Настройте, как вы хотите получать важные обновления
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 md:p-8 space-y-8">
            {/* Email Notifications */}
            <div className="flex items-start justify-between gap-4 p-6 bg-blue-50 rounded-xl border-2 border-blue-200 hover:border-blue-400 transition-all">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <div>
                    <Label htmlFor="email-toggle" className="text-lg font-semibold text-gray-900 cursor-pointer">
                      Email уведомления
                    </Label>
                    <p className="text-sm text-gray-600">
                      Получайте письма о бронированиях, платежах и важных обновлениях
                    </p>
                    <p className="text-xs text-blue-700 font-medium mt-1">
                      📧 {user?.email}
                    </p>
                  </div>
                </div>
              </div>
              <Switch
                id="email-toggle"
                checked={emailEnabled}
                onCheckedChange={setEmailEnabled}
                className="data-[state=checked]:bg-blue-600 scale-125"
              />
            </div>

            {/* Telegram Notifications */}
            <div className="flex items-start justify-between gap-4 p-6 bg-cyan-50 rounded-xl border-2 border-cyan-200 hover:border-cyan-400 transition-all">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-cyan-600 rounded-lg flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-white"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.941z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Label htmlFor="telegram-toggle" className="text-lg font-semibold text-gray-900 cursor-pointer">
                        Telegram уведомления
                      </Label>
                      {!telegramChatId && (
                        <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Не привязан
                        </Badge>
                      )}
                      {telegramChatId && (
                        <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                          ✅ Активен
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">
                      Мгновенные уведомления прямо в ваш мессенджер
                    </p>
                    {telegramChatId && (
                      <p className="text-xs text-cyan-700 font-medium mt-1">
                        🆔 Chat ID: {telegramChatId}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <Switch
                id="telegram-toggle"
                checked={telegramEnabled}
                onCheckedChange={setTelegramEnabled}
                disabled={!telegramChatId}
                className="data-[state=checked]:bg-cyan-600 scale-125"
              />
            </div>

            {/* Telegram Linking Section */}
            {!telegramChatId && (
              <div className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border-2 border-purple-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  🔗 Привязать Telegram
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Для получения уведомлений в Telegram, необходимо связать ваш аккаунт с ботом
                </p>

                <div className="space-y-4">
                  {!linkingCode ? (
                    <Button
                      onClick={generateLinkingCode}
                      className="w-full md:w-auto bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-6 text-lg"
                    >
                      Сгенерировать код привязки
                    </Button>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex flex-col md:flex-row gap-3">
                        <div className="flex-1 relative">
                          <Input
                            value={linkingCode}
                            readOnly
                            className="pr-12 text-center text-2xl font-mono font-bold tracking-widest h-14 border-2 border-purple-300 bg-white"
                          />
                        </div>
                        <Button
                          onClick={copyCode}
                          variant="outline"
                          className="h-14 px-6 border-2 border-purple-300 hover:bg-purple-100"
                        >
                          {codeCopied ? (
                            <>
                              <Check className="w-5 h-5 mr-2" />
                              Скопировано
                            </>
                          ) : (
                            <>
                              <Copy className="w-5 h-5 mr-2" />
                              Копировать код
                            </>
                          )}
                        </Button>
                      </div>

                      <div className="p-4 bg-white rounded-lg border-2 border-purple-200 space-y-3">
                        <p className="text-sm font-semibold text-gray-900">
                          📱 Инструкция:
                        </p>
                        <ol className="text-sm text-gray-700 space-y-2 list-decimal list-inside">
                          <li>Скопируйте код выше</li>
                          <li>Откройте бот @{getTelegramBotUsername()} в Telegram</li>
                          <li>Отправьте команду /start</li>
                          <li>Отправьте ваш код привязки</li>
                        </ol>
                        <Button
                          asChild
                          className="w-full bg-cyan-500 hover:bg-cyan-600 text-white font-semibold py-5 mt-2"
                        >
                          <a
                            href={
                              user?.id
                                ? telegramAccountLinkUrl(user.id)
                                : `https://t.me/${getTelegramBotUsername()}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2"
                          >
                            Открыть @{getTelegramBotUsername()}
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Save Button */}
            <div className="pt-4 border-t-2 flex flex-col md:flex-row gap-3 justify-end">
              <Button
                variant="outline"
                onClick={loadUserSettings}
                className="md:w-auto w-full py-6 text-base"
                disabled={saving}
              >
                Отменить изменения
              </Button>
              <Button
                onClick={saveSettings}
                disabled={saving}
                className="md:w-auto w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold py-6 text-base"
              >
                {saving ? 'Сохранение...' : '✅ Сохранить настройки'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="border-2 border-blue-200 bg-blue-50">
          <CardContent className="p-6">
            <div className="flex gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-5 h-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">О уведомлениях</h3>
                <p className="text-sm text-gray-700">
                  Вы будете получать уведомления о новых бронированиях, платежах, сообщениях, 
                  верификации партнера и выплатах. Важные уведомления (верификация, выплаты) 
                  всегда отправляются на email независимо от настроек.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
