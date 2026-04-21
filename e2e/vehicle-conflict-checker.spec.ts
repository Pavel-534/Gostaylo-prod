import { test, expect } from '@playwright/test'
import { intervalsOverlap, normalizeVehicleIntervalBounds } from '../lib/services/vehicle-conflict-utils.js'

test.describe('Vehicle conflict checker helpers', () => {
  test('day-only interval uses full-day protected bounds', async () => {
    const normalized = normalizeVehicleIntervalBounds('2026-06-01', '2026-06-01')
    expect(normalized.success).toBe(true)
    if (!normalized.success) return
    expect(normalized.mode).toBe('day-only-protected')

    const another = normalizeVehicleIntervalBounds('2026-06-01T12:00:00+07:00', '2026-06-01T14:00:00+07:00')
    expect(another.success).toBe(true)
    if (!another.success) return

    expect(intervalsOverlap(normalized.startMs, normalized.endMs, another.startMs, another.endMs)).toBe(true)
  })

  test('adjacent intervals do not overlap', async () => {
    const a = normalizeVehicleIntervalBounds('2026-06-01T08:00:00+07:00', '2026-06-01T10:00:00+07:00')
    const b = normalizeVehicleIntervalBounds('2026-06-01T10:00:00+07:00', '2026-06-01T12:00:00+07:00')
    expect(a.success).toBe(true)
    expect(b.success).toBe(true)
    if (!a.success || !b.success) return

    expect(intervalsOverlap(a.startMs, a.endMs, b.startMs, b.endMs)).toBe(false)
  })

  test('invalid interval is rejected', async () => {
    const invalid = normalizeVehicleIntervalBounds('2026-06-01T12:00:00+07:00', '2026-06-01T10:00:00+07:00')
    expect(invalid.success).toBe(false)
    expect(invalid.error).toBe('INVALID_DATE_RANGE')
  })
})

