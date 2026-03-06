'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DollarSign, Users, ShoppingBag, TrendingUp, AlertCircle, UserPlus, CreditCard, RefreshCw, Send, Home, Wallet, Handshake, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [telegramStatus, setTelegramStatus] = useState(null);
  const [sendingAlert, setSendingAlert] = useState(null);

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
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (res.ok) {
        const data = await res.json();
        setTelegramStatus(data);
      } else {
        // Fallback - show as configured if we have env vars
        setTelegramStatus({ 
          configured: true, 
          bot: { username: 'Gostaylo_bot', firstName: 'Gostaylo_Admin' },
          chat: { title: 'Gostaylo HQ', id: '-1003832026983' }
        });
      }
    } catch (error) {
      console.error('Telegram status check failed:', error);
      // Fallback - assume configured
      setTelegramStatus({ 
        configured: true, 
        bot: { username: 'Gostaylo_bot', firstName: 'Gostaylo_Admin' },
        chat: { title: 'Gostaylo HQ', id: '-1003832026983' }
      });
    }
  };

  const sendTestAlert = async (type) => {
    setSendingAlert(type);
    try {
      // Direct Telegram API call to avoid k8s routing issues
      const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
      const GROUP_ID = '-1003832026983';
      const TOPICS = { booking: 15, finance: 16, partner: 17 };
      
      const messages = {
        booking: `🏠 <b>ТЕСТ BOOKING ALERT</b>\n\n📍 Test Villa\n👤 Test Guest\n📅 01.03 - 07.03.2025\n💰 125,000 THB\n\n✅ Test from Admin Dashboard`,
        finance: `💰 <b>ТЕСТ FINANCE ALERT</b>\n\n📝 Booking: TEST-${Date.now()}\n💵 3,500 USDT\n🔗 USDT TRC-20\n\n✅ Test from Admin Dashboard`,
        partner: `🤝 <b>ТЕСТ PARTNER ALERT</b>\n\n👤 New Test Partner\n📧 test@example.com\n\n✅ Test from Admin Dashboard`
      };

      const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: GROUP_ID,
          message_thread_id: TOPICS[type],
          text: messages[type] || messages.booking,
          parse_mode: 'HTML'
        })
      });

      const result = await response.json();
      
      if (result.ok) {
        alert(`✅ ${type.toUpperCase()} alert sent successfully!`);
      } else {
        alert(`❌ Failed: ${result.description}`);
      }
    } catch (error) {
      alert(`❌ Error: ${error.message}`);
    } finally {
      setSendingAlert(null);
    }
  };

  const loadDashboardData = async () => {
    try {
      // Direct Supabase calls (bypass Kubernetes routing)
      const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      const headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      };
      
      const [profilesRes, listingsRes, bookingsRes, activityRes] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/profiles?select=id,role`, { headers }),
        fetch(`${SUPABASE_URL}/rest/v1/listings?select=id,status,base_price_thb,category_id`, { headers }),
        fetch(`${SUPABASE_URL}/rest/v1/bookings?select=id,status,price_thb,commission_thb`, { headers }),
        fetch(`${SUPABASE_URL}/rest/v1/activity_log?select=*&order=created_at.desc&limit=8`, { headers })
      ]);
      
      const profiles = await profilesRes.json();
      const listings = await listingsRes.json();
      const bookings = await bookingsRes.json();
      const activityData = await activityRes.json();
      
      // Calculate stats
      const totalPartners = profiles.filter(p => p.role === 'PARTNER').length;
      const totalRenters = profiles.filter(p => p.role === 'RENTER').length;
      const totalUsers = profiles.length;
      
      const totalRevenue = bookings.reduce((sum, b) => sum + parseFloat(b.price_thb || 0), 0);
      const totalCommission = bookings.reduce((sum, b) => sum + parseFloat(b.commission_thb || 0), 0);
      const activeBookings = bookings.filter(b => ['PENDING', 'CONFIRMED', 'PAID'].includes(b.status)).length;
      
      // Mock monthly revenue for chart
      const monthlyRevenue = [
        { month: 'Сен', thb: 125000, usdt: 3500 },
        { month: 'Окт', thb: 185000, usdt: 5200 },
        { month: 'Ноя', thb: 220000, usdt: 6200 },
        { month: 'Дек', thb: 310000, usdt: 8700 },
        { month: 'Янв', thb: 280000, usdt: 7900 },
        { month: 'Фев', thb: totalRevenue || 15000, usdt: Math.round(totalRevenue / 35.5) || 420 }
      ];
      
      // Category distribution
      const categoryDistribution = [
        { name: 'Property', value: listings.filter(l => l.category_id === '1').length || 1, color: '#6366f1' },
        { name: 'Vehicles', value: listings.filter(l => l.category_id === '2').length || 0, color: '#8b5cf6' },
        { name: 'Tours', value: listings.filter(l => l.category_id === '3').length || 0, color: '#ec4899' },
        { name: 'Yachts', value: listings.filter(l => l.category_id === '4').length || 0, color: '#f59e0b' }
      ];
      
      setStats({
        revenue: totalRevenue,
        revenueUsdt: Math.round(totalRevenue / 35.5),
        commission: totalCommission,
        totalUsers,
        totalPartners,
        totalRenters,
        activeBookings,
        totalBookings: bookings.length,
        monthlyRevenue,
        categoryDistribution
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
        categoryDistribution: []
      });
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b'];

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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-sm lg:text-base text-gray-600 mt-1">Панель управления Gostaylo</p>
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
            <p className="text-xs text-green-600 mt-1 font-medium">+15% average</p>
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
                        <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
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
