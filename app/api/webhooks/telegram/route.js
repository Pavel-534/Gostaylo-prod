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
import { getTelegramMessages } from '@/lib/services/telegram/messages/index.js'
import { resolveTelegramLanguageForChat, normalizeTelegramUiLang } from '@/lib/services/telegram/locale.js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request) {
  let chatId
  let lang = 'en'

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
    const telegramLangCode = message.from?.language_code

    lang = await resolveTelegramLanguageForChat(chatId, telegramLangCode)
    const t = getTelegramMessages(lang)

    console.log(
      `[WEBHOOK] Chat: ${chatId}, User: ${firstName}, TelegramId: ${telegramUserId}, Lang: ${lang}, Text: ${text?.substring(0, 50)}`
    )

    if (text.startsWith('/help')) {
      await sendTelegram(chatId, t.help(lang))
      return NextResponse.json({ ok: true })
    }

    if (text.startsWith('/start')) {
      // /start link_<id> или /start@BotUsername link_<id>
      const deepLinkMatch = text.match(/^\/start(?:@[A-Za-z0-9_]+)?\s+link_([a-zA-Z0-9_-]+)$/i)

      if (deepLinkMatch) {
        const userId = deepLinkMatch[1]
        await handleDeepLink(chatId, userId, firstName, username, telegramUserId, lang)
        return NextResponse.json({ ok: true })
      }

      await sendTelegram(chatId, t.start(firstName, lang))
      return NextResponse.json({ ok: true })
    }

    if (text.startsWith('/status')) {
      await handleStatusCheck(chatId, lang)
      return NextResponse.json({ ok: true })
    }

    if (text.startsWith('/link')) {
      const email = extractEmailFromLinkCommand(text)
      if (!email) {
        await sendTelegram(chatId, t.linkInvalidFormat)
        return NextResponse.json({ ok: true })
      }
      await handleLinkAccount(chatId, email, firstName, username, lang)
      return NextResponse.json({ ok: true })
    }

    if (photo && photo.length > 0) {
      await handlePhotoUpload(chatId, message, firstName, lang)
      return NextResponse.json({ ok: true })
    }

    if (text.startsWith('/my')) {
      await handleMyDrafts(chatId, lang)
      return NextResponse.json({ ok: true })
    }

    if (text.startsWith('/draft') || text.startsWith('/lazy')) {
      await sendTelegram(chatId, t.lazyDraftHint)
      return NextResponse.json({ ok: true })
    }

    if (text && !text.startsWith('/')) {
      await sendTelegram(chatId, t.plainTextNeedsPhoto)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[WEBHOOK ERROR]', error)
    if (chatId) {
      const errLang = lang || normalizeTelegramUiLang(undefined)
      await sendTelegram(chatId, getTelegramMessages(errLang).webhookError)
    }
    return NextResponse.json({ ok: true })
  }
}

export async function GET() {
  const { storageBucket } = telegramEnv()
  return NextResponse.json({
    ok: true,
    service: 'Gostaylo Telegram Webhook',
    version: '7.2',
    stage: 28,
    runtime: 'nodejs',
    modular: true,
    i18n: ['ru', 'en'],
    features: [
      'Advanced price extraction',
      'Supabase Storage upload',
      'Server-side image compression (Sharp)',
      'WebP conversion (1920px, 80% quality)',
      'Draft isolation (INACTIVE + metadata.is_draft)',
      '/start, /help, /link, /status',
      'Profile language + Telegram language_code',
    ],
    db_column: 'base_price_thb',
    storage_bucket: storageBucket,
    image_config: IMAGE_CONFIG,
    timestamp: new Date().toISOString(),
  })
}

