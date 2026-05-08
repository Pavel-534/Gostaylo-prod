import { supabaseAdmin } from '@/lib/supabase'
import { getPublicSiteUrl, getSiteDisplayName } from '@/lib/site-url.js'
import {
  shouldStillSendNewMessagePush,
  FCM_INSTANT_PUSH_DEBUG,
  PREMIUM_CHAT_PUSH_DELAY_MS,
} from '@/lib/services/push/push-policy.js'
import { resolveSilentForPushDelivery } from '@/lib/services/push/push-quiet-handler.js'

function isChatBatchTableMissing(err) {
  const m = String(err?.message || '')
  return m.includes('chat_push_delivery_batch') && m.includes('Could not find the table')
}

function hasSupabaseFrom(client) {
  return !!client && typeof client.from === 'function'
}

export async function scheduleSimpleDelayedPush(
  recipientId,
  tokensDelayed,
  data,
  lang,
  { scheduleBackgroundWork, sendPush, fetchUserPushTokenRows },
) {
  const messageId = data.messageId
  const tokens = [...tokensDelayed]
  await scheduleBackgroundWork(async () => {
    await new Promise((r) => setTimeout(r, PREMIUM_CHAT_PUSH_DELAY_MS))
    const stillSend = await shouldStillSendNewMessagePush(messageId)
    if (!stillSend) {
      console.log('[FCM] Delayed NEW_MESSAGE skipped (read or missing msg):', messageId)
      return
    }
    const rows = await fetchUserPushTokenRows(recipientId)
    const silent = await resolveSilentForPushDelivery(recipientId, rows, {
      bookingId: data.bookingId || null,
      listingId: data.listingId || null,
      emergencyBypass: data.emergencyBypass === true,
    })
    await Promise.allSettled(
      tokens.map((token) =>
        sendPush(token, 'NEW_MESSAGE', { ...data, silentDelivery: silent }, lang, {
          profileId: recipientId,
        }),
      ),
    )
  })
}

export async function mergeOrInsertDelayedChatBatch(
  recipientId,
  senderId,
  tokensDelayed,
  data,
  lang,
  deps,
) {
  const messageId = data.messageId
  if (!senderId || !messageId) {
    await scheduleSimpleDelayedPush(recipientId, tokensDelayed, data, lang, deps)
    return
  }

  const deadlineIso = new Date(Date.now() + PREMIUM_CHAT_PUSH_DELAY_MS).toISOString()
  const { data: row, error: selErr } = await supabaseAdmin
    .from('chat_push_delivery_batch')
    .select('*')
    .eq('recipient_id', recipientId)
    .eq('sender_id', String(senderId))
    .maybeSingle()

  if (selErr && isChatBatchTableMissing(selErr)) {
    await scheduleSimpleDelayedPush(recipientId, tokensDelayed, data, lang, deps)
    return
  }
  if (selErr && !isChatBatchTableMissing(selErr)) {
    console.warn('[FCM] batch select:', selErr.message)
  }

  const applyMerge = async (existing) => {
    const msgIds = [...new Set([...(existing.message_ids || []), messageId])]
    const pTok = [...new Set([...(existing.pending_tokens || []), ...tokensDelayed])]
    const { error: upErr } = await supabaseAdmin
      .from('chat_push_delivery_batch')
      .update({
        message_ids: msgIds,
        pending_tokens: pTok,
        conversation_id: data.conversationId || existing.conversation_id,
        sender_display_name: data.sender || existing.sender_display_name,
        updated_at: new Date().toISOString(),
      })
      .eq('recipient_id', recipientId)
      .eq('sender_id', String(senderId))
    if (upErr) console.warn('[FCM] batch merge:', upErr.message)
  }

  let scheduleLeader = false
  if (row) {
    await applyMerge(row)
  } else {
    const { error: insErr } = await supabaseAdmin.from('chat_push_delivery_batch').insert({
      recipient_id: recipientId,
      sender_id: String(senderId),
      conversation_id: data.conversationId,
      sender_display_name: data.sender,
      message_ids: [messageId],
      pending_tokens: tokensDelayed,
      window_deadline_at: deadlineIso,
    })
    if (insErr) {
      if (isChatBatchTableMissing(insErr)) {
        await scheduleSimpleDelayedPush(recipientId, tokensDelayed, data, lang, deps)
        return
      }
      const { data: row2 } = await supabaseAdmin
        .from('chat_push_delivery_batch')
        .select('*')
        .eq('recipient_id', recipientId)
        .eq('sender_id', String(senderId))
        .maybeSingle()
      if (row2) {
        await applyMerge(row2)
      } else {
        console.warn('[FCM] batch insert:', insErr.message)
        await scheduleSimpleDelayedPush(recipientId, tokensDelayed, data, lang, deps)
      }
    } else {
      scheduleLeader = true
    }
  }

  if (scheduleLeader) {
    await deps.scheduleBackgroundWork(() => runChatPushBatchLeader(recipientId, String(senderId), lang, deps))
  }
}

export async function runChatPushBatchLeader(recipientId, senderId, lang, deps) {
  const { data: row0 } = await supabaseAdmin
    .from('chat_push_delivery_batch')
    .select('window_deadline_at')
    .eq('recipient_id', recipientId)
    .eq('sender_id', senderId)
    .maybeSingle()
  if (!row0?.window_deadline_at) return

  const deadlineMs = new Date(row0.window_deadline_at).getTime()
  const waitMs = Math.max(0, deadlineMs - Date.now())
  await new Promise((r) => setTimeout(r, waitMs))

  const { data: deletedRows, error: delErr } = await supabaseAdmin
    .from('chat_push_delivery_batch')
    .delete()
    .eq('recipient_id', recipientId)
    .eq('sender_id', senderId)
    .select('*')

  if (delErr || !Array.isArray(deletedRows) || deletedRows.length === 0) return
  const snap = deletedRows[0]
  await deliverChatBatchSnapshot({ snap, recipientId, senderId, lang, source: 'leader' }, deps)
}

export async function resolveRecipientLanguage(recipientId, fallback = 'ru') {
  const { data } = await supabaseAdmin.from('profiles').select('language').eq('id', recipientId).maybeSingle()
  return String(data?.language || fallback)
}

export async function deliverChatBatchSnapshot(
  { snap, recipientId, senderId, lang, source = 'leader' },
  { sendPush, fetchUserPushTokenRows, fetchLegacyProfileToken },
) {
  const ids = Array.isArray(snap?.message_ids) ? snap.message_ids : []
  const lastId = ids.length ? ids[ids.length - 1] : null
  if (!lastId) return { delivered: 0, reason: 'empty_message_ids', source }

  const stillSend = await shouldStillSendNewMessagePush(lastId)
  if (!stillSend) {
    console.log('[FCM] Batched NEW_MESSAGE skipped (read or missing):', lastId, source)
    return { delivered: 0, reason: 'already_read', source }
  }

  const batchCount = ids.length
  const base = (getPublicSiteUrl() || '').replace(/\/$/, '')
  const cid = encodeURIComponent(snap.conversation_id)
  const link = `${base}/messages/${cid}`
  const tokenRows = await fetchUserPushTokenRows(recipientId)
  let bookingId = null
  let listingId = null
  if (snap?.conversation_id) {
    const { data: conv } = await supabaseAdmin
      .from('conversations')
      .select('booking_id')
      .eq('id', String(snap.conversation_id))
      .maybeSingle()
    if (conv?.booking_id) {
      bookingId = bookingId || String(conv.booking_id)
      if (!listingId && bookingId) {
        const { data: b } = await supabaseAdmin
          .from('bookings')
          .select('listing_id')
          .eq('id', String(bookingId))
          .maybeSingle()
        if (b?.listing_id) listingId = String(b.listing_id)
      }
    }
  }
  const silent = await resolveSilentForPushDelivery(recipientId, tokenRows, {
    bookingId,
    listingId,
    emergencyBypass: false,
  })
  const valid = new Set(tokenRows.map((r) => r.token).filter(Boolean))
  const legacy = await fetchLegacyProfileToken(recipientId)
  if (legacy) valid.add(legacy)
  const pending = [...new Set((snap.pending_tokens || []).filter(Boolean))]
  const readyTokens = pending.filter((t) => valid.has(t))
  if (readyTokens.length === 0) return { delivered: 0, reason: 'no_valid_tokens', source }

  const payload = {
    sender: snap.sender_display_name || getSiteDisplayName(),
    link,
    conversationId: snap.conversation_id,
    messageId: lastId,
    messageBatchCount: String(batchCount),
    senderId,
    silentDelivery: silent,
  }
  const settled = await Promise.allSettled(
    readyTokens.map((token) => sendPush(token, 'NEW_MESSAGE', payload, lang, { profileId: recipientId })),
  )
  const delivered = settled.filter((r) => r.status === 'fulfilled' && r.value?.success).length
  return { delivered, attempted: readyTokens.length, source }
}

export async function runStaleChatPushSweeper(
  { staleMinutes = 10, limit = 200 } = {},
  { sendPush, fetchUserPushTokenRows, fetchLegacyProfileToken },
) {
  const cutoffIso = new Date(Date.now() - staleMinutes * 60_000).toISOString()
  const rowErrors = []
  if (!hasSupabaseFrom(supabaseAdmin)) {
    return { ok: false, error: 'supabaseAdmin.from is unavailable', staleMinutes, cutoffIso }
  }
  try {
    const { data: staleRows, error } = await supabaseAdmin
      .from('chat_push_delivery_batch')
      .lt('window_deadline_at', cutoffIso)
      .select('*')
      .order('window_deadline_at', { ascending: true })
      .limit(limit)
    if (error) {
      if (isChatBatchTableMissing(error)) {
        return { ok: true, tableMissing: true, staleMinutes, cutoffIso, checked: 0, delivered: 0 }
      }
      console.error('[FCM] push-sweeper query failed', error.message, error)
      return { ok: false, error: error.message || 'sweeper query failed', staleMinutes, cutoffIso, checked: 0, delivered: 0 }
    }
    const rows = Array.isArray(staleRows) ? staleRows : []
    if (rows.length === 0) {
      return { ok: true, tableMissing: false, staleMinutes, cutoffIso, checked: 0, stuckFound: 0, delivered: 0, cleared: 0, status: 'ok' }
    }
    for (const row of rows) {
      const recipientId = row?.recipient_id
      const senderId = String(row?.sender_id || '')
      if (!recipientId || !senderId) continue
      try {
        const { error: delErr } = await supabaseAdmin
          .from('chat_push_delivery_batch')
          .delete()
          .eq('recipient_id', recipientId)
          .eq('sender_id', senderId)
        if (delErr) console.error('[FCM] push-sweeper batch delete', delErr.message, { recipientId, senderId })
      } catch (e) {
        console.error('[FCM] push-sweeper batch delete exception', e?.message, e?.stack, { recipientId, senderId })
        rowErrors.push({ step: 'delete', recipientId, senderId, message: String(e?.message || e) })
      }
    }

    let delivered = 0
    let stuckFound = 0
    for (const row of rows) {
      stuckFound += 1
      const recipientId = row?.recipient_id
      const senderId = String(row?.sender_id || '')
      if (!recipientId || !senderId) continue
      try {
        const lang = await resolveRecipientLanguage(recipientId, 'ru')
        const result = await deliverChatBatchSnapshot(
          { snap: row, recipientId, senderId, lang, source: 'sweeper' },
          { sendPush, fetchUserPushTokenRows, fetchLegacyProfileToken },
        )
        delivered += Number(result?.delivered || 0)
      } catch (e) {
        console.error('[FCM] push-sweeper deliver row failed', e?.message, e?.stack, {
          recipientId,
          senderId,
          conversationId: row?.conversation_id,
        })
        rowErrors.push({ step: 'deliver', recipientId, senderId, message: String(e?.message || e) })
      }
    }

    return {
      ok: true,
      tableMissing: false,
      staleMinutes,
      cutoffIso,
      checked: rows.length,
      stuckFound,
      delivered,
      cleared: rows.length,
      status: rows.length > 0 ? 'stuck_messages_found' : 'ok',
      rowErrors: rowErrors.length ? rowErrors : undefined,
    }
  } catch (e) {
    console.error('[FCM] runStaleChatPushSweeper fatal', e?.message, e?.stack)
    return {
      ok: false,
      error: e?.message || String(e),
      staleMinutes,
      cutoffIso,
      rowErrors: rowErrors.length ? rowErrors : undefined,
    }
  }
}

export async function sendNewMessageWithSmartDelivery(userId, data, lang, legacyToken, deps) {
  const rows = await deps.fetchUserPushTokenRows(userId)
  const byToken = new Map()
  for (const row of rows) {
    if (row.token) byToken.set(row.token, row)
  }
  if (legacyToken && !byToken.has(legacyToken)) {
    byToken.set(legacyToken, { token: legacyToken, last_seen_at: null, device_info: {} })
  }
  const enriched = [...byToken.values()]
  if (enriched.length === 0) {
    console.log(`[FCM] No token for user ${userId}`)
    return { success: false, error: 'No FCM token' }
  }

  const instant = []
  const delayed = []
  if (FCM_INSTANT_PUSH_DEBUG) {
    console.log('[FCM] FCM_INSTANT_PUSH_DEBUG=1 — instant NEW_MESSAGE for all tokens (no delayed batch)')
    for (const row of enriched) instant.push(row.token)
  } else {
    for (const row of enriched) delayed.push(row.token)
  }

  let ok = 0
  let fail = 0
  if (instant.length) {
    const silentInstant = await resolveSilentForPushDelivery(userId, enriched, {
      bookingId: data.bookingId || null,
      listingId: data.listingId || null,
      emergencyBypass: data.emergencyBypass === true,
    })
    const settled = await Promise.allSettled(
      instant.map((token) =>
        deps.sendPush(token, 'NEW_MESSAGE', { ...data, silentDelivery: silentInstant }, lang, {
          profileId: userId,
        }),
      ),
    )
    const passed = settled.filter((r) => r.status === 'fulfilled' && r.value?.success).length
    ok += passed
    fail += settled.length - passed
  }
  if (delayed.length) {
    await mergeOrInsertDelayedChatBatch(userId, data.senderId, [...delayed], data, lang, deps)
  }
  return {
    success: ok > 0 || delayed.length > 0,
    sent: ok,
    failed: fail,
    total: enriched.length,
    smartInstant: instant.length,
    smartScheduled: delayed.length,
  }
}
