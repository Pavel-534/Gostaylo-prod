'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  Power, 
  Bot, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Activity, 
  Clock, 
  MessageSquare, 
  Zap,
  Shield,
  Server,
  Wifi,
  WifiOff,
  Palmtree,
  Globe,
  Send,
  TestTube,
  ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';

const TELEGRAM_BOT_TOKEN = '8702569258:AAFuj-Ob9otOVf6KiABQSiiWC0-8_KvkFqM';
const ADMIN_CHAT_ID = 1303143012;

export default function SystemControlPage() {
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [webhookStatus, setWebhookStatus] = useState(null);
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSystemStatus();
  }, []);

  async function loadSystemStatus() {
    try {
      const SUPABASE_URL = 'https://vtzzcdsjwudkaloxhvnw.supabase.co';
      const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0enpjZHNqd3Vka2Fsb3hodm53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMjkxMzUsImV4cCI6MjA4NzYwNTEzNX0.vSrBY_n8_KqAi0yzN-g9LZqTkbbjloSakXq5o_28r4k';
      
      // Load maintenance mode
      const settingsRes = await fetch(`${SUPABASE_URL}/rest/v1/system_settings?key=eq.maintenance_mode`, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      });
      const settings = await settingsRes.json();
      if (settings?.[0]) {
        setMaintenanceMode(settings[0].value === 'true' || settings[0].value === true);
      }

      // Load webhook status
      await checkWebhookStatus();
      
      // Load recent activity
      const activityRes = await fetch(`${SUPABASE_URL}/rest/v1/activity_log?order=created_at.desc&limit=10`, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      });
      const activityData = await activityRes.json();
      setRecentActivity(Array.isArray(activityData) ? activityData : []);
      
    } catch (error) {
      console.error('Failed to load system status:', error);
    } finally {
      setLoading(false);
    }
  }

  async function checkWebhookStatus() {
    try {
      const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`);
      const data = await res.json();
      
      if (data.ok) {
        const hasRecentError = data.result.last_error_date && 
          (Date.now() / 1000 - data.result.last_error_date) < 300; // Error in last 5 minutes
        
        setWebhookStatus({
          url: data.result.url,
          isActive: !!data.result.url,
          hasError: hasRecentError,
          pendingUpdates: data.result.pending_update_count || 0,
          lastError: data.result.last_error_message || null,
          lastErrorDate: data.result.last_error_date ? new Date(data.result.last_error_date * 1000) : null
        });
      }
    } catch (error) {
      console.error('Failed to check webhook:', error);
      setWebhookStatus({ isActive: false, error: error.message });
    }
  }

  async function handleMaintenanceToggle(enabled) {
    try {
      const SUPABASE_URL = 'https://vtzzcdsjwudkaloxhvnw.supabase.co';
      const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0enpjZHNqd3Vka2Fsb3hodm53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMjkxMzUsImV4cCI6MjA4NzYwNTEzNX0.vSrBY_n8_KqAi0yzN-g9LZqTkbbjloSakXq5o_28r4k';
      
      await fetch(`${SUPABASE_URL}/rest/v1/system_settings?key=eq.maintenance_mode`, {
        method: 'DELETE',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      });

      await fetch(`${SUPABASE_URL}/rest/v1/system_settings`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          key: 'maintenance_mode',
          value: String(enabled),
          description: 'Global maintenance mode toggle'
        })
      });
      
      setMaintenanceMode(enabled);
      toast.success(enabled ? '🔴 Режим обслуживания ВКЛЮЧЁН' : '🟢 Режим обслуживания ВЫКЛЮЧЕН');
      await logActivity(enabled ? 'MAINTENANCE_ON' : 'MAINTENANCE_OFF', 'Переключен режим обслуживания');
      
    } catch (error) {
      console.error('Failed to toggle maintenance:', error);
      toast.error('Ошибка обновления режима обслуживания');
    }
  }

  async function handleRelinkWebhook() {
    setWebhookLoading(true);
    try {
      // Get proper webhook URL without double slashes
      const baseUrl = window.location.origin.replace(/\/$/, '');
      const webhookUrl = `${baseUrl}/api/webhooks/telegram`;
      
      // Delete existing webhook
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteWebhook`);
      await new Promise(r => setTimeout(r, 1000));
      
      // Set new webhook with drop_pending_updates
      const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: webhookUrl,
          drop_pending_updates: true,
          allowed_updates: ['message', 'callback_query']
        })
      });
      const data = await res.json();
      
      if (data.ok) {
        toast.success('✅ Вебхук успешно переподключён!');
        await checkWebhookStatus();
        await logActivity('WEBHOOK_RELINK', `URL: ${webhookUrl}`);
      } else {
        toast.error('Ошибка: ' + data.description);
      }
    } catch (error) {
      console.error('Failed to relink webhook:', error);
      toast.error('Ошибка переподключения вебхука');
    } finally {
      setWebhookLoading(false);
    }
  }

  async function handleTestConnection() {
    setTestingConnection(true);
    try {
      // Test 1: Check if Telegram API is reachable
      const meRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`);
      const meData = await meRes.json();
      
      if (!meData.ok) {
        toast.error('❌ Telegram API недоступен');
        return;
      }
      
      // Test 2: Try to send a message
      const sendRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: ADMIN_CHAT_ID,
          text: '🔧 <b>Тест подключения</b>\n\nЭто тестовое сообщение из Центра управления.\n\n✅ Бот работает корректно!',
          parse_mode: 'HTML'
        })
      });
      const sendData = await sendRes.json();
      
      if (sendData.ok) {
        toast.success('✅ Подключение работает! Сообщение отправлено.');
        await logActivity('CONNECTION_TEST', 'Тест пройден успешно');
      } else {
        toast.error('❌ Ошибка отправки: ' + sendData.description);
      }
      
      // Test 3: Check webhook endpoint locally
      try {
        const webhookRes = await fetch('/api/webhooks/telegram');
        const webhookData = await webhookRes.json();
        if (webhookData.ok) {
          toast.success('✅ Вебхук endpoint доступен локально');
        }
      } catch (e) {
        toast.warning('⚠️ Вебхук endpoint недоступен локально');
      }
      
    } catch (error) {
      toast.error('❌ Ошибка теста: ' + error.message);
    } finally {
      setTestingConnection(false);
    }
  }

  async function handleSendAloha() {
    try {
      const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: ADMIN_CHAT_ID,
          text: '🌴 <b>Aloha из FunnyRent!</b>\n\nДобро пожаловать в мир аренды на Пхукете!\n\n📸 <b>Lazy Realtor</b>\nОтправьте фото + описание для создания черновика.\n\nФормат:\n• 📷 Фото объекта\n• 📝 Описание в подписи\n• 💰 Цена: "15000 THB"\n\n🏝 Ваш бот готов к работе!',
          parse_mode: 'HTML'
        })
      });
      const data = await res.json();
      
      if (data.ok) {
        toast.success('🌴 Сообщение "Aloha" отправлено!');
        await logActivity('ALOHA_SENT', 'Отправлено приветственное сообщение');
      } else {
        toast.error('Ошибка: ' + data.description);
      }
    } catch (error) {
      toast.error('Ошибка отправки');
    }
  }

  async function logActivity(action, details) {
    try {
      const SUPABASE_URL = 'https://vtzzcdsjwudkaloxhvnw.supabase.co';
      const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0enpjZHNqd3Vka2Fsb3hodm53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMjkxMzUsImV4cCI6MjA4NzYwNTEzNX0.vSrBY_n8_KqAi0yzN-g9LZqTkbbjloSakXq5o_28r4k';
      
      await fetch(`${SUPABASE_URL}/rest/v1/activity_log`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: action,
          details: details,
          ip_address: 'admin-panel',
          user_agent: 'FunnyRent Admin'
        })
      });
      
      loadSystemStatus();
    } catch (error) {
      console.error('Failed to log activity:', error);
    }
  }

  function formatDate(date) {
    if (!date) return 'Н/Д';
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleString('ru-RU', { 
      day: '2-digit', 
      month: '2-digit', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }

  function getStatusBadge() {
    if (!webhookStatus?.isActive) {
      return <Badge variant="destructive" className="flex items-center gap-1 text-xs"><WifiOff className="w-3 h-3" /> Офлайн</Badge>;
    }
    if (webhookStatus?.hasError) {
      return <Badge className="bg-amber-500 flex items-center gap-1 text-xs"><AlertTriangle className="w-3 h-3" /> Ошибки</Badge>;
    }
    return <Badge className="bg-green-500 flex items-center gap-1 text-xs"><Wifi className="w-3 h-3" /> Онлайн</Badge>;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Загрузка...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 lg:space-y-6 max-w-full overflow-hidden px-1">
      {/* Header - Mobile Optimized */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Palmtree className="w-6 h-6 lg:w-8 lg:h-8 text-teal-600 flex-shrink-0" />
            <h1 className="text-xl lg:text-2xl font-bold text-slate-900 truncate">
              Центр управления
            </h1>
          </div>
          <p className="text-sm text-slate-600">Управление платформой и интеграциями</p>
        </div>
        <Badge 
          variant={maintenanceMode ? "destructive" : "default"} 
          className="self-start sm:self-auto text-xs px-2 py-1 flex-shrink-0"
        >
          {maintenanceMode ? '🔴 Обслуживание' : '🟢 Работает'}
        </Badge>
      </div>

      {/* Maintenance Mode - Mobile Optimized */}
      <Card className={`border-2 ${maintenanceMode ? 'border-red-400 bg-red-50' : 'border-teal-400 bg-teal-50'}`}>
        <CardContent className="p-4 lg:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3 min-w-0">
              <div className={`w-10 h-10 lg:w-12 lg:h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${maintenanceMode ? 'bg-red-500' : 'bg-teal-500'}`}>
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
              <Switch
                checked={maintenanceMode}
                onCheckedChange={handleMaintenanceToggle}
                className="scale-110"
              />
            </div>
          </div>
          <div className={`mt-4 p-3 rounded-lg text-sm ${maintenanceMode ? 'bg-red-100 text-red-700' : 'bg-teal-100 text-teal-700'}`}>
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

      {/* Telegram Webhook - Mobile Optimized */}
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
            {getStatusBadge()}
          </div>
        </CardHeader>
        <CardContent className="p-4 lg:p-6 pt-2 space-y-4">
          {/* Webhook Info - Stacked on Mobile */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-slate-100 p-3 rounded-lg">
              <Label className="text-xs text-slate-500 uppercase">URL вебхука</Label>
              <p className="text-xs font-mono mt-1 break-all leading-relaxed">
                {webhookStatus?.url || 'Не настроен'}
              </p>
            </div>
            <div className="bg-slate-100 p-3 rounded-lg">
              <Label className="text-xs text-slate-500 uppercase">Ожидающие обновления</Label>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {webhookStatus?.pendingUpdates || 0}
              </p>
            </div>
          </div>
          
          {/* Error Info */}
          {webhookStatus?.lastError && (
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
          )}

          {/* Actions - Wrap on Mobile */}
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleRelinkWebhook}
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
              onClick={handleTestConnection}
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
            <Button
              onClick={handleSendAloha}
              size="sm"
              variant="outline"
              className="border-teal-500 text-teal-700 hover:bg-teal-50 text-xs"
            >
              <Palmtree className="w-3 h-3 mr-1" />
              Отправить "Aloha"
            </Button>
            <Button
              onClick={checkWebhookStatus}
              size="sm"
              variant="outline"
              className="text-xs"
            >
              <Activity className="w-3 h-3 mr-1" />
              Обновить
            </Button>
          </div>
          
          {/* Help Text */}
          <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg text-xs text-blue-700">
            <p className="font-medium mb-1">💡 Диагностика:</p>
            <ul className="list-disc list-inside space-y-0.5 text-blue-600">
              <li>502 ошибка = сервер перезапускается (подождите 30 сек)</li>
              <li>Используйте "Тест связи" для проверки соединения</li>
              <li>Кнопка "Aloha" отправляет сообщение напрямую</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity - Mobile Optimized */}
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
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 sm:mt-0 ${
                      event.action?.includes('ERROR') ? 'bg-red-500' :
                      event.action?.includes('MAINTENANCE') ? 'bg-amber-500' :
                      'bg-green-500'
                    }`} />
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

      {/* Quick Stats - Mobile Grid */}
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
              <Bot className={`w-8 h-8 ${webhookStatus?.isActive && !webhookStatus?.hasError ? 'text-blue-500' : 'text-red-500'}`} />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-purple-600 font-medium">В очереди</p>
                <p className="text-lg font-bold text-purple-900">
                  {webhookStatus?.pendingUpdates || 0}
                </p>
              </div>
              <Zap className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
