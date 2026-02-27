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
  WifiOff
} from 'lucide-react';
import { toast } from 'sonner';

const TELEGRAM_BOT_TOKEN = '8702569258:AAFuj-Ob9otOVf6KiABQSiiWC0-8_KvkFqM';

export default function SystemControlPage() {
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [webhookStatus, setWebhookStatus] = useState(null);
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSystemStatus();
  }, []);

  async function loadSystemStatus() {
    try {
      // Load maintenance mode from Supabase
      const SUPABASE_URL = 'https://vtzzcdsjwudkaloxhvnw.supabase.co';
      const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0enpjZHNqd3Vka2Fsb3hodm53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMjkxMzUsImV4cCI6MjA4NzYwNTEzNX0.vSrBY_n8_KqAi0yzN-g9LZqTkbbjloSakXq5o_28r4k';
      
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
      
      // Load recent activity from activity_log
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
        setWebhookStatus({
          url: data.result.url,
          isActive: !!data.result.url,
          pendingUpdates: data.result.pending_update_count || 0,
          lastError: data.result.last_error_message || null,
          lastErrorDate: data.result.last_error_date ? new Date(data.result.last_error_date * 1000).toISOString() : null
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
      
      // Upsert the setting
      const res = await fetch(`${SUPABASE_URL}/rest/v1/system_settings?key=eq.maintenance_mode`, {
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
      toast.success(enabled ? '🔴 Maintenance Mode ENABLED' : '🟢 Maintenance Mode DISABLED');
      
      // Log activity
      await logActivity(enabled ? 'MAINTENANCE_ENABLED' : 'MAINTENANCE_DISABLED', 'System maintenance mode toggled');
      
    } catch (error) {
      console.error('Failed to toggle maintenance:', error);
      toast.error('Failed to update maintenance mode');
    }
  }

  async function handleRelinkWebhook() {
    setWebhookLoading(true);
    try {
      const webhookUrl = `${window.location.origin}/api/webhooks/telegram`;
      
      // Delete existing webhook
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteWebhook`);
      
      // Set new webhook
      const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook?url=${encodeURIComponent(webhookUrl)}&drop_pending_updates=true`);
      const data = await res.json();
      
      if (data.ok) {
        toast.success('✅ Telegram Webhook Re-linked!');
        await checkWebhookStatus();
        await logActivity('WEBHOOK_RELINKED', `Webhook set to ${webhookUrl}`);
      } else {
        toast.error('Failed to set webhook: ' + data.description);
      }
    } catch (error) {
      console.error('Failed to relink webhook:', error);
      toast.error('Failed to relink webhook');
    } finally {
      setWebhookLoading(false);
    }
  }

  async function handleSendTestMessage() {
    try {
      // Get admin chat ID (Pavel)
      const chatId = 1303143012;
      
      const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: '🌴 <b>Aloha from FunnyRent!</b>\n\nThis is a test message from the System Control Center.\n\nYour bot is working correctly! 🤖',
          parse_mode: 'HTML'
        })
      });
      
      const data = await res.json();
      if (data.ok) {
        toast.success('✅ Test message sent!');
        await logActivity('BOT_TEST', 'Test message sent to admin');
      } else {
        toast.error('Failed to send message: ' + data.description);
      }
    } catch (error) {
      toast.error('Failed to send test message');
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
      
      // Refresh activity list
      loadSystemStatus();
    } catch (error) {
      console.error('Failed to log activity:', error);
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleString('ru-RU', { 
      day: '2-digit', 
      month: '2-digit', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Server className="w-8 h-8 text-teal-600" />
            System Control Center
          </h1>
          <p className="text-slate-600 mt-1">Manage platform operations and integrations</p>
        </div>
        <Badge variant={maintenanceMode ? "destructive" : "default"} className="text-sm px-3 py-1">
          {maintenanceMode ? '🔴 Maintenance' : '🟢 Online'}
        </Badge>
      </div>

      {/* Main Kill Switch */}
      <Card className={`border-2 ${maintenanceMode ? 'border-red-500 bg-red-50' : 'border-teal-500 bg-teal-50'} shadow-lg`}>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${maintenanceMode ? 'bg-red-500' : 'bg-teal-500'}`}>
                <Power className="w-6 h-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl">Maintenance Mode</CardTitle>
                <CardDescription>Global kill switch for the public site</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Label htmlFor="maintenance" className={`text-lg font-semibold ${maintenanceMode ? 'text-red-700' : 'text-teal-700'}`}>
                {maintenanceMode ? 'ENABLED' : 'DISABLED'}
              </Label>
              <Switch
                id="maintenance"
                checked={maintenanceMode}
                onCheckedChange={handleMaintenanceToggle}
                className="scale-125"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className={`p-4 rounded-lg ${maintenanceMode ? 'bg-red-100' : 'bg-teal-100'}`}>
            <div className="flex items-center gap-2">
              <AlertTriangle className={`w-5 h-5 ${maintenanceMode ? 'text-red-600' : 'text-teal-600'}`} />
              <span className={`text-sm font-medium ${maintenanceMode ? 'text-red-700' : 'text-teal-700'}`}>
                {maintenanceMode 
                  ? 'Public site is DOWN. Only admins can access the platform.'
                  : 'Platform is fully operational. All users can access the site.'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Telegram Webhook Management */}
      <Card className="border-2 border-slate-200 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl">Telegram Bot Webhook</CardTitle>
                <CardDescription>Manage bot connectivity and status</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {webhookStatus?.isActive ? (
                <Badge className="bg-green-500 text-white flex items-center gap-1">
                  <Wifi className="w-3 h-3" />
                  Online
                </Badge>
              ) : (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <WifiOff className="w-3 h-3" />
                  Offline
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Webhook Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-100 p-4 rounded-lg">
              <Label className="text-xs text-slate-500 uppercase">Webhook URL</Label>
              <p className="text-sm font-mono mt-1 break-all">
                {webhookStatus?.url || 'Not configured'}
              </p>
            </div>
            <div className="bg-slate-100 p-4 rounded-lg">
              <Label className="text-xs text-slate-500 uppercase">Pending Updates</Label>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {webhookStatus?.pendingUpdates || 0}
              </p>
            </div>
          </div>
          
          {/* Error Info */}
          {webhookStatus?.lastError && (
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
              <div className="flex items-center gap-2 text-amber-700">
                <AlertTriangle className="w-4 h-4" />
                <span className="font-medium">Last Error</span>
              </div>
              <p className="text-sm text-amber-600 mt-1">{webhookStatus.lastError}</p>
              <p className="text-xs text-amber-500 mt-1">
                {webhookStatus.lastErrorDate ? `at ${formatDate(webhookStatus.lastErrorDate)}` : ''}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={handleRelinkWebhook}
              disabled={webhookLoading}
              className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white"
            >
              {webhookLoading ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Re-link Webhook
            </Button>
            <Button
              onClick={handleSendTestMessage}
              variant="outline"
              className="border-teal-500 text-teal-700 hover:bg-teal-50"
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Send Test "Aloha!"
            </Button>
            <Button
              onClick={checkWebhookStatus}
              variant="outline"
            >
              <Activity className="w-4 h-4 mr-2" />
              Refresh Status
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity Log */}
      <Card className="border-2 border-slate-200 shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl">Recent System Activity</CardTitle>
              <CardDescription>Last 10 system events</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {recentActivity.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No recent activity</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentActivity.slice(0, 10).map((event, idx) => (
                <div 
                  key={event.id || idx} 
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      event.action?.includes('ERROR') ? 'bg-red-500' :
                      event.action?.includes('MAINTENANCE') ? 'bg-amber-500' :
                      'bg-green-500'
                    }`} />
                    <div>
                      <span className="font-medium text-sm text-slate-900">
                        {event.action || 'Unknown Action'}
                      </span>
                      <p className="text-xs text-slate-500">{event.details || ''}</p>
                    </div>
                  </div>
                  <div className="text-xs text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDate(event.created_at)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-teal-50 to-cyan-50 border-teal-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-teal-600 font-medium">System Status</p>
                <p className="text-2xl font-bold text-teal-900">
                  {maintenanceMode ? 'Maintenance' : 'Operational'}
                </p>
              </div>
              <Shield className={`w-10 h-10 ${maintenanceMode ? 'text-amber-500' : 'text-teal-500'}`} />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium">Bot Status</p>
                <p className="text-2xl font-bold text-blue-900">
                  {webhookStatus?.isActive ? 'Connected' : 'Disconnected'}
                </p>
              </div>
              <Bot className={`w-10 h-10 ${webhookStatus?.isActive ? 'text-blue-500' : 'text-red-500'}`} />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600 font-medium">Pending Updates</p>
                <p className="text-2xl font-bold text-purple-900">
                  {webhookStatus?.pendingUpdates || 0}
                </p>
              </div>
              <Zap className="w-10 h-10 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
