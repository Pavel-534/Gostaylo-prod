/**
 * POST /api/v2/chat/messages — отправка (SSOT: lib/chat/post-chat-message.server.js).
 * GET /api/v2/chat/messages?conversationId= — история.
 *
 * Клиент: lib/chat/post-chat-message.js
 */

import { NextResponse } from 'next/server'
import {
  executeGetChatMessages,
  executePostChatMessage,
} from '@/lib/chat/post-chat-message.server.js'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const { status, body } = await executeGetChatMessages(request)
  return NextResponse.json(body, { status })
}

export async function POST(request) {
  const { status, body } = await executePostChatMessage(request)
  return NextResponse.json(body, { status })
}
