'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ReferralMonthlyLeaderboard } from '@/components/referral/ReferralMonthlyLeaderboard'
import { ReferralMiniSparkline } from '@/components/referral/ReferralMiniSparkline'
import { ReferralWithdrawalHistory } from '@/components/referral/ReferralWithdrawalHistory'

function formatThb(value, locale = 'ru-RU') {
  const n = Number(value)
  if (!Number.isFinite(n)) return '0'
  return n.toLocaleString(locale, { maximumFractionDigits: 2 })
}

export function ReferralProfileTabHistory({ data, walletData, t, locale }) {
  const recentTransactions = Array.isArray(walletData?.recentTransactions) ? walletData.recentTransactions : []

  function txTypeLabel(v) {
    const x = String(v || '').toLowerCase()
    if (x === 'referral_bonus') return t('stage1143_txReferralBonus')
    if (x === 'referral_cashback') return t('stage1143_txCashback')
    if (x === 'welcome_bonus') return t('stage1143_txWelcome')
    return t('stage1143_txOther')
  }

  return (
    <div className="space-y-6">
      <ReferralWithdrawalHistory walletData={walletData} t={t} locale={locale} />
      <ReferralMonthlyLeaderboard t={t} locale={locale} formatThb={(n) => formatThb(n, locale)} />

      {Array.isArray(data?.stats?.sparkMonthlyYtdThb) && data.stats.sparkMonthlyYtdThb.length > 1 ? (
        <Card className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">{t('stage73_statYearlyEarned')}</CardTitle>
            <CardDescription>{t('stage73_referralStatsTzHint')}</CardDescription>
          </CardHeader>
          <CardContent>
            <ReferralMiniSparkline values={data.stats.sparkMonthlyYtdThb} height={56} />
            <p className="text-2xl font-semibold text-[#006666] mt-4 tabular-nums">
              {formatThb(data?.stats?.yearlyEarnedThb, locale)} THB
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">{t('stage1143_walletOpsTitle')}</CardTitle>
          <CardDescription>{t('stage1143_walletOpsSubtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          {!recentTransactions.length ? (
            <p className="text-sm text-slate-600">{t('stage1143_walletOpsEmpty')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th className="py-2 pr-3 font-medium">{t('stage1143_txType')}</th>
                    <th className="py-2 pr-3 font-medium">THB</th>
                    <th className="py-2 font-medium">{t('stage1143_txDate')}</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTransactions.slice(0, 20).map((tx) => (
                    <tr key={tx.id} className="border-b last:border-0">
                      <td className="py-2 pr-3">{txTypeLabel(tx.tx_type)}</td>
                      <td className="py-2 pr-3 tabular-nums font-medium text-[#006666]">
                        {Number(tx.amount_thb || 0) >= 0 ? '+' : ''}
                        {formatThb(tx.amount_thb, locale)}
                      </td>
                      <td className="py-2 text-slate-500">
                        {tx.created_at ? new Date(tx.created_at).toLocaleDateString(locale) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
