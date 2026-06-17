/**
 * Stage 154.2 — private chat-attachments bucket: signed URL access for conversation parties.
 */
import { supabaseAdmin } from '@/lib/supabase'
import { canReadConversation, isStaffRole } from '@/lib/services/chat/access'
import { createStorageSignedUrl } from '@/lib/storage/storage-upload.server'
import { STORAGE_BUCKETS } from '@/lib/storage/storage-buckets'

/** Signed URL TTL for chat attachments (20 minutes). */
export const CHAT_ATTACHMENT_SIGNED_URL_TTL_SEC = 20 * 60

/**
 * @param {string | null | undefined} path
 */
export function isSafeChatAttachmentObjectPath(path) {
  const p = String(path || '').trim().replace(/^\/+/, '')
  if (!p || p.includes('..')) return false
  return /^[\w.-]+(?:\/[\w.-]+)*$/.test(p)
}

/**
 * @param {string} objectPath
 */
export function chatAttachmentOwnerIdFromPath(objectPath) {
  return String(objectPath || '').split('/')[0] || ''
}

/**
 * @param {string} userId
 * @param {string} otherUserId
 */
export async function usersShareConversation(userId, otherUserId) {
  const uid = String(userId || '').trim()
  const other = String(otherUserId || '').trim()
  if (!uid || !other || uid === other) return uid === other
  if (!supabaseAdmin) return false

  const { data, error } = await supabaseAdmin
    .from('conversations')
    .select('id, owner_id, partner_id, renter_id, admin_id')
    .or(`renter_id.eq.${uid},partner_id.eq.${uid},owner_id.eq.${uid},admin_id.eq.${uid}`)
    .limit(300)

  if (error || !Array.isArray(data)) return false

  return data.some((row) => {
    const parties = [row.owner_id, row.partner_id, row.renter_id, row.admin_id]
      .filter(Boolean)
      .map((x) => String(x))
    return parties.includes(uid) && parties.includes(other)
  })
}

/**
 * @param {{ userId: string, role: string }} session
 * @param {string} objectPath
 * @param {{ conversationId?: string | null }} [opts]
 */
export async function canReadChatAttachmentObject(session, objectPath, opts = {}) {
  const userId = String(session?.userId || '').trim()
  const role = String(session?.role || '').toUpperCase()
  if (!userId || !isSafeChatAttachmentObjectPath(objectPath)) return false
  if (isStaffRole(role)) return true

  const ownerId = chatAttachmentOwnerIdFromPath(objectPath)
  if (!ownerId) return false
  if (ownerId === userId) return true

  const conversationId = String(opts.conversationId || '').trim()
  if (conversationId && supabaseAdmin) {
    const { data: conversation } = await supabaseAdmin
      .from('conversations')
      .select('id, owner_id, partner_id, renter_id, admin_id')
      .eq('id', conversationId)
      .maybeSingle()
    if (!conversation) return false
    if (!canReadConversation(userId, role, conversation)) return false
    const parties = [conversation.owner_id, conversation.partner_id, conversation.renter_id, conversation.admin_id]
      .filter(Boolean)
      .map((x) => String(x))
    return parties.includes(ownerId)
  }

  return usersShareConversation(userId, ownerId)
}

/**
 * @param {string} objectPath
 * @param {number} [expiresInSec]
 */
export async function createChatAttachmentSignedUrl(objectPath, expiresInSec = CHAT_ATTACHMENT_SIGNED_URL_TTL_SEC) {
  return createStorageSignedUrl(STORAGE_BUCKETS.CHAT_ATTACHMENTS, objectPath, expiresInSec)
}
