'use client'

import Link from 'next/link'
import { format } from 'date-fns'
import { Clock } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatPrice } from '@/lib/currency'

export function PartnerFinancesLedger({ t, balanceBreakdown }) {
  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-5 w-5 text-slate-600 shrink-0" />
          {t('partnerFinances_ledgerTitle')}
        </CardTitle>
        <CardDescription>{t('partnerFinances_ledgerDesc')}</CardDescription>
      </CardHeader>
      <CardContent>
        {!balanceBreakdown?.recentLedgerTransactions?.length ? (
          <p className="text-sm text-slate-500 py-2">{t('partnerFinances_ledgerEmpty')}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 -mx-0">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="bg-slate-50 text-slate-600 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium whitespace-nowrap">{t('partnerFinances_ledgerColDate')}</th>
                  <th className="px-3 py-2 font-medium">{t('partnerFinances_ledgerColEvent')}</th>
                  <th className="px-3 py-2 font-medium">{t('partnerFinances_ledgerColSide')}</th>
                  <th className="px-3 py-2 font-medium text-right">{t('partnerFinances_ledgerColThb')}</th>
                  <th className="px-3 py-2 font-medium">{t('partnerFinances_ledgerColBooking')}</th>
                  <th className="px-3 py-2 font-medium">{t('partnerFinances_ledgerColNote')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {balanceBreakdown.recentLedgerTransactions.map((row) => (
                  <tr key={row.entryId || `${row.journalId}-${row.createdAt}`} className="hover:bg-slate-50/80">
                    <td className="px-3 py-2 whitespace-nowrap text-slate-700">
                      {row.createdAt ? format(new Date(row.createdAt), 'dd.MM.yyyy HH:mm') : '—'}
                    </td>
                    <td className="px-3 py-2 text-slate-800 font-mono text-xs">{row.eventType || '—'}</td>
                    <td className="px-3 py-2">{row.side || '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">
                      {formatPrice(row.amountThb ?? 0, 'THB')}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {row.bookingId ? (
                        <Link
                          href={`/partner/bookings?booking=${encodeURIComponent(String(row.bookingId))}`}
                          className="text-teal-700 hover:underline"
                          title={row.bookingId}
                        >
                          {String(row.bookingId).slice(0, 8)}…
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-600 max-w-[240px] truncate" title={row.description || ''}>
                      {row.description || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
