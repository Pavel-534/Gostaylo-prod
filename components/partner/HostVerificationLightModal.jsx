'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { KycUploader } from '@/components/kyc-uploader'
import { getUIText } from '@/lib/translations'

export default function HostVerificationLightModal({ open, onOpenChange, language = 'ru', onSubmitted }) {
  const [phone, setPhone] = useState('')
  const [docUrl, setDocUrl] = useState(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!phone.trim() || !docUrl) {
      toast.error(getUIText('partnerHostVerify_needFields', language))
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/v2/partner/verification-light', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim(), verificationDocUrl: docUrl }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.success) {
        toast.error(json.error || getUIText('partnerHostVerify_submitError', language))
        return
      }
      toast.success(getUIText('partnerHostVerify_submitOk', language))
      onSubmitted?.()
      onOpenChange(false)
    } catch {
      toast.error(getUIText('partnerHostVerify_submitError', language))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>{getUIText('partnerHostVerify_modalTitle', language)}</DialogTitle>
          <DialogDescription>{getUIText('partnerHostVerify_modalDesc', language)}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="host-verify-phone">{getUIText('partnerHostVerify_phoneLabel', language)}</Label>
            <Input
              id="host-verify-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+66 …"
              disabled={busy}
            />
          </div>
          <KycUploader value={docUrl} onChange={setDocUrl} disabled={busy} />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {getUIText('partnerHostVerify_cancel', language)}
          </Button>
          <Button type="button" variant="brand" onClick={() => void submit()} disabled={busy}>
            {getUIText('partnerHostVerify_submit', language)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
