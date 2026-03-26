/**
 * DEPRECATED — этот маршрут отключён.
 * Используй /api/v2/chat/messages (сессионная аутентификация, проверка участника).
 */
import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

const GONE = (method) =>
  NextResponse.json(
    {
      success: false,
      error: `${method} /api/v2/messages is retired. Use /api/v2/chat/messages instead.`,
      migration: '/api/v2/chat/messages',
    },
    {
      status: 410,
      headers: { 'X-Deprecated': '1', Link: '</api/v2/chat/messages>; rel="successor-version"' },
    }
  )

export const GET = () => GONE('GET')
export const POST = () => GONE('POST')
