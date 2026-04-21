'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

function buildTimeSlots(stepMinutes = 30) {
  const out = []
  for (let h = 0; h < 24; h += 1) {
    for (let m = 0; m < 60; m += stepMinutes) {
      out.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    }
  }
  return out
}

const TIME_SLOTS = buildTimeSlots(30)

export function TimeSelect({
  value = '07:00',
  onChange,
  className,
  placeholder = '00:00',
  disabled = false,
}) {
  const normalized = TIME_SLOTS.includes(String(value)) ? String(value) : '07:00'
  return (
    <Select value={normalized} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {TIME_SLOTS.map((slot) => (
          <SelectItem key={slot} value={slot}>
            {slot}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

