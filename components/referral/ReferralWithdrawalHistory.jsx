'use client'

import Link from 'next/link'
import { ArrowDownLeft, Clock, History } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ReferralLedgerAmount } from '@/components/referral/ReferralLedgerAmount'

function formatWhen(iso, locale) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(locale)
  } catch {
    return iso
  }
}

function rowStatusLabel(row, t) {
  const s = String(row.status || '').toLowerCase()
  if (row.kind === 'request' && s === 'withdrawable_referral') {
    return { label: t('stage1146_withdrawStatusPending'), tone: 'amber' }
  }
  if (s.includes('paid')) return { label: t('stage1146_withdrawStatusPaid'), tone: 'teal' }
  if (row.kind === 'debit') return { label: t('stage1146_withdrawStatusDebited'), tone: 'slate' }
  return { label: row.status || '—', tone: 'slate' }
}

/**
 * Stage 114.5 / 114.6 — история заявок и дебетов withdrawable (SSOT wallet/me).
 */
export function ReferralWithdrawalHistory({ walletData, t, locale }) {
  const payout = walletData?.payout || {}
  const txs = Array.isArray(walletData?.recentTransactions) ? walletData.recentTransactions : []

  const withdrawalRows = []

  if (payout?.referralWithdrawalStatus) {
    withdrawalRows.push({
      id: 'current-request',
      kind: 'request',
      amountThb: Number(payout.referralWithdrawalAmountThb || payout.withdrawableBalanceThb || 0),
      status: payout.referralWithdrawalStatus,
      at: payout.referralWithdrawalRequestedAt,
    })
  }

  for (const tx of txs) {
    if (String(tx?.operation_type || '').toLowerCase() !== 'debit') continue
    const txType = String(tx?.tx_type || '').toLowerCase()
    const ref = String(tx?.reference_id || '').toLowerCase()
    const isReferralOut =
      txType.includes('referral') ||
      ref.includes('referral_withdraw') ||
      ref.includes('referral_payout')
    if (!isReferralOut) continue
    withdrawalRows.push({
      id: tx.id,
      kind: 'debit',
      amountThb: Number(tx.amount_thb || 0),
      status: tx.tx_type || 'debit',
      at: tx.created_at,
    })
  }

  return (
    <Card className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <History className="h-4 w-4 text-brand" />
          {t('stage1145_withdrawHistoryTitle')}
        </CardTitle>
        <CardDescription>{t('stage1145_withdrawHistorySubtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        {withdrawalRows.length === 0 ? (
          <div className="text-center py-8 text-sm text-slate-500 space-y-3">
            <p>{t('stage1146_withdrawHistoryEmpty')}</p>
            <Button type="button" variant="outline" size="sm" asChild className="min-h-[44px]">
              <Link href="/profile/wallet">{t('stage1143_tabNavWallet')}</Link>
            </Button>
          </div>
        ) : (
          <ul className="space-y-2 text-sm">
            {withdrawalRows.map((row) => {
              const st = rowStatusLabel(row, t)
              const toneClass =
                st.tone === 'amber'
                  ? 'border-amber-200 bg-amber-50/80'
                  : st.tone === 'teal'
                    ? 'border-brand/25 bg-brand/10'
                    : 'border-slate-100 bg-slate-50/80'
              return (
                <li
                  key={row.id}
                  className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-3 py-3 ${toneClass}`}
                >
                  <div className="flex items-start gap-2 min-w-0">
                    {row.kind === 'request' ? (
                      <Clock className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                    ) : (
                      <ArrowDownLeft className="h-4 w-4 text-slate-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-semibold text-slate-900 break-words">
                        <ReferralLedgerAmount thb={row.amountThb} />
                      </p>
                      <p className="text-xs text-slate-500">{formatWhen(row.at, locale)}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] uppercase tracking-wide shrink-0">
                    {st.label}
                  </Badge>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
