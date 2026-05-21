/**
 * POST /api/v2/chat/invoice — счёт в чат (SSOT: lib/chat/post-chat-invoice.server.js).
 * GET  /api/v2/chat/invoice?conversationId= | ?id=
 *
 * Клиент: lib/chat/post-chat-invoice.js
 * Сообщение: executePostChatMessageForUser в post-chat-message.server.js
 */

import { NextResponse } from 'next/server'
import {
  executeGetChatInvoices,
  executePostChatInvoice,
} from '@/lib/chat/post-chat-invoice.server.js'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  const { status, body } = await executePostChatInvoice(request)
  return NextResponse.json(body, { status })
}

export async function GET(request) {
  const { status, body } = await executeGetChatInvoices(request)
  return NextResponse.json(body, { status })
}
