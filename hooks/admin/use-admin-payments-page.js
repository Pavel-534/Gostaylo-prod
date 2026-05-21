'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useToast } from '@/hooks/use-toast'
import {
  fetchAdminPaymentsList,
  fetchAdminPaymentsPendingCount,
  fetchPaymentAdaptersHealth,
  verifyTronPayment,
  postPaymentAction,
} from '@/lib/admin/admin-payments-api-client'

/**
 * Stage 111.0 — логика админ-страницы верификации платежей.
 */
export function useAdminPaymentsPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [payments, setPayments] = useState([])
  const [pendingCount, setPendingCount] = useState(0)
  const [activeFilter, setActiveFilter] = useState('all')
  const [selectedPayment, setSelectedPayment] = useState(null)
  const [verificationResult, setVerificationResult] = useState(null)
  const [verifying, setVerifying] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [adaptersHealth, setAdaptersHealth] = useState(null)

  const loadPayments = useCallback(async () => {
    setLoading(true)
    try {
      const { ok, data } = await fetchAdminPaymentsList({ activeFilter })
      if (ok) {
        setPayments(data.payments || [])
      }
      const countRes = await fetchAdminPaymentsPendingCount()
      setPendingCount(countRes.count || 0)
    } catch (error) {
      console.error('Error loading payments:', error)
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить платежи',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [activeFilter, toast])

  const loadAdaptersHealth = useCallback(async () => {
    try {
      const { ok, data } = await fetchPaymentAdaptersHealth()
      setAdaptersHealth(ok ? data : null)
    } catch {
      setAdaptersHealth(null)
    }
  }, [])

  useEffect(() => {
    void loadPayments()
  }, [loadPayments])

  useEffect(() => {
    void loadAdaptersHealth()
  }, [loadAdaptersHealth])

  const handleVerifyTron = useCallback(
    async (txid, bookingId = null) => {
      setVerifying(true)
      setVerificationResult(null)
      try {
        if (!bookingId) {
          toast({
            title: 'Нет привязки к брони',
            description: 'Для проверки суммы у платежа должен быть booking_id (как на чекауте).',
            variant: 'destructive',
          })
          return
        }
        const { data } = await verifyTronPayment({ txid, bookingId })
        setVerificationResult(data)
        if (data.success) {
          toast({
            title: '✅ Транзакция подтверждена',
            description: `Сумма: ${data.data?.amount} ${data.data?.token}`,
          })
        } else if (data.status === 'PENDING') {
          toast({
            title: '⏳ Ожидает подтверждения',
            description: 'Транзакция ещё не подтверждена сетью',
          })
        } else if (data.status === 'UNDERPAID') {
          toast({
            title: '⚠️ Недоплата',
            description: 'Получено меньше ожидаемого',
            variant: 'warning',
          })
        } else if (data.status === 'INVALID_RECIPIENT') {
          toast({
            title: '❌ Неверный получатель',
            description: 'Транзакция отправлена на другой кошелёк',
            variant: 'destructive',
          })
        } else {
          toast({
            title: 'Ошибка верификации',
            description: data.error || data.status,
            variant: 'destructive',
          })
        }
      } catch (error) {
        console.error('Verify error:', error)
        toast({
          title: 'Ошибка',
          description: 'Не удалось проверить транзакцию',
          variant: 'destructive',
        })
      } finally {
        setVerifying(false)
      }
    },
    [toast],
  )

  const handleConfirmPayment = useCallback(
    async (paymentId) => {
      setProcessing(true)
      try {
        const { ok, data } = await postPaymentAction({
          action: 'confirm',
          paymentId,
          verificationData: verificationResult?.data || {},
        })
        if (ok) {
          toast({
            title: '✅ Платёж подтверждён',
            description: 'Уведомления отправлены партнёру и гостю',
          })
          setSelectedPayment(null)
          void loadPayments()
        } else {
          toast({ title: 'Ошибка', description: data.error, variant: 'destructive' })
        }
      } catch (error) {
        console.error('Confirm error:', error)
        toast({
          title: 'Ошибка',
          description: 'Не удалось подтвердить платёж',
          variant: 'destructive',
        })
      } finally {
        setProcessing(false)
      }
    },
    [verificationResult, loadPayments, toast],
  )

  const handleRejectPayment = useCallback(
    async (paymentId) => {
      if (!rejectReason.trim()) {
        toast({
          title: 'Ошибка',
          description: 'Укажите причину отклонения',
          variant: 'destructive',
        })
        return
      }
      setProcessing(true)
      try {
        const { ok, data } = await postPaymentAction({
          action: 'reject',
          paymentId,
          reason: rejectReason,
        })
        if (ok) {
          toast({ title: 'Платёж отклонён' })
          setShowRejectModal(false)
          setSelectedPayment(null)
          setRejectReason('')
          void loadPayments()
        } else {
          toast({ title: 'Ошибка', description: data.error, variant: 'destructive' })
        }
      } catch (error) {
        console.error('Reject error:', error)
        toast({ title: 'Ошибка', variant: 'destructive' })
      } finally {
        setProcessing(false)
      }
    },
    [rejectReason, loadPayments, toast],
  )

  const pendingPayments = useMemo(
    () => payments.filter((p) => p.status === 'PENDING' || p.status === 'VERIFYING'),
    [payments],
  )

  return {
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
  }
}
