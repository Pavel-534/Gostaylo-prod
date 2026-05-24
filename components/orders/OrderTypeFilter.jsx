import { Button } from '@/components/ui/button'
import OrderTypeIcon from '@/components/ui/OrderTypeIcon'

const FILTERS = [
  { id: 'all', label: 'Все', icon: null },
  { id: 'home', label: 'Жильё', icon: 'home' },
  { id: 'transport', label: 'Транспорт', icon: 'transport' },
  { id: 'activity', label: 'Активности', icon: 'activity' },
]

export default function OrderTypeFilter({ activeType = 'all', counters = {}, onChange }) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      {FILTERS.map((item) => {
        const active = activeType === item.id
        return (
          <Button
            key={item.id}
            type="button"
            variant={active ? 'brand' : 'outline'}
            className={active ? '' : undefined}
            onClick={() => onChange?.(item.id)}
          >
            {item.icon ? <OrderTypeIcon type={item.icon} className="mr-2" /> : null}
            {item.label} ({counters?.[item.id] || 0})
          </Button>
        )
      })}
    </div>
  )
}
