/**
 * Partner Approved Email Notification
 * POST /api/notifications/partner-approved
 */

import { NextResponse } from 'next/server';
import { EmailService } from '@/lib/services/email.service';

export async function POST(request) {
  try {
    const { partnerId, email, name } = await request.json();
    
    if (!email) {
      return NextResponse.json({ success: false, error: 'Email required' }, { status: 400 });
    }
    
    // Send Partner Approved email
    const result = await EmailService.sendPartnerApproved({ name, email }, 'ru');
    
    return NextResponse.json({ 
      success: true, 
      message: 'Email sent',
      ...result
    });
  } catch (error) {
    console.error('[PARTNER APPROVED EMAIL ERROR]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
