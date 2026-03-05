/**
 * FunnyRent 2.1 - Telegram Link API
 * POST /api/v2/telegram/link - Generate link code for partner
 * PUT /api/v2/telegram/link - Confirm link with chat_id
 */

import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { supabaseAdmin } from '@/lib/supabase';
import { generateLinkCode } from '@/lib/telegram';

// Temporary storage for link codes (in production use Redis)
const linkCodes = new Map();

export async function POST(request) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing userId' 
      }, { status: 400 });
    }

    // Generate unique code
    const code = generateLinkCode(userId);
    
    // Store with expiration (15 minutes)
    linkCodes.set(code, {
      userId,
      createdAt: Date.now(),
      expiresAt: Date.now() + 15 * 60 * 1000
    });

    // Clean up expired codes
    for (const [key, value] of linkCodes.entries()) {
      if (value.expiresAt < Date.now()) {
        linkCodes.delete(key);
      }
    }

    return NextResponse.json({ 
      success: true, 
      code,
      botUsername: 'GostayloBot', // Replace with actual bot username
      expiresIn: '15 minutes',
      instruction: `Отправьте этот код боту @GostayloBot: /link ${code}`
    });

  } catch (error) {
    console.error('[TELEGRAM LINK ERROR]', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

// Called by Telegram bot webhook when user sends /link code
export async function PUT(request) {
  try {
    const { code, chatId, username } = await request.json();

    if (!code || !chatId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing code or chatId' 
      }, { status: 400 });
    }

    // Find the code
    const linkData = linkCodes.get(code);

    if (!linkData) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid or expired code' 
      }, { status: 400 });
    }

    if (linkData.expiresAt < Date.now()) {
      linkCodes.delete(code);
      return NextResponse.json({ 
        success: false, 
        error: 'Code expired' 
      }, { status: 400 });
    }

    // Update user profile with telegram_id
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ 
        telegram_id: chatId.toString(),
        telegram_username: username || null,
        notification_preferences: {
          email: true,
          telegram: true
        }
      })
      .eq('id', linkData.userId);

    if (updateError) {
      console.error('[TELEGRAM LINK DB ERROR]', updateError);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to update profile' 
      }, { status: 500 });
    }

    // Remove used code
    linkCodes.delete(code);

    return NextResponse.json({ 
      success: true, 
      message: 'Telegram account linked successfully!'
    });

  } catch (error) {
    console.error('[TELEGRAM LINK ERROR]', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
