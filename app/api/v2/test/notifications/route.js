/**
 * Notification Test API - Phase 5.4
 * Quick test endpoint to verify TG and Email notifications
 */

import { NextResponse } from 'next/server'
import { NotificationService, NotificationEvents } from '@/lib/services/notification.service'

export async function POST(request) {
  try {
    const { event, testData } = await request.json()
    
    // Test data templates
    const templates = {
      NEW_BOOKING_REQUEST: {
        booking: {
          id: 'test-booking-123',
          guest_name: 'Test User',
          guest_email: 'test@example.com',
          check_in: '2025-04-01',
          check_out: '2025-04-05',
          total_price_thb: 15000,
          commission_rate: 15,
          commission_thb: 2250,
          partner_earnings_thb: 12750
        },
        partner: {
          first_name: 'Test',
          last_name: 'Partner',
          email: 'partner@example.com'
        },
        listing: {
          title: 'Luxury Villa in Rawai',
          district: 'Rawai'
        }
      },
      BOOKING_CONFIRMED: {
        booking: {
          id: 'test-booking-123',
          guest_name: 'Test User',
          check_in: '2025-04-01',
          check_out: '2025-04-05'
        },
        renter: {
          email: 'renter@example.com',
          first_name: 'Test Renter'
        },
        listing: {
          title: 'Luxury Villa in Rawai'
        }
      }
    }
    
    const data = testData || templates[event]
    
    if (!data) {
      return NextResponse.json({
        success: false,
        error: 'No test data provided and no template found'
      }, { status: 400 })
    }
    
    // Dispatch notification
    await NotificationService.dispatch(event, data)
    
    return NextResponse.json({
      success: true,
      message: `Test notification dispatched for event: ${event}`,
      data
    })
  } catch (error) {
    console.error('[NOTIFICATION TEST ERROR]', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    available_events: Object.keys(NotificationEvents),
    telegram_configured: !!process.env.TELEGRAM_BOT_TOKEN,
    email_configured: !!process.env.RESEND_API_KEY,
    admin_group_configured: !!process.env.TELEGRAM_ADMIN_GROUP_ID
  })
}
