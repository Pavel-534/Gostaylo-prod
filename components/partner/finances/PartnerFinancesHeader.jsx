'use client'

import { Download, Wallet } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatPrice } from '@/lib/currency'

export function PartnerFinancesHeader({
  t,
  balanceBreakdown,
  bookingsLength,
  onExportCsv,
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between min-w-0">
      <div className="min-w-0">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">{t('financesTitle')}</h1>
        <p className="text-slate-600 mt-1 text-sm sm:text-base">{t('financesDesc')}</p>
      </div>
      {balanceBreakdown && (
        <Card className="border-teal-100 bg-teal-50/50 w-full sm:max-w-md">
          <CardHeader className="py-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Wallet className="h-4 w-4 text-teal-700" />
              {t('partnerFinances_escrowCardTitle')}
            </CardTitle>
            <CardDescription className="text-xs">{t('partnerFinances_escrowCardDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="pt-0 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">{t('partnerFinances_escrowFrozenLabel')}</span>
              <span className="font-semibold">{formatPrice(balanceBreakdown.frozenBalanceThb ?? 0, 'THB')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">{t('partnerFinances_escrowAvailableLabel')}</span>
              <span className="font-semibold text-teal-800">
                {formatPrice(balanceBreakdown.availableBalanceThb ?? 0, 'THB')}
              </span>
            </div>
            {balanceBreakdown.byCategory && Object.keys(balanceBreakdown.byCategory).length > 0 && (
              <div className="pt-2 border-t border-teal-100 text-xs text-slate-600 space-y-1">
                <p className="font-medium text-slate-700">{t('partnerFinances_escrowByCategory')}</p>
                {Object.entries(balanceBreakdown.byCategory).map(([slug, row]) => (
                  <div key={slug} className="flex justify-between gap-2">
                    <span className="truncate">{slug}</span>
                    <span>
                      {t('partnerFinances_escrowFrozenShort')} {formatPrice(row.frozenThb ?? 0, 'THB')} /{' '}
                      {t('partnerFinances_escrowAvailableShort')} {formatPrice(row.availableThb ?? 0, 'THB')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
      <Button
        onClick={onExportCsv}
        variant="outline"
        disabled={bookingsLength === 0}
        className="gap-2 shrink-0 self-start sm:self-auto"
      >
        <Download className="h-4 w-4" />
        {t('exportCSV')}
      </Button>
    </div>
  )
}
