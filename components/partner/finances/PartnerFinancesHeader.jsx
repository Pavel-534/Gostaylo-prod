'use client'

import { PageSectionHeader } from '@/components/product/PageSectionHeader'
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
    <div className="space-y-4 min-w-0">
      <PageSectionHeader
        title={t('financesTitle')}
        subtitle={t('financesDesc')}
        action={
          <Button
            onClick={onExportCsv}
            variant="outline"
            disabled={bookingsLength === 0}
            className="gap-2 shrink-0 self-start sm:self-auto"
          >
            <Download className="h-4 w-4" />
            {t('exportCSV')}
          </Button>
        }
      />
      {balanceBreakdown ? (
        <Card className="border-brand/20 bg-brand/10 w-full sm:max-w-md">
          <CardHeader className="py-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Wallet className="h-4 w-4 text-brand-hover" />
              {t('partnerFinances_escrowCardTitle')}
            </CardTitle>
            <CardDescription className="text-xs">{t('partnerFinances_escrowCardDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="pt-0 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">{t('partnerFinances_escrowFrozenLabel')}</span>
              <span className="font-semibold">{formatPrice(balanceBreakdown.frozenBalanceThb ?? 0, 'THB')}</span>
            </div>
            {(balanceBreakdown.thawHoldBalanceThb ?? 0) > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-600">{t('partnerFinances_bucketThawHoldTitle')}</span>
                <span className="font-semibold text-cyan-800">
                  {formatPrice(balanceBreakdown.thawHoldBalanceThb ?? 0, 'THB')}
                </span>
              </div>
            )}
            {(balanceBreakdown.disputeHoldBalanceThb ?? 0) > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-600">{t('partnerFinances_bucketDisputeTitle')}</span>
                <span className="font-semibold text-rose-800">
                  {formatPrice(balanceBreakdown.disputeHoldBalanceThb ?? 0, 'THB')}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-600">{t('partnerFinances_escrowAvailableLabel')}</span>
              <span className="font-semibold text-brand-hover">
                {formatPrice(balanceBreakdown.availableBalanceThb ?? 0, 'THB')}
              </span>
            </div>
            {balanceBreakdown.byCategory && Object.keys(balanceBreakdown.byCategory).length > 0 && (
              <div className="pt-2 border-t border-brand/20 text-xs text-slate-600 space-y-1">
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
      ) : null}
    </div>
  )
}
