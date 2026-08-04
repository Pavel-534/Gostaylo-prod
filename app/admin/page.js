/**
 * Admin dashboard — главная панель.
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Users, Building2, CreditCard, MessageSquare, 
  TrendingUp, CheckCircle, Clock,
  Shield, BarChart3, DollarSign
} from 'lucide-react';
import { OwnerLaunchReadinessCard } from '@/components/admin/OwnerLaunchReadinessCard';
import { OwnerPlatformStatusCard } from '@/components/admin/OwnerPlatformStatusCard';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      const res = await fetch('/api/v2/admin/stats', { credentials: 'include', cache: 'no-store' });
      const data = await res.json();
      if (data.success) {
        setStats(data.data ?? data);
      }
    } catch (error) {
      console.error('[ADMIN STATS]', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleRefreshCache() {
    setRefreshing(true);
    try {
      const res = await fetch('/api/admin/revalidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          paths: ['/', '/listings', '/renter', '/partner/dashboard'] 
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        alert('Кэш очищен. «Призрачные» объявления должны исчезнуть.');
        loadStats();
      } else {
        alert('Не удалось очистить кэш. Попробуйте ещё раз.');
      }
    } catch (error) {
      console.error('[REFRESH CACHE]', error);
      alert('Ошибка очистки кэша. Смотрите консоль.');
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Главная панель</h1>
          <p className="text-slate-600">Обзор системы и управление</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            onClick={handleRefreshCache}
            disabled={refreshing}
            variant="outline"
            className="bg-white hover:bg-slate-50"
          >
            <TrendingUp className="h-4 w-4 mr-2" />
            {refreshing ? 'Обновление…' : 'Обновить данные сайта'}
          </Button>
          <Badge className="bg-indigo-100 text-indigo-800">
            <Shield className="h-3 w-3 mr-1" />
            Доступ админа
          </Badge>
        </div>
      </div>

      {!loading && stats?.launchReadiness ? (
        <OwnerLaunchReadinessCard launchReadiness={stats.launchReadiness} onRefresh={loadStats} />
      ) : loading ? (
        <div className="h-40 rounded-xl border-2 border-indigo-200 bg-indigo-50/50 animate-pulse" aria-hidden />
      ) : null}

      <OwnerPlatformStatusCard platformStatus={stats?.platformStatus} loading={loading} />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Всего пользователей</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.users?.total || 0}</div>
            <p className="text-xs text-slate-500">
              {stats?.users?.partners || 0} партнёров, {stats?.users?.renters || 0} клиентов
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Активные объявления</CardTitle>
            <Building2 className="h-4 w-4 text-brand" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.listings?.active || 0}</div>
            <p className="text-xs text-slate-500">
              {stats?.listings?.pending || 0} на проверке
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Выручка (месяц)</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ฿{(
                stats?.monthlyRevenue?.[stats.monthlyRevenue.length - 1]?.revenue ??
                stats?.revenue?.total ??
                0
              ).toLocaleString()}
            </div>
            <p className="text-xs text-slate-500">
              ฿{(stats?.revenue?.commission || 0).toLocaleString()} комиссия (всего)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Ожидают действий</CardTitle>
            <Clock className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {(stats?.pending?.payments || 0) + (stats?.pending?.verifications || 0)}
            </div>
            <p className="text-xs text-slate-500">
              {stats?.pending?.payments || 0} платежей, {stats?.pending?.verifications || 0} верификаций
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/admin/users">
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-blue-500">
            <CardContent className="pt-6">
              <Users className="h-8 w-8 text-blue-600 mb-2" />
              <h3 className="font-semibold">Пользователи</h3>
              <p className="text-sm text-slate-600">Роли и аккаунты</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/moderation" className="relative">
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-brand">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between gap-2">
                <Building2 className="h-8 w-8 text-brand mb-2" />
                {(stats?.listings?.pending || 0) > 0 ? (
                  <Badge className="bg-orange-100 text-orange-800 shrink-0">
                    {stats.listings.pending} на проверке
                  </Badge>
                ) : null}
              </div>
              <h3 className="font-semibold">Объявления</h3>
              <p className="text-sm text-slate-600">Модерация и одобрение</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/finances">
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-green-500">
            <CardContent className="pt-6">
              <CreditCard className="h-8 w-8 text-green-600 mb-2" />
              <h3 className="font-semibold">Финансы</h3>
              <p className="text-sm text-slate-600">Платежи и выплаты</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/messages/">
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-purple-500">
            <CardContent className="pt-6">
              <MessageSquare className="h-8 w-8 text-purple-600 mb-2" />
              <h3 className="font-semibold">Сообщения</h3>
              <p className="text-sm text-slate-600">Поддержка и споры</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* System Health */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Состояние системы
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm">API: онлайн</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm">База данных: подключена</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm">Telegram-бот: активен</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm">Email: готов</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
