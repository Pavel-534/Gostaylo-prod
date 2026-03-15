'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { DollarSign, Wallet, ArrowUpRight, Loader2, Building2, Download } from 'lucide-react'
import { formatPrice } from '@/lib/currency'
import { toast } from 'sonner'

export default function PartnerFinances() {
  const [balance, setBalance] = useState(null)
  const [payouts, setPayouts] = useState([])
  const [loading, setLoading] = useState(true)
  const [payoutModalOpen, setPayoutModalOpen] = useState(false)
  const [payoutAmount, setPayoutAmount] = useState('')
  const [payoutMethod, setPayoutMethod] = useState('PROMPTPAY')
  const [walletAddress, setWalletAddress] = useState('')
  const [bankAccount, setBankAccount] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadBalance()
    loadPayouts()
  }, [])

  async function loadBalance() {
    try {
      const res = await fetch('/api/partner/balance?partnerId=partner-1')
      const data = await res.json()
      
      if (data.success) {
        setBalance(data.data)
      }
      setLoading(false)
    } catch (error) {
      console.error('Failed to load balance:', error)
      setLoading(false)
    }
  }

  async function loadPayouts() {
    try {
      const res = await fetch('/api/partner/payouts?partnerId=partner-1')
      const data = await res.json()
      
      if (data.success) {
        setPayouts(data.data)
      }
    } catch (error) {
      console.error('Failed to load payouts:', error)
    }
  }

  async function handlePayoutRequest(e) {
    e.preventDefault()

    const amount = parseFloat(payoutAmount)
    const currency = 'THB'
    const minWithdrawal = currency === 'USDT' ? 30 : 1000

    if (amount < minWithdrawal) {
      toast.error(`Минимальная сумма вывода: ${minWithdrawal} ${currency}`)
      return
    }

    if (amount > (balance?.availableBalance || 0)) {
      toast.error('Недостаточно средств')
      return
    }

    setSubmitting(true)

    try {
      const res = await fetch('/api/partner/payouts/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partnerId: 'partner-1',
          amount,
          currency,
          method: payoutMethod,
          walletAddress: payoutMethod === 'USDT' ? walletAddress : null,
          bankAccount: payoutMethod === 'PROMPTPAY' ? bankAccount : null,
        }),
      })

      const data = await res.json()

      if (data.success) {
        toast.success('Заявка на вывод отправлена!')
        setPayoutModalOpen(false)
        setPayoutAmount('')
        setWalletAddress('')
        setBankAccount('')
        loadBalance()
        loadPayouts()
      } else {
        toast.error(data.error || 'Ошибка при создании заявки')
      }
    } catch (error) {
      console.error('Failed to request payout:', error)
      toast.error('Ошибка при создании заявки')
    } finally {
      setSubmitting(false)
    }
  }

  function getPayoutStatusBadge(status) {
    const config = {
      PENDING: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Ожидает' },
      PROCESSING: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Обработка' },
      COMPLETED: { bg: 'bg-green-100', text: 'text-green-700', label: 'Завершено' },
      REJECTED: { bg: 'bg-red-100', text: 'text-red-700', label: 'Отклонено' },
    }
    const c = config[status] || config.PENDING
    return <Badge className={`${c.bg} ${c.text}`}>{c.label}</Badge>
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-teal-600" />
      </div>
    )
  }

  const availableBalance = balance?.availableBalance || 0
  const escrowBalance = balance?.escrowBalance || 0

  return (
    <div className="p-4 lg:p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Финансы</h1>
        <p className="text-slate-600 mt-1">Управление доходами и выплатами</p>
      </div>

      {/* Balance Card */}
      <Card className="bg-gradient-to-r from-teal-500 to-teal-600 text-white">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Баланс
          </CardTitle>
          <CardDescription className="text-teal-50">
            Средства доступные для вывода
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-teal-100 mb-1">Доступно для вывода</p>
            <div className="text-5xl font-bold">
              {formatPrice(availableBalance, 'THB')}
            </div>
          </div>
          
          {escrowBalance > 0 && (
            <div className="bg-teal-700/50 rounded-lg p-4">
              <p className="text-sm text-teal-100">В эскроу (ожидают check-in)</p>
              <p className="text-2xl font-bold">{formatPrice(escrowBalance, 'THB')}</p>
            </div>
          )}
          
          <div className="flex gap-3">
            <Dialog open={payoutModalOpen} onOpenChange={setPayoutModalOpen}>
              <DialogTrigger asChild>
                <Button
                  className="bg-white text-teal-600 hover:bg-teal-50"
                  size="lg"
                  disabled={availableBalance < 1000}
                >
                  <ArrowUpRight className="h-5 w-5 mr-2" />
                  Вывести средства
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Запрос на вывод средств</DialogTitle>
                </DialogHeader>

                <form onSubmit={handlePayoutRequest} className="space-y-6">
                  <div>
                    <Label htmlFor="amount" className="text-base font-semibold mb-2 block">
                      Сумма вывода
                    </Label>
                    <Input
                      id="amount"
                      type="number"
                      value={payoutAmount}
                      onChange={(e) => setPayoutAmount(e.target.value)}
                      placeholder="Минимум 1,000 THB"
                      min="1000"
                      step="100"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Доступно: {formatPrice(availableBalance, 'THB')}
                    </p>
                  </div>

                  <div>
                    <Label className="text-base font-semibold mb-3 block">
                      Способ вывода
                    </Label>
                    <RadioGroup value={payoutMethod} onValueChange={setPayoutMethod}>
                      <div className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50">
                        <RadioGroupItem value="PROMPTPAY" id="promptpay" />
                        <Label htmlFor="promptpay" className="flex items-center gap-3 cursor-pointer flex-1">
                          <Building2 className="h-5 w-5 text-slate-600" />
                          <div>
                            <p className="font-semibold">Thai Bank (PromptPay)</p>
                            <p className="text-xs text-slate-500">Перевод на тайский банк</p>
                          </div>
                        </Label>
                      </div>

                      <div className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50">
                        <RadioGroupItem value="USDT" id="usdt" />
                        <Label htmlFor="usdt" className="flex items-center gap-3 cursor-pointer flex-1">
                          <Wallet className="h-5 w-5 text-amber-600" />
                          <div>
                            <p className="font-semibold">USDT Wallet</p>
                            <p className="text-xs text-slate-500">Минимум 30 USDT</p>
                          </div>
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {payoutMethod === 'PROMPTPAY' && (
                    <div>
                      <Label htmlFor="bank">Номер счёта PromptPay</Label>
                      <Input
                        id="bank"
                        value={bankAccount}
                        onChange={(e) => setBankAccount(e.target.value)}
                        placeholder="0812345678"
                        required
                      />
                    </div>
                  )}

                  {payoutMethod === 'USDT' && (
                    <div>
                      <Label htmlFor="wallet">USDT Wallet Address (TRC-20)</Label>
                      <Input
                        id="wallet"
                        value={walletAddress}
                        onChange={(e) => setWalletAddress(e.target.value)}
                        placeholder="TXYZMockWallet..."
                        className="font-mono text-sm"
                        required
                      />
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={submitting || !payoutAmount || parseFloat(payoutAmount) < 1000}
                    className="w-full bg-teal-600 hover:bg-teal-700"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Отправка...
                      </>
                    ) : (
                      'Отправить заявку'
                    )}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>

            <Button
              variant="outline"
              size="lg"
              className="bg-white/10 border-white/20 hover:bg-white/20 text-white"
            >
              <Download className="h-5 w-5 mr-2" />
              Скачать отчёт
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Payout History */}
      <Card>
        <CardHeader>
          <CardTitle>История выводов</CardTitle>
          <CardDescription>Ваши запросы на вывод средств</CardDescription>
        </CardHeader>
        <CardContent>
          {payouts.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              Пока нет заявок на вывод
            </div>
          ) : (
            <div className="space-y-3">
              {payouts.map((payout) => (
                <div key={payout.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <p className="font-semibold">{formatPrice(payout.amount, payout.currency)}</p>
                      {getPayoutStatusBadge(payout.status)}
                    </div>
                    <p className="text-sm text-slate-600">
                      {payout.method === 'PROMPTPAY' ? 'Thai Bank' : 'USDT Wallet'} •{' '}
                      {new Date(payout.createdAt).toLocaleDateString('ru-RU')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Всего заработано</CardTitle>
            <DollarSign className="h-4 w-4 text-teal-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPrice(availableBalance + escrowBalance, 'THB')}</div>
            <p className="text-xs text-slate-500 mt-1">За всё время</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Комиссия платформы</CardTitle>
            <DollarSign className="h-4 w-4 text-slate-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">15%</div>
            <p className="text-xs text-slate-500 mt-1">Стандартная ставка</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Выведено</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatPrice(
                payouts.filter(p => p.status === 'COMPLETED').reduce((sum, p) => sum + p.amount, 0),
                'THB'
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">Успешные выплаты</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
