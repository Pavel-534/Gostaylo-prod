'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DollarSign, Users, ShoppingBag, TrendingUp, AlertCircle, UserPlus, CreditCard, RefreshCw, Send, Home, Wallet, Handshake, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getSiteDisplayName } from '@/lib/site-url';

const ADMIN_CHART_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b'];

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [telegramStatus, setTelegramStatus] = useState(null);
  const [sendingAlert, setSendingAlert] = useState(null);
  const [fxHealth, setFxHealth] = useState(null);

  useEffect(() => {
    loadDashboardData();
    checkTelegramStatus();
  }, []);

  const checkTelegramStatus = async () => {
    try {
      // Use internal fetch with error handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const res = await fetch('/api/v2/telegram/test', {
        signal: controller.signal,
        credentials: 'include',
      });
      clearTimeout(timeoutId);
      
      if (res.ok) {
        const data = await res.json();
        setTelegramStatus(data);
      } else {
        setTelegramStatus({ configured: false, bot: null, chat: null });
      }
    } catch (error) {
      console.error('Telegram status check failed:', error);
      setTelegramStatus({ configured: false, bot: null, chat: null });
    }
  };

  const sendTestAlert = async (type) => {
    setSendingAlert(type);
    try {
      const response = await fetch('/api/v2/telegram/test', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });
      const result = await response.json();

      if (result.success) {
        alert(`✅ ${type.toUpperCase()} alert sent successfully!`);
      } else {
        alert(`❌ Failed: ${result.error || result.description || 'Unknown error'}`);
      }
    } catch (error) {
      alert(`❌ Error: ${error.message}`);
    } finally {
      setSendingAlert(null);
    }
  };

  const loadDashboardData = async () => {
    try {
      const [statsRes, activityRes, fxRes, commRes, fxHealthRes] = await Promise.all([
        fetch('/api/v2/admin/stats', { credentials: 'include', cache: 'no-store' }),
        fetch('/api/admin/activity/recent?limit=8', { credentials: 'include', cache: 'no-store' }),
        fetch(`/api/v2/exchange-rates`, { cache: 'no-store' }),
        fetch(`/api/v2/commission`, { cache: 'no-store' }),
        fetch(`/api/v2/admin/exchange-rates-health`, { credentials: 'include', cache: 'no-store' }),
      ]);

      const statsJson = await statsRes.json().catch(() => ({}));
      const activityJson = await activityRes.json().catch(() => ({}));
      const fxJson = await fxRes.json().catch(() => ({}));
      const commJson = await commRes.json().catch(() => ({}));
      const fxHealthJson = await fxHealthRes.json().catch(() => ({}));

      if (fxHealthJson.success && fxHealthJson.data) {
        setFxHealth(fxHealthJson.data);
      } else {
        setFxHealth(null);
      }

      const d = statsJson.success ? statsJson.data : null;
      const activityDataRaw =
        activityJson.success && Array.isArray(activityJson.data) ? activityJson.data : [];
      const activityData = activityDataRaw.map((row) => ({
        type: row.activity_type || 'BOOKING',
        description: row.description || '—',
        user: row.user_name || row.user_id || '',
        amount: null,
        timestamp: row.created_at,
      }));

      const thbPerUsdt =
        fxJson.success && fxJson.rateMap?.USDT ? Number(fxJson.rateMap.USDT) : null;
      const systemCommissionPct =
        commJson.success && commJson.data?.systemRate != null
          ? Number(commJson.data.systemRate)
          : null;

      const totalPartners = d?.users?.partners ?? 0;
      const totalRenters = d?.users?.renters ?? 0;
      const totalUsers = d?.users?.total ?? 0;

      const totalRevenue = d?.revenue?.total ?? 0;
      const totalCommission = d?.revenue?.commission ?? 0;
      const activeBookings = d?.bookings?.activePipeline ?? 0;
      const totalBookings = d?.bookings?.total ?? 0;

      const byCat = d?.listingCountByCategoryId || {};
      const categoryDistribution = (d?.categoryRevenue || []).map((c, i) => ({
        name: c.name,
        value: byCat[String(c.id)] ?? 0,
        color: ADMIN_CHART_COLORS[i % ADMIN_CHART_COLORS.length],
      }));
      if (categoryDistribution.length === 0 || categoryDistribution.every((x) => !x.value)) {
        categoryDistribution.length = 0;
        categoryDistribution.push({ name: '—', value: 1, color: ADMIN_CHART_COLORS[0] });
      }

      const monthlyRevenue = (d?.monthlyRevenue || []).map((m) => ({
        month: m.month,
        thb: m.revenue,
        usdt:
          thbPerUsdt && m.revenue
            ? Math.round(m.revenue / thbPerUsdt)
            : thbPerUsdt && (m.revenue || 0)
              ? Math.round((m.revenue || 0) / thbPerUsdt)
              : 0,
      }));

      setStats({
        revenue: totalRevenue,
        revenueUsdt:
          thbPerUsdt && totalRevenue > 0 ? Math.round(totalRevenue / thbPerUsdt) : 0,
        commission: totalCommission,
        totalUsers,
        totalPartners,
        totalRenters,
        activeBookings,
        totalBookings,
        monthlyRevenue,
        categoryDistribution,
        systemCommissionPct,
      });

      setActivity(activityData || []);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
      // Set default stats on error
      setStats({
        revenue: 0,
        revenueUsdt: 0,
        commission: 0,
        totalUsers: 2,
        totalPartners: 1,
        totalRenters: 0,
        activeBookings: 0,
        totalBookings: 0,
        monthlyRevenue: [],
        categoryDistribution: [],
        systemCommissionPct: null,
      });
    } finally {
      setLoading(false);
    }
  };

  const getActivityIcon = (type) => {
    switch (type) {
      case 'BOOKING':
        return <ShoppingBag className="w-4 h-4 text-blue-600" />;
      case 'SIGNUP':
        return <UserPlus className="w-4 h-4 text-green-600" />;
      case 'PAYOUT':
        return <CreditCard className="w-4 h-4 text-purple-600" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-600" />;
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
    <div className="space-y-4 lg:space-y-6">
      {fxHealth?.stale ? (
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-red-950 sm:flex-row sm:items-center sm:justify-between"
          data-testid="admin-fx-stale-banner"
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden />
            <div>
              <p className="font-bold">Курсы валют не актуальны (&gt;24 ч или нет даты обновления)</p>
              <p className="text-sm text-red-900/90">
                Последнее обновление (среди проблемных):{' '}
                <span className="font-semibold">{fxHealth.lastUpdateLabel || 'неизвестно'}</span>
                {fxHealth.staleCodes?.length ? (
                  <span className="block text-xs mt-1 opacity-90">
                    Коды: {fxHealth.staleCodes.join(', ')}
                  </span>
                ) : null}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-sm lg:text-base text-gray-600 mt-1">Панель управления {getSiteDisplayName()}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={loadDashboardData}
            className="min-h-[44px] px-4"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Обновить
          </Button>
          <div className="text-right hidden sm:block">
            <p className="text-sm text-gray-600">Super Admin</p>
            <p className="text-lg font-semibold text-indigo-600">Павел Б.</p>
          </div>
        </div>
      </div>

      {/* Stats Cards - Responsive Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6">
        {/* Total Revenue */}
        <Card className="border-2 border-indigo-100 bg-gradient-to-br from-indigo-50 to-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Общая выручка</CardTitle>
            <DollarSign className="w-5 h-5 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-indigo-900">
              {stats?.revenue?.toLocaleString('ru-RU')} ₿
            </div>
            <p className="text-xs text-gray-600 mt-1">
              +{stats?.revenueUsdt?.toLocaleString('ru-RU')} USDT
            </p>
          </CardContent>
        </Card>

        {/* Commission */}
        <Card className="border-2 border-purple-100 bg-gradient-to-br from-purple-50 to-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Комиссия платформы</CardTitle>
            <TrendingUp className="w-5 h-5 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-900">
              {stats?.commission?.toLocaleString('ru-RU')} ₿
            </div>
            <p className="text-xs text-green-600 mt-1 font-medium">
              {stats?.systemCommissionPct != null && Number.isFinite(stats.systemCommissionPct)
                ? `Глобальная ставка ${stats.systemCommissionPct}%`
                : 'Ставка из настроек'}
            </p>
          </CardContent>
        </Card>

        {/* Total Users */}
        <Card className="border-2 border-pink-100 bg-gradient-to-br from-pink-50 to-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Пользователи</CardTitle>
            <Users className="w-5 h-5 text-pink-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-pink-900">{stats?.totalUsers}</div>
            <p className="text-xs text-gray-600 mt-1">
              {stats?.totalPartners} партнеров | {stats?.totalRenters} арендаторов
            </p>
          </CardContent>
        </Card>

        {/* Active Bookings */}
        <Card className="border-2 border-orange-100 bg-gradient-to-br from-orange-50 to-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Активные бронирования</CardTitle>
            <ShoppingBag className="w-5 h-5 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-900">{stats?.activeBookings}</div>
            <p className="text-xs text-gray-600 mt-1">
              из {stats?.totalBookings} всего
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        {/* Revenue Trend Chart */}
        <Card className="shadow-xl overflow-hidden">
          <CardHeader className="pb-2 lg:pb-4">
            <CardTitle className="text-lg lg:text-xl">Динамика выручки</CardTitle>
            <CardDescription className="text-xs lg:text-sm">Ежемесячный тренд (THB)</CardDescription>
          </CardHeader>
          <CardContent className="p-2 lg:p-6">
            <div className="w-full overflow-x-auto">
              <div className="min-w-[300px]">
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={stats?.monthlyRevenue || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="thb" stroke="#6366f1" strokeWidth={2} name="THB" />
                    <Line type="monotone" dataKey="usdt" stroke="#8b5cf6" strokeWidth={2} name="USDT" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Category Distribution */}
        <Card className="shadow-xl overflow-hidden">
          <CardHeader className="pb-2 lg:pb-4">
            <CardTitle className="text-lg lg:text-xl">По категориям</CardTitle>
            <CardDescription className="text-xs lg:text-sm">Распределение листингов</CardDescription>
          </CardHeader>
          <CardContent className="p-2 lg:p-6">
            <div className="w-full overflow-x-auto">
              <div className="min-w-[250px]">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={stats?.categoryDistribution || []}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => entry.name}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {(stats?.categoryDistribution || []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color || ADMIN_CHART_COLORS[index % ADMIN_CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Telegram Command Center */}
      <Card className="shadow-xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
        <CardHeader className="pb-2 lg:pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="text-lg lg:text-xl flex items-center gap-2">
                <Send className="w-5 h-5 text-blue-600" />
                Telegram Command Center
              </CardTitle>
              <CardDescription className="text-xs lg:text-sm">
                Тестовые уведомления для проверки интеграции
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {telegramStatus?.configured ? (
                <span className="flex items-center gap-1 text-sm text-green-600 font-medium">
                  <CheckCircle className="w-4 h-4" />
                  Connected
                </span>
              ) : (
                <span className="flex items-center gap-1 text-sm text-red-600 font-medium">
                  <XCircle className="w-4 h-4" />
                  Not configured
                </span>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 lg:p-6 pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-4">
            {/* Test Booking Alert */}
            <Button
              onClick={() => sendTestAlert('booking')}
              disabled={sendingAlert === 'booking'}
              className="h-auto py-4 flex flex-col items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
              data-testid="test-booking-alert-btn"
            >
              {sendingAlert === 'booking' ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <Home className="w-6 h-6" />
              )}
              <span className="font-semibold">Test Booking Alert</span>
              <span className="text-xs opacity-80">🏠 BOOKINGS topic</span>
            </Button>

            {/* Test Finance Alert */}
            <Button
              onClick={() => sendTestAlert('finance')}
              disabled={sendingAlert === 'finance'}
              className="h-auto py-4 flex flex-col items-center gap-2 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600"
              data-testid="test-finance-alert-btn"
            >
              {sendingAlert === 'finance' ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <Wallet className="w-6 h-6" />
              )}
              <span className="font-semibold">Test Finance Alert</span>
              <span className="text-xs opacity-80">💰 FINANCE topic</span>
            </Button>

            {/* Test Partner Alert */}
            <Button
              onClick={() => sendTestAlert('partner')}
              disabled={sendingAlert === 'partner'}
              className="h-auto py-4 flex flex-col items-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
              data-testid="test-partner-alert-btn"
            >
              {sendingAlert === 'partner' ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <Handshake className="w-6 h-6" />
              )}
              <span className="font-semibold">Test Partner Alert</span>
              <span className="text-xs opacity-80">🤝 NEW_PARTNERS topic</span>
            </Button>
          </div>

          {telegramStatus?.bot && (
            <div className="mt-4 p-3 bg-white/70 rounded-lg border border-blue-200">
              <p className="text-sm text-gray-700">
                <strong>Bot:</strong> @{telegramStatus.bot.username} ({telegramStatus.bot.firstName})
              </p>
              {telegramStatus.chat && (
                <p className="text-sm text-gray-700">
                  <strong>Group:</strong> {telegramStatus.chat.title} (ID: {telegramStatus.chat.id})
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activity Feed */}
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            Последние события
          </CardTitle>
          <CardDescription>Real-time активность на платформе</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {activity.map((item, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg border border-gray-300">
                    {getActivityIcon(item.type)}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{item.description}</p>
                    <p className="text-sm text-gray-600">{item.user}</p>
                  </div>
                </div>
                <div className="text-right">
                  {item.amount && (
                    <p className="font-semibold text-gray-900">
                      {item.amount.toLocaleString('ru-RU')} ₿
                    </p>
                  )}
                  <p className="text-xs text-gray-500">
                    {new Date(item.timestamp).toLocaleString('ru-RU', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
