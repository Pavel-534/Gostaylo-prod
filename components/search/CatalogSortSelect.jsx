'use client'

import { useState } from 'react'
import { ArrowUpDown } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Button } from '@/components/ui/button'
import { getUIText } from '@/lib/translations'
import { cn } from '@/lib/utils'
import { CATALOG_SORT_LABEL_KEYS, listCatalogSortValues } from '@/lib/search/catalog-sort-ui'

export function CatalogSortSelect({
  value = 'recommended',
  onChange,
  language = 'ru',
  distanceDisabled = false,
  className,
}) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const options = listCatalogSortValues({ distanceDisabled })

  const handlePick = (next) => {
    const sortKey = String(next || '').trim()
    if (!sortKey) return
    onChange?.(sortKey)
    setSheetOpen(false)
  }

  return (
    <div className={className}>
      <div className="md:hidden">
        <Button
          type="button"
          variant="outline"
          aria-haspopup="dialog"
          aria-expanded={sheetOpen}
          aria-label={getUIText('catalogSortLabel', language)}
          data-testid="catalog-sort-sheet-trigger"
          className="min-h-[44px] min-w-[44px] rounded-2xl px-0"
          onClick={() => setSheetOpen(true)}
        >
          <ArrowUpDown className="h-4 w-4" aria-hidden />
        </Button>
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent
            side="bottom"
            fit="content"
            data-testid="catalog-sort-sheet"
            className="gap-0 rounded-t-2xl border-t border-slate-200 p-0 shadow-2xl"
          >
            <div className="flex justify-center pt-2" aria-hidden>
              <div className="h-1 w-12 rounded-full bg-slate-300" />
            </div>
            <SheetHeader className="space-y-0 px-4 pb-2 pt-1 pr-14 text-left">
              <SheetTitle className="text-lg font-semibold tracking-tight">
                {getUIText('catalogSortSheetTitle', language)}
              </SheetTitle>
            </SheetHeader>
            <RadioGroup
              value={value}
              onValueChange={handlePick}
              className="gap-0 overflow-y-auto px-2 pb-2"
            >
              {options.map((sortKey) => {
                const selected = value === sortKey
                return (
                  <label
                    key={sortKey}
                    htmlFor={`catalog-sort-${sortKey}`}
                    className={cn(
                      'flex min-h-[48px] cursor-pointer items-center gap-3 border-b border-slate-100 px-3 last:border-b-0',
                      selected && 'bg-brand/5',
                    )}
                  >
                    <RadioGroupItem
                      id={`catalog-sort-${sortKey}`}
                      value={sortKey}
                      className="h-5 w-5 border-brand text-brand"
                    />
                    <span
                      className={cn(
                        'text-sm text-slate-800',
                        selected && 'font-semibold text-slate-900',
                      )}
                    >
                      {getUIText(CATALOG_SORT_LABEL_KEYS[sortKey], language)}
                    </span>
                  </label>
                )
              })}
            </RadioGroup>
          </SheetContent>
        </Sheet>
      </div>

      <div className="hidden md:block">
        <label className="sr-only">{getUIText('catalogSortLabel', language)}</label>
        <Select value={value} onValueChange={handlePick}>
          <SelectTrigger className="h-auto min-h-[44px] w-auto min-w-[10.5rem] max-w-full rounded-2xl border-slate-200 bg-white text-sm">
            <SelectValue placeholder={getUIText('catalogSortLabel', language)} />
          </SelectTrigger>
          <SelectContent>
            {options.map((sortKey) => (
              <SelectItem key={sortKey} value={sortKey}>
                {getUIText(CATALOG_SORT_LABEL_KEYS[sortKey], language)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
