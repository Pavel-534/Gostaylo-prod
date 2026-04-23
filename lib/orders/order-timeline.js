import { listingDateToday, toListingDate } from '@/lib/listing-date'

const CANCELLED_STATUSES = new Set(['CANCELLED', 'DECLINED', 'REJECTED', 'REFUNDED'])

export function normalizeOrderType(type) {
  const value = String(type || '').trim().toLowerCase()
  if (value === 'transport') return 'transport'
  if (value === 'activity' || value === 'tour' || value === 'tours') return 'activity'
  return 'home'
}

export function normalizeOrderStatus(status) {
  return String(status || '').trim().toUpperCase()
}

export function isCancelledOrderStatus(status) {
  return CANCELLED_STATUSES.has(normalizeOrderStatus(status))
}

export function shouldAllowReviewByLifecycle(status, checkOutIso, now = new Date()) {
  const normalizedStatus = normalizeOrderStatus(status)
  if (isCancelledOrderStatus(normalizedStatus)) return false
  if (normalizedStatus === 'COMPLETED' || normalizedStatus === 'FINISHED') return true

  const checkOutYmd = toListingDate(checkOutIso)
  const todayYmd = toListingDate(now) || listingDateToday()
  if (!checkOutYmd || !todayYmd) return false
  return checkOutYmd <= todayYmd
}

export function shouldAllowCheckInToday(status, checkInIso, now = new Date()) {
  const normalizedStatus = normalizeOrderStatus(status)
  if (normalizedStatus !== 'PAID_ESCROW') return false
  const checkInYmd = toListingDate(checkInIso)
  const todayYmd = toListingDate(now) || listingDateToday()
  if (!checkInYmd || !todayYmd) return false
  return checkInYmd === todayYmd
}

export function buildOrderTimelineModel({
  status,
  type = 'home',
  mode = 'order',
  reviewed = false,
  checkOutIso = null,
  now = new Date(),
}) {
  const normalizedStatus = normalizeOrderStatus(status)
  const normalizedType = normalizeOrderType(type)
  const allowReview = shouldAllowReviewByLifecycle(normalizedStatus, checkOutIso, now)
  const isReviewed = reviewed === true

  const steps = mode === 'chat'
    ? ['created', 'paid', 'in_progress', 'completed']
    : ['created', 'paid', 'in_progress', 'completed', 'reviewed']

  let currentStep = 'created'
  if (normalizedStatus === 'CHECKED_IN') currentStep = 'in_progress'
  else if (normalizedStatus === 'PAID_ESCROW' || normalizedStatus === 'PAID') currentStep = 'paid'
  else if (normalizedStatus === 'COMPLETED' || normalizedStatus === 'FINISHED' || normalizedStatus === 'THAWED')
    currentStep = 'completed'

  if (mode !== 'chat' && isReviewed) currentStep = 'reviewed'

  const currentIndex = steps.indexOf(currentStep)
  const reviewedEnabled = mode !== 'chat' && (isReviewed || allowReview)

  return steps.map((id, index) => {
    const done = index < currentIndex || (id === 'reviewed' && isReviewed)
    const current = index === currentIndex

    let labelKey = `orderTimeline_step_${id}`
    if (id === 'in_progress' && normalizedType === 'transport') {
      labelKey = 'orderTimeline_step_pickup'
    }

    return {
      id,
      done,
      current,
      labelKey,
      disabled: id === 'reviewed' ? !reviewedEnabled : false,
    }
  })
}
