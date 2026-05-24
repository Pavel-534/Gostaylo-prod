'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Wallet,
  CreditCard,
  CheckCircle,
  XCircle,
  Loader2,
  ExternalLink,
  RefreshCw,
  Clock,
  DollarSign,
  AlertCircle,
  Eye,
  Landmark,
  ChevronRight,
} from 'lucide-react'
import { PAYMENT_METHODS, STATUS_CONFIG, isTestPaymentRow } from '@/lib/admin/admin-payments-shared'
import { useAdminPaymentsPage } from '@/hooks/admin/use-admin-payments-page'

export default function AdminPaymentsPageContent() {
  const {
    loading,
    payments,
    pendingCount,
    activeFilter,
    setActiveFilter,
    selectedPayment,
    setSelectedPayment,
    verificationResult,
    setVerificationResult,
    verifying,
    processing,
    rejectReason,
    setRejectReason,
    showRejectModal,
    setShowRejectModal,
    adaptersHealth,
    pendingPayments,
    loadPayments,
    handleVerifyTron,
    handleConfirmPayment,
    handleRejectPayment,
  } = useAdminPaymentsPage()

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 p-4 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 flex items-center gap-2">
              <DollarSign className="h-8 w-8 text-brand" />
              Платежи
            </h1>
            <p className="text-slate-600 mt-1">Верификация входящих платежей (crypto / card / МИР)</p>
            {adaptersHealth && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <Badge
                  variant="outline"
                  className={
                    adaptersHealth.overallMode === 'LIVE_MODE'
                      ? 'border-emerald-300 text-emerald-700'
                      : 'border-amber-300 text-amber-700'
                  }
                >
                  Режим: {adaptersHealth.overallMode === 'LIVE_MODE' ? 'Боевой' : 'Симуляция (MOCK_MODE)'}
                </Badge>
                <Badge variant="outline">
                  CARD_INTL: {adaptersHealth?.adapters?.CARD_INTL?.runtimeMode || 'UNKNOWN'}
                </Badge>
                <Badge variant="outline">
                  MIR_RU: {adaptersHealth?.adapters?.MIR_RU?.runtimeMode || 'UNKNOWN'}
                </Badge>
              </div>
            )}
          </div>
          <Button onClick={loadPayments} variant="outline" size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Обновить
          </Button>
        </div>

        <Link
          href="/admin/settings/finances"
          className="mb-6 flex items-center justify-between gap-4 rounded-xl border-2 border-brand/25 bg-gradient-to-r from-brand/10 to-slate-50 px-4 py-4 hover:border-brand/40 transition-colors"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand text-white shrink-0">
              <Landmark className="h-6 w-6" />
            </div>
            <div>
              <p className="font-semibold text-slate-900">FinTech-пульт (Pricing V2, касса, пулы, ledger)</p>
              <p className="text-sm text-slate-600 mt-0.5">
                Комиссии, 54-ФЗ, батчинг READY_FOR_PAYOUT и compliance CSV
              </p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-brand-hover shrink-0" />
        </Link>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-6">
          <Card className={`bg-white/80 backdrop-blur ${pendingCount > 0 ? 'border-red-300 ring-2 ring-red-200' : ''}`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${pendingCount > 0 ? 'bg-red-100' : 'bg-yellow-100'}`}>
                  <Clock className={`h-5 w-5 ${pendingCount > 0 ? 'text-red-600' : 'text-yellow-600'}`} />
                </div>
                <div>
                  <p className={`text-2xl font-bold ${pendingCount > 0 ? 'text-red-600' : 'text-yellow-600'}`}>
                    {pendingCount}
                  </p>
                  <p className="text-xs text-slate-600">Ожидают</p>
                </div>
                {pendingCount > 0 && (
                  <span className="ml-auto flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">
                    {payments.filter(p => p.status === 'CONFIRMED').length}
                  </p>
                  <p className="text-xs text-slate-600">Подтверждено</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                  <Wallet className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-600">
                    {payments.filter(p => p.payment_method === 'USDT_TRC20').length}
                  </p>
                  <p className="text-xs text-slate-600">Crypto</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <CreditCard className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-600">
                    {payments.filter(p => p.payment_method === 'CARD_INTL' || p.payment_method === 'CARD_RU').length}
                  </p>
                  <p className="text-xs text-slate-600">Cards</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter Tabs */}
        <Tabs value={activeFilter} onValueChange={setActiveFilter} className="space-y-4">
          <TabsList className="bg-white/80 backdrop-blur p-1 flex-wrap h-auto gap-1">
            <TabsTrigger value="all" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
              Все
            </TabsTrigger>
            <TabsTrigger value="PENDING" className="data-[state=active]:bg-yellow-600 data-[state=active]:text-white relative">
              Ожидают
              {pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
                  {pendingCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="CRYPTO" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white">
              <Wallet className="h-4 w-4 mr-1" />
              Crypto
            </TabsTrigger>
            <TabsTrigger value="MIR" className="data-[state=active]:bg-green-600 data-[state=active]:text-white">
              МИР
            </TabsTrigger>
            <TabsTrigger value="CARD" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <CreditCard className="h-4 w-4 mr-1" />
              Card
            </TabsTrigger>
            <TabsTrigger value="CONFIRMED" className="data-[state=active]:bg-green-600 data-[state=active]:text-white">
              <CheckCircle className="h-4 w-4 mr-1" />
              Confirmed
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeFilter} className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
              </div>
            ) : payments.length === 0 ? (
              <Card className="bg-white/80 backdrop-blur">
                <CardContent className="p-8 text-center">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-900">Нет платежей</h3>
                  <p className="text-slate-600">Платежи с выбранным фильтром не найдены</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {payments.map((payment) => {
                  const methodConfig = PAYMENT_METHODS[payment.payment_method] || PAYMENT_METHODS.CARD_INTL
                  const statusConfig = STATUS_CONFIG[payment.status] || STATUS_CONFIG.PENDING
                  const StatusIcon = statusConfig.icon
                  const MethodIcon = methodConfig.icon
                  const isTestPayment = isTestPaymentRow(payment)

                  return (
                    <Card 
                      key={payment.id} 
                      className={`backdrop-blur hover:shadow-lg transition-shadow cursor-pointer ${
                        isTestPayment ? 'bg-slate-50/95 border-slate-300' : 'bg-white/90'
                      } ${
                        payment.status === 'PENDING' ? 'border-l-4 border-l-yellow-500' : ''
                      }`}
                      onClick={() => setSelectedPayment(payment)}
                      data-testid={`payment-card-${payment.id}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between flex-wrap gap-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-${methodConfig.color}-100`}>
                              <MethodIcon className={`h-5 w-5 text-${methodConfig.color}-600`} />
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900">
                                {payment.booking?.listing?.title || 'Объект'}
                              </p>
                              <p className="text-sm text-slate-600">
                                {payment.booking?.guest_name || 'Гость'} • {methodConfig.label}
                              </p>
                              {isTestPayment && (
                                <div className="mt-1">
                                  <Badge variant="outline" className="border-slate-400 text-slate-700">
                                    ТЕСТ
                                  </Badge>
                                </div>
                              )}
                              {payment.txid && (
                                <p className="text-xs text-slate-500 font-mono truncate max-w-[200px]">
                                  TXID: {payment.txid.substring(0, 20)}...
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="font-bold text-lg text-slate-900">
                                ฿{payment.amount?.toLocaleString() || 0}
                              </p>
                              <p className="text-xs text-slate-500">
                                {new Date(payment.created_at).toLocaleDateString('ru-RU')}
                              </p>
                            </div>

                            <Badge className={`${statusConfig.color} flex items-center gap-1`}>
                              <StatusIcon className={`h-3 w-3 ${payment.status === 'VERIFYING' ? 'animate-spin' : ''}`} />
                              {statusConfig.label}
                            </Badge>

                            {payment.payment_method === 'USDT_TRC20' && payment.txid && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  window.open(`https://tronscan.org/#/transaction/${payment.txid}`, '_blank')
                                }}
                                data-testid={`tronscan-btn-${payment.id}`}
                              >
                                <ExternalLink className="h-4 w-4 mr-1" />
                                TronScan
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Payment Detail Modal */}
      <Dialog open={!!selectedPayment} onOpenChange={() => {
        setSelectedPayment(null)
        setVerificationResult(null)
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedPayment && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5 text-indigo-600" />
                  Детали платежа
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                {/* Status Badge */}
                <div className="flex items-center justify-between">
                  <Badge className={STATUS_CONFIG[selectedPayment.status]?.color || 'bg-gray-100'}>
                    {STATUS_CONFIG[selectedPayment.status]?.label || selectedPayment.status}
                  </Badge>
                  <div className="flex items-center gap-2">
                    {isTestPaymentRow(selectedPayment) && (
                      <Badge variant="outline" className="border-slate-400 text-slate-700">
                        ТЕСТ
                      </Badge>
                    )}
                    <Badge variant="outline">
                      {PAYMENT_METHODS[selectedPayment.payment_method]?.label || selectedPayment.payment_method}
                    </Badge>
                  </div>
                </div>

                {/* Booking Info */}
                <Card>
                  <CardContent className="p-4 space-y-2">
                    <h4 className="font-semibold">Бронирование</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-slate-500">Объект</p>
                        <p className="font-medium">{selectedPayment.booking?.listing?.title || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Гость</p>
                        <p className="font-medium">{selectedPayment.booking?.guest_name || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Email</p>
                        <p className="font-medium">{selectedPayment.booking?.guest_email || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Сумма</p>
                        <p className="font-bold text-brand">฿{selectedPayment.amount?.toLocaleString()}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* TXID Info for Crypto */}
                {(selectedPayment.payment_method === 'USDT_TRC20' || selectedPayment.payment_method === 'CRYPTO') && selectedPayment.txid && (
                  <Card>
                    <CardContent className="p-4 space-y-3">
                      <h4 className="font-semibold flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-amber-600" />
                        Crypto Transaction
                      </h4>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">TXID</p>
                        <code className="text-xs bg-slate-100 p-2 rounded block break-all">
                          {selectedPayment.txid}
                        </code>
                      </div>

                      {/* TronScan Verify Button */}
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() =>
                            handleVerifyTron(selectedPayment.txid, selectedPayment.bookingId ?? selectedPayment.booking_id)
                          }
                          disabled={verifying}
                          className="flex-1"
                          data-testid="live-verify-btn"
                        >
                          {verifying ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4 mr-2" />
                          )}
                          Live Verify
                        </Button>
                        <Button
                          variant="outline"
                          asChild
                          className="flex-1"
                        >
                          <a 
                            href={`https://tronscan.org/#/transaction/${selectedPayment.txid}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-4 w-4 mr-2" />
                            View on TronScan
                          </a>
                        </Button>
                      </div>

                      {/* Verification Result with Amount Comparison */}
                      {verificationResult && (
                        <div className={`rounded-lg p-4 border ${
                          verificationResult.success 
                            ? 'bg-green-50 border-green-200' 
                            : verificationResult.status === 'PENDING'
                            ? 'bg-yellow-50 border-yellow-200'
                            : verificationResult.status === 'UNDERPAID'
                            ? 'bg-orange-50 border-orange-200'
                            : 'bg-red-50 border-red-200'
                        }`}>
                          <div className="flex items-center gap-2 mb-2">
                            {verificationResult.success ? (
                              <CheckCircle className="h-5 w-5 text-green-600" />
                            ) : verificationResult.status === 'PENDING' ? (
                              <Clock className="h-5 w-5 text-yellow-600" />
                            ) : verificationResult.status === 'UNDERPAID' ? (
                              <AlertCircle className="h-5 w-5 text-orange-600" />
                            ) : (
                              <AlertCircle className="h-5 w-5 text-red-600" />
                            )}
                            <span className={`font-semibold ${
                              verificationResult.success ? 'text-green-800' 
                              : verificationResult.status === 'PENDING' ? 'text-yellow-800'
                              : verificationResult.status === 'UNDERPAID' ? 'text-orange-800'
                              : 'text-red-800'
                            }`}>
                              {verificationResult.badge?.labelRu || verificationResult.badge?.label || verificationResult.status}
                            </span>
                          </div>
                          
                          {verificationResult.data && (
                            <div className="text-sm space-y-1">
                              <p><span className="text-slate-500">От:</span> <code className="text-xs">{verificationResult.data.from}</code></p>
                              <p><span className="text-slate-500">Кому:</span> <code className="text-xs">{verificationResult.data.to}</code></p>
                            </div>
                          )}

                          {/* Amount Comparison Table */}
                          {verificationResult.amountVerification && (
                            <div className="mt-3 bg-white rounded-lg p-3 border">
                              <h5 className="text-xs font-semibold text-slate-600 mb-2">Верификация суммы</h5>
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                <div className="bg-slate-50 p-2 rounded">
                                  <p className="text-xs text-slate-500">Получено</p>
                                  <p className="font-bold text-slate-900">
                                    {verificationResult.amountVerification.received || 0} USDT
                                  </p>
                                </div>
                                <div className="bg-slate-50 p-2 rounded">
                                  <p className="text-xs text-slate-500">Ожидалось</p>
                                  <p className="font-bold text-slate-900">
                                    {verificationResult.amountVerification.expected || '—'} USDT
                                  </p>
                                </div>
                              </div>
                              {verificationResult.amountVerification.difference !== undefined && (
                                <div className={`mt-2 p-2 rounded text-center ${
                                  verificationResult.amountVerification.sufficient 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  <span className="font-medium">
                                    {verificationResult.amountVerification.sufficient 
                                      ? '✓ Сумма достаточна' 
                                      : `⚠ Недоплата: ${Math.abs(verificationResult.amountVerification.difference)} USDT`
                                    }
                                  </span>
                                  <span className="text-xs ml-2">
                                    ({verificationResult.amountVerification.percentage}%)
                                  </span>
                                </div>
                              )}
                            </div>
                          )}

                          <div className="mt-2">
                            <p className="text-sm">
                              <span className="text-slate-500">Кошелёк верный:</span> 
                              {verificationResult.data?.isCorrectWallet ? (
                                <span className="text-green-600 font-medium ml-1">✓ Да</span>
                              ) : (
                                <span className="text-red-600 font-medium ml-1">✗ Нет</span>
                              )}
                            </p>
                          </div>
                          
                          {verificationResult.error && (
                            <p className="text-sm text-red-600 mt-2">{verificationResult.error}</p>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Admin Actions */}
                {selectedPayment.status === 'PENDING' && (
                  <div className="flex gap-3 pt-4 border-t">
                    <Button
                      onClick={() => handleConfirmPayment(selectedPayment.id)}
                      disabled={processing}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      data-testid="confirm-payment-btn"
                    >
                      {processing ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle className="h-4 w-4 mr-2" />
                      )}
                      Подтвердить
                    </Button>
                    <Button
                      onClick={() => setShowRejectModal(true)}
                      variant="destructive"
                      disabled={processing}
                      className="flex-1"
                      data-testid="reject-payment-btn"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Отклонить
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Modal */}
      <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <XCircle className="h-5 w-5" />
              Отклонить платёж
            </DialogTitle>
            <DialogDescription>
              Укажите причину отклонения платежа
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Причина отклонения..."
            className="min-h-[100px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectModal(false)}>
              Отмена
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleRejectPayment(selectedPayment?.id)}
              disabled={processing || !rejectReason.trim()}
            >
              {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Отклонить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
