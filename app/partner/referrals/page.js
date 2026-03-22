'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Copy, Share2, Users, Gift, Check, ExternalLink } from 'lucide-react'
import { formatPrice } from '@/lib/currency'
import { toast } from 'sonner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export default function PartnerReferrals() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [siteOrigin, setSiteOrigin] = useState('')

  useEffect(() => {
    setSiteOrigin(typeof window !== 'undefined' ? window.location.origin : '')
  }, [])

  useEffect(() => {
    loadReferrals()
  }, [])

  async function loadReferrals() {
    try {
      const res = await fetch('/api/partner/referrals')
      const result = await res.json()
      setData(result.data)
      setLoading(false)
    } catch (error) {
      console.error('Failed to load referrals:', error)
      setLoading(false)
    }
  }

  function copyReferralCode() {
    navigator.clipboard.writeText(data?.referralCode || '')
    setCopied(true)
    toast.success('Реферальный код скопирован!')
    setTimeout(() => setCopied(false), 2000)
  }

  function shareReferralLink() {
    const link = `${siteOrigin}?ref=${data?.referralCode}`
    navigator.clipboard.writeText(link)
    toast.success('Ссылка скопирована в буфер обмена!')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Реферальная программа</h1>
        <p className="text-slate-600 mt-1">
          Приглашайте партнёров и зарабатывайте бонусы
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Приглашено партнёров
            </CardTitle>
            <Users className="h-4 w-4 text-teal-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              {data?.totalReferred || 0}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              +{data?.referrals?.filter(r => !r.rewardPaid).length || 0} ожидают первого бронирования
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Заработано бонусов
            </CardTitle>
            <Gift className="h-4 w-4 text-teal-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-teal-600">
              {formatPrice(data?.totalRewards || 0, 'USDT')}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {data?.referrals?.filter(r => r.rewardPaid).length || 0} выплачено
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Ваш реферальный код
            </CardTitle>
            <Share2 className="h-4 w-4 text-teal-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 font-mono">
              {data?.referralCode || 'FR00000'}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={copyReferralCode}
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 mr-1" />
                  Скопировано
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3 mr-1" />
                  Копировать код
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Share Card */}
      <Card className="bg-gradient-to-r from-teal-500 to-teal-600 text-white">
        <CardHeader>
          <CardTitle className="text-white">Поделитесь реферальной ссылкой</CardTitle>
          <CardDescription className="text-teal-50">
            Приглашайте других партнёров и получайте 50 USDT за каждого активного реферала
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={siteOrigin ? `${siteOrigin}?ref=${data?.referralCode}` : ''}
              readOnly
              className="bg-white/20 border-white/30 text-white placeholder:text-teal-100"
            />
            <Button
              variant="secondary"
              onClick={shareReferralLink}
            >
              <Share2 className="h-4 w-4 mr-2" />
              Поделиться
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <div className="text-3xl font-bold mb-1">50 USDT</div>
              <p className="text-sm text-teal-50">За каждого активного реферала</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <div className="text-3xl font-bold mb-1">10%</div>
              <p className="text-sm text-teal-50">Бонус от их первых 10 заказов</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <div className="text-3xl font-bold mb-1">∞</div>
              <p className="text-sm text-teal-50">Неограниченное количество рефералов</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Referrals List */}
      <Card>
        <CardHeader>
          <CardTitle>Ваши рефералы</CardTitle>
          <CardDescription>
            Список приглашённых партнёров и их статус
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!data?.referrals || data.referrals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-slate-300 mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                Пока нет рефералов
              </h3>
              <p className="text-slate-600 text-center max-w-md mb-6">
                Начните приглашать партнёров и зарабатывайте бонусы
              </p>
              <Button onClick={shareReferralLink} className="bg-teal-600 hover:bg-teal-700">
                <Share2 className="h-4 w-4 mr-2" />
                Поделиться ссылкой
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Дата регистрации</TableHead>
                    <TableHead>Бонус</TableHead>
                    <TableHead>Статус</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.referrals.map((referral) => (
                    <TableRow key={referral.id}>
                      <TableCell className="font-medium">
                        {referral.referredEmail}
                      </TableCell>
                      <TableCell>
                        {new Date(referral.createdAt).toLocaleDateString('ru-RU')}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-semibold text-teal-600">
                            {formatPrice(referral.rewardUsdt, 'USDT')}
                          </div>
                          {referral.rewardPoints > 0 && (
                            <div className="text-xs text-slate-500">
                              +{referral.rewardPoints} баллов
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {referral.rewardPaid ? (
                          <Badge className="bg-green-100 text-green-700">
                            <Check className="h-3 w-3 mr-1" />
                            Выплачено
                          </Badge>
                        ) : (
                          <Badge className="bg-yellow-100 text-yellow-700">
                            Ожидание
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* How it works */}
      <Card>
        <CardHeader>
          <CardTitle>Как работает программа</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center mb-3">
                <Share2 className="h-6 w-6 text-teal-600" />
              </div>
              <h3 className="font-semibold text-slate-900">1. Поделитесь ссылкой</h3>
              <p className="text-sm text-slate-600">
                Отправьте вашу реферальную ссылку друзьям и коллегам
              </p>
            </div>
            <div className="space-y-2">
              <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center mb-3">
                <Users className="h-6 w-6 text-teal-600" />
              </div>
              <h3 className="font-semibold text-slate-900">2. Они регистрируются</h3>
              <p className="text-sm text-slate-600">
                Новые партнёры используют вашу ссылку для регистрации
              </p>
            </div>
            <div className="space-y-2">
              <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center mb-3">
                <Gift className="h-6 w-6 text-teal-600" />
              </div>
              <h3 className="font-semibold text-slate-900">3. Получайте бонусы</h3>
              <p className="text-sm text-slate-600">
                Зарабатывайте 50 USDT после первого заказа реферала
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}