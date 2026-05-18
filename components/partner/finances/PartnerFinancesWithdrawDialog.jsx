'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, HandCoins, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { formatPayoutProfileLines } from '@/lib/partner/format-payout-profile-display'
import { resolvePayoutCurrency } from '@/lib/partner/partner-payout-fx'
import { fetchPartnerPayoutPreview } from '@/lib/api/partner-finances-client'
import { PartnerPayoutPreviewFields } from '@/components/partner/finances/PartnerPayoutPreviewFields'

function isRubProfile(profile) {
  return resolvePayoutCurrency(profile?.method_id, profile?.method) === 'RUB'
}

function isUsdtProfile(profile) {
  return resolvePayoutCurrency(profile?.method_id, profile?.method) === 'USDT'
}

export function PartnerFinancesWithdrawDialog({
  t,
  language,
  open,
  onOpenChange,
  partnerProfileVerified,
  financesSummary,
  payoutProfiles = [],
  partnerId,
  withdrawSubmitting,
  onConfirmWithdraw,
}) {
  const [rail, setRail] = useState('RUB')
  const [selectedProfileId, setSelectedProfileId] = useState(null)
  const [preview, setPreview] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const rubProfiles = useMemo(
    () => (payoutProfiles || []).filter(isRubProfile),
    [payoutProfiles],
  )
  const usdtProfiles = useMemo(
    () => (payoutProfiles || []).filter(isUsdtProfile),
    [payoutProfiles],
  )

  const profilesForRail = rail === 'USDT' ? usdtProfiles : rubProfiles
  const selectedProfile =
    profilesForRail.find((p) => p.id === selectedProfileId) ||
    profilesForRail.find((p) => p.is_default) ||
    profilesForRail[0] ||
    null

  useEffect(() => {
    if (!open) return
    if (!rubProfiles.length && usdtProfiles.length) setRail('USDT')
    else if (!usdtProfiles.length && rubProfiles.length) setRail('RUB')
  }, [open, rubProfiles.length, usdtProfiles.length])

  useEffect(() => {
    if (!open) return
    const list = rail === 'USDT' ? usdtProfiles : rubProfiles
    const preferred = list.find((p) => p.is_default) || list[0]
    setSelectedProfileId(preferred?.id ?? null)
  }, [open, rail, rubProfiles, usdtProfiles])

  useEffect(() => {
    if (!open || !selectedProfile?.id) {
      setPreview(null)
      return
    }
    let cancelled = false
    setPreviewLoading(true)
    ;(async () => {
      try {
        const data = await fetchPartnerPayoutPreview({
          payoutProfileId: selectedProfile.id,
        })
        if (!cancelled) setPreview(data)
      } catch {
        if (!cancelled) setPreview(null)
      } finally {
        if (!cancelled) setPreviewLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, selectedProfile?.id])

  const profileLines = selectedProfile
    ? formatPayoutProfileLines(selectedProfile.method, selectedProfile.data)
    : []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('partnerFinances_withdrawDialogTitle')}</DialogTitle>
          <DialogDescription>{t('partnerFinances_withdrawDialogDesc')}</DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950 flex gap-2">
          <HandCoins className="h-5 w-5 shrink-0 text-amber-700 mt-0.5" />
          <p>{t('partnerFinances_withdrawManualNotice')}</p>
        </div>

        {partnerProfileVerified === false ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            {t('partnerFinances_payoutKycBlockedHint')}
            <div className="mt-2">
              <Link
                href="/partner/settings"
                className="font-semibold text-amber-900 underline underline-offset-2"
              >
                {t('partnerFinances_payoutKycLinkSettings')}
              </Link>
            </div>
          </div>
        ) : null}

        <div className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-900">
          {t('partnerFinances_withdrawSubmittedNotice')}
        </div>

        <div className="space-y-3 text-sm">
          <div>
            <Label className="text-slate-700">{t('partnerFinances_withdrawRailLabel')}</Label>
            <RadioGroup
              value={rail}
              onValueChange={setRail}
              className="mt-2 flex flex-col gap-2"
            >
              <label className="flex items-center gap-2 cursor-pointer">
                <RadioGroupItem value="RUB" id="rail-rub" />
                <span>{t('partnerFinances_withdrawRailRub')}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <RadioGroupItem value="USDT" id="rail-usdt" />
                <span>{t('partnerFinances_withdrawRailUsdt')}</span>
              </label>
            </RadioGroup>
          </div>

          {profilesForRail.length > 1 ? (
            <div>
              <Label className="text-slate-700">{t('partnerFinances_withdrawRequisites')}</Label>
              <select
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                value={selectedProfileId || ''}
                onChange={(e) => setSelectedProfileId(e.target.value)}
              >
                {profilesForRail.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.method?.name || p.id}
                    {p.is_verified ? '' : ' (pending)'}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <PartnerPayoutPreviewFields
            t={t}
            language={language}
            preview={preview}
            loading={previewLoading}
            financesSummary={financesSummary}
            variant="dialog"
          />

          <div>
            <p className="font-medium text-slate-800">{t('partnerFinances_withdrawRequisites')}</p>
            {selectedProfile ? (
              <div className="mt-1 space-y-1 rounded-md bg-slate-50 border border-slate-100 p-3 text-sm text-slate-800">
                <p className="font-medium text-slate-900">{selectedProfile.method?.name || '—'}</p>
                {profileLines.map((line) => (
                  <p key={line} className="text-slate-700 break-all">
                    {line}
                  </p>
                ))}
                {!selectedProfile.is_verified ? (
                  <p className="text-amber-800 text-xs flex items-start gap-1">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    Pending verification
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="mt-1 text-amber-800 flex items-start gap-1">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                {t('partnerFinances_withdrawNoProfile')}
              </p>
            )}
            {!profilesForRail.length ? (
              <Button variant="outline" asChild className="w-full mt-2">
                <Link href="/partner/payout-profiles">{t('partnerFinances_withdrawLinkProfiles')}</Link>
              </Button>
            ) : null}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('partnerFinances_withdrawCancel')}
          </Button>
          <Button
            type="button"
            className="gap-2 bg-teal-600 hover:bg-teal-700"
            onClick={() =>
              void onConfirmWithdraw({
                payoutProfileId: selectedProfile?.id,
                amountThb: preview?.baseAmountThb ?? preview?.availableThb,
              })
            }
            disabled={
              withdrawSubmitting ||
              !partnerId ||
              partnerProfileVerified !== true ||
              !selectedProfile?.is_verified ||
              previewLoading ||
              !preview?.finalAmountThb
            }
          >
            {withdrawSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
            ) : null}
            {t('partnerFinances_withdrawConfirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
