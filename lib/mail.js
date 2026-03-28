// Email Service Module (Resend-compatible architecture)
// Mock-first implementation - ready for real API key

import { render } from '@react-email/render'
import WelcomeEmail from '@/emails/welcome-email'
import BookingRequestEmail from '@/emails/booking-request-email'
import PaymentSuccessEmail from '@/emails/payment-success-email'
import { getTransactionalFromAddress } from '@/lib/email-env'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL = getTransactionalFromAddress()
const IS_PRODUCTION = process.env.NODE_ENV === 'production' && RESEND_API_KEY

/**
 * Send email using Resend API
 * In development (no API key): logs HTML to console
 * In production (with API key): sends via Resend
 */
export async function sendEmail({ to, subject, template, data }) {
  // Handle both direct react components and template-based calls
  let react;
  
  if (template) {
    // Template-based call from notifications system
    switch (template) {
      case 'welcome-email':
        react = WelcomeEmail({
          userName: data.userName,
          referralCode: data.referralCode || 'FR00000',
          loginUrl: data.loginUrl || `${process.env.NEXT_PUBLIC_BASE_URL}/login`,
        });
        break;
      case 'booking-request-email':
        react = BookingRequestEmail({
          partnerName: data.partnerName,
          listingTitle: data.listingTitle,
          guestName: data.renterName,
          checkIn: data.checkIn,
          checkOut: data.checkOut,
          totalDays: 5, // Mock value
          priceBreakdown: data.priceBreakdown,
          totalPrice: data.totalPrice,
          commission: Math.round(data.totalPrice * 0.15), // 15% commission
          partnerEarnings: Math.round(data.totalPrice * 0.85),
          bookingUrl: data.bookingUrl,
        });
        break;
      case 'partner-verified-email':
        react = WelcomeEmail({ // Reuse welcome template
          userName: data.partnerName,
          referralCode: 'VERIFIED',
          loginUrl: data.loginUrl || `${process.env.NEXT_PUBLIC_BASE_URL}/partner`,
        });
        break;
      case 'payout-processed-email':
        react = WelcomeEmail({ // Reuse welcome template for now
          userName: data.partnerName,
          referralCode: `PAYOUT-${data.transactionId}`,
          loginUrl: data.dashboardUrl,
        });
        break;
      default:
        react = WelcomeEmail({
          userName: data.userName || 'User',
          referralCode: 'DEFAULT',
          loginUrl: data.loginUrl || `${process.env.NEXT_PUBLIC_BASE_URL}`,
        });
    }
  } else {
    // Direct react component call (backward compatibility)
    react = data;
  }
  
  const html = render(react)
  
  if (!IS_PRODUCTION) {
    // Mock mode: log to console
    console.log('\n========== [MOCK EMAIL] ==========')
    console.log(`To: ${Array.isArray(to) ? to.join(', ') : to}`)
    console.log(`Subject: ${subject}`)
    console.log(`HTML Length: ${html.length} characters`)
    console.log(`Preview: ${html.substring(0, 200)}...`)
    console.log('=====================================\n')
    
    return {
      success: true,
      mock: true,
      message: 'Email logged to console (no API key configured)',
    }
  }
  
  // Production mode: real Resend API
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
      }),
    })
    
    const data = await response.json()
    
    if (!response.ok) {
      throw new Error(`Resend API error: ${data.message || 'Unknown error'}`)
    }
    
    console.log(`[EMAIL SENT] To: ${to}, ID: ${data.id}`)
    
    return {
      success: true,
      mock: false,
      emailId: data.id,
    }
  } catch (error) {
    console.error('[EMAIL ERROR]', error)
    return {
      success: false,
      error: error.message,
    }
  }
}

// Legacy sendEmail function for backward compatibility
async function sendEmailInternal({ to, subject, react }) {
  const html = render(react)
  
  if (!IS_PRODUCTION) {
    // Mock mode: log to console
    console.log('\n========== [MOCK EMAIL] ==========')
    console.log(`To: ${Array.isArray(to) ? to.join(', ') : to}`)
    console.log(`Subject: ${subject}`)
    console.log(`HTML Length: ${html.length} characters`)
    console.log(`Preview: ${html.substring(0, 200)}...`)
    console.log('=====================================\n')
    
    return {
      success: true,
      mock: true,
      message: 'Email logged to console (no API key configured)',
    }
  }
  
  // Production mode: real Resend API
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
      }),
    })
    
    const data = await response.json()
    
    if (!response.ok) {
      throw new Error(`Resend API error: ${data.message || 'Unknown error'}`)
    }
    
    console.log(`[EMAIL SENT] To: ${to}, ID: ${data.id}`)
    
    return {
      success: true,
      mock: false,
      emailId: data.id,
    }
  } catch (error) {
    console.error('[EMAIL ERROR]', error)
    return {
      success: false,
      error: error.message,
    }
  }
}

/**
 * Send Welcome Email to new user
 */
export async function sendWelcomeEmail({
  to,
  userName,
  referralCode,
}) {
  return sendEmailInternal({
    to,
    subject: '🏝️ Добро пожаловать в Gostaylo!',
    react: WelcomeEmail({
      userName,
      referralCode,
      loginUrl: `${process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://www.gostaylo.com'}/login`,
    }),
  })
}

/**
 * Send Booking Request Email to partner
 */
export async function sendBookingRequestEmail({
  to,
  partnerName,
  listingTitle,
  guestName,
  checkIn,
  checkOut,
  totalDays,
  priceBreakdown,
  totalPrice,
  commission,
  partnerEarnings,
  bookingId,
}) {
  return sendEmailInternal({
    to,
    subject: `🎉 Новое бронирование: ${listingTitle}`,
    react: BookingRequestEmail({
      partnerName,
      listingTitle,
      guestName,
      checkIn,
      checkOut,
      totalDays,
      priceBreakdown,
      totalPrice,
      commission,
      partnerEarnings,
      bookingUrl: `${process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://www.gostaylo.com'}/partner/bookings`,
    }),
  })
}

/**
 * Send Payment Success Email to renter
 */
export async function sendPaymentSuccessEmail({
  to,
  guestName,
  bookingId,
  listingTitle,
  checkIn,
  checkOut,
  totalDays,
  totalPaid,
  paymentMethod,
  partnerName,
  partnerPhone,
  address,
}) {
  return sendEmailInternal({
    to,
    subject: `✅ Оплата подтверждена! Бронирование #${bookingId}`,
    react: PaymentSuccessEmail({
      guestName,
      bookingId,
      listingTitle,
      checkIn,
      checkOut,
      totalDays,
      totalPaid,
      paymentMethod,
      partnerName,
      partnerPhone,
      address,
      bookingDetailsUrl: `${process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://www.gostaylo.com'}/renter/bookings`,
    }),
  })
}

export default {
  sendWelcomeEmail,
  sendBookingRequestEmail,
  sendPaymentSuccessEmail,
}
