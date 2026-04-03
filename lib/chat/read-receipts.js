/**
 * Per-side read receipts: renter vs host/partner columns on messages.
 */

/**
 * @param {string} userId
 * @param {{ renter_id?: string, renterId?: string, partner_id?: string, partnerId?: string, owner_id?: string, ownerId?: string }} conversation
 * @returns {'renter' | 'partner' | null}
 */
export function viewerConversationSide(userId, conversation) {
  if (!userId || !conversation) return null
  const uid = String(userId)
  const renter = String(conversation.renter_id ?? conversation.renterId ?? '')
  if (renter && renter === uid) return 'renter'
  const partner = String(conversation.partner_id ?? conversation.partnerId ?? '')
  const owner = String(conversation.owner_id ?? conversation.ownerId ?? '')
  if (partner && partner === uid) return 'partner'
  if (owner && owner === uid) return 'partner'
  return null
}

/**
 * For the sender's bubble: whether the other party has read (double-check UX).
 * @param {Object} row — message row (snake or camel)
 * @param {Object|null} conversation
 */
export function otherPartyHasReadRaw(row, conversation) {
  if (!row) return false
  const raR = row.read_at_renter ?? row.readAtRenter
  const raP = row.read_at_partner ?? row.readAtPartner
  const hasR = raR != null && raR !== ''
  const hasP = raP != null && raP !== ''
  const s = String(row.sender_id ?? row.senderId ?? '')
  const renter = String(conversation?.renter_id ?? conversation?.renterId ?? '')
  if (renter && s === renter) return hasP
  if (renter && s !== renter) return hasR
  return Boolean(row.is_read ?? row.isRead)
}
