/**
 * usePartnerCalendar - TanStack Query hook for partner calendar
 *
 * Features:
 * - Fetch calendar data for all partner listings
 * - Mutations for blocks and manual bookings
 * - Optimistic updates and cache invalidation
 * - On API failure: surfaces error (no silent demo data) unless
 *   NEXT_PUBLIC_PARTNER_CALENDAR_DEMO_FALLBACK=1 (then demo + meta.isDemoFallback)
 */

'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format, addDays } from 'date-fns'

// Query key factory
export const partnerCalendarKeys = {
  all: ['partner-calendar'],
  data: (partnerId, dateRange) => [...partnerCalendarKeys.all, 'data', partnerId, dateRange],
}

const DEMO_FALLBACK =
  typeof process !== 'undefined' &&
  process.env.NEXT_PUBLIC_PARTNER_CALENDAR_DEMO_FALLBACK === '1'

/**
 * Fetch calendar data from API v2
 * @returns {{ data: object, meta?: object }}
 */
async function fetchCalendarData({ partnerId, startDate, endDate }) {
  const params = new URLSearchParams()
  if (partnerId) params.set('partnerId', partnerId)
  if (startDate) params.set('startDate', startDate)
  if (endDate) params.set('endDate', endDate)

  try {
    const res = await fetch(`/api/v2/partner/calendar?${params.toString()}`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      cache: 'no-store',
    })

    const raw = await res.text()
    let json
    try {
      json = JSON.parse(raw)
    } catch {
      throw new Error('Ответ сервера не JSON. Проверьте сеть и попробуйте снова.')
    }

    if (!res.ok) {
      throw new Error(json.error || `Ошибка загрузки календаря (${res.status})`)
    }

    if (json.status === 'error') {
      throw new Error(json.error || 'Ошибка календаря')
    }

    if (json.data == null) {
      throw new Error('Некорректный ответ API')
    }

    return {
      data: json.data,
      meta: json.meta || {},
    }
  } catch (error) {
    if (DEMO_FALLBACK) {
      console.warn('[Calendar] API error, demo fallback enabled:', error.message)
      return {
        data: generateMockCalendarData(startDate, endDate),
        meta: {
          isDemoFallback: true,
          demoErrorMessage: error.message,
        },
      }
    }
    throw error
  }
}

/**
 * Generate mock calendar data (only when NEXT_PUBLIC_PARTNER_CALENDAR_DEMO_FALLBACK=1)
 */
function generateMockCalendarData(startDate, endDate) {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const dates = []
  let current = new Date(start)

  while (current <= end) {
    dates.push(format(current, 'yyyy-MM-dd'))
    current = addDays(current, 1)
  }

  const mockListings = [
    {
      id: 'lst-villa-001',
      title: 'Роскошная вилла с бассейном',
      type: 'villa',
      district: 'Rawai',
      coverImage:
        'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=400',
      basePriceThb: 8500,
    },
    {
      id: 'lst-apt-002',
      title: 'Современные апартаменты в центре',
      type: 'apartment',
      district: 'Patong',
      coverImage:
        'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=400',
      basePriceThb: 3500,
    },
    {
      id: 'lst-yacht-003',
      title: 'Яхта Princess 65ft',
      type: 'yacht',
      district: 'Chalong',
      coverImage:
        'https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?w=400',
      basePriceThb: 45000,
    },
    {
      id: 'lst-bike-004',
      title: 'Honda PCX 160',
      type: 'bike',
      district: 'Kata',
      coverImage:
        'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400',
      basePriceThb: 350,
    },
  ]

  const bookings = [
    {
      listingId: 'lst-villa-001',
      guestName: 'Иван Петров',
      checkIn: addDays(start, 2),
      checkOut: addDays(start, 7),
      status: 'CONFIRMED',
    },
    {
      listingId: 'lst-villa-001',
      guestName: 'Мария Сидорова',
      checkIn: addDays(start, 9),
      checkOut: addDays(start, 12),
      status: 'PENDING',
    },
    {
      listingId: 'lst-apt-002',
      guestName: 'Алексей Козлов',
      checkIn: addDays(start, 5),
      checkOut: addDays(start, 10),
      status: 'CONFIRMED',
    },
    {
      listingId: 'lst-yacht-003',
      guestName: 'Дмитрий Волков',
      checkIn: addDays(start, 7),
      checkOut: addDays(start, 8),
      status: 'CONFIRMED',
    },
    {
      listingId: 'lst-bike-004',
      guestName: 'Елена Новикова',
      checkIn: addDays(start, 1),
      checkOut: addDays(start, 15),
      status: 'CONFIRMED',
    },
  ]

  const blocks = [
    {
      listingId: 'lst-apt-002',
      startDate: addDays(start, 12),
      endDate: addDays(start, 14),
      reason: 'Личное использование',
    },
  ]

  const listings = mockListings.map((listing) => {
    const availability = {}

    dates.forEach((date) => {
      const dateObj = new Date(date)

      const booking = bookings.find(
        (b) =>
          b.listingId === listing.id &&
          dateObj >= b.checkIn &&
          dateObj < b.checkOut
      )

      const block =
        !booking &&
        blocks.find(
          (b) =>
            b.listingId === listing.id &&
            dateObj >= b.startDate &&
            dateObj <= b.endDate
        )

      if (booking) {
        const isCheckIn = dateObj.getTime() === booking.checkIn.getTime()
        availability[date] = {
          status: 'BOOKED',
          bookingId: `bk-${listing.id}-${date}`,
          guestName: booking.guestName,
          bookingStatus: booking.status,
          source: 'PLATFORM',
          isCheckIn,
          isCheckOut: false,
          isTransition: false,
        }
      } else if (block) {
        availability[date] = {
          status: 'BLOCKED',
          blockId: `blk-${listing.id}-${date}`,
          reason: block.reason,
          blockType: 'OWNER_USE',
        }
      } else {
        availability[date] = { status: 'AVAILABLE' }
      }
    })

    return {
      listing,
      availability,
      bookingsCount: bookings.filter((b) => b.listingId === listing.id).length,
      blocksCount: blocks.filter((b) => b.listingId === listing.id).length,
    }
  })

  return {
    dates,
    listings,
    summary: {
      totalListings: mockListings.length,
      totalBookings: bookings.length,
      totalBlocks: blocks.length,
    },
  }
}

/**
 * Hook to fetch partner calendar
 */
export function usePartnerCalendar(partnerId, options = {}) {
  const today = new Date()
  const {
    startDate = format(today, 'yyyy-MM-dd'),
    endDate = format(addDays(today, 30), 'yyyy-MM-dd'),
    enabled = true,
  } = options

  const query = useQuery({
    queryKey: partnerCalendarKeys.data(partnerId, { startDate, endDate }),
    queryFn: () => fetchCalendarData({ partnerId, startDate, endDate }),
    enabled: !!partnerId && enabled,
    staleTime: 2 * 60 * 1000,
    retry: 2,
    retryDelay: 1000,
  })

  return {
    ...query,
    data: query.data?.data,
    meta: query.data?.meta,
  }
}

/**
 * Hook to create availability block
 */
export function useCreateBlock() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ listingId, startDate, endDate, reason, type, partnerId }) => {
      const res = await fetch(`/api/v2/partner/calendar/block?partnerId=${partnerId}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId, startDate, endDate, reason, type }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to create block')
      }

      return res.json()
    },

    onSuccess: () => {
      toast.success('Даты заблокированы')
    },

    onError: (err) => {
      toast.error(err.message || 'Ошибка при блокировке дат')
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: partnerCalendarKeys.all })
    },
  })
}

/**
 * Hook to delete availability block
 */
export function useDeleteBlock() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ blockId, partnerId }) => {
      const res = await fetch(
        `/api/v2/partner/calendar/block?blockId=${blockId}&partnerId=${partnerId}`,
        {
          method: 'DELETE',
          credentials: 'include',
        }
      )

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to delete block')
      }

      return res.json()
    },

    onSuccess: () => {
      toast.success('Блокировка снята')
    },

    onError: (err) => {
      toast.error(err.message || 'Ошибка при снятии блокировки')
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: partnerCalendarKeys.all })
    },
  })
}

/**
 * Hook to create manual booking
 */
export function useCreateManualBooking() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      listingId,
      checkIn,
      checkOut,
      guestName,
      guestPhone,
      guestEmail,
      priceThb,
      notes,
      partnerId,
    }) => {
      const res = await fetch(`/api/v2/partner/calendar/manual-booking?partnerId=${partnerId}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId,
          checkIn,
          checkOut,
          guestName,
          guestPhone,
          guestEmail,
          priceThb,
          notes,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to create booking')
      }

      return res.json()
    },

    onSuccess: () => {
      toast.success('Бронирование создано')
    },

    onError: (err) => {
      toast.error(err.message || 'Ошибка при создании бронирования')
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: partnerCalendarKeys.all })
    },
  })
}

export default usePartnerCalendar
