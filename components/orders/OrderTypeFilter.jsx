'use client'

import { Button } from '@/components/ui/button'
import OrderTypeIcon from '@/components/ui/OrderTypeIcon'
import { getUIText } from '@/lib/translations'

const FILTER_IDS = [
  { id: 'all', labelKey: 'all', icon: null },
  { id: 'home', labelKey: 'orderTypeFilter_home', icon: 'home' },
  { id: 'transport', labelKey: 'orderTypeFilter_transport', icon: 'transport' },
  { id: 'activity', labelKey: 'orderTypeFilter_activity', icon: 'activity' },
]

export default function OrderTypeFilter({ activeType = 'all', counters = {}, onChange, language = 'ru' }) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      {FILTER_IDS.map((item) => {
        const active = activeType === item.id
        return (
          <Button
            key={item.id}
            type="button"
            variant={active ? 'brand' : 'outline'}
            className="min-h-[44px]"
            onClick={() => onChange?.(item.id)}
          >
            {item.icon ? <OrderTypeIcon type={item.icon} className="mr-2" /> : null}
            {getUIText(item.labelKey, language)} ({counters?.[item.id] || 0})
          </Button>
        )
      })}
    </div>
  )
}
