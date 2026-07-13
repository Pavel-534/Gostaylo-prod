'use client'

import Link from 'next/link'
import { format } from 'date-fns'
import { Clock } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PartnerHostLedgerAmount } from '@/components/partner/finances/partner-host-amount-display'

export function PartnerFinancesLedger({ t, balanceBreakdown, language = 'ru' }) {
  const rows = balanceBreakdown?.recentLedgerTransactions || []

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
        {!rows.length ? (
          <p className="text-sm text-slate-500 py-2">{t('partnerFinances_ledgerEmpty')}</p>
        ) : (
          <>
            <div className="md:hidden space-y-3 min-w-0">
              {rows.map((row) => (
                <div
                  key={row.entryId || `${row.journalId}-${row.createdAt}`}
                  className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 space-y-2 text-sm min-w-0"
                >
                  <div className="flex items-start justify-between gap-2 min-w-0">
                    <span className="text-slate-500 text-xs shrink-0">
                      {row.createdAt ? format(new Date(row.createdAt), 'dd.MM.yyyy HH:mm') : '—'}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-wide text-slate-500 truncate max-w-[55%] text-right">
                      {row.eventType || '—'}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-1.5 text-xs sm:text-sm">
                    <div className="flex justify-between gap-2 min-w-0">
                      <span className="text-slate-500 shrink-0">{t('partnerFinances_ledgerColSide')}</span>
                      <span className="text-right break-words">{row.side || '—'}</span>
                    </div>
                    <div className="flex justify-between gap-2 min-w-0">
                      <span className="text-slate-500 shrink-0">{t('partnerFinances_ledgerColThb')}</span>
                      <span className="tabular-nums font-semibold text-right break-all">
                        <PartnerHostLedgerAmount thb={row.amountThb ?? 0} />
                      </span>
                    </div>
                    <div className="flex justify-between gap-2 min-w-0">
                      <span className="text-slate-500 shrink-0">{t('partnerFinances_ledgerColBooking')}</span>
                      <span className="font-mono text-xs text-right break-all">
                        {row.bookingId ? (
                          <Link
                            href={`/partner/bookings?booking=${encodeURIComponent(String(row.bookingId))}`}
                            className="inline-flex min-h-11 items-center text-brand-hover hover:underline"
                          >
                            {String(row.bookingId).slice(0, 8)}…
                          </Link>
                        ) : (
                          '—'
                        )}
                      </span>
                    </div>
                    {row.description ? (
                      <p className="pt-1 border-t border-slate-200 text-slate-600 text-xs leading-relaxed break-words">
                        {row.description}
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden md:block overflow-x-auto rounded-lg border border-slate-200 -mx-0">
              <table className="w-full text-sm min-w-[640px]">
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
                  {rows.map((row) => (
                    <tr key={row.entryId || `${row.journalId}-${row.createdAt}`} className="hover:bg-slate-50/80">
                      <td className="px-3 py-2 whitespace-nowrap text-slate-700">
                        {row.createdAt ? format(new Date(row.createdAt), 'dd.MM.yyyy HH:mm') : '—'}
                      </td>
                      <td className="px-3 py-2 text-slate-800 font-mono text-xs">{row.eventType || '—'}</td>
                      <td className="px-3 py-2">{row.side || '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">
                        <PartnerHostLedgerAmount thb={row.amountThb ?? 0} />
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {row.bookingId ? (
                          <Link
                            href={`/partner/bookings?booking=${encodeURIComponent(String(row.bookingId))}`}
                            className="text-brand-hover hover:underline"
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
          </>
        )}
      </CardContent>
    </Card>
  )
}
