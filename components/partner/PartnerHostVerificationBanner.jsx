'use client'

import { useEffect, useState } from 'react'
import { ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getUIText } from '@/lib/translations'
import HostVerificationLightModal from '@/components/partner/HostVerificationLightModal'

/**
 * Плашка KYC light для неподтверждённых хостов (Stage 141.3).
 */
export default function PartnerHostVerificationBanner({ language = 'ru' }) {
  const [verified, setVerified] = useState(true)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/v2/auth/me', { credentials: 'include' })
        const json = await res.json().catch(() => ({}))
        if (cancelled) return
        const u = json?.user || json?.data?.user
        const isV =
          u?.isVerified === true ||
          u?.is_verified === true ||
          String(u?.verificationStatus || u?.verification_status || '').toUpperCase() === 'VERIFIED'
        setVerified(isV)
      } catch {
        if (!cancelled) setVerified(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [modalOpen])

  if (loading || verified) return null

  return (
    <>
      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <ShieldAlert className="h-6 w-6 shrink-0 text-amber-800" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-amber-950">
              {getUIText('partnerHostVerify_bannerTitle', language)}
            </p>
            <p className="text-xs text-amber-900/90 mt-0.5">
              {getUIText('partnerHostVerify_bannerBody', language)}
            </p>
          </div>
        </div>
        <Button type="button" variant="brand" size="sm" className="shrink-0" onClick={() => setModalOpen(true)}>
          {getUIText('partnerHostVerify_cta', language)}
        </Button>
      </div>
      <HostVerificationLightModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        language={language}
        onSubmitted={() => setVerified(false)}
      />
    </>
  )
}
