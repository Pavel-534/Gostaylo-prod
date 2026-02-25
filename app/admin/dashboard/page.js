'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DollarSign, Users, ShoppingBag, TrendingUp, AlertCircle, UserPlus, CreditCard } from 'lucide-react';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [statsRes, activityRes] = await Promise.all([
        fetch('/api/admin/stats'),
        fetch('/api/admin/activity-feed?limit=8'),
      ]);

      if (statsRes.ok && activityRes.ok) {
        const statsData = await statsRes.json();
        const activityData = await activityRes.json();
        setStats(statsData.data);
        setActivity(activityData.data);
      }
    } catch (error) {
      console.error('Failed to load dashboard:', error);
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600 mt-1">Панель управления платформой FunnyRent</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-600">Super Admin</p>
          <p className="text-lg font-semibold text-indigo-600">Павел Б.</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend Chart */}
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="text-xl">Динамика выручки</CardTitle>
            <CardDescription>Ежемесячный тренд доходов (THB)</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={stats?.monthlyRevenue || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="thb" stroke="#6366f1" strokeWidth={3} name="THB" />
                <Line type="monotone" dataKey="usdt" stroke="#8b5cf6" strokeWidth={3} name="USDT" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Category Distribution */}
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="text-xl">Распределение по категориям</CardTitle>
            <CardDescription>Что приносит больше дохода?</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={stats?.categoryRevenue || []}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.category}: ${entry.percentage}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="revenue"
                >
                  {(stats?.categoryRevenue || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

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
