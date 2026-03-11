/**
 * Telegram Booking Callback API
 * Handles approve/decline callbacks from Telegram inline buttons
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

export async function POST(request) {
  try {
    const body = await request.json()
    const { callback_query } = body

    if (!callback_query) {
      return NextResponse.json({ ok: true })
    }

    const { id: callbackId, data, from, message } = callback_query
    const chatId = message?.chat?.id

    // Parse callback data: approve_booking_xxx or decline_booking_xxx
    const match = data?.match(/^(approve|decline)_booking_(.+)$/)
    if (!match) {
      await answerCallback(callbackId, 'Неизвестная команда')
      return NextResponse.json({ ok: true })
    }

    const action = match[1]
    const bookingId = match[2]

    // Initialize Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // Verify booking exists and belongs to this partner
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*, listing:listings(title, owner_id), partner:profiles!bookings_partner_id_fkey(telegram_id, first_name)')
      .eq('id', bookingId)
      .single()

    if (bookingError || !booking) {
      await answerCallback(callbackId, 'Бронирование не найдено')
      return NextResponse.json({ ok: true })
    }

    // Verify telegram user owns this booking
    if (booking.partner?.telegram_id?.toString() !== from?.id?.toString()) {
      await answerCallback(callbackId, 'У вас нет прав на это действие')
      return NextResponse.json({ ok: true })
    }

    // Check if already processed
    if (booking.status !== 'PENDING') {
      await answerCallback(callbackId, `Бронирование уже обработано (${booking.status})`)
      return NextResponse.json({ ok: true })
    }

    // Process action
    const newStatus = action === 'approve' ? 'CONFIRMED' : 'CANCELLED'
    const timestamp = new Date().toISOString()

    const updateData = {
      status: newStatus,
      updated_at: timestamp,
      ...(action === 'approve' ? { confirmed_at: timestamp } : { cancelled_at: timestamp })
    }

    const { error: updateError } = await supabase
      .from('bookings')
      .update(updateData)
      .eq('id', bookingId)

    if (updateError) {
      await answerCallback(callbackId, 'Ошибка обновления')
      return NextResponse.json({ ok: true })
    }

    // Answer callback
    const successMessage = action === 'approve' 
      ? '✅ Бронирование подтверждено!' 
      : '❌ Бронирование отклонено'
    await answerCallback(callbackId, successMessage)

    // Update the original message
    const partnerEarnings = booking.price_thb - booking.commission_thb
    const updatedText = action === 'approve'
      ? `✅ <b>БРОНИРОВАНИЕ ПОДТВЕРЖДЕНО</b>\n\n` +
        `📍 ${booking.listing?.title || 'Объект'}\n` +
        `👤 ${booking.guest_name}\n` +
        `📅 ${booking.check_in} → ${booking.check_out}\n` +
        `💵 Ваш доход: ฿${partnerEarnings.toLocaleString()}\n\n` +
        `Гость получит уведомление о подтверждении.`
      : `❌ <b>БРОНИРОВАНИЕ ОТКЛОНЕНО</b>\n\n` +
        `📍 ${booking.listing?.title || 'Объект'}\n` +
        `👤 ${booking.guest_name}\n` +
        `📅 ${booking.check_in} → ${booking.check_out}\n\n` +
        `Гость получит уведомление об отклонении.`

    await editMessage(chatId, message.message_id, updatedText)

    // TODO: Send notification to guest about approval/decline

    return NextResponse.json({ ok: true })

  } catch (error) {
    console.error('Telegram callback error:', error)
    return NextResponse.json({ ok: true })
  }
}

async function answerCallback(callbackId, text) {
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackId,
        text,
        show_alert: true
      })
    })
  } catch (e) {
    console.error('answerCallback error:', e)
  }
}

async function editMessage(chatId, messageId, text) {
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: 'HTML'
      })
    })
  } catch (e) {
    console.error('editMessage error:', e)
  }
}
