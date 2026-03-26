/**
 * DEPRECATED — этот маршрут отключён.
 * Используй /api/v2/chat/conversations?id=<id>&enrich=1 (GET) или /api/v2/chat/read (mark read).
 */
import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

const GONE = (method) =>
  NextResponse.json(
    {
      success: false,
      error: `${method} /api/v2/conversations/:id is retired. Use /api/v2/chat/conversations?id=<id>&enrich=1`,
      migration: '/api/v2/chat/conversations',
    },
    {
      status: 410,
      headers: { 'X-Deprecated': '1', Link: '</api/v2/chat/conversations>; rel="successor-version"' },
    }
  )

export const GET = () => GONE('GET')
export const PATCH = () => GONE('PATCH')
