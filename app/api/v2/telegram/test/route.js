/**
 * GoStayLo - Telegram Test API
 * POST /api/v2/telegram/test - Send test alerts to admin group
 */

import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { sendTestAlert, getBotInfo, getChatInfo, initializeTopics } from '@/lib/telegram';
import { getSessionPayload } from '@/lib/services/session-service';

async function requireAdminOrModeratorResponse() {
  const session = await getSessionPayload();
  if (!session?.userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  const role = String(session.role || '').toUpperCase();
  if (role !== 'ADMIN' && role !== 'MODERATOR') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }
  return null;
}

export async function POST(request) {
  try {
    const deny = await requireAdminOrModeratorResponse();
    if (deny) return deny;

    const { type, action } = await request.json();

    // Action: initialize topics
    if (action === 'init-topics') {
      const result = await initializeTopics();
      return NextResponse.json({ 
        success: true, 
        message: 'Topics initialization attempted',
        results: result 
      });
    }

    // Action: get bot info
    if (action === 'bot-info') {
      const botInfo = await getBotInfo();
      const chatInfo = await getChatInfo();
      return NextResponse.json({ 
        success: true, 
        bot: botInfo,
        chat: chatInfo
      });
    }

    // Send test alert
    if (!type) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing type parameter. Use: booking, finance, partner, or general' 
      }, { status: 400 });
    }

    const result = await sendTestAlert(type);

    if (result.ok) {
      return NextResponse.json({ 
        success: true, 
        message: `Test ${type} alert sent successfully!`,
        messageId: result.result?.message_id,
        chatId: result.result?.chat?.id
      });
    } else {
      return NextResponse.json({ 
        success: false, 
        error: result.description || result.error || 'Failed to send message'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('[TELEGRAM TEST ERROR]', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

export async function GET() {
  const deny = await requireAdminOrModeratorResponse();
  if (deny) return deny;

  const botInfo = await getBotInfo();
  const chatInfo = await getChatInfo();

  return NextResponse.json({
    configured: !!process.env.TELEGRAM_BOT_TOKEN,
    adminGroupId: process.env.TELEGRAM_ADMIN_GROUP_ID || null,
    bot: botInfo.ok ? {
      id: botInfo.result?.id,
      username: botInfo.result?.username,
      firstName: botInfo.result?.first_name
    } : null,
    chat: chatInfo.ok ? {
      id: chatInfo.result?.id,
      title: chatInfo.result?.title,
      type: chatInfo.result?.type
    } : null
  });
}
