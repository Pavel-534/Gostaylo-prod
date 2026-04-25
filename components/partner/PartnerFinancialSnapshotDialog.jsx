'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatPrice } from '@/lib/currency'
import { getUIText } from '@/lib/translations'

function moneyRow(label, valueThb, { muted = false, strong = false } = {}) {
  return (
    <div
      className={`flex justify-between gap-3 text-sm ${muted ? 'text-slate-500' : 'text-slate-800'} ${
        strong ? 'font-semibold text-base pt-2 border-t border-slate-200' : ''
      }`}
    >
      <span className="pr-2">{label}</span>
      <span className="tabular-nums shrink-0">{formatPrice(Number(valueThb) || 0, 'THB')}</span>
    </div>
  )
}

/**
 * Partner-facing breakdown from API `financial_snapshot` (read-model SSOT).
 */
export function PartnerFinancialSnapshotDialog({
  open,
  onOpenChange,
  snapshot,
  bookingTitle,
  bookingId,
  status,
  language = 'ru',
}) {
  const t = (k) => getUIText(k, language)
  if (!snapshot || typeof snapshot !== 'object') return null

  const sub = snapshot.subtotalThb ?? snapshot.gross ?? 0
  const guestFee = snapshot.guestServiceFeeThb ?? 0
  const hostComm = snapshot.hostCommissionThb ?? 0
  const plat = snapshot.platformMarginThb ?? 0
  const net = snapshot.partnerPayoutThb ?? snapshot.net ?? 0
  const guestPay = snapshot.guestPayableThb ?? 0
  const ins = snapshot.insuranceReserveThb ?? 0
  const roundPot = snapshot.roundingDiffPotThb ?? 0
  const platformFeesCombined = (Number(hostComm) || 0) + (Number(plat) || 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('partnerFinancial_dialogTitle')}</DialogTitle>
          <DialogDescription className="text-left space-y-1">
            <span className="block font-medium text-slate-800">{bookingTitle || '—'}</span>
            <span className="block text-xs font-mono text-slate-500">
              ID {bookingId || '—'} · {status || '—'}
            </span>
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-xl border border-teal-200 bg-gradient-to-b from-teal-50/80 to-white px-4 py-3 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-teal-900">
            {t('partnerFinancial_chainTitle')}
          </p>
          {guestPay > 0 ? moneyRow(t('partnerFinancial_chainGuestPays'), guestPay) : null}
          {guestFee > 0 ? moneyRow(t('partnerFinancial_guestServiceFee'), guestFee, { muted: true }) : null}
          {ins > 0 ? moneyRow(t('partnerFinancial_insuranceReserve'), ins, { muted: true }) : null}
          {platformFeesCombined > 0
            ? moneyRow(t('partnerFinancial_chainPlatformFees'), platformFeesCombined, { muted: true })
            : null}
          {moneyRow(t('partnerFinancial_netPayout'), net, { strong: true })}
        </div>
        <div className="rounded-xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white px-4 py-3 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
            {t('partnerFinancial_sectionPartner')}
          </p>
          {moneyRow(t('partnerFinancial_subtotal'), sub)}
          {guestFee > 0 ? moneyRow(t('partnerFinancial_guestServiceFee'), guestFee, { muted: true }) : null}
          {hostComm > 0 ? moneyRow(t('partnerFinancial_hostCommission'), hostComm) : null}
          {plat > 0 ? moneyRow(t('partnerFinancial_platformMargin'), plat, { muted: true }) : null}
          {ins > 0 ? moneyRow(t('partnerFinancial_insuranceReserve'), ins, { muted: true }) : null}
          {roundPot !== 0 ? moneyRow(t('partnerFinancial_roundingPot'), roundPot, { muted: true }) : null}
          {moneyRow(t('partnerFinancial_netPayout'), net, { strong: true })}
        </div>
        <div className="rounded-xl border border-teal-100 bg-teal-50/60 px-4 py-3 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-teal-900">
            {t('partnerFinancial_sectionGuest')}
          </p>
          {guestPay > 0 ? moneyRow(t('partnerFinancial_guestPayable'), guestPay) : null}
        </div>
        <p className="text-[11px] text-slate-500 leading-snug">{t('partnerFinancial_footnote')}</p>
      </DialogContent>
    </Dialog>
  )
}
