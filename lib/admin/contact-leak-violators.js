/**
 * Stage 116.3 — SSOT: агрегация нарушителей контактов для админки.
 */

/**
 * @param {object[]} events — строки critical_signal_events
 * @param {number} [maxPerUser]
 * @returns {Map<string, object[]>}
 */
export function groupRecentLeakEventsBySender(events, maxPerUser = 5) {
  const byUser = new Map()
  for (const ev of events || []) {
    const detail = ev.detail && typeof ev.detail === 'object' ? ev.detail : {}
    const senderId = String(detail.senderId || detail.sender_id || '').trim()
    if (!senderId) continue
    if (!byUser.has(senderId)) byUser.set(senderId, [])
    const arr = byUser.get(senderId)
    if (arr.length >= maxPerUser) continue
    arr.push({
      id: ev.id,
      at: ev.created_at,
      conversationId: detail.conversationId || detail.conversation_id || null,
    })
  }
  return byUser
}

/**
 * Объединяет профили со страйками и топ по попыткам (без дублей).
 * @param {object[]} strikeProfiles
 * @param {object[]} topRows — RPC admin_contact_leak_top_violators
 * @param {Map<string, object>} profilesById
 * @param {Map<string, object[]>} recentByUser
 * @param {Map<string, object[]>} listingsByOwner
 * @param {object} chatSafety
 */
export function mergeContactViolatorRows(
  strikeProfiles,
  topRows,
  profilesById,
  recentByUser,
  listingsByOwner,
  chatSafety,
) {
  const threshold = chatSafety.strikeThreshold
  const seen = new Set()
  /** @type {object[]} */
  const out = []

  const pushRow = (userId, base = {}) => {
    const id = String(userId || '').trim()
    if (!id || seen.has(id)) return
    seen.add(id)
    const p = profilesById.get(id)
    const strikes = p?.contact_leak_strikes != null ? Number(p.contact_leak_strikes) : base.strikes ?? 0
    out.push({
      userId: id,
      displayName: displayNameFromProfile(p) || base.displayName || null,
      email: p?.email || base.email || null,
      strikes,
      isBanned: Boolean(p?.is_banned),
      attemptCount: Number(base.attemptCount) || 0,
      lastEventAt: base.lastEventAt || null,
      lastConversationId: base.lastConversationId || null,
      searchPenalized:
        strikes >= threshold && chatSafety.searchRankPenaltyEnabled !== false,
      listings: listingsByOwner.get(id) || [],
      recentEvents: recentByUser.get(id) || [],
    })
  }

  for (const p of strikeProfiles || []) {
    pushRow(p.id, { strikes: Number(p.contact_leak_strikes) || 0 })
  }

  for (const row of topRows || []) {
    pushRow(row.sender_id, {
      attemptCount: Number(row.attempt_count) || 0,
      lastEventAt: row.last_event_at,
      lastConversationId: row.last_conversation_id || null,
    })
  }

  return out.sort((a, b) => {
    const s = (b.strikes || 0) - (a.strikes || 0)
    if (s !== 0) return s
    return (b.attemptCount || 0) - (a.attemptCount || 0)
  })
}

function displayNameFromProfile(p) {
  if (!p) return ''
  const a = [p.first_name, p.last_name].filter(Boolean).join(' ').trim()
  if (a) return a
  return p.email ? String(p.email).split('@')[0] : ''
}
