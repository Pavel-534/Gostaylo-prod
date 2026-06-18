'use client'

import { Badge } from '@/components/ui/badge'

/**
 * @param {{ country_code?: string, region_code?: string, city_code?: string }} row
 */
export function LocationSuggestionContextChip({ row }) {
  const parts = [row.country_code, row.city_code || row.region_code].filter(Boolean)
  if (!parts.length) {
    return <span className="text-xs text-slate-400">—</span>
  }
  return (
    <div className="flex flex-wrap gap-1">
      {parts.map((p) => (
        <Badge key={p} variant="outline" className="font-mono text-[10px] font-normal">
          {p}
        </Badge>
      ))}
    </div>
  )
}
