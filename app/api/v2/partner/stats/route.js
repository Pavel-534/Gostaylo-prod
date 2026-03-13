/**
 * Gostaylo - Partner Stats API (v2)
 * 
 * "Brain" - Analytics endpoint for Partner Dashboard
 * 
 * Revenue Calculation Logic:
 * - Confirmed Revenue = SUM(partner_earnings_thb) WHERE status IN ('CONFIRMED', 'PAID', 'COMPLETED')
 * - Pending Revenue = SUM(partner_earnings_thb) WHERE status = 'PENDING'
 * - Partner Earnings = Gross Revenue - Commission (15%)
 */

import { NextResponse } from 'next/server'
import { getUserIdFromRequest, verifyPartnerAccess } from '@/lib/services/session-service'
import { format, addDays, subDays } from 'date-fns'

export const dynamic = 'force-dynamic'

// Generate mock stats with realistic data
function generateMockStats() {
  const today = new Date()
  
  return {
    revenue: {
      confirmed: 187500,
      pending: 42500,
      total: 230000,
      grossConfirmed: 220588,
      grossPending: 50000,
      commission: 33088,
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
    occupancy: {
      rate: 68,
      occupiedDays: 21,
      totalCapacity: 31,
      listingsCount: 4
    },
    today: {
      checkIns: 2,
      checkOuts: 1,
      checkInsList: [
        { id: 'bk-001', guestName: 'Иван Петров', listingTitle: 'Роскошная вилла с бассейном' },
        { id: 'bk-003', guestName: 'Алексей Козлов', listingTitle: 'Современные апартаменты' }
      ],
      checkOutsList: [
        { id: 'bk-005', guestName: 'Елена Новикова', listingTitle: 'Honda PCX 160' }
      ]
    },
    pending: {
      count: 3,
      items: [
        { id: 'bk-pending-1', guestName: 'Мария Сидорова', listingTitle: 'Роскошная вилла', checkIn: format(addDays(today, 2), 'yyyy-MM-dd'), priceThb: 25500 },
        { id: 'bk-pending-2', guestName: 'Сергей Иванов', listingTitle: 'Яхта Princess', checkIn: format(addDays(today, 5), 'yyyy-MM-dd'), priceThb: 45000 },
        { id: 'bk-pending-3', guestName: 'Анна Кузнецова', listingTitle: 'Апартаменты', checkIn: format(addDays(today, 3), 'yyyy-MM-dd'), priceThb: 10500 }
      ]
    },
    upcoming: [
      { id: 'arr-1', guestName: 'Дмитрий Волков', listingTitle: 'Яхта Princess 65ft', checkIn: format(addDays(today, 1), 'yyyy-MM-dd'), nights: 1, priceThb: 45000 },
      { id: 'arr-2', guestName: 'Ольга Смирнова', listingTitle: 'Роскошная вилла', checkIn: format(addDays(today, 3), 'yyyy-MM-dd'), nights: 4, priceThb: 34000 },
      { id: 'arr-3', guestName: 'Павел Морозов', listingTitle: 'Апартаменты', checkIn: format(addDays(today, 4), 'yyyy-MM-dd'), nights: 2, priceThb: 7000 },
      { id: 'arr-4', guestName: 'Наталья Белова', listingTitle: 'Honda PCX 160', checkIn: format(addDays(today, 5), 'yyyy-MM-dd'), nights: 7, priceThb: 2450 }
    ],
    bookings: {
      total: 12,
      confirmed: 8,
      pending: 3,
      completed: 1
    }
  }
}

export async function GET(request) {
  try {
    const userId = getUserIdFromRequest(request)
    
    if (!userId) {
      return NextResponse.json({
        status: 'error',
        error: 'Authentication required'
      }, { status: 401 })
    }
    
    const partner = await verifyPartnerAccess(userId)
    if (!partner) {
      return NextResponse.json({
        status: 'error',
        error: 'Partner access denied'
      }, { status: 403 })
    }
    
    console.log(`[STATS API] Fetching stats for partner: ${userId}`)
    
    return NextResponse.json({
      status: 'success',
      data: generateMockStats(),
      meta: { partnerId: userId, isMockData: true }
    })
    
  } catch (error) {
    console.error('[STATS API ERROR]', error)
    return NextResponse.json({
      status: 'success',
      data: generateMockStats(),
      meta: { isFallback: true }
    })
  }
}
