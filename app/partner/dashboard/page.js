'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Home, Calendar, DollarSign, Users, TrendingUp, Eye, ArrowUpRight } from 'lucide-react'
import { formatPrice } from '@/lib/currency'

export default function PartnerDashboard() {
  const [stats, setStats] = useState(null)
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const [statsRes, bookingsRes] = await Promise.all([
        fetch('/api/partner/stats'),
        fetch('/api/partner/bookings'),
      ])

      const statsData = await statsRes.json()
      const bookingsData = await bookingsRes.json()

      setStats(statsData.data)
      setBookings(bookingsData.data?.slice(0, 5) || [])
      setLoading(false)
    } catch (error) {
      console.error('Failed to load data:', error)
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    )
  }

  const statCards = [
    {
      title: 'Всего листингов',
      value: stats?.totalListings || 0,
      change: `${stats?.activeListings || 0} активных`,
      icon: Home,
      color: 'bg-blue-50 text-blue-600',
    },
    {
      title: 'Активные бронирования',
      value: stats?.activeBookings || 0,
      change: `${stats?.totalBookings || 0} всего`,
      icon: Calendar,
      color: 'bg-purple-50 text-purple-600',
    },
    {
      title: 'Общий доход',
      value: formatPrice(stats?.totalEarnings || 0, 'THB'),
      change: 'После комиссии',
      icon: DollarSign,
      color: 'bg-green-50 text-green-600',
    },
    {
      title: 'Реферальные бонусы',
      value: formatPrice(stats?.referralBonuses || 0, 'USDT'),
      change: 'Выплачено',
      icon: Users,
      color: 'bg-teal-50 text-teal-600',
    },
  ]

  return (
    <div className="p-4 lg:p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Панель управления</h1>
        <p className="text-slate-600 mt-1">
          Добро пожаловать обратно! Вот обзор вашего бизнеса.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card) => (
          <Card key={card.title} className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">
                {card.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${card.color}`}>
                <card.icon className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">{card.value}</div>
              <p className="text-xs text-slate-500 mt-1">{card.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance Card */}
        <Card>
          <CardHeader>
            <CardTitle>Производительность</CardTitle>
            <CardDescription>Статистика за последний месяц</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-slate-500" />
                <span className="text-sm text-slate-600">Всего просмотров</span>
              </div>
              <span className="text-lg font-semibold text-slate-900">
                {stats?.totalViews || 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-slate-500" />
                <span className="text-sm text-slate-600">Конверсия</span>
              </div>
              <span className="text-lg font-semibold text-slate-900">
                {stats?.totalViews > 0 
                  ? ((stats.totalBookings / stats.totalViews) * 100).toFixed(1)
                  : 0}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-slate-500" />
                <span className="text-sm text-slate-600">Уплачено комиссий</span>
              </div>
              <span className="text-lg font-semibold text-red-600">
                {formatPrice(stats?.totalCommissionPaid || 0, 'THB')}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Последняя активность</CardTitle>
            <CardDescription>Последние 5 бронирований</CardDescription>
          </CardHeader>
          <CardContent>
            {bookings.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">
                Нет активности
              </p>
            ) : (
              <div className="space-y-3">
                {bookings.map((booking) => (
                  <div
                    key={booking.id}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900">
                        {booking.guestName}
                      </p>
                      <p className="text-xs text-slate-500">
                        {booking.listing?.title}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-teal-600">
                        {formatPrice(booking.priceThb - booking.commissionThb, 'THB')}
                      </p>
                      <span className={`inline-block px-2 py-0.5 text-xs rounded-full ${
                        booking.status === 'CONFIRMED'
                          ? 'bg-green-100 text-green-700'
                          : booking.status === 'PENDING'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {booking.status === 'CONFIRMED' ? 'Подтверждено' : 
                         booking.status === 'PENDING' ? 'Ожидание' : booking.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Быстрые действия</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <a
              href="/partner/listings/new"
              className="flex items-center justify-between p-4 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-lg hover:shadow-lg transition-shadow"
            >
              <span className="font-medium">Добавить листинг</span>
              <ArrowUpRight className="h-5 w-5" />
            </a>
            <a
              href="/partner/bookings"
              className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:shadow-lg transition-shadow"
            >
              <span className="font-medium">Просмотр бронирований</span>
              <ArrowUpRight className="h-5 w-5" />
            </a>
            <a
              href="/partner/referrals"
              className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg hover:shadow-lg transition-shadow"
            >
              <span className="font-medium">Пригласить партнёра</span>
              <ArrowUpRight className="h-5 w-5" />
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}