'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

/**
 * First-visit MLM consent on /profile/referral (ADR-131A §6).
 * Decline closes without POST; modal returns on the next visit.
 */
export function MlmConsentModal({ open, onOpenChange, t, language = 'ru' }) {
  const [checked, setChecked] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleAccept() {
    if (!checked || submitting) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/v2/referral/consent', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.success === false) {
        toast.error(json.error || (language === 'en' ? 'Could not save consent' : 'Не удалось сохранить согласие'))
        return
      }
      toast.success(t('referral_mlm_consent_saved'))
      onOpenChange(false, { consented: true, consentAt: json.consentAt || null })
    } catch {
      toast.error(language === 'en' ? 'Network error' : 'Ошибка сети')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (submitting) return
        if (!next) onOpenChange(false, { consented: false })
      }}
    >
      <DialogContent mobileAnchor="bottom" className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t('referral_mlm_consent_modal_title')}</DialogTitle>
          <DialogDescription className="text-left text-slate-600">
            {t('referral_mlm_consent_modal_body')}
          </DialogDescription>
        </DialogHeader>

        <p>
          <Link
            href="/legal/public-offer/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center font-medium text-brand-hover underline underline-offset-2"
          >
            {t('referral_mlm_consent_modal_offer_link')}
          </Link>
        </p>

        <div className="flex items-start gap-3">
          <div className="flex min-h-[44px] min-w-[44px] items-center justify-center">
            <Checkbox
              id="mlm-consent-checkbox"
              checked={checked}
              onCheckedChange={(v) => setChecked(v === true)}
              aria-required="true"
            />
          </div>
          <label
            htmlFor="mlm-consent-checkbox"
            className="cursor-pointer select-none py-2 text-sm leading-snug text-slate-600"
          >
            {t('referral_mlm_consent_checkbox_label')}
          </label>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px]"
            disabled={submitting}
            onClick={() => onOpenChange(false, { consented: false })}
          >
            {t('referral_mlm_consent_modal_decline')}
          </Button>
          <Button
            type="button"
            variant="brand"
            className="min-h-[44px]"
            disabled={!checked || submitting}
            onClick={() => void handleAccept()}
          >
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t('referral_mlm_consent_modal_accept')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
