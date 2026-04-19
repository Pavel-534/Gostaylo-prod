/**
 * usePartnerStats - TanStack Query hook for partner dashboard stats
 */

'use client'

import { useQuery } from '@tanstack/react-query'
import { format, addDays, subMonths, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'

export const partnerStatsKeys = {
  all: ['partner-stats'],
  data: (partnerId) => [...partnerStatsKeys.all, 'data', partnerId],
}

function mockIncomeByMonth(today) {
  const keys = []
  for (let i = 5; i >= 0; i -= 1) {
    keys.push(format(subMonths(today, i), 'yyyy-MM'))
  }
  return keys.map((key, idx) => ({
    key,
    label: format(parseISO(`${key}-01`), 'LLL yy', { locale: ru }),
    amountThb: [12000, 0, 8500, 22000, 15000, 18000][idx] ?? 0,
  }))
}

function generateMockStats() {
  const today = new Date()
  
  return {
    revenue: {
      confirmed: 187500,
      pending: 42500,
      total: 230000,
      trend: [
        { day: 'Пн', revenue: 8500 },
        { day: 'Вт', revenue: 0 },
        { day: 'Ср', revenue: 25500 },
        { day: 'Чт', revenue: 8500 },
        { day: 'Пт', revenue: 45000 },
        { day: 'Сб', revenue: 12750 },
        { day: 'Вс', revenue: 17500 }
      ]
    },
    occupancy: { rate: 68, listingsCount: 4 },
    today: {
      checkIns: 2,
      checkOuts: 1,
      checkInsList: [
        { id: 'bk-001', guestName: 'Иван Петров', listingTitle: 'Роскошная вилла' },
        { id: 'bk-003', guestName: 'Алексей Козлов', listingTitle: 'Апартаменты' }
      ],
      checkOutsList: [{ id: 'bk-005', guestName: 'Елена Новикова', listingTitle: 'Honda PCX' }]
    },
    pending: {
      count: 3,
      items: [
        { id: 'bk-pending-1', guestName: 'Мария Сидорова', listingTitle: 'Вилла', checkIn: format(addDays(today, 2), 'yyyy-MM-dd'), priceThb: 25500 },
        { id: 'bk-pending-2', guestName: 'Сергей Иванов', listingTitle: 'Яхта', checkIn: format(addDays(today, 5), 'yyyy-MM-dd'), priceThb: 45000 },
        { id: 'bk-pending-3', guestName: 'Анна Кузнецова', listingTitle: 'Апарт.', checkIn: format(addDays(today, 3), 'yyyy-MM-dd'), priceThb: 10500 }
      ]
    },
    upcoming: [
      { id: 'arr-1', guestName: 'Дмитрий Волков', listingTitle: 'Яхта Princess', checkIn: format(addDays(today, 1), 'yyyy-MM-dd'), nights: 1, priceThb: 45000 },
      { id: 'arr-2', guestName: 'Ольга Смирнова', listingTitle: 'Вилла', checkIn: format(addDays(today, 3), 'yyyy-MM-dd'), nights: 4, priceThb: 34000 },
      { id: 'arr-3', guestName: 'Павел Морозов', listingTitle: 'Апартаменты', checkIn: format(addDays(today, 4), 'yyyy-MM-dd'), nights: 2, priceThb: 7000 },
      { id: 'arr-4', guestName: 'Наталья Белова', listingTitle: 'Honda PCX', checkIn: format(addDays(today, 5), 'yyyy-MM-dd'), nights: 7, priceThb: 2450 }
    ],
    bookings: { total: 12, confirmed: 8, pending: 3, completed: 1 },
    financialV2: {
      moneyInTransitThb: 45200,
      incomeByMonth: mockIncomeByMonth(today),
    },
  }
}

async function fetchPartnerStats(partnerId) {
  try {
    const res = await fetch(`/api/v2/partner/stats?partnerId=${partnerId}`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      cache: 'no-store'
    })
    
    const contentType = res.headers.get('content-type')
    if (!contentType || !contentType.includes('application/json')) {
      return { data: generateMockStats(), isFallback: true }
    }
    
    if (!res.ok) throw new Error('Failed')
    return res.json()
  } catch (error) {
    return { data: generateMockStats(), isFallback: true }
  }
}

export function usePartnerStats(partnerId, options = {}) {
  const { enabled = true } = options
  
  return useQuery({
    queryKey: partnerStatsKeys.data(partnerId),
    queryFn: () => fetchPartnerStats(partnerId),
    enabled: !!partnerId && enabled,
    staleTime: 60 * 1000,
    retry: 2,
    select: (response) => response.data
  })
}

export default usePartnerStats
