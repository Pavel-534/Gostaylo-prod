'use client';



import {

  Bar,

  BarChart,

  ResponsiveContainer,

  Tooltip,

  XAxis,

  YAxis,

} from 'recharts';

import { ChevronRight } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { cn } from '@/lib/utils';



/**

 * @param {{

 *   rollup?: { rows?: Array<{ categorySlug: string, gmvThb: number, platformMarginThb: number, gmvSharePct: number, bookingsCount: number }> },

 *   onSelectCategory?: (categorySlug: string) => void,

 * }} props

 */

export function CategoryRollupPanel({ rollup, onSelectCategory }) {

  const rows = rollup?.rows || [];

  const chartData = rows.slice(0, 8).map((r) => ({

    slug: String(r.categorySlug).length > 14 ? `${r.categorySlug.slice(0, 12)}…` : r.categorySlug,

    gmvThb: r.gmvThb,

    marginThb: r.platformMarginThb,

    share: r.gmvSharePct,

  }));



  if (!rows.length) {

    return (

      <Card className="border-slate-200/80 shadow-sm">

        <CardHeader>

          <CardTitle className="text-base">Оборот по вертикалям</CardTitle>

        </CardHeader>

        <CardContent className="text-sm text-slate-500 py-8 text-center">

          Нет данных за период

        </CardContent>

      </Card>

    );

  }



  return (

    <Card className="border-slate-200/80 shadow-sm">

      <CardHeader>

        <CardTitle className="text-base">Оборот по вертикалям</CardTitle>

        <CardDescription>

          Категории объявлений · клик по строке → брони этой вертикали

        </CardDescription>

      </CardHeader>

      <CardContent>

        <div className="h-48 mb-4">

          <ResponsiveContainer width="100%" height="100%">

            <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>

              <XAxis dataKey="slug" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={50} />

              <YAxis tick={{ fontSize: 10 }} width={40} />

              <Tooltip

                formatter={(v, name) => [

                  `฿${Number(v).toLocaleString('ru-RU', { maximumFractionDigits: 0 })}`,

                  name === 'gmvThb' ? 'Оборот' : 'Маржа',

                ]}

              />

              <Bar dataKey="gmvThb" name="Оборот" fill="#6366f1" radius={[4, 4, 0, 0]} />

              <Bar dataKey="marginThb" name="Маржа" fill="#059669" radius={[4, 4, 0, 0]} />

            </BarChart>

          </ResponsiveContainer>

        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200">

          <table className="w-full text-xs">

            <thead className="bg-slate-50 text-slate-500">

              <tr>

                <th className="text-left px-3 py-2">Вертикаль</th>

                <th className="text-right px-3 py-2">Брони</th>

                <th className="text-right px-3 py-2">Оборот</th>

                <th className="text-right px-3 py-2">Маржа</th>

                <th className="text-right px-3 py-2">% оборота</th>

                <th className="w-8" />

              </tr>

            </thead>

            <tbody>

              {rows.map((r) => (

                <tr

                  key={r.categorySlug}

                  className={cn(

                    'border-t border-slate-100',

                    onSelectCategory && 'cursor-pointer hover:bg-indigo-50/60 transition',

                  )}

                  onClick={() => onSelectCategory?.(r.categorySlug)}

                >

                  <td className="px-3 py-2 font-mono">{r.categorySlug}</td>

                  <td className="px-3 py-2 text-right">{r.bookingsCount}</td>

                  <td className="px-3 py-2 text-right tabular-nums">

                    ฿{r.gmvThb.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}

                  </td>

                  <td className="px-3 py-2 text-right tabular-nums">

                    ฿{r.platformMarginThb.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}

                  </td>

                  <td className="px-3 py-2 text-right">{r.gmvSharePct}%</td>

                  <td className="px-2 py-2 text-slate-400">

                    {onSelectCategory ? <ChevronRight className="h-4 w-4" /> : null}

                  </td>

                </tr>

              ))}

            </tbody>

          </table>

        </div>

      </CardContent>

    </Card>

  );

}



export default CategoryRollupPanel;

