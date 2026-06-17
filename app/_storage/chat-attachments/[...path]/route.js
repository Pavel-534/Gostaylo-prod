/**
 * GET /_storage/chat-attachments/{path}
 * Stage 154.2 — private bucket; session + conversation-party check → short-lived signed URL.
 */

import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/api/api-guard'
import { AuthErrorCode } from '@/lib/auth/auth-error-codes'
import {
  canReadChatAttachmentObject,
  createChatAttachmentSignedUrl,
  isSafeChatAttachmentObjectPath,
} from '@/lib/storage/chat-attachment-access'

export const dynamic = 'force-dynamic'

function normalizePath(parts) {
  if (!Array.isArray(parts) || !parts.length) return ''
  return parts.map((x) => String(x || '').trim()).filter(Boolean).join('/')
}

export async function GET(request, { params }) {
  try {
    const objectPath = normalizePath(params?.path)
    if (!isSafeChatAttachmentObjectPath(objectPath)) {
      return NextResponse.json({ success: false, error: 'Invalid path' }, { status: 400 })
    }

    const guard = await requireSession()
    if (!guard.ok) return guard.response

    const conversationId = new URL(request.url).searchParams.get('conversationId')
    const allowed = await canReadChatAttachmentObject(guard.session, objectPath, { conversationId })
    if (!allowed) {
      return NextResponse.json(
        { success: false, error_code: AuthErrorCode.AUTH_ACCESS_FORBIDDEN },
        { status: 403 },
      )
    }

    const signed = await createChatAttachmentSignedUrl(objectPath)
    if (!signed.success || !signed.signedUrl) {
      return NextResponse.json(
        { success: false, error: signed.error || 'Failed to sign URL' },
        { status: 500 },
      )
    }

    return NextResponse.redirect(signed.signedUrl, { status: 302 })
  } catch (error) {
    return NextResponse.json({ success: false, error: error?.message || 'Internal error' }, { status: 500 })
  }
}
