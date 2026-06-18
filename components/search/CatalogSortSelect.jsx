'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getUIText } from '@/lib/translations'
import { CATALOG_SORT_VALUES } from '@/lib/recommendations/constants'

const SORT_LABEL_KEYS = {
  recommended: 'catalogSortRecommended',
  price_asc: 'catalogSortPriceAsc',
  price_desc: 'catalogSortPriceDesc',
  distance: 'catalogSortDistance',
}

export function CatalogSortSelect({
  value = 'recommended',
  onChange,
  language = 'ru',
  distanceDisabled = false,
  className,
}) {
  return (
    <div className={className}>
      <label className="sr-only">{getUIText('catalogSortLabel', language)}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 w-full min-w-[180px] border-slate-200 bg-white text-sm">
          <SelectValue placeholder={getUIText('catalogSortLabel', language)} />
        </SelectTrigger>
        <SelectContent>
          {CATALOG_SORT_VALUES.map((sortKey) => {
            if (sortKey === 'distance' && distanceDisabled) return null
            return (
              <SelectItem key={sortKey} value={sortKey}>
                {getUIText(SORT_LABEL_KEYS[sortKey], language)}
              </SelectItem>
            )
          })}
        </SelectContent>
      </Select>
    </div>
  )
}
