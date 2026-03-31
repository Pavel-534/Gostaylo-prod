import { telegramEnv } from '../env.js'
import { sendTelegram, withMainMenuForChat } from '../api.js'
import { getTelegramMessages } from '../messages/index.js'
import { telegramPartnerRoleLabel } from '../locale.js'

export async function handleStatusCheck(chatId, lang) {
  const t = getTelegramMessages(lang)
  const { supabaseUrl, serviceKey, openaiApiKey } = telegramEnv()
  const aiEnabled = Boolean(String(openaiApiKey || '').trim())
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/profiles?telegram_id=eq.${chatId}&select=id,email,first_name,last_name,role`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      }
    )
    const profiles = await res.json()
    const profile = profiles?.[0]

    if (profile) {
      await sendTelegram(
        chatId,
        t.statusOk(profile, lang, aiEnabled),
        await withMainMenuForChat(lang, chatId)
      )
    } else {
      await sendTelegram(chatId, t.statusUnlinked(), await withMainMenuForChat(lang, chatId))
    }
  } catch (e) {
    console.error('[STATUS ERROR]', e)
    await sendTelegram(chatId, t.statusError(), await withMainMenuForChat(lang, chatId))
  }
}

export async function handleDeepLink(chatId, userId, firstName, username, telegramId, lang) {
  const t = getTelegramMessages(lang)
  const { supabaseUrl, serviceKey } = telegramEnv()
  console.log(`[DEEP LINK] Attempt: userId=${userId}, telegramId=${telegramId}, chatId=${chatId}`)

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=id,email,role,first_name,last_name,telegram_id`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      }
    )
    const profiles = await res.json()
    const profile = profiles?.[0]

    console.log(`[DEEP LINK] Profile found:`, profile ? profile.email : 'NOT FOUND')

    if (!profile) {
      await sendTelegram(chatId, t.deepLinkUserNotFound(userId), await withMainMenuForChat(lang, chatId))
      return
    }

    if (profile.telegram_id && profile.telegram_id !== chatId.toString()) {
      await sendTelegram(
        chatId,
        t.deepLinkAlreadyLinked(),
        await withMainMenuForChat(lang, chatId)
      )
      return
    }

    const updateRes = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${profile.id}`, {
      method: 'PATCH',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        telegram_id: chatId.toString(),
        telegram_username: username || firstName,
        telegram_linked_at: new Date().toISOString(),
      }),
    })

    if (!updateRes.ok) {
      const errText = await updateRes.text()
      console.error('[DEEP LINK] Update failed:', errText)
      throw new Error('DB update failed')
    }

    const roleLabel = telegramPartnerRoleLabel(profile.role, lang)

    await sendTelegram(
      chatId,
      t.deepLinkSuccess(profile.first_name, profile.last_name, profile.email, roleLabel),
      await withMainMenuForChat(lang, chatId)
    )

    console.log(`[TELEGRAM] Deep link SUCCESS: ${profile.email} -> ${chatId}`)
  } catch (e) {
    console.error('[DEEP LINK ERROR]', e)
    await sendTelegram(chatId, t.deepLinkError(), await withMainMenuForChat(lang, chatId))
  }
}

export async function handleLinkAccount(chatId, email, firstName, username, lang) {
  const t = getTelegramMessages(lang)
  const { supabaseUrl, serviceKey } = telegramEnv()
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/profiles?email=eq.${encodeURIComponent(email)}&select=id,role,first_name,last_name`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      }
    )
    const profiles = await res.json()
    const profile = profiles?.[0]

    if (!profile) {
      await sendTelegram(chatId, t.linkEmailNotFound(email), await withMainMenuForChat(lang, chatId))
      return
    }

    if (!['RENTER', 'PARTNER', 'ADMIN', 'MODERATOR'].includes(profile.role)) {
      await sendTelegram(chatId, t.linkNotPartner(), await withMainMenuForChat(lang, chatId))
      return
    }

    await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${profile.id}`, {
      method: 'PATCH',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        telegram_id: String(chatId),
        telegram_username: username || firstName,
        telegram_linked_at: new Date().toISOString(),
      }),
    })

    const roleLabel = telegramPartnerRoleLabel(profile.role, lang)

    await sendTelegram(
      chatId,
      t.linkSuccess(profile.first_name, profile.last_name, roleLabel),
      await withMainMenuForChat(lang, chatId)
    )
  } catch (e) {
    console.error('[LINK ERROR]', e)
    await sendTelegram(chatId, t.linkError(), await withMainMenuForChat(lang, chatId))
  }
}
