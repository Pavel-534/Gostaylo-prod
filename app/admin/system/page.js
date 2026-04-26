'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { getAdminDiagnosticsUserAgent } from '@/lib/http-client-identity';
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
  ExternalLink,
  Lock,
  Eye,
  EyeOff,
  Key,
  Calendar,
  Link2,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Admin Chat ID for test messages
const ADMIN_CHAT_ID = process.env.NEXT_PUBLIC_ADMIN_CHAT_ID || '1303143012';

export default function SystemControlPage() {
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [webhookStatus, setWebhookStatus] = useState(null);
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Security section state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  
  // iCal Sync state
  const [icalSyncStatus, setIcalSyncStatus] = useState(null);
  const [icalSyncFrequency, setIcalSyncFrequency] = useState('1h');
  const [icalSyncing, setIcalSyncing] = useState(false);

  useEffect(() => {
    loadSystemStatus();
  }, []);

  async function loadSystemStatus() {
    try {
      const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      // Load maintenance mode
      const settingsRes = await fetch(`/_db/system_settings?key=eq.maintenance_mode`, {
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
      const activityRes = await fetch(`/_db/activity_log?order=created_at.desc&limit=10`, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      });
      const activityData = await activityRes.json();
      setRecentActivity(Array.isArray(activityData) ? activityData : []);
      
      // Load iCal sync status
      await loadIcalSyncStatus();
      
    } catch (error) {
      console.error('Failed to load system status:', error);
    } finally {
      setLoading(false);
    }
  }

  async function checkWebhookStatus() {
    try {
      // Use our server API instead of direct Telegram calls
      const res = await fetch('/api/v2/admin/telegram');
      const data = await res.json();
      
      if (data.success && data.webhook) {
        const hasRecentError = data.webhook.lastErrorDate && 
          (Date.now() - new Date(data.webhook.lastErrorDate).getTime()) < 300000; // Error in last 5 minutes
        
        setWebhookStatus({
          url: data.webhook.url,
          isActive: data.webhook.active,
          hasError: hasRecentError,
          pendingUpdates: data.webhook.pendingUpdateCount || 0,
          lastError: data.webhook.lastErrorMessage || null,
          lastErrorDate: data.webhook.lastErrorDate ? new Date(data.webhook.lastErrorDate) : null,
          botUsername: data.bot?.username,
          botLink: data.bot?.link
        });
      } else {
        setWebhookStatus({ 
          isActive: false, 
          error: data.error || 'Failed to get status',
          url: null
        });
      }
    } catch (error) {
      console.error('Failed to check webhook:', error);
      setWebhookStatus({ isActive: false, error: error.message });
    }
  }

  async function loadIcalSyncStatus() {
    try {
      const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      // Get sync status
      const statusRes = await fetch(`/_db/system_settings?key=eq.ical_sync_status`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      const statusData = await statusRes.json();
      if (statusData?.[0]?.value) {
        setIcalSyncStatus(statusData[0].value);
      }
      
      // Get sync settings
      const settingsRes = await fetch(`/_db/system_settings?key=eq.ical_sync_settings`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      const settingsData = await settingsRes.json();
      if (settingsData?.[0]?.value?.frequency) {
        setIcalSyncFrequency(settingsData[0].value.frequency);
      }
    } catch (error) {
      console.error('Failed to load iCal sync status:', error);
    }
  }

  async function handleGlobalIcalSync() {
    setIcalSyncing(true);
    try {
      const res = await fetch('/api/ical/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync-all' })
      });
      const data = await res.json();
      
      if (data.success) {
        toast.success(`✅ Синхронизировано ${data.listingsSynced || 0} объявлений, ${data.eventsProcessed || 0} событий`);
        await loadIcalSyncStatus();
        await logActivity('ICAL_GLOBAL_SYNC', `Синхронизировано ${data.listingsSynced || 0} объявлений`);
      } else {
        toast.error(`Ошибка: ${data.error}`);
      }
    } catch (error) {
      console.error('Global sync error:', error);
      toast.error('Ошибка глобальной синхронизации');
    }
    setIcalSyncing(false);
  }

  async function handleIcalFrequencyChange(frequency) {
    const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    try {
      // Upsert settings
      await fetch(`/_db/system_settings?key=eq.ical_sync_settings`, {
        method: 'DELETE',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      
      await fetch(`/_db/system_settings`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          key: 'ical_sync_settings',
          value: { frequency, enabled: true }
        })
      });
      
      setIcalSyncFrequency(frequency);
      toast.success(`Частота синхронизации: ${frequency}`);
    } catch (error) {
      toast.error('Ошибка сохранения настроек');
    }
  }

  async function handleMaintenanceToggle(enabled) {
    try {
      const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      await fetch(`/_db/system_settings?key=eq.maintenance_mode`, {
        method: 'DELETE',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      });

      await fetch(`/_db/system_settings`, {
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
      // Use our server API to set webhook
      const res = await fetch('/api/v2/admin/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setWebhook' })
      });
      const data = await res.json();
      
      if (data.success) {
        toast.success('✅ Вебхук успешно переподключён!');
        await checkWebhookStatus();
        await logActivity('WEBHOOK_RELINK', `URL: ${data.webhookUrl}`);
      } else {
        toast.error('Ошибка: ' + (data.message || data.error));
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
      // Use our server API to test connection
      const res = await fetch('/api/v2/admin/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'testMessage' })
      });
      const data = await res.json();
      
      if (data.success) {
        toast.success('✅ Подключение работает! Сообщение отправлено.');
        await logActivity('CONNECTION_TEST', 'Тест пройден успешно');
        await checkWebhookStatus();
      } else {
        toast.error('❌ Ошибка: ' + (data.message || data.error));
      }
      
    } catch (error) {
      toast.error('❌ Ошибка теста: ' + error.message);
    } finally {
      setTestingConnection(false);
    }
  }

  async function handleSendAloha() {
    try {
      // Use our server API to send message
      const res = await fetch('/api/v2/admin/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'testMessage' })
      });
      const data = await res.json();
      
      if (data.success) {
        toast.success('🌴 Сообщение отправлено!');
        await logActivity('ALOHA_SENT', 'Отправлено тестовое сообщение');
      } else {
        toast.error('Ошибка: ' + (data.message || data.error));
      }
    } catch (error) {
      toast.error('Ошибка отправки');
    }
  }

  async function handlePasswordChange() {
    if (newPassword !== confirmPassword || newPassword.length < 8) {
      toast.error('Проверьте правильность пароля');
      return;
    }
    
    setChangingPassword(true);
    try {
      const { updatePassword } = await import('@/lib/auth');
      const result = await updatePassword(newPassword);
      
      if (result.success) {
        toast.success('✅ Пароль успешно обновлён!');
        setNewPassword('');
        setConfirmPassword('');
        await logActivity('PASSWORD_CHANGE', 'Пароль администратора обновлён');
      } else {
        toast.error('❌ Ошибка: ' + (result.error || 'Не удалось обновить пароль'));
      }
    } catch (error) {
      console.error('Password change error:', error);
      toast.error('❌ Ошибка обновления пароля');
    } finally {
      setChangingPassword(false);
    }
  }

  async function logActivity(action, details) {
    try {
      const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      await fetch(`/_db/activity_log`, {
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
          user_agent: getAdminDiagnosticsUserAgent()
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

      {/* AI analytics — только ADMIN (маршрут /admin/system/ai) */}
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

      {/* iCal Sync Engine - Admin Control */}
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
            <Badge className={icalSyncStatus?.error_count > 0 
              ? 'bg-amber-100 text-amber-700' 
              : 'bg-green-100 text-green-700'}>
              {icalSyncStatus?.error_count > 0 ? 'Есть ошибки' : 'Работает'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-4 lg:p-6 pt-2 space-y-4">
          {/* Status Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-lg p-3 border border-orange-200 text-center">
              <div className="text-2xl font-bold text-orange-600">
                {icalSyncStatus?.listings_synced || 0}
              </div>
              <div className="text-xs text-slate-500">Объявлений</div>
            </div>
            <div className="bg-white rounded-lg p-3 border border-green-200 text-center">
              <div className="text-2xl font-bold text-green-600">
                {icalSyncStatus?.success_count || 0}
              </div>
              <div className="text-xs text-slate-500">Успешно</div>
            </div>
            <div className="bg-white rounded-lg p-3 border border-red-200 text-center">
              <div className="text-2xl font-bold text-red-600">
                {icalSyncStatus?.error_count || 0}
              </div>
              <div className="text-xs text-slate-500">Ошибок</div>
            </div>
            <div className="bg-white rounded-lg p-3 border border-slate-200 text-center">
              <div className="text-sm font-medium text-slate-700">
                {icalSyncStatus?.last_sync 
                  ? new Date(icalSyncStatus.last_sync).toLocaleString('ru-RU', { 
                      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' 
                    })
                  : 'Никогда'}
              </div>
              <div className="text-xs text-slate-500">Последняя синхр.</div>
            </div>
          </div>
          
          {/* Frequency Setting */}
          <div className="flex items-center justify-between bg-white rounded-lg p-3 border border-orange-200">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-500" />
              <span className="text-sm font-medium">Частота синхронизации</span>
            </div>
            <Select value={icalSyncFrequency} onValueChange={handleIcalFrequencyChange}>
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
          
          {/* Actions */}
          <div className="flex gap-2">
            <Button
              onClick={handleGlobalIcalSync}
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
            <Button
              onClick={loadIcalSyncStatus}
              variant="outline"
              className="border-orange-300"
            >
              <Activity className="w-4 h-4" />
            </Button>
          </div>
          
          {/* Info */}
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

      {/* Security Section - Password Change */}
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
                  type={showNewPassword ? "text" : "password"}
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
          
          {newPassword && confirmPassword && newPassword !== confirmPassword && (
            <div className="bg-red-50 border border-red-200 p-3 rounded-lg text-sm text-red-700 flex items-center gap-2">
              <XCircle className="w-4 h-4 flex-shrink-0" />
              <span>Пароли не совпадают</span>
            </div>
          )}
          
          <Button
            onClick={handlePasswordChange}
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
