'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, CreditCard, Wallet, Loader2, CheckCircle2, Copy, ExternalLink, AlertCircle, Smartphone } from 'lucide-react'
import { formatPrice, languageToNumberLocale, priceRawForTest } from '@/lib/currency'
import { toast } from 'sonner'
import { detectLanguage, getUIText } from '@/lib/translations'

function interpolateTemplate(str, vars = {}) {
  let s = String(str)
  for (const [k, v] of Object.entries(vars)) {
    s = s.split(`{{${k}}}`).join(String(v))
  }
  return s
}
import { QRCodeSVG } from 'qrcode.react'
import { useCommission } from '@/hooks/use-commission'

// Official GoStayLo USDT TRC-20 Wallet Address
const GOSTAYLO_WALLET = 'TXyfMKVxUNFkC8Q77GnbAqgnWFUWVaKwZ5';

function CheckoutPageInner({ params }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [accessDenied, setAccessDenied] = useState(false)
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
  const [chatConversationId, setChatConversationId] = useState(null)
  const [thbPerUsdt, setThbPerUsdt] = useState(null)
  const commissionFromApi = useCommission()
  const [language, setLanguage] = useState('ru')
  const [exchangeRates, setExchangeRates] = useState({ THB: 1 })

  useEffect(() => {
    loadPaymentStatus()
  }, [params.bookingId])

  useEffect(() => {
    const lang = detectLanguage()
    setLanguage(lang)
    const h = (e) => {
      if (e?.detail) setLanguage(e.detail)
    }
    window.addEventListener('language-change', h)
    window.addEventListener('languageChange', h)
    return () => {
      window.removeEventListener('language-change', h)
      window.removeEventListener('languageChange', h)
    }
  }, [])

  useEffect(() => {
    fetch('/api/v2/exchange-rates', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        if (j.success && j.rateMap && typeof j.rateMap === 'object') {
          setExchangeRates({ THB: 1, ...j.rateMap })
          if (j.rateMap.USDT != null) setThbPerUsdt(j.rateMap.USDT)
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const pm = searchParams.get('pm')
    if (pm === 'CRYPTO') setPaymentMethod('CRYPTO')
    if (pm === 'CARD') setPaymentMethod('CARD')
  }, [searchParams])

  // Ownership check: when auth is ready and booking has renter_id, verify user owns it
  useEffect(() => {
    if (authLoading || !booking) return
    if (booking.renter_id) {
      if (!user?.id) {
        setAccessDenied(true)
        return
      }
      if (booking.renter_id !== user.id) {
        setAccessDenied(true)
      }
    }
  }, [authLoading, booking, user])

  async function handleApplyPromoCode() {
    if (!promoCode.trim()) {
      toast.error(getUIText('checkout_toast_promoEmpty', language))
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
        toast.success(
          interpolateTemplate(getUIText('checkout_toast_promoOk', language), {
            amount: String(data.data.discountAmount),
          }),
        )
      } else {
        toast.error(data.error || getUIText('checkout_toast_promoInvalid', language))
        setPromoDiscount(null)
      }
    } catch (error) {
      console.error('Failed to apply promo code:', error)
      toast.error(getUIText('checkout_toast_promoCheckFail', language))
    } finally {
      setPromoLoading(false)
    }
  }

  async function loadPaymentStatus() {
    try {
      // Use API route with service role to bypass RLS issues
      const bookingRes = await fetch(`/api/v2/bookings/${params.bookingId}`, {
        cache: 'no-store'
      });
      const bookingData = await bookingRes.json();
      
      if (!bookingData.success || !bookingData.data) {
        console.error('[CHECKOUT] Booking not found:', bookingData.error);
        setLoading(false);
        return;
      }
      
      const b = bookingData.data;
      const l = b.listings;

      // Ownership check deferred until auth is ready (see useEffect below)
      
      // Transform booking data
      setBooking({
        id: b.id,
        renter_id: b.renter_id,
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
        metadata: b.metadata,
        commissionRate: parseFloat(b.commission_rate),
        partnerEarningsThb: parseFloat(b.partner_earnings_thb) || 0
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
      
      // Только PAID = реально оплачено. CONFIRMED = подтверждено партнёром, но ещё не оплачено.
      if (b.status === 'PAID' || b.status === 'COMPLETED') {
        setPayment({
          id: `pay-${b.id}`,
          status: 'COMPLETED',
          method: 'CARD',
          amount: b.price_thb
        });
        setPaymentSuccess(true);
      }

      // Try to find the linked conversation so we can offer a chat link on success screen.
      try {
        const convRes = await fetch(
          `/api/v2/chat/conversations?id=${encodeURIComponent(b.id)}&enrich=0`,
          { credentials: 'include' }
        )
        const convJson = await convRes.json()
        const convId = convJson.data?.[0]?.id
        if (convId) setChatConversationId(convId)
        else {
          // Fallback: search by booking_id param
          const convRes2 = await fetch(
            `/api/v2/chat/conversations?enrich=0`,
            { credentials: 'include' }
          )
          const convJson2 = await convRes2.json()
          const matched = Array.isArray(convJson2.data)
            ? convJson2.data.find((c) => String(c.bookingId) === String(b.id))
            : null
          if (matched?.id) setChatConversationId(matched.id)
        }
      } catch {
        // Non-critical — don't block checkout flow
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
          toast.success(getUIText('checkout_toast_mockRedirect', language))
          setTimeout(() => {
            handleConfirmPayment(null, `MOCK-${Date.now()}`)
          }, 2000)
        }
      } else {
        toast.error(data.error || getUIText('checkout_toast_paymentInitFail', language))
      }
    } catch (error) {
      console.error('Failed to initiate payment:', error)
      toast.error(getUIText('checkout_toast_paymentInitFail', language))
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
        toast.info(getUIText('checkout_toast_txReceived', language))
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
          toast.error(verifyData.error || getUIText('checkout_toast_txNotVerified', language))
          setVerifying(false)
          setVerificationStep(0)
          return
        }
        
        // Step 3: Verified!
        setVerificationStep(3)
        toast.success(getUIText('checkout_toast_chainOk', language))
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
          toast.error(data.error || getUIText('checkout_toast_paymentConfirmFail', language))
        }
      } catch (error) {
        console.error('Failed to verify crypto payment:', error)
        toast.error(getUIText('checkout_toast_verifyPaymentFail', language))
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
        toast.success(getUIText('checkout_toast_paymentOk', language))
        setPaymentSuccess(true)
        setCryptoModalOpen(false)
        
        setTimeout(() => {
          handleCheckInConfirm()
        }, 1000)
      } else {
        toast.error(data.error || getUIText('checkout_toast_paymentConfirmFail', language))
      }
    } catch (error) {
      console.error('Failed to confirm payment:', error)
      toast.error(getUIText('checkout_toast_paymentConfirmFail', language))
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
    toast.success(getUIText('checkout_copySuccess', language))
  }

  // Verify TXID via TronScan API
  async function handleVerifyTxid() {
    if (!txId.trim() || txId.length < 60) {
      toast.error(getUIText('checkout_toast_txidShort', language))
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
        toast.success(getUIText('checkout_toast_txFound', language))
      } else if (data.status === 'PENDING') {
        toast.info(getUIText('checkout_toast_txPending', language))
      } else if (data.status === 'NOT_FOUND') {
        toast.warning(getUIText('checkout_toast_txNotFound', language))
      } else {
        toast.error(data.error || getUIText('checkout_toast_verifyError', language))
      }
    } catch (error) {
      console.error('Verification error:', error)
      toast.error(getUIText('checkout_toast_checkTxFail', language))
    } finally {
      setVerifying(false)
    }
  }

  // Submit TXID to admin for verification
  async function handleSubmitTxid() {
    if (!txId.trim() || txId.length < 60) {
      toast.error(getUIText('checkout_toast_txidShort', language))
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
        toast.success(getUIText('checkout_toast_txSubmitOk', language))
        setTxidSubmitted(true)
      } else {
        toast.error(data.error || getUIText('checkout_toast_txSubmitFail', language))
      }
    } catch (error) {
      console.error('Submit TXID error:', error)
      toast.error(getUIText('checkout_toast_txSubmitFail', language))
    } finally {
      setVerifying(false)
    }
  }

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-teal-600" />
      </div>
    )
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <h3 className="text-xl font-semibold mb-2">{getUIText('checkout_accessDeniedTitle', language)}</h3>
            <p className="text-slate-600 mb-4">
              {getUIText('checkout_accessDeniedBody', language)}
            </p>
            <div className="flex gap-2 justify-center">
              <Button asChild>
                <Link href="/">{getUIText('checkout_home', language)}</Link>
              </Button>
              <Button variant="outline" onClick={() => window.location.reload()}>
                {getUIText('checkout_refresh', language)}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!booking || booking.status === 'CANCELLED') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <h3 className="text-xl font-semibold mb-2">{getUIText('checkout_unavailableTitle', language)}</h3>
            <p className="text-slate-600 mb-4">{getUIText('checkout_unavailableBody', language)}</p>
            <Button asChild>
              <Link href="/">{getUIText('checkout_home', language)}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (paymentSuccess) {
    const chatHref = chatConversationId ? `/messages/${encodeURIComponent(chatConversationId)}` : null
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto mb-4" />
            <h3 className="text-2xl font-bold mb-2">{getUIText('checkout_successTitle', language)}</h3>
            <p className="text-slate-600 mb-6">
              {getUIText('checkout_successBody', language)}
            </p>
            <div className="space-y-3">
              {chatHref && (
                <Button asChild className="w-full bg-teal-600 hover:bg-teal-700">
                  <Link href={chatHref}>{getUIText('checkout_chatHost', language)}</Link>
                </Button>
              )}
              <Button asChild variant={chatHref ? 'outline' : 'default'} className={`w-full${chatHref ? '' : ' bg-teal-600 hover:bg-teal-700'}`}>
                <Link href="/">{getUIText('checkout_home', language)}</Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href="/my-bookings">{getUIText('checkout_myBookings', language)}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const commissionRate = Number.isFinite(booking.commissionRate)
    ? booking.commissionRate
    : !commissionFromApi.loading && Number.isFinite(commissionFromApi.effectiveRate)
      ? commissionFromApi.effectiveRate
      : null
  if (commissionRate == null) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-teal-600" />
      </div>
    )
  }
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
          {getUIText('checkout_back', language)}
        </Link>

        <h1 className="text-3xl font-bold text-slate-900 mb-8">{getUIText('checkout_title', language)}</h1>

        {/* Баннер для подтверждённого, но неоплаченного бронирования */}
        {booking?.status === 'CONFIRMED' && (
          <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-emerald-900 text-sm">
                {getUIText('checkout_confirmedBannerTitle', language)}
              </p>
              <p className="text-sm text-emerald-700 mt-0.5">
                {getUIText('checkout_confirmedBannerBody', language)}
              </p>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-6">
          {/* Payment Form */}
          <div className="md:col-span-2 space-y-6">
            {/* Payment Method Selection */}
            <Card>
              <CardHeader>
                <CardTitle>{getUIText('checkout_selectMethod', language)}</CardTitle>
              </CardHeader>
              <CardContent>
                <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
                  <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-slate-50 cursor-pointer">
                    <RadioGroupItem value="CARD" id="card" />
                    <Label htmlFor="card" className="flex items-center gap-3 cursor-pointer flex-1">
                      <CreditCard className="h-5 w-5 text-slate-600" />
                      <div>
                        <p className="font-semibold">{getUIText('checkout_methodCard', language)}</p>
                        <p className="text-sm text-slate-500">{getUIText('checkout_methodCardDesc', language)}</p>
                      </div>
                    </Label>
                  </div>

                  <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-slate-50 cursor-pointer">
                    <RadioGroupItem value="MIR" id="mir" />
                    <Label htmlFor="mir" className="flex items-center gap-3 cursor-pointer flex-1">
                      <CreditCard className="h-5 w-5 text-blue-600" />
                      <div>
                        <p className="font-semibold">{getUIText('checkout_methodMir', language)}</p>
                        <p className="text-sm text-slate-500">{getUIText('checkout_methodMirDesc', language)}</p>
                      </div>
                    </Label>
                  </div>

                  <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-slate-50 cursor-pointer">
                    <RadioGroupItem value="CRYPTO" id="crypto" />
                    <Label htmlFor="crypto" className="flex items-center gap-3 cursor-pointer flex-1">
                      <Wallet className="h-5 w-5 text-amber-600" />
                      <div>
                        <p className="font-semibold">{getUIText('checkout_methodCrypto', language)}</p>
                        <p className="text-sm text-slate-500">{getUIText('checkout_methodCryptoDesc', language)}</p>
                      </div>
                    </Label>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>

            {/* Promo Code Section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{getUIText('checkout_promoTitle', language)}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Input
                    placeholder={getUIText('checkout_promoPlaceholder', language)}
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
                      getUIText('checkout_apply', language)
                    )}
                  </Button>
                </div>
                {promoDiscount && (
                  <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm font-medium text-green-900">
                      {interpolateTemplate(getUIText('checkout_applied', language), {
                        code: promoDiscount.code,
                      })}
                    </p>
                    <p className="text-xs text-green-700 mt-1">
                      −{formatPrice(promoDiscount.discountAmount, 'THB', exchangeRates, language)}
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
                  {getUIText('checkout_payProcessing', language)}
                </>
              ) : (
                interpolateTemplate(getUIText('checkout_payCta', language), {
                  amount: formatPrice(totalWithFee, booking.currency, exchangeRates, language),
                })
              )}
            </Button>
          </div>

          {/* Order Summary */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{getUIText('checkout_orderTitle', language)}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="font-semibold text-slate-900">{listing?.title}</p>
                  <p className="text-sm text-slate-600 mt-1">
                    {new Date(booking.checkIn).toLocaleDateString(languageToNumberLocale(language))} –{' '}
                    {new Date(booking.checkOut).toLocaleDateString(languageToNumberLocale(language))}
                  </p>
                </div>

                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">{getUIText('checkout_subtotal', language)}</span>
                    <span
                      className="font-medium"
                      data-test-subtotal-value={priceRawForTest(booking.priceThb, 'THB', exchangeRates)}
                    >
                      {formatPrice(booking.priceThb, 'THB', exchangeRates, language)}
                    </span>
                  </div>
                  {promoDiscount && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span className="flex items-center gap-1">
                        {interpolateTemplate(getUIText('checkout_discountLine', language), {
                          code: promoDiscount.code,
                        })}
                      </span>
                      <span className="font-medium">
                        −{formatPrice(discountAmount, 'THB', exchangeRates, language)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">
                      {interpolateTemplate(getUIText('checkout_serviceFeeLine', language), {
                        pct: String(commissionRate),
                      })}
                    </span>
                    <span
                      className="font-medium"
                      data-test-fee-value={priceRawForTest(serviceFee, 'THB', exchangeRates)}
                    >
                      {formatPrice(serviceFee, 'THB', exchangeRates, language)}
                    </span>
                  </div>
                  <div className="flex justify-between text-lg font-bold border-t pt-2">
                    <span>{getUIText('checkout_total', language)}</span>
                    <span
                      className="text-teal-600"
                      data-test-raw-value={priceRawForTest(totalWithFee, 'THB', exchangeRates)}
                      data-test-total-thb={String(Math.round(Number(totalWithFee) || 0))}
                    >
                      {formatPrice(totalWithFee, 'THB', exchangeRates, language)}
                    </span>
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
                {getUIText('checkout_cryptoModalTitle', language)}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              {/* Network Warning */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                  <span className="text-lg font-bold text-amber-800">
                    {getUIText('checkout_cryptoWarnTitle', language)}
                  </span>
                </div>
                <p className="text-sm text-amber-700">{getUIText('checkout_cryptoWarnBody', language)}</p>
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
                  <span className="text-sm">{getUIText('checkout_scanHint', language)}</span>
                </div>
              </div>

              {/* Wallet Address with Copy */}
              <div>
                <Label className="text-base font-semibold mb-2 block">
                  {getUIText('checkout_walletLabel', language)}
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
                    {getUIText('checkout_copy', language)}
                  </Button>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                    {getUIText('checkout_networkBadge', language)}
                  </Badge>
                  <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
                    {getUIText('checkout_tokenBadge', language)}
                  </Badge>
                </div>
              </div>

              {/* Amount to Pay */}
              <div>
                <Label className="text-base font-semibold mb-2 block">
                  {getUIText('checkout_amountLabel', language)}
                </Label>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-2xl font-bold text-amber-900" data-testid="usdt-amount">
                    {payment?.metadata?.amount ??
                      (thbPerUsdt
                        ? Math.ceil((totalWithFee / thbPerUsdt) * 100) / 100
                        : '—')}{' '}
                    USDT
                  </p>
                  <p className="text-sm text-amber-700 mt-1">
                    ≈ {formatPrice(totalWithFee, 'THB', exchangeRates, language)}
                  </p>
                </div>
              </div>

              {/* TXID Submitted Success State */}
              {txidSubmitted && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-green-900">
                        {getUIText('checkout_txidSentTitle', language)}
                      </p>
                      <p className="text-sm text-green-700 mt-1">
                        {getUIText('checkout_txidSentBody', language)}
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
                        {getUIText('checkout_viewExplorer', language)}
                      </a>
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      className="flex-1 bg-teal-600 hover:bg-teal-700"
                      onClick={() => setCryptoModalOpen(false)}
                    >
                      {getUIText('checkout_close', language)}
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
                      <p>
                        {getUIText('checkout_verify_from', language)}{' '}
                        <code className="text-xs">{liveVerification.data.from}</code>
                      </p>
                      <p>
                        {getUIText('checkout_verify_to', language)}{' '}
                        <code className="text-xs">{liveVerification.data.to}</code>
                      </p>
                      {liveVerification.data.amount > 0 && (
                        <p>
                          {getUIText('checkout_verify_amount', language)}{' '}
                          <strong>
                            {liveVerification.data.amount} {liveVerification.data.token}
                          </strong>
                        </p>
                      )}
                      {/* Amount Verification Details */}
                      {liveVerification.amountVerification && (
                        <div className={`mt-2 p-2 rounded ${
                          liveVerification.amountVerification.sufficient ? 'bg-green-100' : 'bg-red-100'
                        }`}>
                          <p className="text-xs font-medium">
                            {getUIText('checkout_verify_received', language)}{' '}
                            {liveVerification.amountVerification.received} USDT
                          </p>
                          {liveVerification.amountVerification.expected && (
                            <p className="text-xs">
                              {getUIText('checkout_verify_expected', language)}{' '}
                              {liveVerification.amountVerification.expected} USDT
                            </p>
                          )}
                          {liveVerification.amountVerification.difference !== 0 && (
                            <p className={`text-xs ${liveVerification.amountVerification.difference > 0 ? 'text-green-700' : 'text-red-700'}`}>
                              {getUIText('checkout_verify_diff', language)}{' '}
                              {liveVerification.amountVerification.difference > 0 ? '+' : ''}
                              {liveVerification.amountVerification.difference} USDT
                            </p>
                          )}
                        </div>
                      )}
                      {!liveVerification.data.isCorrectWallet && (
                        <p className="text-orange-600 font-medium">
                          ⚠️ {getUIText('checkout_verify_wrongWallet', language)}
                        </p>
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
                      {getUIText('checkout_txidLabel', language)}
                    </Label>
                    <Input
                      id="txid"
                      value={txId}
                      onChange={(e) => {
                        setTxId(e.target.value);
                        setLiveVerification(null);
                      }}
                      placeholder={getUIText('checkout_txidPh', language)}
                      className="font-mono text-sm"
                      data-testid="txid-input"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      {getUIText('checkout_txidHelp', language)}
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
                          {getUIText('checkout_verifying', language)}
                        </>
                      ) : (
                        <>
                          <ExternalLink className="h-4 w-4 mr-2" />
                          {getUIText('checkout_verifyBtn', language)}
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={handleSubmitTxid}
                      disabled={!txId.trim() || txId.length < 60 || verifying}
                      className="flex-1 bg-teal-600 hover:bg-teal-700"
                      data-testid="submit-txid-btn"
                    >
                      {getUIText('checkout_submitTxid', language)}
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

export default function CheckoutPage({ params }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <Loader2 className="h-10 w-10 animate-spin text-teal-600" />
        </div>
      }
    >
      <CheckoutPageInner params={params} />
    </Suspense>
  )
}
