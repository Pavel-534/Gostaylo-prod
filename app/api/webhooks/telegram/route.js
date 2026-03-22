/**
 * Gostaylo - Telegram Webhook (thin router)
 * Logic: lib/services/telegram/*
 */

import { NextResponse } from 'next/server'
import { telegramEnv, IMAGE_CONFIG } from '@/lib/services/telegram/env.js'
import { sendTelegram } from '@/lib/services/telegram/api.js'
import { extractEmailFromLinkCommand } from '@/lib/services/telegram/parse.js'
import { handleStatusCheck, handleDeepLink, handleLinkAccount } from '@/lib/services/telegram/handlers/accounts.js'
import { handleMyDrafts } from '@/lib/services/telegram/handlers/drafts.js'
import { handlePhotoUpload } from '@/lib/services/telegram/handlers/lazy-realtor.js'
import { handleCallbackQuery } from '@/lib/services/telegram/handlers/callbacks.js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request) {
  let chatId

  try {
    const update = await request.json()

    if (update?.callback_query) {
      return handleCallbackQuery(update.callback_query)
    }

    const message = update?.message

    if (!message || message.chat?.type !== 'private') {
      return NextResponse.json({ ok: true })
    }

    chatId = message.chat.id
    const text = message.text || message.caption || ''
    const firstName = message.from?.first_name || 'User'
    const username = message.from?.username || ''
    const telegramUserId = message.from?.id
    const photo = message.photo

    const { appUrl } = telegramEnv()
    console.log(
      `[WEBHOOK] Chat: ${chatId}, User: ${firstName}, TelegramId: ${telegramUserId}, Text: ${text?.substring(0, 50)}`
    )

    if (text.startsWith('/help')) {
      await sendTelegram(
        chatId,
        '📖 <b>Инструкция Gostaylo</b>\n\n' +
          '━━━━━━━━━━━━━━━━━━━━\n' +
          '📸 <b>Ленивый риелтор</b>\n' +
          'Отправьте <b>фото + подпись</b> → черновик в ЛК.\n\n' +
          'Пример подписи:\n' +
          '<i>Вилла на Раваи, 25000 THB</i>\n' +
          'или\n' +
          '<i>Апартаменты Патонг\n฿15000/ночь</i>\n\n' +
          '💡 <b>Цена:</b> 25000 thb, ฿25000, 25000 бат\n\n' +
          '━━━━━━━━━━━━━━━━━━━━\n' +
          '📋 <b>Мои черновики:</b> <code>/my</code>\n' +
          '🔗 <b>Привязка:</b> <code>/link email@test.com</code>\n' +
          '📋 <b>Статус:</b> <code>/status</code>\n\n' +
          `🌐 <a href="${appUrl}/partner/listings">Личный кабинет →</a>`
      )
      return NextResponse.json({ ok: true })
    }

    if (text.startsWith('/start')) {
      const deepLinkMatch = text.match(/^\/start\s+link_([a-zA-Z0-9-]+)$/)

      if (deepLinkMatch) {
        const userId = deepLinkMatch[1]
        await handleDeepLink(chatId, userId, firstName, username, telegramUserId)
        return NextResponse.json({ ok: true })
      }

      await sendTelegram(
        chatId,
        `🌴 <b>Aloha, ${firstName}!</b>\n\n` +
          'Добро пожаловать в <b>Gostaylo</b>!\n\n' +
          '📸 <b>Ленивый риелтор</b>\n' +
          'Отправьте <b>фото + подпись</b> → черновик в ЛК.\n' +
          'Дома редактируйте и отправляйте на модерацию.\n\n' +
          '📋 <b>Команды:</b>\n' +
          '/my — Мои черновики\n' +
          '/help — Подробная инструкция\n' +
          '/link email — Привязать аккаунт\n' +
          '/status — Проверить привязку'
      )
      return NextResponse.json({ ok: true })
    }

    if (text.startsWith('/status')) {
      await handleStatusCheck(chatId)
      return NextResponse.json({ ok: true })
    }

    if (text.startsWith('/link')) {
      const email = extractEmailFromLinkCommand(text)
      if (!email) {
        await sendTelegram(
          chatId,
          '❌ <b>Неверный формат</b>\n\n' + 'Используйте: <code>/link ваш@email.com</code>'
        )
        return NextResponse.json({ ok: true })
      }
      await handleLinkAccount(chatId, email, firstName, username)
      return NextResponse.json({ ok: true })
    }

    if (photo && photo.length > 0) {
      await handlePhotoUpload(chatId, message, firstName)
      return NextResponse.json({ ok: true })
    }

    if (text.startsWith('/my')) {
      await handleMyDrafts(chatId)
      return NextResponse.json({ ok: true })
    }

    if (text.startsWith('/draft') || text.startsWith('/lazy')) {
      await sendTelegram(
        chatId,
        '📸 <b>Ленивый риелтор</b>\n\n' +
          'Отправьте <b>фото + подпись</b> (название, цена).\n\n' +
          'Пример: <i>Вилла Раваи, 25000 THB</i>\n\n' +
          '/help — полная инструкция'
      )
      return NextResponse.json({ ok: true })
    }

    if (text && !text.startsWith('/')) {
      await sendTelegram(
        chatId,
        '📸 Отправьте <b>фото с описанием</b> для создания черновика!\n\n' +
          'Пример подписи: <i>Вилла Раваи, 25000 THB</i>\n\n' +
          '/help — полная инструкция'
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[WEBHOOK ERROR]', error)
    if (chatId) {
      await sendTelegram(chatId, '⚠️ Ошибка обработки. Попробуйте ещё раз.')
    }
    return NextResponse.json({ ok: true })
  }
}

export async function GET() {
  const { storageBucket } = telegramEnv()
  return NextResponse.json({
    ok: true,
    service: 'Gostaylo Telegram Webhook',
    version: '7.1',
    stage: 28,
    runtime: 'nodejs',
    modular: true,
    features: [
      'Advanced price extraction',
      'Supabase Storage upload',
      'Server-side image compression (Sharp)',
      'WebP conversion (1920px, 80% quality)',
      'Draft isolation (INACTIVE + metadata.is_draft)',
      '/start, /help, /link, /status',
    ],
    db_column: 'base_price_thb',
    storage_bucket: storageBucket,
    image_config: IMAGE_CONFIG,
    timestamp: new Date().toISOString(),
  })
}
