/**
 * POST /api/v2/feedback — product feedback (site bug / UX), session required.
 * Stage 200.137 — ops via Telegram + support email; not chat escalate.
 */

import { NextResponse } from 'next/server'
import { requireSessionUser } from '@/lib/privacy/require-session-user'
import {
  allowProductFeedbackRate,
  validateProductFeedbackBody,
  deliverProductFeedback,
} from '@/lib/feedback/submit-product-feedback.js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request) {
  const auth = await requireSessionUser()
  if (auth.error) return auth.error

  let body = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const validated = validateProductFeedbackBody(body, {
    userId: auth.userId,
    email: auth.profile?.email ?? null,
    role: auth.profile?.role ?? null,
  })

  if (!validated.ok) {
    return NextResponse.json(
      { success: false, error: validated.error },
      { status: validated.status },
    )
  }

  if (!allowProductFeedbackRate(auth.userId)) {
    return NextResponse.json(
      { success: false, error: 'RATE_LIMITED' },
      { status: 429 },
    )
  }

  await deliverProductFeedback(validated.payload)

  return NextResponse.json({ success: true })
}
