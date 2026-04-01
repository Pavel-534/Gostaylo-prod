/**
 * GoStayLo - Push Notifications API
 * POST /api/v2/push/register - Register FCM token
 * POST /api/v2/push/send - Send push notification (admin only)
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { PushService } from '@/lib/services/push.service';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

// Register FCM token
export async function POST(request) {
  try {
    const body = await request.json();
    const { action, token, userId, templateKey, data, targetUserId } = body;

    // Action: register - Register FCM token for user
    if (action === 'register') {
      if (!token || !userId) {
        return NextResponse.json(
          { success: false, error: 'token and userId required' },
          { status: 400 }
        );
      }

      const result = await PushService.registerToken(userId, token);
      return NextResponse.json(result);
    }

    // Action: send - Send push notification (admin only)
    if (action === 'send') {
      // Verify admin access
      const supabase = createServerComponentClient({ cookies });
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        );
      }

      // Check if user is admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profile?.role !== 'ADMIN') {
        return NextResponse.json(
          { success: false, error: 'Admin access required' },
          { status: 403 }
        );
      }

      if (!targetUserId || !templateKey) {
        return NextResponse.json(
          { success: false, error: 'targetUserId and templateKey required' },
          { status: 400 }
        );
      }

      const result = await PushService.sendToUser(targetUserId, templateKey, data || {});
      return NextResponse.json(result);
    }

    // Action: test - Send test push to own device
    if (action === 'test') {
      if (!token) {
        return NextResponse.json(
          { success: false, error: 'token required' },
          { status: 400 }
        );
      }

      const result = await PushService.sendPush(token, 'NEW_MESSAGE', {
        sender: 'GoStayLo Test',
        link: '/'
      });
      
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action. Use: register, send, or test' },
      { status: 400 }
    );

  } catch (error) {
    console.error('[PUSH API ERROR]', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// GET - Get push notification status
export async function GET(request) {
  return NextResponse.json({
    success: true,
    service: 'Firebase Cloud Messaging',
    project: 'gostaylo-push',
    templates: [
      'NEW_MESSAGE',
      'BOOKING_REQUEST',
      'BOOKING_CONFIRMED',
      'PAYMENT_RECEIVED',
      'CHECKIN_REMINDER',
      'PAYOUT_READY'
    ],
    endpoints: {
      register: 'POST /api/v2/push { action: "register", token: "...", userId: "..." }',
      send: 'POST /api/v2/push { action: "send", targetUserId: "...", templateKey: "...", data: {...} }',
      test: 'POST /api/v2/push { action: "test", token: "..." }'
    }
  });
}
