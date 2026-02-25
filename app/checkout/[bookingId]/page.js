'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ArrowLeft, CreditCard, Wallet, Loader2, CheckCircle2, Copy, QrCode } from 'lucide-react'
import { formatPrice } from '@/lib/currency'
import { toast } from 'sonner'

export default function CheckoutPage({ params }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [booking, setBooking] = useState(null)
  const [listing, setListing] = useState(null)
  const [payment, setPayment] = useState(null)
  const [paymentMethod, setPaymentMethod] = useState('CARD')
  const [processing, setProcessing] = useState(false)
  const [cryptoModalOpen, setCryptoModalOpen] = useState(false)
  const [txId, setTxId] = useState('')
  const [paymentSuccess, setPaymentSuccess] = useState(false)
  const [verificationStep, setVerificationStep] = useState(0) // 0: not started, 1: received, 2: verifying, 3: verified
  const [confirmations, setConfirmations] = useState(0)
  const [verifying, setVerifying] = useState(false)
  const [promoCode, setPromoCode] = useState('')
  const [promoDiscount, setPromoDiscount] = useState(null)
  const [promoLoading, setPromoLoading] = useState(false)

  useEffect(() => {
    loadPaymentStatus()
  }, [params.bookingId])

  async function handleApplyPromoCode() {
    if (!promoCode.trim()) {
      toast.error('Введите промокод')
      return
    }

    setPromoLoading(true)
    try {
      const res = await fetch('/api/promo-codes/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: promoCode,
          bookingAmount: booking.priceThb,
        }),
      })

      const data = await res.json()

      if (data.success) {
        setPromoDiscount(data.data)
        toast.success(`🎉 Промокод применён! Скидка: ${data.data.discountAmount} ฿`)
      } else {
        toast.error(data.error || 'Промокод недействителен')
        setPromoDiscount(null)
      }
    } catch (error) {
      console.error('Failed to apply promo code:', error)
      toast.error('Ошибка при проверке промокода')
    } finally {
      setPromoLoading(false)
    }
  }

  async function loadPaymentStatus() {
    try {
      const res = await fetch(`/api/bookings/${params.bookingId}/payment-status`)
      const data = await res.json()
      
      if (data.success) {
        setBooking(data.data.booking)
        setListing(data.data.listing)
        setPayment(data.data.payment)
        
        if (data.data.payment?.status === 'COMPLETED') {
          setPaymentSuccess(true)
        }
      }
      setLoading(false)
    } catch (error) {
      console.error('Failed to load payment status:', error)
      setLoading(false)
    }
  }

  async function handleInitiatePayment() {
    setProcessing(true)

    try {
      const res = await fetch(`/api/bookings/${params.bookingId}/payment/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: paymentMethod }),
      })

      const data = await res.json()

      if (data.success) {
        setPayment(data.data)
        
        if (paymentMethod === 'CRYPTO') {
          setCryptoModalOpen(true)
        } else {
          // Mock card/MIR payment - auto-confirm after 2 seconds
          toast.success('Mock: Перенаправление на платёжный шлюз...')
          setTimeout(() => {
            handleConfirmPayment(null, `MOCK-${Date.now()}`)
          }, 2000)
        }
      } else {
        toast.error(data.error || 'Ошибка при инициализации платежа')
      }
    } catch (error) {
      console.error('Failed to initiate payment:', error)
      toast.error('Ошибка при инициализации платежа')
    } finally {
      setProcessing(false)
    }
  }

  async function handleConfirmPayment(transactionId = null, gatewayRef = null) {
    // For crypto payments, use blockchain verification
    if (paymentMethod === 'CRYPTO' && transactionId) {
      setVerifying(true)
      setVerificationStep(1) // TXID Received
      
      try {
        // Step 1: TXID Received
        toast.info('📥 TXID получен, начинаем проверку...')
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        // Step 2: Verifying on blockchain
        setVerificationStep(2)
        
        // Simulate confirmations counting up
        for (let i = 0; i <= 19; i++) {
          setConfirmations(i)
          await new Promise(resolve => setTimeout(resolve, 100))
        }
        
        // Call verification webhook
        const verifyRes = await fetch('/api/webhooks/crypto/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            txid: transactionId,
            bookingId: params.bookingId,
            expectedAmount: payment?.metadata?.amount || '100',
            targetWallet: payment?.metadata?.walletAddress || 'TXYZMockWallet',
          }),
        })
        
        const verifyData = await verifyRes.json()
        
        if (!verifyData.verified) {
          toast.error(verifyData.error || 'Транзакция не подтверждена')
          setVerifying(false)
          setVerificationStep(0)
          return
        }
        
        // Step 3: Verified!
        setVerificationStep(3)
        toast.success('✅ Транзакция подтверждена блокчейном!')
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // Now confirm payment in our system
        const res = await fetch(`/api/bookings/${params.bookingId}/payment/confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            txId: transactionId,
            gatewayRef: verifyData.data.blockNumber,
          }),
        })

        const data = await res.json()

        if (data.success) {
          setPaymentSuccess(true)
          setCryptoModalOpen(false)
          
          // Trigger check-in confirmation
          setTimeout(() => {
            handleCheckInConfirm()
          }, 1000)
        } else {
          toast.error(data.error || 'Ошибка подтверждения платежа')
        }
      } catch (error) {
        console.error('Failed to verify crypto payment:', error)
        toast.error('Ошибка верификации платежа')
        setVerificationStep(0)
      } finally {
        setVerifying(false)
      }
      return
    }
    
    // For card/MIR payments (original logic)
    try {
      const res = await fetch(`/api/bookings/${params.bookingId}/payment/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txId: transactionId || txId,
          gatewayRef,
        }),
      })

      const data = await res.json()

      if (data.success) {
        toast.success('✅ Оплата успешно подтверждена!')
        setPaymentSuccess(true)
        setCryptoModalOpen(false)
        
        setTimeout(() => {
          handleCheckInConfirm()
        }, 1000)
      } else {
        toast.error(data.error || 'Ошибка подтверждения платежа')
      }
    } catch (error) {
      console.error('Failed to confirm payment:', error)
      toast.error('Ошибка подтверждения платежа')
    }
  }

  async function handleCheckInConfirm() {
    try {
      const res = await fetch(`/api/bookings/${params.bookingId}/check-in/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await res.json()

      if (data.success) {
        console.log('✅ Check-in confirmed. Funds released to partner.')
      }
    } catch (error) {
      console.error('Failed to confirm check-in:', error)
    }
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text)
    toast.success('Скопировано!')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-teal-600" />
      </div>
    )
  }

  if (!booking || booking.status === 'CANCELLED') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <h3 className="text-xl font-semibold mb-2">Бронирование недоступно</h3>
            <p className="text-slate-600 mb-4">Это бронирование было отменено или не найдено.</p>
            <Button asChild>
              <Link href="/">На главную</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (paymentSuccess) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto mb-4" />
            <h3 className="text-2xl font-bold mb-2">Оплата успешна!</h3>
            <p className="text-slate-600 mb-6">
              Ваше бронирование оплачено. Деньги переведены партнёру после подтверждения check-in.
            </p>
            <div className="space-y-3">
              <Button asChild className="w-full bg-teal-600 hover:bg-teal-700">
                <Link href="/">На главную</Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href="/my-bookings">Мои бронирования</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const commissionRate = 15 // Mock - should come from listing
  const discountAmount = promoDiscount?.discountAmount || 0
  const priceAfterDiscount = booking.priceThb - discountAmount
  const serviceFee = priceAfterDiscount * (commissionRate / 100)
  const totalWithFee = priceAfterDiscount + serviceFee

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <Link href="/" className="inline-flex items-center text-teal-600 hover:text-teal-700 mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Назад
        </Link>

        <h1 className="text-3xl font-bold text-slate-900 mb-8">Оплата бронирования</h1>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Payment Form */}
          <div className="md:col-span-2 space-y-6">
            {/* Payment Method Selection */}
            <Card>
              <CardHeader>
                <CardTitle>Выберите способ оплаты</CardTitle>
              </CardHeader>
              <CardContent>
                <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
                  <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-slate-50 cursor-pointer">
                    <RadioGroupItem value="CARD" id="card" />
                    <Label htmlFor="card" className="flex items-center gap-3 cursor-pointer flex-1">
                      <CreditCard className="h-5 w-5 text-slate-600" />
                      <div>
                        <p className="font-semibold">Банковская карта</p>
                        <p className="text-sm text-slate-500">Visa, Mastercard, UnionPay (Stripe)</p>
                      </div>
                    </Label>
                  </div>

                  <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-slate-50 cursor-pointer">
                    <RadioGroupItem value="MIR" id="mir" />
                    <Label htmlFor="mir" className="flex items-center gap-3 cursor-pointer flex-1">
                      <CreditCard className="h-5 w-5 text-blue-600" />
                      <div>
                        <p className="font-semibold">Карта МИР</p>
                        <p className="text-sm text-slate-500">Для граждан РФ (RUB → THB)</p>
                      </div>
                    </Label>
                  </div>

                  <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-slate-50 cursor-pointer">
                    <RadioGroupItem value="CRYPTO" id="crypto" />
                    <Label htmlFor="crypto" className="flex items-center gap-3 cursor-pointer flex-1">
                      <Wallet className="h-5 w-5 text-amber-600" />
                      <div>
                        <p className="font-semibold">Криптовалюта</p>
                        <p className="text-sm text-slate-500">USDT TRC-20</p>
                      </div>
                    </Label>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>

            {/* Promo Code Section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Промокод</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Input
                    placeholder="Введите промокод"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                    disabled={promoDiscount !== null}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleApplyPromoCode}
                    disabled={promoLoading || promoDiscount !== null || !promoCode.trim()}
                    variant="outline"
                  >
                    {promoLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : promoDiscount ? (
                      '✓'
                    ) : (
                      'Применить'
                    )}
                  </Button>
                </div>
                {promoDiscount && (
                  <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm font-medium text-green-900">
                      🎉 Промокод "{promoDiscount.code}" применён!
                    </p>
                    <p className="text-xs text-green-700 mt-1">
                      Скидка: -{formatPrice(promoDiscount.discountAmount, 'THB')}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pay Button */}
            <Button
              onClick={handleInitiatePayment}
              disabled={processing || !paymentMethod}
              className="w-full bg-teal-600 hover:bg-teal-700 h-12 text-lg"
            >
              {processing ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Обработка...
                </>
              ) : (
                `Оплатить ${formatPrice(totalWithFee, booking.currency)}`
              )}
            </Button>
          </div>

          {/* Order Summary */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Детали заказа</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="font-semibold text-slate-900">{listing?.title}</p>
                  <p className="text-sm text-slate-600 mt-1">
                    {new Date(booking.checkIn).toLocaleDateString('ru-RU')} - {new Date(booking.checkOut).toLocaleDateString('ru-RU')}
                  </p>
                </div>

                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Стоимость аренды</span>
                    <span className="font-medium">{formatPrice(booking.priceThb, 'THB')}</span>
                  </div>
                  {promoDiscount && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span className="flex items-center gap-1">
                        🎉 Скидка ({promoDiscount.code})
                      </span>
                      <span className="font-medium">-{formatPrice(discountAmount, 'THB')}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Сервисный сбор (15%)</span>
                    <span className="font-medium">{formatPrice(serviceFee, 'THB')}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold border-t pt-2">
                    <span>Итого</span>
                    <span className="text-teal-600">{formatPrice(totalWithFee, 'THB')}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Crypto Payment Modal */}
        <Dialog open={cryptoModalOpen} onOpenChange={setCryptoModalOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Оплата криптовалютой (USDT TRC-20)</DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              {/* Wallet Address */}
              <div>
                <Label className="text-base font-semibold mb-2 block">Адрес кошелька</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={payment?.metadata?.walletAddress || ''}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(payment?.metadata?.walletAddress)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-slate-500 mt-1">Сеть: TRC-20 (Tron)</p>
              </div>

              {/* Amount */}
              <div>
                <Label className="text-base font-semibold mb-2 block">Сумма к оплате</Label>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-2xl font-bold text-amber-900">
                    {payment?.metadata?.amount} USDT
                  </p>
                  <p className="text-sm text-amber-700 mt-1">
                    ≈ {formatPrice(totalWithFee, 'THB')}
                  </p>
                </div>
              </div>

              {/* QR Code Placeholder */}
              <div className="bg-slate-100 rounded-lg p-6 text-center">
                <QrCode className="h-32 w-32 text-slate-400 mx-auto mb-2" />
                <p className="text-sm text-slate-600">QR-код для сканирования</p>
                <p className="text-xs text-slate-500">(Mock placeholder)</p>
              </div>

              {/* Live Status Tracker */}
              {verificationStep > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 space-y-4">
                  <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                    <Loader2 className={`h-5 w-5 ${verificationStep < 3 ? 'animate-spin text-teal-600' : 'hidden'}`} />
                    {verificationStep === 3 && <CheckCircle2 className="h-5 w-5 text-green-600" />}
                    Статус верификации
                  </h3>
                  
                  {/* Progress Steps */}
                  <div className="space-y-3">
                    {/* Step 1: TXID Received */}
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        verificationStep >= 1 ? 'bg-green-100 text-green-600' : 'bg-slate-200 text-slate-400'
                      }`}>
                        {verificationStep >= 1 ? '✓' : '1'}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">TXID получен</p>
                        <p className="text-xs text-slate-500">Транзакция найдена в блокчейне</p>
                      </div>
                      {verificationStep === 1 && (
                        <Loader2 className="h-4 w-4 animate-spin text-teal-600" />
                      )}
                    </div>
                    
                    {/* Step 2: Confirming */}
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        verificationStep >= 2 ? 'bg-green-100 text-green-600' : 'bg-slate-200 text-slate-400'
                      }`}>
                        {verificationStep >= 3 ? '✓' : verificationStep === 2 ? confirmations : '2'}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">
                          Подтверждения: {confirmations}/19
                        </p>
                        <p className="text-xs text-slate-500">Ожидаем подтверждения от сети</p>
                        {verificationStep === 2 && (
                          <div className="mt-2 w-full bg-slate-200 rounded-full h-2">
                            <div 
                              className="bg-teal-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${(confirmations / 19) * 100}%` }}
                            />
                          </div>
                        )}
                      </div>
                      {verificationStep === 2 && (
                        <Loader2 className="h-4 w-4 animate-spin text-teal-600" />
                      )}
                    </div>
                    
                    {/* Step 3: Verifying Amount */}
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        verificationStep >= 3 ? 'bg-green-100 text-green-600' : 'bg-slate-200 text-slate-400'
                      }`}>
                        {verificationStep >= 3 ? '✓' : '3'}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">Проверка суммы</p>
                        <p className="text-xs text-slate-500">Верификация полученной суммы</p>
                      </div>
                    </div>
                    
                    {/* Step 4: Success */}
                    {verificationStep === 3 && (
                      <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg p-3">
                        <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0" />
                        <div>
                          <p className="font-semibold text-green-900">Платёж подтверждён!</p>
                          <p className="text-xs text-green-700">
                            Средства зачислены в эскроу. Будут переведены партнёру после check-in.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Transaction ID Input */}
              {verificationStep === 0 && (
                <>
                  <div>
                    <Label htmlFor="txid" className="text-base font-semibold mb-2 block">
                      Transaction ID (TXID) *
                    </Label>
                    <Input
                      id="txid"
                      value={txId}
                      onChange={(e) => setTxId(e.target.value)}
                      placeholder="Вставьте TXID вашей транзакции"
                      className="font-mono"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      После отправки USDT вставьте сюда Transaction ID для подтверждения
                    </p>
                  </div>

                  {/* Confirm Button */}
                  <Button
                    onClick={() => handleConfirmPayment(txId)}
                    disabled={!txId.trim() || verifying}
                    className="w-full bg-teal-600 hover:bg-teal-700"
                  >
                    {verifying ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        Проверка транзакции...
                      </>
                    ) : (
                      'Подтвердить оплату'
                    )}
                  </Button>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
