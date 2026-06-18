'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { useDebounce } from '@/lib/hooks/useListingsSearch'
import { fetchLocationSuggest } from '@/lib/api/catalog-public-client'
import { PHUKET_DISTRICTS_CANON } from '@/lib/locations/phuket-districts-canonical'

const TARGET_TYPES = [
  { value: 'district', label: 'Район (district)' },
  { value: 'city', label: 'Город (city)' },
  { value: 'region', label: 'Регион (region)' },
]

/**
 * @param {{
 *   open: boolean,
 *   onOpenChange: (open: boolean) => void,
 *   suggestion: object | null,
 *   processing: boolean,
 *   onConfirm: (payload: { target_code: string, target_type: string }) => void,
 * }} props
 */
export function LocationMergeDialog({
  open,
  onOpenChange,
  suggestion,
  processing,
  onConfirm,
}) {
  const [targetCode, setTargetCode] = useState('')
  const [targetType, setTargetType] = useState('district')
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [suggestItems, setSuggestItems] = useState([])

  const debouncedCode = useDebounce(targetCode, 280)

  useEffect(() => {
    if (!open || !suggestion) return
    setTargetCode('')
    setTargetType(suggestion.kind === 'city' ? 'city' : 'district')
    setSuggestItems([])
  }, [open, suggestion?.id])

  useEffect(() => {
    if (!open) return
    const q = debouncedCode.trim()
    if (q.length < 2) {
      setSuggestItems([])
      return
    }

    let cancelled = false
    setSuggestLoading(true)
    fetchLocationSuggest({ q, lang: 'ru', limit: 8 })
      .then((res) => {
        if (cancelled) return
        setSuggestItems(res.items || [])
      })
      .catch(() => {
        if (!cancelled) setSuggestItems([])
      })
      .finally(() => {
        if (!cancelled) setSuggestLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [debouncedCode, open])

  const presetHints = useMemo(() => {
    const q = targetCode.trim().toLowerCase()
    if (!q) return PHUKET_DISTRICTS_CANON.slice(0, 6)
    return PHUKET_DISTRICTS_CANON.filter((d) => d.toLowerCase().includes(q)).slice(0, 8)
  }, [targetCode])

  const canSubmit = targetCode.trim().length > 0 && !processing

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Слияние локации</DialogTitle>
          <DialogDescription>
            «{suggestion?.raw_term}» → канонический код в справочнике и синонимах.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="merge-target-code">Канонический код (target_code)</Label>
            <Input
              id="merge-target-code"
              value={targetCode}
              onChange={(e) => setTargetCode(e.target.value)}
              placeholder="Например: Chalong, phuket-city"
              autoComplete="off"
            />
            {suggestLoading ? (
              <p className="flex items-center gap-2 text-xs text-slate-500">
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                Поиск подсказок…
              </p>
            ) : null}
            {(suggestItems.length > 0 || presetHints.length > 0) && (
              <ul className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-1">
                {[...suggestItems.map((i) => ({ key: i.value, label: i.label, value: i.value })),
                  ...presetHints
                    .filter((p) => !suggestItems.some((s) => s.value === p))
                    .map((p) => ({ key: `preset-${p}`, label: p, value: p })),
                ].slice(0, 10).map((item) => (
                  <li key={item.key}>
                    <button
                      type="button"
                      className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-white"
                      onClick={() => {
                        setTargetCode(item.value)
                        setSuggestItems([])
                      }}
                    >
                      <span className="font-medium">{item.label}</span>
                      {item.label !== item.value ? (
                        <span className="ml-2 text-xs text-slate-500">{item.value}</span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-2">
            <Label>Тип цели (target_type)</Label>
            <Select value={targetType} onValueChange={setTargetType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TARGET_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {suggestion ? (
            <p className="rounded-lg bg-brand/5 px-3 py-2 text-xs text-slate-600">
              Будет обновлено объявлений:{' '}
              <strong className="text-slate-900">{suggestion.listings_count ?? 0}</strong>
              {targetCode.trim() ? (
                <>
                  {' '}
                  → <strong className="font-mono">{targetType}</strong> «
                  <strong>{targetCode.trim()}</strong>»
                </>
              ) : null}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={processing}>
            Отмена
          </Button>
          <Button
            type="button"
            variant="brand"
            disabled={!canSubmit}
            onClick={() =>
              onConfirm({
                target_code: targetCode.trim(),
                target_type: targetType,
              })
            }
          >
            {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Подтвердить merge
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
