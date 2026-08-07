'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LocationSuggestionContextChip } from '@/components/admin/locations/LocationSuggestionContextChip'
import { cn } from '@/lib/utils'
import { MOBILE_FLAT_CARD_CLASS } from '@/lib/ui/mobile-flat-canvas'

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })
}

/**
 * @param {{
 *   rows: object[],
 *   canResolve: boolean,
 *   processingId: string | null,
 *   onMerge: (row: object) => void,
 *   onReject: (row: object) => void,
 * }} props
 */
export function LocationSuggestionsTable({
  rows,
  canResolve,
  processingId,
  onMerge,
  onReject,
}) {
  return (
    <>
      <div className="sm:hidden space-y-0" data-testid="location-suggestions-mobile">
        {rows.map((row) => {
          const busy = processingId === row.id
          const count = row.listings_count ?? 0
          return (
            <div
              key={row.id}
              className={cn(MOBILE_FLAT_CARD_CLASS, 'border-b border-slate-100 py-3')}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900">{row.raw_term}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="capitalize">
                      {row.kind || 'district'}
                    </Badge>
                    <LocationSuggestionContextChip row={row} />
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Объявлений:{' '}
                    <span className={count >= 3 ? 'font-semibold text-brand' : 'text-slate-700'}>
                      {count}
                    </span>
                    {' · '}
                    {formatDate(row.created_at)}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-col gap-2">
                <Button
                  type="button"
                  variant="brand"
                  className="min-h-[44px] w-full"
                  disabled={!canResolve || busy}
                  title={!canResolve ? 'Только ADMIN' : undefined}
                  onClick={() => onMerge(row)}
                >
                  Мерж
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-[44px] w-full"
                  disabled={!canResolve || busy}
                  title={!canResolve ? 'Только ADMIN' : undefined}
                  onClick={() => onReject(row)}
                >
                  Отклонить
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white sm:block">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Термин</th>
              <th className="px-4 py-3">Тип</th>
              <th className="px-4 py-3">Контекст</th>
              <th className="px-4 py-3 text-right">Объявления</th>
              <th className="px-4 py-3">Создано</th>
              <th className="px-4 py-3 text-right">Действия</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const busy = processingId === row.id
              const count = row.listings_count ?? 0
              return (
                <tr key={row.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-semibold text-slate-900">{row.raw_term}</td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary" className="capitalize">
                      {row.kind || 'district'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <LocationSuggestionContextChip row={row} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span className={count >= 3 ? 'font-semibold text-brand' : 'text-slate-700'}>
                      {count}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDate(row.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="brand"
                        className="min-h-[44px]"
                        disabled={!canResolve || busy}
                        title={!canResolve ? 'Только ADMIN' : undefined}
                        onClick={() => onMerge(row)}
                      >
                        Мерж
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="min-h-[44px]"
                        disabled={!canResolve || busy}
                        title={!canResolve ? 'Только ADMIN' : undefined}
                        onClick={() => onReject(row)}
                      >
                        Отклонить
                      </Button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
