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
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, CreditCard, Wallet, Loader2, CheckCircle2, Copy, ExternalLink, AlertCircle, Smartphone } from 'lucide-react'
import { formatPrice } from '@/lib/currency'
import { toast } from 'sonner'
import { QRCodeSVG } from 'qrcode.react'

// Official Gostaylo USDT TRC-20 Wallet Address
const GOSTAYLO_WALLET = 'TXyfMKVxUNFkC8Q77GnbAqgnWFUWVaKwZ5';

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
  const [txidSubmitted, setTxidSubmitted] = useState(false)
  const [liveVerification, setLiveVerification] = useState(null)
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
      const res = await fetch('/api/v2/promo-codes/validate', {
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
      // Fetch directly from Supabase to bypass Kubernetes routing issues
      const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      // Fetch booking
      const bookingRes = await fetch(
        `${SUPABASE_URL}/rest/v1/bookings?id=eq.${params.bookingId}&select=*`,
        {
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
          }
        }
      );
      const bookings = await bookingRes.json();
      
      if (!bookings || bookings.length === 0) {
        setLoading(false);
        return;
      }
      
      const b = bookings[0];
      
      // Fetch listing info
      const listingRes = await fetch(
        `${SUPABASE_URL}/rest/v1/listings?id=eq.${b.listing_id}&select=id,title,district,images,cover_image,base_price_thb`,
        {
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
          }
        }
      );
      const listings = await listingRes.json();
      const l = listings?.[0] || null;
      
      // Transform booking data
      setBooking({
        id: b.id,
        status: b.status,
        checkIn: b.check_in,
        checkOut: b.check_out,
        priceThb: parseFloat(b.price_thb),
        currency: b.currency || 'THB',
        guestName: b.guest_name,
        guestEmail: b.guest_email,
        guestPhone: b.guest_phone,
        specialRequests: b.special_requests,
        createdAt: b.created_at,
        metadata: b.metadata
      });
      
      if (l) {
        setListing({
          id: l.id,
          title: l.title,
          district: l.district,
          coverImage: l.cover_image || l.images?.[0],
          basePriceThb: parseFloat(l.base_price_thb)
        });
      }
      
      // Check if already paid
      if (b.status === 'CONFIRMED') {
        setPayment({
          id: `pay-${b.id}`,
          status: 'COMPLETED',
          method: 'CARD',
          amount: b.price_thb
        });
        setPaymentSuccess(true);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Failed to load payment status:', error)
      setLoading(false)
    }
  }

  async function handleInitiatePayment() {
    setProcessing(true)

    try {
      const res = await fetch(`/api/v2/bookings/${params.bookingId}/payment/initiate`, {
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
        const res = await fetch(`/api/v2/bookings/${params.bookingId}/payment/confirm`, {
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
      const res = await fetch(`/api/v2/bookings/${params.bookingId}/payment/confirm`, {
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
      const res = await fetch(`/api/v2/bookings/${params.bookingId}/check-in/confirm`, {
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

  // Verify TXID via TronScan API
  async function handleVerifyTxid() {
    if (!txId.trim() || txId.length < 60) {
      toast.error('TXID должен быть не менее 64 символов')
      return
    }

    setVerifying(true)
    setLiveVerification(null)

    try {
      const res = await fetch('/api/v2/payments/verify-tron', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txid: txId })
      })

      const data = await res.json()
      setLiveVerification(data)

      if (data.success) {
        toast.success('✅ Транзакция найдена и подтверждена!')
      } else if (data.status === 'PENDING') {
        toast.info('⏳ Транзакция ожидает подтверждения')
      } else if (data.status === 'NOT_FOUND') {
        toast.warning('Транзакция не найдена на блокчейне')
      } else {
        toast.error(data.error || 'Ошибка верификации')
      }
    } catch (error) {
      console.error('Verification error:', error)
      toast.error('Ошибка при проверке транзакции')
    } finally {
      setVerifying(false)
    }
  }

  // Submit TXID to admin for verification
  async function handleSubmitTxid() {
    if (!txId.trim() || txId.length < 60) {
      toast.error('TXID должен быть не менее 64 символов')
      return
    }

    setVerifying(true)

    try {
      const res = await fetch('/api/v2/payments/submit-txid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: params.bookingId,
          txid: txId,
          paymentMethod: 'USDT_TRC20'
        })
      })

      const data = await res.json()

      if (data.success) {
        toast.success('✅ TXID отправлен на проверку!')
        setTxidSubmitted(true)
      } else {
        toast.error(data.error || 'Ошибка при отправке TXID')
      }
    } catch (error) {
      console.error('Submit TXID error:', error)
      toast.error('Ошибка при отправке TXID')
    } finally {
      setVerifying(false)
    }
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

        {/* Crypto Payment Modal - USDT TRC-20 with QR Code */}
        <Dialog open={cryptoModalOpen} onOpenChange={setCryptoModalOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-amber-600" />
                Оплата криптовалютой (USDT TRC-20)
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              {/* Network Warning */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                  <span className="text-lg font-bold text-amber-800">Важно!</span>
                </div>
                <p className="text-sm text-amber-700">
                  Отправляйте <strong>только USDT</strong> через сеть <strong>TRC-20 (Tron)</strong>. 
                  Перевод других токенов или через другие сети приведёт к потере средств.
                </p>
              </div>

              {/* QR Code Section */}
              <div className="flex flex-col items-center">
                <div className="bg-white p-4 rounded-xl border-2 border-slate-200 shadow-sm">
                  <QRCodeSVG 
                    value={GOSTAYLO_WALLET}
                    size={180}
                    level="H"
                    includeMargin={true}
                    data-testid="wallet-qr-code"
                  />
                </div>
                <div className="mt-3 flex items-center gap-2 text-slate-600">
                  <Smartphone className="h-4 w-4" />
                  <span className="text-sm">Сканируйте кошельком (TRC-20)</span>
                </div>
              </div>

              {/* Wallet Address with Copy */}
              <div>
                <Label className="text-base font-semibold mb-2 block">
                  Адрес кошелька Gostaylo (TRC-20)
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={GOSTAYLO_WALLET}
                    readOnly
                    className="font-mono text-sm bg-slate-50"
                    data-testid="usdt-wallet-address"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(GOSTAYLO_WALLET)}
                    data-testid="copy-wallet-btn"
                    className="flex items-center gap-1"
                  >
                    <Copy className="h-4 w-4" />
                    Copy
                  </Button>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">Сеть: TRC-20</Badge>
                  <Badge variant="outline" className="text-xs bg-green-50 text-green-700">Токен: USDT</Badge>
                </div>
              </div>

              {/* Amount to Pay */}
              <div>
                <Label className="text-base font-semibold mb-2 block">Сумма к оплате</Label>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-2xl font-bold text-amber-900" data-testid="usdt-amount">
                    {payment?.metadata?.amount || Math.ceil(totalWithFee / 35.5 * 100) / 100} USDT
                  </p>
                  <p className="text-sm text-amber-700 mt-1">
                    ≈ {formatPrice(totalWithFee, 'THB')}
                  </p>
                </div>
              </div>

              {/* TXID Submitted Success State */}
              {txidSubmitted && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-green-900">TXID отправлен на проверку!</p>
                      <p className="text-sm text-green-700 mt-1">
                        Платёж проходит верификацию. Администратор проверит транзакцию и подтвердит оплату.
                      </p>
                      <p className="text-xs text-green-600 mt-2 font-mono break-all">
                        TXID: {txId}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className="flex-1"
                    >
                      <a 
                        href={`https://tronscan.org/#/transaction/${txId}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-1"
                      >
                        <ExternalLink className="h-4 w-4" />
                        View on TronScan
                      </a>
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      className="flex-1 bg-teal-600 hover:bg-teal-700"
                      onClick={() => setCryptoModalOpen(false)}
                    >
                      Закрыть
                    </Button>
                  </div>
                </div>
              )}

              {/* Live Verification Result */}
              {liveVerification && !txidSubmitted && (
                <div className={`rounded-lg p-4 border ${
                  liveVerification.success 
                    ? 'bg-green-50 border-green-200' 
                    : liveVerification.status === 'PENDING'
                    ? 'bg-yellow-50 border-yellow-200'
                    : liveVerification.status === 'UNDERPAID'
                    ? 'bg-orange-50 border-orange-200'
                    : 'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {liveVerification.success ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : liveVerification.status === 'PENDING' ? (
                      <Loader2 className="h-5 w-5 text-yellow-600 animate-spin" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-600" />
                    )}
                    <span className={`font-semibold ${
                      liveVerification.success ? 'text-green-800' 
                      : liveVerification.status === 'PENDING' ? 'text-yellow-800'
                      : liveVerification.status === 'UNDERPAID' ? 'text-orange-800'
                      : 'text-red-800'
                    }`}>
                      {liveVerification.badge?.labelRu || liveVerification.badge?.label || liveVerification.status}
                    </span>
                  </div>
                  {liveVerification.data && (
                    <div className="text-sm space-y-1">
                      <p>От: <code className="text-xs">{liveVerification.data.from}</code></p>
                      <p>Кому: <code className="text-xs">{liveVerification.data.to}</code></p>
                      {liveVerification.data.amount > 0 && (
                        <p>Сумма: <strong>{liveVerification.data.amount} {liveVerification.data.token}</strong></p>
                      )}
                      {/* Amount Verification Details */}
                      {liveVerification.amountVerification && (
                        <div className={`mt-2 p-2 rounded ${
                          liveVerification.amountVerification.sufficient ? 'bg-green-100' : 'bg-red-100'
                        }`}>
                          <p className="text-xs font-medium">
                            Получено: {liveVerification.amountVerification.received} USDT
                          </p>
                          {liveVerification.amountVerification.expected && (
                            <p className="text-xs">
                              Ожидалось: {liveVerification.amountVerification.expected} USDT
                            </p>
                          )}
                          {liveVerification.amountVerification.difference !== 0 && (
                            <p className={`text-xs ${liveVerification.amountVerification.difference > 0 ? 'text-green-700' : 'text-red-700'}`}>
                              Разница: {liveVerification.amountVerification.difference > 0 ? '+' : ''}{liveVerification.amountVerification.difference} USDT
                            </p>
                          )}
                        </div>
                      )}
                      {!liveVerification.data.isCorrectWallet && (
                        <p className="text-orange-600 font-medium">⚠️ Неверный адрес получателя!</p>
                      )}
                    </div>
                  )}
                  {liveVerification.error && (
                    <p className="text-sm text-red-600">{liveVerification.error}</p>
                  )}
                </div>
              )}

              {/* TXID Input Form */}
              {!txidSubmitted && (
                <>
                  <div>
                    <Label htmlFor="txid" className="text-base font-semibold mb-2 block">
                      Transaction ID (TXID) *
                    </Label>
                    <Input
                      id="txid"
                      value={txId}
                      onChange={(e) => {
                        setTxId(e.target.value);
                        setLiveVerification(null);
                      }}
                      placeholder="Вставьте TXID вашей транзакции (64 символа)"
                      className="font-mono text-sm"
                      data-testid="txid-input"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      После отправки USDT вставьте сюда Transaction ID для подтверждения
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={handleVerifyTxid}
                      disabled={!txId.trim() || txId.length < 60 || verifying}
                      className="flex-1"
                      data-testid="verify-txid-btn"
                    >
                      {verifying ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Проверка...
                        </>
                      ) : (
                        <>
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Проверить на TronScan
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={handleSubmitTxid}
                      disabled={!txId.trim() || txId.length < 60 || verifying}
                      className="flex-1 bg-teal-600 hover:bg-teal-700"
                      data-testid="submit-txid-btn"
                    >
                      Отправить TXID
                    </Button>
                  </div>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
