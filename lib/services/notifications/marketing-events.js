/**
 * Stage 54.0 — marketing & partner lifecycle cluster (notifications).
 */
import { getSiteDisplayName, buildLocalizedSiteUrl } from '@/lib/site-url.js'
import { EmailService } from '@/lib/services/email.service.js'
import * as Tg from '@/lib/services/notifications/telegram.service.js'
import { supabaseAdmin } from '@/lib/supabase'
import { buildMainMenuReplyMarkup } from '@/lib/services/telegram/inline-menu.js'
import { getNotifyDeps } from '@/lib/services/notifications/notify-deps.js'


export async function handleUserWelcome(data) {
  const { sendEmail, sendTelegram, sendToAdminTopic, calculateNights, buildGuestChatUrlForBooking, resolveGuestEmailLang, sendTelegramBookingRequest } =
    getNotifyDeps()

    const { user, lang = 'ru' } = data;
    
    // Professional HTML Email to new user using EmailService
    try {
      await EmailService.sendWelcome({
        name: user.first_name || user.name || user.email?.split('@')[0],
        email: user.email
      }, lang);
      console.log(`[WELCOME EMAIL] Sent to ${user.email}`);
    } catch (error) {
      console.error('[WELCOME EMAIL ERROR]', error);
      // Fallback to simple email
      await sendEmail(
        user.email,
        `🌴 Добро пожаловать в ${getSiteDisplayName()}!`,
        `Здравствуйте, ${user.first_name || 'друг'}!\n\nДобро пожаловать в ${getSiteDisplayName()} — вашу платформу для аренды на Пхукете.\n\nС уважением,\nКоманда ${getSiteDisplayName()}`
      );
    }
    
    // If partner, notify admin group
    if (user.role === 'PARTNER') {
      await sendToAdminTopic('NEW_PARTNERS',
        `🤝 <b>НОВЫЙ ПАРТНЁР</b>\n\n` +
        `👤 <b>Имя:</b> ${user.first_name || ''} ${user.last_name || ''}\n` +
        `📧 <b>Email:</b> ${user.email}\n` +
        `📞 <b>Телефон:</b> ${user.phone || 'N/A'}\n\n` +
        `📊 <b>Статус:</b> PENDING VERIFICATION\n` +
        `🕐 ${new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Bangkok' })}`
      );
    }
  }

export async function handlePartnerVerified(data) {
  const { sendEmail, sendTelegram, sendToAdminTopic, calculateNights, buildGuestChatUrlForBooking, resolveGuestEmailLang, sendTelegramBookingRequest } =
    getNotifyDeps()

    const { partner } = data;

    try {
      await EmailService.sendPartnerApproved(
        {
          name: partner.first_name || partner.name || 'партнёр',
          email: partner.email,
        },
        'ru',
      );
    } catch (err) {
      console.error('[PARTNER VERIFIED EMAIL]', err);
      await sendEmail(
        partner.email,
        '🎉 Ваша учетная запись верифицирована!',
        `Поздравляем, ${partner.first_name || 'Партнёр'}!\n\n` +
          `Ваша учетная запись партнёра была успешно верифицирована.\n\n` +
          `Теперь вы можете:\n` +
          `• Создавать объявления\n` +
          `• Принимать бронирования\n` +
          `• Получать выплаты\n\n` +
          `Удачного бизнеса!\n\nС уважением,\nКоманда ${getSiteDisplayName()}`,
      );
    }
    
    await sendToAdminTopic('NEW_PARTNERS',
      `✅ <b>ПАРТНЁР ВЕРИФИЦИРОВАН</b>\n\n` +
      `👤 ${partner.first_name || ''} ${partner.last_name || ''}\n` +
      `📧 ${partner.email}\n` +
      `📊 <b>Статус:</b> VERIFIED`
    );
  }

export async function handlePartnerRejected(data) {
  const { sendEmail, sendTelegram, sendToAdminTopic, calculateNights, buildGuestChatUrlForBooking, resolveGuestEmailLang, sendTelegramBookingRequest } =
    getNotifyDeps()

    const { partner, reason } = data;
    
    await sendEmail(
      partner.email,
      '❌ Верификация отклонена',
      `К сожалению, ваша заявка на верификацию была отклонена.\n\n` +
      `Причина: ${reason || 'Документы не соответствуют требованиям'}\n\n` +
      `Вы можете исправить указанные проблемы и подать заявку повторно.\n\nС уважением,\nКоманда ${getSiteDisplayName()}`
    );
  }

export async function handleListingApproved(data) {
  const { sendEmail, sendTelegram, sendToAdminTopic, calculateNights, buildGuestChatUrlForBooking, resolveGuestEmailLang, sendTelegramBookingRequest } =
    getNotifyDeps()

    const { listing, partner } = data;
    
    if (partner?.email) {
      await sendEmail(
        partner.email,
        `✅ Объявление одобрено: ${listing?.title}`,
        `Поздравляем!\n\nВаше объявление "${listing?.title}" было одобрено и опубликовано.\n\n` +
        `Теперь оно доступно для бронирования.\n\nС уважением,\nКоманда ${getSiteDisplayName()}`
      );
    }
    
    if (partner?.telegram_id) {
      await sendTelegram(partner.telegram_id,
        `✅ <b>Объявление одобрено!</b>\n\n📍 ${listing?.title}\n\n🎉 Теперь доступно для бронирования`
      );
    }
  }

export async function handleListingRejected(data) {
  const { sendEmail, sendTelegram, sendToAdminTopic, calculateNights, buildGuestChatUrlForBooking, resolveGuestEmailLang, sendTelegramBookingRequest } =
    getNotifyDeps()

    const { listing, partner, reason } = data;
    
    if (partner?.email) {
      await sendEmail(
        partner.email,
        `❌ Объявление отклонено: ${listing?.title}`,
        `К сожалению, ваше объявление "${listing?.title}" было отклонено.\n\n` +
        `Причина: ${reason || 'Не указана'}\n\n` +
        `Вы можете исправить указанные проблемы и подать объявление повторно.\n\nС уважением,\nКоманда ${getSiteDisplayName()}`
      );
    }
    
    if (partner?.telegram_id) {
      await sendTelegram(partner.telegram_id,
        `❌ <b>Объявление отклонено</b>\n\n📍 ${listing?.title}\n\n📝 Причина: ${reason || 'Не указана'}`
      );
    }
  }

export async function sendPartnerDraftDigestReminder({ telegramId, draftCount, lang = 'ru' }) {
  const { sendEmail, sendTelegram, sendToAdminTopic, calculateNights, buildGuestChatUrlForBooking, resolveGuestEmailLang, sendTelegramBookingRequest } =
    getNotifyDeps()

    if (telegramId == null || telegramId === '' || draftCount < 1) {
      return { success: false, reason: 'skip' };
    }
    if (supabaseAdmin) {
      const { data: prof, error: roleErr } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('telegram_id', String(telegramId))
        .maybeSingle();
      if (roleErr) {
        console.error('[DRAFT DIGEST] profile by telegram_id:', roleErr);
        return { success: false, reason: 'profile_error' };
      }
      const role = String(prof?.role || '').toUpperCase();
      if (!['PARTNER', 'ADMIN'].includes(role)) {
        return { success: false, reason: 'not_partner' };
      }
    }
    const uiLang = lang === 'en' ? 'en' : 'ru';
    const draftsUrl = buildLocalizedSiteUrl(uiLang, '/partner/listings?filter=draft');
    const n = Number(draftCount);
    const text =
      lang === 'en'
        ? `📝 <b>Unfinished drafts</b>\n\n` +
          `You have <b>${n}</b> unfinished draft listing${n === 1 ? '' : 's'}. ` +
          `Complete them in your dashboard to start receiving bookings.`
        : `📝 <b>Незавершённые черновики</b>\n\n` +
          `У вас есть незавершённые черновики (<b>${n}</b> шт.). ` +
          `Завершите их в личном кабинете, чтобы начать получать бронирования.`;
    const btn = lang === 'en' ? '📋 Open drafts' : '📋 Открыть черновики';
    const partnerMenu = buildMainMenuReplyMarkup(uiLang, 'partner');
    const reply_markup = {
      inline_keyboard: [
        [{ text: btn, url: draftsUrl }],
        ...partnerMenu.inline_keyboard,
      ],
    };
    return Tg.sendTelegramMessagePayload({
      chat_id: telegramId,
      text,
      reply_markup,
    })
}

export async function handleDraftDigestReminder(data) {
  const { sendEmail, sendTelegram, sendToAdminTopic, calculateNights, buildGuestChatUrlForBooking, resolveGuestEmailLang, sendTelegramBookingRequest } =
    getNotifyDeps()

    const { telegramId, draftCount, lang } = data || {};
    return sendPartnerDraftDigestReminder({
      telegramId,
      draftCount,
      lang: lang || 'ru',
    });
  }

/** Stage 71.6 — welcome bonus expiry reminders (email + Telegram DM if linked). */
export async function handleWalletWelcomeExpiring(data) {
  const { sendEmail, sendTelegram } = getNotifyDeps()
  const { userId, windowDays, remainingThb, expiresAtIso } = data || {}
  const uid = String(userId || '').trim()
  const wd = Number(windowDays)
  if (!uid || (wd !== 5 && wd !== 1)) return

  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select('email,first_name,telegram_id,language')
    .eq('id', uid)
    .maybeSingle()
  if (error || !profile?.email) {
    console.warn('[WALLET_WELCOME_EXPIRING] no profile/email', uid, error?.message)
    return
  }

  const site = getSiteDisplayName()
  const amount = Number(remainingThb)
  const expStr = expiresAtIso
    ? new Date(expiresAtIso).toLocaleString('ru-RU', { timeZone: 'Asia/Bangkok' })
    : '—'
  const dayWord = wd === 5 ? '5 дней' : '1 день'

  const subject =
    wd === 5
      ? `Напоминание: бонус сгорит через ${dayWord} — ${site}`
      : `Срочно: бонус сгорит завтра — ${site}`

  const textBody =
    `Здравствуйте${profile.first_name ? `, ${profile.first_name}` : ''}!\n\n` +
    `Неиспользованный приветственный бонус (${Number.isFinite(amount) ? amount : '—'} THB) сгорит через ${dayWord} ` +
    `(ориентир по времени истечения: ${expStr}, Asia/Bangkok).\n\n` +
    `Чтобы использовать бонусы при оплате брони, подтвердите email или привяжите Telegram в профиле.\n\n` +
    `С уважением,\nКоманда ${site}`

  await sendEmail(profile.email, subject, textBody)

  if (profile.telegram_id) {
    await sendTelegram(
      profile.telegram_id,
      `⏳ <b>Приветственный бонус</b>\n\n` +
        `Осталось около <b>${wd === 5 ? '5 дней' : '1 дня'}</b> до сгорания неиспользованной суммы ` +
        `(${Number.isFinite(amount) ? `${amount} THB` : '—'}).\n` +
        `Истечение (ориентир): ${expStr}\n\n` +
        `Используйте бонусы при чекауте после подтверждения email или привязки Telegram.`,
    )
  }

  const col = wd === 5 ? 'welcome_notify_5d_sent_at' : 'welcome_notify_1d_sent_at'
  await supabaseAdmin
    .from('user_wallets')
    .update({ [col]: new Date().toISOString() })
    .eq('user_id', uid)
}

export async function runDailyDraftDigestReminders() {
  const { sendEmail, sendTelegram, sendToAdminTopic, calculateNights, buildGuestChatUrlForBooking, resolveGuestEmailLang, sendTelegramBookingRequest } =
    getNotifyDeps()

    if (!supabaseAdmin) {
      console.warn('[DRAFT DIGEST] supabaseAdmin not configured');
      return { sent: 0, partnersWithDrafts: 0, error: 'no_db' };
    }
    const { data: rows, error } = await supabaseAdmin
      .from('listings')
      .select('owner_id, metadata')
      .eq('status', 'INACTIVE');
    if (error) {
      console.error('[DRAFT DIGEST] listings query:', error);
      throw error;
    }
    const isDraftRow = (l) =>
      l.metadata?.is_draft === true ||
      l.metadata?.is_draft === 'true' ||
      l.metadata?.source === 'TELEGRAM_LAZY_REALTOR';
    const byOwner = new Map();
    for (const r of rows || []) {
      if (!r.owner_id || !isDraftRow(r)) continue;
      byOwner.set(r.owner_id, (byOwner.get(r.owner_id) || 0) + 1);
    }
    const ownerIds = [...byOwner.keys()];
    if (ownerIds.length === 0) {
      return { sent: 0, partnersWithDrafts: 0 };
    }
    const { data: profiles, error: pErr } = await supabaseAdmin
      .from('profiles')
      .select('id, telegram_id, language, role')
      .in('id', ownerIds);
    if (pErr) {
      console.error('[DRAFT DIGEST] profiles batch:', pErr);
      throw pErr;
    }
    const partnerProfiles = (profiles || []).filter((p) =>
      ['PARTNER', 'ADMIN'].includes(String(p.role || '').toUpperCase())
    );
    const partnersWithDrafts = partnerProfiles.filter((p) => (byOwner.get(p.id) || 0) >= 1).length;
    let sent = 0;
    for (const profile of partnerProfiles) {
      const draftCount = byOwner.get(profile.id) || 0;
      if (draftCount < 1 || !profile.telegram_id) continue;
      const lang = String(profile.language || 'ru').toLowerCase().startsWith('en') ? 'en' : 'ru';
      const r = await sendPartnerDraftDigestReminder({
        telegramId: profile.telegram_id,
        draftCount,
        lang,
      });
      if (r?.success) sent += 1;
    }
    return { sent, partnersWithDrafts };
  }
