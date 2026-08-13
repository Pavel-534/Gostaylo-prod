'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Loader2, AlertCircle } from 'lucide-react'
import { formatPrice } from '@/lib/currency'
import { getUIText } from '@/lib/translations'
import { fetchBookingCancelPreview, postBookingCancel } from '@/lib/api/renter-bookings-client'
import { formatGuestPaymentDisplayAmount } from '@/lib/booking/guest-payment-display.js'

export function CancelBookingDialog({ open, onOpenChange, bookingId, language, onCancelled }) {
  const [step, setStep] = useState('idle')
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const t = (key) => getUIText(key, language)

  const refundPrimary = useMemo(() => {
    if (!preview?.ledgerRefund) return null
    const currency = String(preview.refundGuestCurrency || 'THB').toUpperCase()
    const amount = Number(preview.refundGuestAmount)
    if (Number.isFinite(amount) && amount >= 0 && preview.refundGuestCurrency) {
      return {
        currency,
        amount,
        label: formatGuestPaymentDisplayAmount(amount, currency, language),
      }
    }
    if (preview.refundGuestThb != null) {
      return {
        currency: 'THB',
        amount: Number(preview.refundGuestThb) || 0,
        label: formatPrice(preview.refundGuestThb, 'THB'),
      }
    }
    return null
  }, [preview, language])

  const loadPreview = useCallback(async () => {
    if (!bookingId) return
    setStep('loading')
    setError(null)
    setPreview(null)
    try {
      const { ok, data, json } = await fetchBookingCancelPreview(bookingId)
      if (!ok) {
        throw new Error(json.error || 'Preview failed')
      }
      setPreview(data)
      if (!data?.cancellable) {
        setStep('blocked')
      } else {
        setStep('confirm')
      }
    } catch (e) {
      setError(e.message)
      setStep('error')
    }
  }, [bookingId])

  useEffect(() => {
    if (open && bookingId) {
      loadPreview()
    } else if (!open) {
      setStep('idle')
      setPreview(null)
      setError(null)
      setSubmitting(false)
    }
  }, [open, bookingId, loadPreview])

  async function confirmCancel() {
    setSubmitting(true)
    setError(null)
    try {
      const { ok, json } = await postBookingCancel(bookingId, {})
      if (!ok) {
        throw new Error(json.error || 'Cancel failed')
      }
      onCancelled?.(json.data)
      onOpenChange(false)
    } catch (e) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent mobileAnchor="bottom" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('renterCancel_title')}</DialogTitle>
          <DialogDescription>{t('renterCancel_subtitle')}</DialogDescription>
        </DialogHeader>

        {step === 'loading' && (
          <div className="flex items-center justify-center py-8 text-slate-600">
            <Loader2 className="h-8 w-8 animate-spin text-brand" />
          </div>
        )}

        {step === 'error' && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error || 'Error'}
          </div>
        )}

        {step === 'blocked' && preview && (
          <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{t('renterCancel_notAllowed')}</span>
          </div>
        )}

        {step === 'confirm' && preview && (
          <div className="space-y-3 text-sm">
            {preview.ledgerRefund && refundPrimary && (
              <div
                className="rounded-lg border border-brand/20 bg-brand/10 px-4 py-3"
                data-testid="cancel-refund-estimate"
              >
                <p className="font-medium text-slate-900">{t('renterCancel_refundLabel')}</p>
                <p
                  className="text-2xl font-bold text-brand-hover mt-1"
                  data-testid="cancel-refund-primary"
                >
                  {refundPrimary.label}
                </p>
                {refundPrimary.currency !== 'THB' && preview.refundGuestThb != null ? (
                  <p className="text-xs text-slate-600 mt-1" data-testid="cancel-refund-thb-secondary">
                    {t('renterCancel_refundThbSecondary').replace(
                      '{{amount}}',
                      formatPrice(preview.refundGuestThb, 'THB'),
                    )}
                  </p>
                ) : null}
                {preview.refundPercent != null && (
                  <p className="text-xs text-slate-600 mt-1">
                    {t('renterCancel_policyLine')
                      .replace('{{policy}}', String(preview.policy || ''))
                      .replace('{{pct}}', String(preview.refundPercent))}
                  </p>
                )}
              </div>
            )}
            {preview.simpleCancelOnly && (
              <p className="text-slate-600">{t('renterCancel_noPaymentYet')}</p>
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0 pb-[max(0.25rem,env(safe-area-inset-bottom,0px))]">
          <Button variant="outline" className="min-h-11" onClick={() => onOpenChange(false)}>
            {t('renterCancel_back')}
          </Button>
          {step === 'confirm' && (
            <Button variant="destructive" className="min-h-11" onClick={confirmCancel} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : t('renterCancel_confirm')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
