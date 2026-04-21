const EXPLICIT_TIME_RE = /[T\s]\d{2}:\d{2}/
const DATE_PART_RE = /^\d{4}-\d{2}-\d{2}$/

export function hasExplicitTimePart(value) {
  return EXPLICIT_TIME_RE.test(String(value || ''))
}

function parseDatePart(value) {
  const s = String(value || '').trim()
  if (!s) return null
  if (DATE_PART_RE.test(s)) return s
  const fromIso = s.slice(0, 10)
  if (DATE_PART_RE.test(fromIso)) return fromIso
  return null
}

function parseInstantMs(value) {
  const ms = new Date(String(value || '')).getTime()
  return Number.isFinite(ms) ? ms : NaN
}

export function normalizeVehicleIntervalBounds(checkIn, checkOut) {
  const startDateKey = parseDatePart(checkIn)
  const endDateKey = parseDatePart(checkOut)
  if (!startDateKey || !endDateKey) {
    return { success: false, error: 'INVALID_DATE_RANGE' }
  }

  const hasStartTime = hasExplicitTimePart(checkIn)
  const hasEndTime = hasExplicitTimePart(checkOut)

  const startRaw = hasStartTime ? String(checkIn) : `${startDateKey}T00:00:00+07:00`
  // Day-only protection: treat requested day as fully occupied.
  const endRaw = hasEndTime ? String(checkOut) : `${endDateKey}T23:59:59.999+07:00`

  const startMs = parseInstantMs(startRaw)
  const endMs = parseInstantMs(endRaw)
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return { success: false, error: 'INVALID_DATE_RANGE' }
  }

  return {
    success: true,
    startMs,
    endMs,
    startIso: new Date(startMs).toISOString(),
    endIso: new Date(endMs).toISOString(),
    startDateKey,
    endDateKey,
    mode: hasStartTime || hasEndTime ? 'datetime' : 'day-only-protected',
  }
}

export function intervalsOverlap(startA, endA, startB, endB) {
  const a1 = Number(startA)
  const a2 = Number(endA)
  const b1 = Number(startB)
  const b2 = Number(endB)
  if (![a1, a2, b1, b2].every(Number.isFinite)) return false
  // Half-open overlap semantics: [start, end)
  return a1 < b2 && a2 > b1
}

