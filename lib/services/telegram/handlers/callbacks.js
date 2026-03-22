import { NextResponse } from 'next/server'
import { telegramEnv } from '../env.js'
import { answerCallback, editTelegramMessage } from '../api.js'

export async function handleCallbackQuery(callbackQuery) {
  const { id: callbackId, data, from, message } = callbackQuery
  const chatId = message?.chat?.id
  const { supabaseUrl, serviceKey } = telegramEnv()

  try {
    const match = data?.match(/^(approve|decline)_booking_(.+)$/)
    if (!match) {
      await answerCallback(callbackId, 'Неизвестная команда')
      return NextResponse.json({ ok: true })
    }

    const action = match[1]
    const bookingId = match[2]

    const bookingRes = await fetch(
      `${supabaseUrl}/rest/v1/bookings?id=eq.${bookingId}&select=*,listing:listings(title,owner_id),partner:profiles!bookings_partner_id_fkey(telegram_id,first_name)`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      }
    )
    const bookings = await bookingRes.json()
    const booking = bookings?.[0]

    if (!booking) {
      await answerCallback(callbackId, 'Бронирование не найдено')
      return NextResponse.json({ ok: true })
    }

    if (booking.partner?.telegram_id?.toString() !== from?.id?.toString()) {
      await answerCallback(callbackId, 'У вас нет прав на это действие')
      return NextResponse.json({ ok: true })
    }

    if (booking.status !== 'PENDING') {
      await answerCallback(callbackId, `Бронирование уже обработано (${booking.status})`)
      return NextResponse.json({ ok: true })
    }

    const newStatus = action === 'approve' ? 'CONFIRMED' : 'CANCELLED'
    const timestamp = new Date().toISOString()

    const updateData = {
      status: newStatus,
      updated_at: timestamp,
      ...(action === 'approve' ? { confirmed_at: timestamp } : { cancelled_at: timestamp }),
    }

    const updateRes = await fetch(`${supabaseUrl}/rest/v1/bookings?id=eq.${bookingId}`, {
      method: 'PATCH',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateData),
    })

    if (!updateRes.ok) {
      await answerCallback(callbackId, 'Ошибка обновления')
      return NextResponse.json({ ok: true })
    }

    const successMessage =
      action === 'approve' ? '✅ Бронирование подтверждено!' : '❌ Бронирование отклонено'
    await answerCallback(callbackId, successMessage)

    const partnerEarnings = (booking.price_thb || 0) - (booking.commission_thb || 0)
    const updatedText =
      action === 'approve'
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

    await editTelegramMessage(chatId, message.message_id, updatedText)

    console.log(`[BOOKING CALLBACK] ${action} booking ${bookingId} by user ${from?.id}`)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[CALLBACK ERROR]', error)
    await answerCallback(callbackId, 'Ошибка обработки')
    return NextResponse.json({ ok: true })
  }
}
