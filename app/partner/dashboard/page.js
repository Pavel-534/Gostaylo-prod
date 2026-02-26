'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Home, Calendar, DollarSign, Users, TrendingUp, Eye, ArrowUpRight, Send, Bot, Bell, Copy, Check, Loader2, Sparkles, MessageSquare, Zap } from 'lucide-react'
import { formatPrice } from '@/lib/currency'
import { toast } from 'sonner'

export default function PartnerDashboard() {
  const [stats, setStats] = useState(null)
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [linkCode, setLinkCode] = useState('')
  const [generatingCode, setGeneratingCode] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const [statsRes, bookingsRes] = await Promise.all([
        fetch('/api/v2/partner/stats'),
        fetch('/api/v2/bookings'),
      ])

      const statsData = await statsRes.json()
      const bookingsData = await bookingsRes.json()

      setStats(statsData.data || statsData)
      setBookings(bookingsData.data?.slice(0, 5) || [])
      setLoading(false)
    } catch (error) {
      console.error('Failed to load data:', error)
      setLoading(false)
    }
  }

  async function generateLinkCode() {
    setGeneratingCode(true)
    try {
      const storedUser = localStorage.getItem('funnyrent_user')
      const user = storedUser ? JSON.parse(storedUser) : { id: 'partner-1' }
      
      const res = await fetch('/api/v2/telegram/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      })
      const data = await res.json()
      
      if (data.success) {
        setLinkCode(data.code)
        toast.success('Код сгенерирован!')
      } else {
        toast.error(data.error || 'Ошибка генерации кода')
      }
    } catch (error) {
      toast.error('Ошибка: ' + error.message)
    } finally {
      setGeneratingCode(false)
    }
  }

  function copyCode() {
    navigator.clipboard.writeText(`/link ${linkCode}`)
    setCopied(true)
    toast.success('Команда скопирована!')
    setTimeout(() => setCopied(false), 2000)
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

      {/* Telegram Magic - Onboarding Block */}
      <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 shadow-xl overflow-hidden">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                Telegram Magic
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">NEW</span>
              </CardTitle>
              <CardDescription>
                Управляйте бизнесом прямо из Telegram
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Step 1: Connect Bot */}
            <div className="bg-white/80 backdrop-blur rounded-xl p-4 border border-blue-100 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm">1</div>
                <h3 className="font-semibold text-slate-900">Connect Bot</h3>
              </div>
              <p className="text-sm text-slate-600 mb-4">
                Подключите бота для получения уведомлений о бронированиях
              </p>
              
              {!linkCode ? (
                <Button 
                  onClick={generateLinkCode}
                  disabled={generatingCode}
                  className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
                  data-testid="get-link-code-btn"
                >
                  {generatingCode ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Генерация...
                    </>
                  ) : (
                    <>
                      <Bot className="h-4 w-4 mr-2" />
                      Get My Link Code
                    </>
                  )}
                </Button>
              ) : (
                <div className="space-y-2">
                  <div className="bg-slate-100 rounded-lg p-3 font-mono text-center text-lg font-bold text-indigo-600">
                    {linkCode}
                  </div>
                  <Button 
                    onClick={copyCode}
                    variant="outline"
                    className="w-full"
                  >
                    {copied ? (
                      <>
                        <Check className="h-4 w-4 mr-2 text-green-600" />
                        Скопировано!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" />
                        Copy /link {linkCode}
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-slate-500 text-center">
                    Отправьте боту <a href="https://t.me/FunnyRent_777_bot" target="_blank" className="text-blue-600 hover:underline">@FunnyRent_777_bot</a>
                  </p>
                </div>
              )}
            </div>

            {/* Step 2: Instant Listing */}
            <div className="bg-white/80 backdrop-blur rounded-xl p-4 border border-purple-100 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold text-sm">2</div>
                <h3 className="font-semibold text-slate-900">Instant Listing</h3>
              </div>
              <p className="text-sm text-slate-600 mb-4">
                Просто отправьте фото и описание боту — объявление создастся автоматически
              </p>
              <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                <div className="flex items-start gap-2">
                  <MessageSquare className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-purple-800">
                    <strong>Как это работает:</strong><br/>
                    1. Отправьте 3-5 фото<br/>
                    2. Добавьте описание<br/>
                    3. Укажите цену<br/>
                    4. Готово! Черновик создан ✨
                  </p>
                </div>
              </div>
            </div>

            {/* Step 3: Real-time Alerts */}
            <div className="bg-white/80 backdrop-blur rounded-xl p-4 border border-teal-100 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-teal-500 rounded-full flex items-center justify-center text-white font-bold text-sm">3</div>
                <h3 className="font-semibold text-slate-900">Real-time Alerts</h3>
              </div>
              <p className="text-sm text-slate-600 mb-4">
                Получайте мгновенные уведомления прямо в Telegram
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-2 p-2 bg-green-50 rounded-lg border border-green-200">
                  <Bell className="h-4 w-4 text-green-600" />
                  <span className="text-xs text-green-800">Новые бронирования</span>
                </div>
                <div className="flex items-center gap-2 p-2 bg-yellow-50 rounded-lg border border-yellow-200">
                  <Zap className="h-4 w-4 text-yellow-600" />
                  <span className="text-xs text-yellow-800">Подтверждения оплаты</span>
                </div>
                <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg border border-blue-200">
                  <DollarSign className="h-4 w-4 text-blue-600" />
                  <span className="text-xs text-blue-800">Выплаты и балансы</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

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