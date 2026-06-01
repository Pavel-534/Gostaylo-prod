'use client';



import { useCallback, useEffect, useState } from 'react';

import Link from 'next/link';

import {

  ArrowLeft,

  Download,

  ExternalLink,

  FileSpreadsheet,

  Landmark,

  Loader2,

  Megaphone,

  RefreshCw,

  Scale,

  Users,

  Wallet,

} from 'lucide-react';

import { toast } from 'sonner';

import { Button } from '@/components/ui/button';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { Badge } from '@/components/ui/badge';

import { AdminTableAmount } from '@/components/admin/AdminTableAmount';

import { BookingPlMoneyFlow } from '@/components/admin/finance-intelligence/BookingPlMoneyFlow';

import { cn } from '@/lib/utils';

import { GSL_FINTECH_HERO_GRADIENT } from '@/lib/theme/product-ui';



const REFERRAL_TYPE_LABELS = {

  referral_bonus: 'Бонус реферала',

  referral_clawback: 'Возврат (clawback)',

  referral_commission: 'Комиссия',

};



const REFERRAL_STATUS_LABELS = {

  earned: 'Начислено',

  earned_held: 'Удержано',

  withdrawn: 'Выведено',

  canceled: 'Отменено',

};



function DeepLinkCard({ href, icon: Icon, title, description }) {

  return (

    <Link

      href={href}

      className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-indigo-200 hover:shadow-md"

    >

      <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600">

        <Icon className="h-5 w-5" />

      </div>

      <div className="min-w-0 flex-1">

        <div className="font-medium text-sm text-slate-900 flex items-center gap-1">

          {title}

          <ExternalLink className="h-3.5 w-3.5 text-slate-400" />

        </div>

        <div className="text-xs text-slate-500 mt-0.5">{description}</div>

      </div>

    </Link>

  );

}



async function downloadPlPdf(bookingId) {
  const res = await fetch(
    `/api/admin/finance/intelligence/pdf?type=booking&bookingId=${encodeURIComponent(bookingId)}`,
    { credentials: 'include' },
  );
  if (!res.ok) throw new Error('PDF_EXPORT_FAILED');
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match?.[1] || `pl-${bookingId.slice(0, 8)}.pdf`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}



/**

 * @param {{ bookingId: string }} props

 */

export function BookingPlPage({ bookingId }) {

  const [loading, setLoading] = useState(true);

  const [report, setReport] = useState(null);



  const load = useCallback(async (fresh = false) => {

    setLoading(true);

    try {

      const q = fresh ? '?fresh=1' : '';

      const res = await fetch(

        `/api/admin/finance/intelligence/bookings/${encodeURIComponent(bookingId)}${q}`,

        { credentials: 'include' },

      );

      const json = await res.json();

      if (!res.ok || !json.success) throw new Error(json.error || 'PL_LOAD_FAILED');

      setReport(json.data);

    } catch (e) {

      toast.error(e?.message || 'Не удалось загрузить P&L');

    } finally {

      setLoading(false);

    }

  }, [bookingId]);



  useEffect(() => {

    load();

  }, [load]);



  const pl = report?.pl;

  const referralAttributionId = report?.fact?.referralAttributionId;



  return (

    <div className="min-h-screen bg-slate-50/90">

      <div className={cn('border-b border-slate-200/80', GSL_FINTECH_HERO_GRADIENT)}>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 text-white">

          <Link

            href="/admin/finance/intelligence"

            className="inline-flex items-center text-sm text-white/80 hover:text-white mb-3"

          >

            <ArrowLeft className="h-4 w-4 mr-1" />

            Финансовая аналитика

          </Link>

          <div className="flex flex-wrap items-start justify-between gap-4">

            <div>

              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">

                <Landmark className="h-7 w-7 text-white/70" />

                P&amp;L бронирования

              </h1>

              <p className="font-mono text-sm text-white/80 mt-1 break-all">{bookingId}</p>

              <div className="flex flex-wrap gap-2 mt-2">

                {report?.fact?.status ? (

                  <Badge className="bg-white/20 text-white border-white/30">{report.fact.status}</Badge>

                ) : null}

                {report?.fact?.categorySlug ? (

                  <Badge variant="outline" className="border-white/30 text-white/90">

                    {report.fact.categorySlug}

                  </Badge>

                ) : null}

              </div>

            </div>

            <div className="flex flex-wrap gap-2">

              <Button

                variant="secondary"

                size="sm"

                className="bg-white/10 text-white border-white/20 hover:bg-white/20"

                onClick={async () => {
                  try {
                    await downloadPlPdf(bookingId);
                    toast.success('PDF готов');
                  } catch {
                    toast.error('Не удалось сформировать PDF');
                  }
                }}
              >
                <Download className="h-4 w-4 mr-1" />
                PDF

              </Button>

              <Button

                variant="secondary"

                size="sm"

                onClick={() => load(true)}

                disabled={loading}

                className="bg-white/10 text-white border-white/20 hover:bg-white/20"

              >

                <RefreshCw className={cn('h-4 w-4 mr-1', loading && 'animate-spin')} />

                Обновить

              </Button>

            </div>

          </div>

        </div>

      </div>



      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {loading && !report ? (

          <div className="flex justify-center py-20 text-slate-500">

            <Loader2 className="h-8 w-8 animate-spin" />

          </div>

        ) : null}



        {report ? (

          <>

            <Card className="border-emerald-200/80 shadow-lg overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-white">

              <CardHeader className="pb-2">

                <CardDescription className="text-emerald-800/80 text-xs uppercase tracking-wide font-medium">

                  Итоговая маржа платформы

                </CardDescription>

                <CardTitle className="text-3xl font-bold text-emerald-950 tabular-nums flex items-baseline gap-2">

                  <AdminTableAmount value={pl?.netPlatformMarginThb} showPlus={false} className="text-3xl" />

                  <span className="text-sm font-normal text-slate-500">после реферала</span>

                </CardTitle>

              </CardHeader>

              <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3 pb-5 text-sm">

                <div>

                  <div className="text-[10px] uppercase text-slate-500">Оплата гостя</div>

                  <AdminTableAmount value={report.guest?.guestPayableThb} showPlus={false} />

                </div>

                <div>

                  <div className="text-[10px] uppercase text-slate-500">Маржа брутто</div>

                  <AdminTableAmount value={pl?.platformGrossMarginThb} showPlus={false} />

                </div>

                <div>

                  <div className="text-[10px] uppercase text-slate-500">Реферал</div>

                  <AdminTableAmount value={pl?.referralCostThb} showPlus={false} />

                </div>

                <div>

                  <div className="text-[10px] uppercase text-slate-500">Партнёру</div>

                  <AdminTableAmount value={pl?.partnerPayoutThb} showPlus={false} />

                </div>

              </CardContent>

            </Card>



            <Card className="border-slate-200/80 shadow-md">

              <CardHeader>

                <CardTitle className="text-base">Как деньги проходят по брони</CardTitle>

                <CardDescription>От оплаты гостя до выплаты партнёру</CardDescription>

              </CardHeader>

              <CardContent>

                <BookingPlMoneyFlow report={report} />

              </CardContent>

            </Card>



            <div className="grid gap-3 sm:grid-cols-2">

              <DeepLinkCard

                href={`/admin/bookings/${encodeURIComponent(bookingId)}`}

                icon={FileSpreadsheet}

                title="Карточка брони"

                description="Статус, гость, партнёр, переписка"

              />

              <DeepLinkCard

                href="/admin/financial-health"

                icon={Scale}

                title="Проводки (ledger)"

                description="Сверка и журнал платформы"

              />

              {referralAttributionId ? (

                <>

                <DeepLinkCard

                  href={`/admin/marketing/attribution?attributionId=${encodeURIComponent(referralAttributionId)}`}

                  icon={Users}

                  title="Реферальная цепочка"

                  description="Атрибуция и начисления"

                />

                <DeepLinkCard

                  href="/admin/marketing/roi#owner-guide"

                  icon={Megaphone}

                  title="Referral ROI"

                  description="Окупаемость кампаний и программы"

                />

                </>

              ) : (

                <DeepLinkCard

                  href="/admin/marketing/budget"

                  icon={Wallet}

                  title="Реферальный бюджет"

                  description="Promo tank и ledger"

                />

              )}

            </div>



            <div className="grid gap-4 md:grid-cols-2">

              <Card className="border-slate-200/80 shadow-sm">

                <CardHeader>

                  <CardTitle className="text-base">Разбивка по юрисдикциям</CardTitle>

                  <CardDescription>RU / KG / FX из снимка цены</CardDescription>

                </CardHeader>

                <CardContent className="space-y-2 text-sm">

                  {[

                    ['Агентство (RU)', report.jurisdiction?.ruFeeThb],

                    ['Сервис (KG)', report.jurisdiction?.krFeeThb],

                    ['Наценка FX', report.jurisdiction?.fxMarkupThb],

                    ['Пул маржи', report.jurisdiction?.platformMarginPoolThb],

                  ].map(([label, val]) => (

                    <div key={label} className="flex justify-between border-b border-slate-100 pb-2 last:border-0">

                      <span className="text-slate-600">{label}</span>

                      <AdminTableAmount value={val} showPlus={false} />

                    </div>

                  ))}

                </CardContent>

              </Card>



              <Card className="border-slate-200/80 shadow-sm">

                <CardHeader>

                  <CardTitle className="text-base">Справка</CardTitle>

                  <CardDescription>Снимок v{report.snapshot?.version ?? 0}</CardDescription>

                </CardHeader>

                <CardContent className="text-xs text-slate-600 space-y-2">

                  <p>Проводки в ledger: {report.ledger?.capturePosted ? 'да' : 'нет'}</p>

                  <p>
                    Оборот (тариф):{' '}
                    <span className="font-medium">
                      ฿{(report.fact?.subtotalThb || 0).toLocaleString('ru-RU')}
                    </span>
                  </p>

                  <p>Партнёр: <span className="font-mono">{report.partner?.partnerId?.slice(0, 16) || '—'}…</span></p>

                  <p>Создано: {report.fact?.createdAt ? new Date(report.fact.createdAt).toLocaleString('ru-RU') : '—'}</p>

                </CardContent>

              </Card>

            </div>



            {(report.referral?.rows || []).length > 0 ? (

              <Card className="border-slate-200/80 shadow-sm">

                <CardHeader>

                  <CardTitle className="text-base">Реферальные начисления</CardTitle>

                  <CardDescription>Строки referral ledger по брони</CardDescription>

                </CardHeader>

                <CardContent>

                  <div className="overflow-x-auto rounded-lg border border-slate-200">

                    <table className="w-full text-sm">

                      <thead className="bg-slate-50 text-slate-500 text-xs uppercase">

                        <tr>

                          <th className="text-left px-3 py-2.5">Тип</th>

                          <th className="text-left px-3 py-2.5">Статус</th>

                          <th className="text-right px-3 py-2.5">Сумма</th>

                        </tr>

                      </thead>

                      <tbody>

                        {report.referral.rows.map((r) => (

                          <tr key={r.id} className="border-t border-slate-100 even:bg-slate-50/50">

                            <td className="px-3 py-2.5 text-slate-800">

                              {REFERRAL_TYPE_LABELS[r.txType] || r.txType}

                            </td>

                            <td className="px-3 py-2.5">

                              <Badge variant="outline" className="text-[10px]">

                                {REFERRAL_STATUS_LABELS[r.status] || r.status}

                              </Badge>

                            </td>

                            <td className="px-3 py-2.5 text-right font-medium">

                              <AdminTableAmount value={r.amountThb} showPlus={false} />

                            </td>

                          </tr>

                        ))}

                      </tbody>

                    </table>

                  </div>

                </CardContent>

              </Card>

            ) : null}



            {report.ledger?.legs?.length > 0 ? (

              <Card className="border-slate-200/80 shadow-sm">

                <CardHeader>

                  <CardTitle className="text-base">Проводки (ledger)</CardTitle>

                  <CardDescription>

                    {(report.ledger.journals || []).map((j) => j.eventType).join(' · ')}

                  </CardDescription>

                </CardHeader>

                <CardContent>

                  <div className="overflow-x-auto rounded-lg border border-slate-200">

                    <table className="w-full text-sm">

                      <thead className="bg-slate-50 text-slate-500 text-xs uppercase">

                        <tr>

                          <th className="text-left px-3 py-2.5">Сторона</th>

                          <th className="text-left px-3 py-2.5">Счёт</th>

                          <th className="text-right px-3 py-2.5">THB</th>

                          <th className="text-right px-3 py-2.5">RUB</th>

                        </tr>

                      </thead>

                      <tbody>

                        {report.ledger.legs.map((leg) => (

                          <tr

                            key={leg.id}

                            className={cn(

                              'border-t border-slate-100 font-mono text-xs',

                              leg.side === 'DEBIT' ? 'bg-rose-50/30' : 'bg-emerald-50/30',

                            )}

                          >

                            <td className="px-3 py-2.5">

                              <Badge

                                variant="outline"

                                className={cn(

                                  'text-[10px]',

                                  leg.side === 'DEBIT' ? 'border-rose-200 text-rose-800' : 'border-emerald-200 text-emerald-800',

                                )}

                              >

                                {leg.side === 'DEBIT' ? 'Дебет' : 'Кредит'}

                              </Badge>

                            </td>

                            <td className="px-3 py-2.5 text-slate-700">

                              {leg.accountCode || leg.accountName || leg.accountId?.slice(0, 10)}

                            </td>

                            <td className="px-3 py-2.5 text-right font-semibold">{leg.amountThb}</td>

                            <td className="px-3 py-2.5 text-right text-slate-500">{leg.amountRub ?? '—'}</td>

                          </tr>

                        ))}

                      </tbody>

                    </table>

                  </div>

                </CardContent>

              </Card>

            ) : null}



            {report.generatedAt ? (

              <p className="text-xs text-slate-400 text-center pb-8">

                Обновлено {new Date(report.generatedAt).toLocaleString('ru-RU')}

              </p>

            ) : null}

          </>

        ) : null}

      </div>

    </div>

  );

}



export default BookingPlPage;

