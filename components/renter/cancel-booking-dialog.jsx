'use client'

import { useState, useEffect, useCallback } from 'react'
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

export function CancelBookingDialog({ open, onOpenChange, bookingId, language, onCancelled }) {
  const [step, setStep] = useState('idle')
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const t = (key) => getUIText(key, language)

  const loadPreview = useCallback(async () => {
    if (!bookingId) return
    setStep('loading')
    setError(null)
    setPreview(null)
    try {
      const res = await fetch(`/api/v2/bookings/${encodeURIComponent(bookingId)}/cancel-preview`, {
        credentials: 'include',
        cache: 'no-store',
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Preview failed')
      }
      setPreview(json.data)
      if (!json.data?.cancellable) {
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
      const res = await fetch(`/api/v2/bookings/${encodeURIComponent(bookingId)}/cancel`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('renterCancel_title')}</DialogTitle>
          <DialogDescription>{t('renterCancel_subtitle')}</DialogDescription>
        </DialogHeader>

        {step === 'loading' && (
          <div className="flex items-center justify-center py-8 text-slate-600">
            <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
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
            {preview.ledgerRefund && preview.refundGuestThb != null && (
              <div className="rounded-lg border border-teal-100 bg-teal-50/80 px-4 py-3">
                <p className="font-medium text-slate-900">{t('renterCancel_refundLabel')}</p>
                <p className="text-2xl font-bold text-teal-700 mt-1">
                  {formatPrice(preview.refundGuestThb, 'THB')}
                </p>
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

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('renterCancel_back')}
          </Button>
          {step === 'confirm' && (
            <Button variant="destructive" onClick={confirmCancel} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : t('renterCancel_confirm')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
