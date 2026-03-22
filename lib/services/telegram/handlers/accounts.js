import { telegramEnv } from '../env.js'
import { sendTelegram } from '../api.js'

export async function handleStatusCheck(chatId) {
  const { supabaseUrl, serviceKey, appUrl } = telegramEnv()
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
        '✅ <b>Аккаунт привязан</b>\n\n' +
          `👤 ${profile.first_name || ''} ${profile.last_name || ''}\n` +
          `📧 ${profile.email}\n` +
          `🏷 ${profile.role}\n\n` +
          `🌐 ${appUrl}`
      )
    } else {
      await sendTelegram(chatId, '❌ <b>Аккаунт не привязан</b>\n\n' + '<code>/link ваш@email.com</code>')
    }
  } catch (e) {
    console.error('[STATUS ERROR]', e)
    await sendTelegram(chatId, '⚠️ Ошибка проверки статуса.')
  }
}

export async function handleDeepLink(chatId, userId, firstName, username, telegramId) {
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
      await sendTelegram(
        chatId,
        '❌ <b>Ошибка привязки</b>\n\n' +
          'Пользователь не найден. Попробуйте ещё раз с профиля.\n\n' +
          `<i>ID: ${userId}</i>`
      )
      return
    }

    if (profile.telegram_id && profile.telegram_id !== chatId.toString()) {
      await sendTelegram(
        chatId,
        '❌ <b>Аккаунт уже привязан</b>\n\n' +
          'Этот аккаунт уже связан с другим Telegram.\n' +
          'Обратитесь в поддержку для смены привязки.'
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

    const roleLabel =
      {
        ADMIN: 'Администратор',
        PARTNER: 'Партнёр',
        RENTER: 'Арендатор',
        MODERATOR: 'Модератор',
      }[profile.role] || profile.role

    await sendTelegram(
      chatId,
      '✅ <b>Успешно!</b>\n\n' +
        '<b>Telegram привязан к вашему аккаунту:</b>\n\n' +
        `👤 ${profile.first_name || ''} ${profile.last_name || ''}\n` +
        `📧 ${profile.email}\n` +
        `🏷 ${roleLabel}\n\n` +
        '🔔 Теперь вы будете получать уведомления о бронированиях и важных событиях.'
    )

    console.log(`[TELEGRAM] Deep link SUCCESS: ${profile.email} -> ${chatId}`)
  } catch (e) {
    console.error('[DEEP LINK ERROR]', e)
    await sendTelegram(
      chatId,
      '⚠️ <b>Ошибка привязки</b>\n\n' +
        'Произошла техническая ошибка. Попробуйте позже или обратитесь в поддержку.'
    )
  }
}

export async function handleLinkAccount(chatId, email, firstName, username) {
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
      await sendTelegram(chatId, `❌ Email <b>${email}</b> не найден в системе.`)
      return
    }

    if (!['PARTNER', 'ADMIN', 'MODERATOR'].includes(profile.role)) {
      await sendTelegram(chatId, '❌ Бот доступен только для партнёров и админов.')
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

    await sendTelegram(
      chatId,
      '✅ <b>Аккаунт привязан!</b>\n\n' +
        `👤 ${profile.first_name || ''} ${profile.last_name || ''}\n` +
        `🏷 ${profile.role}\n\n` +
        '📸 Отправьте фото для создания черновика!'
    )
  } catch (e) {
    console.error('[LINK ERROR]', e)
    await sendTelegram(chatId, '⚠️ Ошибка привязки.')
  }
}
