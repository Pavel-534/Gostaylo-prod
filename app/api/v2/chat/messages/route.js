/**
 * Stage 110.4 — thin route; SSOT: lib/chat/post-chat-message.server.js
 *
 * POST — отправка · GET ?conversationId= — история
 * Клиент: lib/chat/post-chat-message.js
 * Импорт server handlers: `@/lib/chat/post-chat-message.server.js` (не из route).
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
