/**
 * DEPRECATED — этот маршрут отключён.
 * Используй /api/v2/chat/conversations (сессионная аутентификация, нет userId в параметрах).
 */
import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

const GONE = (method) =>
  NextResponse.json(
    {
      success: false,
      error: `${method} /api/v2/conversations is retired. Use /api/v2/chat/conversations instead.`,
      migration: '/api/v2/chat/conversations',
    },
    {
      status: 410,
      headers: { 'X-Deprecated': '1', Link: '</api/v2/chat/conversations>; rel="successor-version"' },
    }
  )

export const GET = () => GONE('GET')
export const POST = () => GONE('POST')
