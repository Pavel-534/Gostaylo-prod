import { format, isSameDay } from 'date-fns'
import { queryFetchJson } from '@/lib/api/query-fetch'

/**
 * Сериализуемые параметры featured-поиска на главной (queryKey).
 */
export function buildHomeFeaturedKeyParams({
  selectedCategory,
  where,
  dateRange,
  guests,
  checkInTime,
  checkOutTime,
  transportSearchMode,
  textQuery,
  useSemantic,
}) {
  const hasDates =
    dateRange?.from && dateRange?.to && !isSameDay(dateRange.from, dateRange.to)
  return {
    category: selectedCategory && selectedCategory !== 'all' ? selectedCategory : null,
    where: where && where !== 'all' ? where : null,
    checkIn: hasDates ? format(dateRange.from, 'yyyy-MM-dd') : null,
    checkOut: hasDates ? format(dateRange.to, 'yyyy-MM-dd') : null,
    checkInTime: transportSearchMode && hasDates ? checkInTime : null,
    checkOutTime: transportSearchMode && hasDates ? checkOutTime : null,
    guests: guests && guests !== '1' ? guests : null,
    q: String(textQuery || '').trim().length >= 2 ? String(textQuery).trim() : null,
    semantic: useSemantic ? '1' : null,
  }
}

/**
 * @param {ReturnType<typeof buildHomeFeaturedKeyParams>} keyParams
 */
export async function fetchHomeFeatured(keyParams) {
  const params = new URLSearchParams({ limit: '12', featured: 'true' })
  params.set('softAvailability', '0')
  if (keyParams.category) params.set('category', keyParams.category)
  if (keyParams.where) params.set('where', keyParams.where)
  if (keyParams.checkIn) params.set('checkIn', keyParams.checkIn)
  if (keyParams.checkOut) params.set('checkOut', keyParams.checkOut)
  if (keyParams.checkInTime) params.set('checkInTime', keyParams.checkInTime)
  if (keyParams.checkOutTime) params.set('checkOutTime', keyParams.checkOutTime)
  if (keyParams.guests) params.set('guests', keyParams.guests)
  if (keyParams.q) {
    params.set('q', keyParams.q)
    if (keyParams.semantic === '1') params.set('semantic', '1')
  }

  const data = await queryFetchJson(`/api/v2/search?${params.toString()}`)
  return {
    listings: data?.listings ?? [],
    available: data?.meta?.available ?? 0,
  }
}
