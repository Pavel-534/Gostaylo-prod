/**
 * Gostaylo - Telegram Webhook (thin router)
 * Logic: lib/services/telegram/*
 */

import { NextResponse } from 'next/server'
import { getPublicSiteUrl, getTelegramWebhookUrl } from '@/lib/site-url.js'
import { getTelegramBotUsername } from '@/lib/telegram-bot-public'
import { telegramEnv, IMAGE_CONFIG } from '@/lib/services/telegram/env.js'
import { sendTelegram, withMainMenuForChat } from '@/lib/services/telegram/api.js'
import { extractEmailFromLinkCommand } from '@/lib/services/telegram/parse.js'
import { handleStatusCheck, handleDeepLink, handleLinkAccount } from '@/lib/services/telegram/handlers/accounts.js'
import { handleMyDrafts } from '@/lib/services/telegram/handlers/drafts.js'
import { handlePhotoUpload } from '@/lib/services/telegram/handlers/lazy-realtor.js'
import { handleCallbackQuery } from '@/lib/services/telegram/handlers/callbacks.js'
import { getTelegramMessages } from '@/lib/services/telegram/messages/index.js'
import { resolveTelegramLanguageForChat, normalizeTelegramUiLang } from '@/lib/services/telegram/locale.js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
/** Ленивый риелтор: скачивание фото + Sharp — не обрывать на дефолтных ~10s */
export const maxDuration = 60

export async function POST(request) {
  let chatId
  let lang = 'en'

  try {
    let update
    try {
      update = await request.json()
    } catch (parseErr) {
      console.error('[WEBHOOK] Invalid or empty JSON body', parseErr?.message || parseErr)
      return NextResponse.json({ ok: true })
    }

    const { botToken } = telegramEnv()
    if (!botToken) {
      console.error(
        '[WEBHOOK] TELEGRAM_BOT_TOKEN missing — updates are accepted but replies cannot be sent. Set token in Vercel/hosting env.'
      )
    }

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
      await sendTelegram(chatId, t.help(lang), await withMainMenuForChat(lang, chatId))
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

      await sendTelegram(chatId, t.start(firstName, lang), await withMainMenuForChat(lang, chatId))
      return NextResponse.json({ ok: true })
    }

    if (text.startsWith('/status')) {
      await handleStatusCheck(chatId, lang)
      return NextResponse.json({ ok: true })
    }

    if (text.startsWith('/link')) {
      const email = extractEmailFromLinkCommand(text)
      if (!email) {
        await sendTelegram(chatId, t.linkInvalidFormat, await withMainMenuForChat(lang, chatId))
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
      await sendTelegram(chatId, t.lazyDraftHint, await withMainMenuForChat(lang, chatId))
      return NextResponse.json({ ok: true })
    }

    if (text && !text.startsWith('/')) {
      await sendTelegram(chatId, t.plainTextNeedsPhoto, await withMainMenuForChat(lang, chatId))
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[WEBHOOK ERROR]', error)
    if (chatId) {
      const errLang = lang || normalizeTelegramUiLang(undefined)
      await sendTelegram(
        chatId,
        getTelegramMessages(errLang).webhookError,
        await withMainMenuForChat(errLang, chatId)
      )
    }
    return NextResponse.json({ ok: true })
  }
}

export async function GET() {
  const { storageBucket, botToken } = telegramEnv()
  const publicSiteUrl = getPublicSiteUrl()
  const expectedWebhookUrl = getTelegramWebhookUrl()
  const botUsernameResolved = getTelegramBotUsername()

  let telegramWebhookInfo = null
  /** Имя бота по токену (источник истины); сравнение с тем, что подхватил сайт из env/дефолта */
  let botUsernameFromToken = null
  let usernameMatchesTokenBot = null

  if (botToken) {
    try {
      const [whRes, meRes] = await Promise.all([
        fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`),
        fetch(`https://api.telegram.org/bot${botToken}/getMe`),
      ])
      const whJson = await whRes.json()
      const meJson = await meRes.json()

      if (meJson?.ok && meJson.result?.username) {
        botUsernameFromToken = String(meJson.result.username)
        usernameMatchesTokenBot =
          botUsernameFromToken.toLowerCase() === botUsernameResolved.toLowerCase()
      }

      if (whJson?.ok && whJson.result) {
        const r = whJson.result
        telegramWebhookInfo = {
          url: r.url || null,
          url_matches_expected:
            Boolean(r.url) &&
            String(r.url).replace(/\/$/, '') === String(expectedWebhookUrl).replace(/\/$/, ''),
          pending_update_count: r.pending_update_count ?? 0,
          last_error_message: r.last_error_message || null,
          last_error_date: r.last_error_date
            ? new Date(r.last_error_date * 1000).toISOString()
            : null,
        }
      }
    } catch (e) {
      telegramWebhookInfo = { fetch_error: e?.message || 'getWebhookInfo/getMe failed' }
    }
  }

  return NextResponse.json({
    ok: true,
    service: 'Gostaylo Telegram Webhook',
    version: '7.2',
    stage: 28,
    runtime: 'nodejs',
    modular: true,
    /** Без утечки секрета: достаточно для проверки, что прод-сервер видит токен */
    bot_token_configured: Boolean(botToken),
    /**
     * Публичное имя бота, которое использует код для ссылок t.me (env NEXT_PUBLIC_TELEGRAM_BOT_USERNAME или дефолт).
     */
    bot_username: botUsernameResolved,
    bot_open_url: `https://t.me/${botUsernameResolved}`,
    /** @username бота, который возвращает Telegram по TELEGRAM_BOT_TOKEN; null если токена нет или getMe не удался */
    bot_username_from_token: botUsernameFromToken,
    /** true, если токен от того же бота, что и ссылки на сайте */
    bot_username_matches_token: usernameMatchesTokenBot,
    public_site_url: publicSiteUrl,
    expected_webhook_url: expectedWebhookUrl,
    telegram_webhook_info: telegramWebhookInfo,
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

