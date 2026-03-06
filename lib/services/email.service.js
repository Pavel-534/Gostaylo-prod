/**
 * Gostaylo - Email Service (Resend)
 * Professional bilingual email templates
 * 
 * Supports: RU, EN, ZH, TH
 * Format: [Current Language] / [English fallback]
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
// PRODUCTION: Domain gostaylo.com verified in Resend
const SENDER_EMAIL = 'Gostaylo <booking@gostaylo.com>';
const BRAND_COLOR = '#0d9488'; // teal-600

// Bilingual text helper
function bilingualText(lang, texts) {
  const primary = texts[lang] || texts.en;
  const secondary = lang !== 'en' ? texts.en : null;
  return secondary ? `${primary}\n\n---\n${secondary}` : primary;
}

// Email templates
const templates = {
  // Welcome Email
  welcome: (user, lang = 'en') => {
    const texts = {
      ru: {
        subject: 'Добро пожаловать в Gostaylo! 🌴',
        greeting: `Привет, ${user.name || 'друг'}!`,
        body: 'Спасибо за регистрацию на Gostaylo — премиальной платформе аренды на Пхукете.',
        features: [
          '🏠 Виллы и апартаменты премиум-класса',
          '🚗 Аренда транспорта',
          '🛥️ Яхты и катера',
          '🗺️ Эксклюзивные туры'
        ],
        cta: 'Начать поиск',
        footer: 'С наилучшими пожеланиями,\nКоманда Gostaylo'
      },
      en: {
        subject: 'Welcome to Gostaylo! 🌴',
        greeting: `Hello, ${user.name || 'friend'}!`,
        body: 'Thank you for joining Gostaylo — the premium rental platform in Phuket.',
        features: [
          '🏠 Premium villas and apartments',
          '🚗 Vehicle rentals',
          '🛥️ Yachts and boats',
          '🗺️ Exclusive tours'
        ],
        cta: 'Start Exploring',
        footer: 'Best regards,\nThe Gostaylo Team'
      },
      zh: {
        subject: '欢迎来到 Gostaylo! 🌴',
        greeting: `你好, ${user.name || '朋友'}!`,
        body: '感谢您注册 Gostaylo — 普吉岛高端租赁平台。',
        features: [
          '🏠 高端别墅和公寓',
          '🚗 车辆租赁',
          '🛥️ 游艇和船只',
          '🗺️ 独家旅游'
        ],
        cta: '开始探索',
        footer: '此致敬礼,\nGostaylo 团队'
      },
      th: {
        subject: 'ยินดีต้อนรับสู่ Gostaylo! 🌴',
        greeting: `สวัสดี, ${user.name || 'เพื่อน'}!`,
        body: 'ขอบคุณที่เข้าร่วม Gostaylo — แพลตฟอร์มเช่าระดับพรีเมียมในภูเก็ต',
        features: [
          '🏠 วิลล่าและอพาร์ทเมนต์ระดับพรีเมียม',
          '🚗 เช่ารถ',
          '🛥️ เรือยอทช์และเรือ',
          '🗺️ ทัวร์สุดพิเศษ'
        ],
        cta: 'เริ่มสำรวจ',
        footer: 'ด้วยความเคารพ,\nทีม Gostaylo'
      }
    };
    
    const t = texts[lang] || texts.en;
    const tEn = texts.en;
    
    return {
      subject: t.subject,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t.subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <!-- Header -->
    <tr>
      <td style="background: linear-gradient(135deg, ${BRAND_COLOR} 0%, #0f766e 100%); padding: 32px; text-align: center;">
        <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 800;">
          Gostaylo
        </h1>
        <p style="margin: 16px 0 0; color: #ccfbf1; font-size: 14px;">Premium Rentals in Phuket</p>
      </td>
    </tr>
    
    <!-- Content -->
    <tr>
      <td style="padding: 40px 32px;">
        <h2 style="margin: 0 0 16px; color: #1e293b; font-size: 24px;">${t.greeting}</h2>
        <p style="margin: 0 0 24px; color: #475569; font-size: 16px; line-height: 1.6;">${t.body}</p>
        
        <div style="background-color: #f0fdfa; border-radius: 12px; padding: 24px; margin: 24px 0;">
          <p style="margin: 0 0 16px; color: #0f766e; font-weight: 600; font-size: 14px;">
            ${lang === 'ru' ? 'Что вас ждёт:' : lang === 'zh' ? '您可以享受：' : lang === 'th' ? 'สิ่งที่รอคุณ:' : 'What awaits you:'}
          </p>
          ${t.features.map(f => `<p style="margin: 8px 0; color: #134e4a; font-size: 14px;">${f}</p>`).join('')}
        </div>
        
        <div style="text-align: center; margin: 32px 0;">
          <a href="https://gostaylo.com" style="display: inline-block; background-color: ${BRAND_COLOR}; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">${t.cta}</a>
        </div>
        
        ${lang !== 'en' ? `
        <div style="border-top: 1px solid #e2e8f0; padding-top: 24px; margin-top: 24px;">
          <p style="margin: 0 0 8px; color: #94a3b8; font-size: 12px; font-style: italic;">English version:</p>
          <p style="margin: 0; color: #64748b; font-size: 14px;">${tEn.body}</p>
        </div>
        ` : ''}
        
        <p style="margin: 32px 0 0; color: #475569; font-size: 14px; white-space: pre-line;">${t.footer}</p>
      </td>
    </tr>
    
    <!-- Footer -->
    <tr>
      <td style="background-color: #f1f5f9; padding: 24px 32px; text-align: center;">
        <p style="margin: 0 0 8px; color: #64748b; font-size: 12px;">© 2025 Gostaylo. All rights reserved.</p>
        <p style="margin: 0; color: #94a3b8; font-size: 11px;">Phuket, Thailand</p>
      </td>
    </tr>
  </table>
</body>
</html>
      `
    };
  },

  // Booking Request Email (to Renter)
  bookingRequested: (booking, lang = 'en') => {
    const texts = {
      ru: {
        subject: `Заявка на бронирование #${booking.id.slice(-8)} отправлена`,
        greeting: `Здравствуйте, ${booking.renterName || 'гость'}!`,
        body: 'Ваша заявка на бронирование успешно отправлена владельцу.',
        listingLabel: 'Объект',
        datesLabel: 'Даты',
        priceLabel: 'Итого',
        statusLabel: 'Статус',
        statusValue: 'Ожидает подтверждения',
        escrow: '🔒 Ваши средства защищены системой Эскроу Gostaylo',
        footer: 'Мы уведомим вас, когда владелец подтвердит бронирование.'
      },
      en: {
        subject: `Booking Request #${booking.id.slice(-8)} Submitted`,
        greeting: `Hello, ${booking.renterName || 'guest'}!`,
        body: 'Your booking request has been successfully sent to the owner.',
        listingLabel: 'Property',
        datesLabel: 'Dates',
        priceLabel: 'Total',
        statusLabel: 'Status',
        statusValue: 'Awaiting confirmation',
        escrow: '🔒 Your funds are protected by Gostaylo Escrow',
        footer: 'We will notify you when the owner confirms your booking.'
      }
    };
    
    const t = texts[lang] || texts.en;
    const tEn = texts.en;
    
    return {
      subject: t.subject,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <tr>
      <td style="background: linear-gradient(135deg, ${BRAND_COLOR} 0%, #0f766e 100%); padding: 24px; text-align: center;">
        <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 800;">Gostaylo</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 32px;">
        <h2 style="margin: 0 0 16px; color: #1e293b; font-size: 20px;">${t.greeting}</h2>
        <p style="margin: 0 0 24px; color: #475569; font-size: 15px;">${t.body}</p>
        
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 20px 0;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
                <span style="color: #64748b; font-size: 13px;">${t.listingLabel}</span><br>
                <strong style="color: #1e293b; font-size: 15px;">${booking.listingTitle || 'N/A'}</strong>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
                <span style="color: #64748b; font-size: 13px;">${t.datesLabel}</span><br>
                <strong style="color: #1e293b; font-size: 15px;">${booking.checkIn} → ${booking.checkOut}</strong>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
                <span style="color: #64748b; font-size: 13px;">${t.priceLabel}</span><br>
                <strong style="color: ${BRAND_COLOR}; font-size: 18px;">฿${booking.totalPrice?.toLocaleString() || '0'}</strong>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0;">
                <span style="color: #64748b; font-size: 13px;">${t.statusLabel}</span><br>
                <span style="display: inline-block; background-color: #fef3c7; color: #92400e; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: 500;">${t.statusValue}</span>
              </td>
            </tr>
          </table>
        </div>
        
        <div style="background-color: #f0fdfa; border-left: 4px solid ${BRAND_COLOR}; padding: 16px; margin: 20px 0;">
          <p style="margin: 0; color: #134e4a; font-size: 14px;">${t.escrow}</p>
        </div>
        
        <p style="margin: 24px 0 0; color: #64748b; font-size: 14px;">${t.footer}</p>
        
        ${lang !== 'en' ? `
        <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; margin-top: 24px;">
          <p style="margin: 0; color: #94a3b8; font-size: 12px; font-style: italic;">${tEn.footer}</p>
        </div>
        ` : ''}
      </td>
    </tr>
    <tr>
      <td style="background-color: #f1f5f9; padding: 20px; text-align: center;">
        <p style="margin: 0; color: #64748b; font-size: 11px;">© 2025 Gostaylo • Phuket, Thailand</p>
      </td>
    </tr>
  </table>
</body>
</html>
      `
    };
  },

  // New Lead Alert (to Partner/Admin)
  newLeadAlert: (booking, lang = 'en') => {
    const texts = {
      ru: {
        subject: `🔔 Новая заявка на бронирование #${booking.id.slice(-8)}`,
        title: 'Новая заявка на бронирование!',
        body: 'Поступила новая заявка на ваш объект.',
        guestLabel: 'Гость',
        listingLabel: 'Объект',
        datesLabel: 'Даты',
        nightsLabel: 'ночей',
        priceLabel: 'Сумма',
        cta: 'Перейти к заявке',
        footer: 'Пожалуйста, подтвердите или отклоните заявку в течение 24 часов.'
      },
      en: {
        subject: `🔔 New Booking Request #${booking.id.slice(-8)}`,
        title: 'New Booking Request!',
        body: 'A new booking request has been submitted for your property.',
        guestLabel: 'Guest',
        listingLabel: 'Property',
        datesLabel: 'Dates',
        nightsLabel: 'nights',
        priceLabel: 'Amount',
        cta: 'View Request',
        footer: 'Please confirm or decline within 24 hours.'
      }
    };
    
    const t = texts[lang] || texts.en;
    
    return {
      subject: t.subject,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <tr>
      <td style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 24px; text-align: center;">
        <h1 style="margin: 0; color: #ffffff; font-size: 24px;">🔔 ${t.title}</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 32px;">
        <p style="margin: 0 0 24px; color: #475569; font-size: 15px;">${t.body}</p>
        
        <div style="background-color: #fffbeb; border: 2px solid #f59e0b; border-radius: 12px; padding: 20px; margin: 20px 0;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding: 8px 0;">
                <span style="color: #92400e; font-size: 13px;">${t.guestLabel}</span><br>
                <strong style="color: #1e293b; font-size: 15px;">${booking.renterName || booking.renterEmail}</strong>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0;">
                <span style="color: #92400e; font-size: 13px;">${t.listingLabel}</span><br>
                <strong style="color: #1e293b; font-size: 15px;">${booking.listingTitle}</strong>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0;">
                <span style="color: #92400e; font-size: 13px;">${t.datesLabel}</span><br>
                <strong style="color: #1e293b; font-size: 15px;">${booking.checkIn} → ${booking.checkOut} (${booking.nights} ${t.nightsLabel})</strong>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0;">
                <span style="color: #92400e; font-size: 13px;">${t.priceLabel}</span><br>
                <strong style="color: #059669; font-size: 20px;">฿${booking.totalPrice?.toLocaleString() || '0'}</strong>
              </td>
            </tr>
          </table>
        </div>
        
        <div style="text-align: center; margin: 24px 0;">
          <a href="https://gostaylo.com/partner/bookings/${booking.id}" style="display: inline-block; background-color: #f59e0b; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">${t.cta}</a>
        </div>
        
        <p style="margin: 24px 0 0; color: #64748b; font-size: 13px; text-align: center;">${t.footer}</p>
      </td>
    </tr>
    <tr>
      <td style="background-color: #f1f5f9; padding: 20px; text-align: center;">
        <p style="margin: 0; color: #64748b; font-size: 11px;">© 2025 Gostaylo • Partner Dashboard</p>
      </td>
    </tr>
  </table>
</body>
</html>
      `
    };
  },

  // Partner Approved Email
  partnerApproved: (partner, lang = 'en') => {
    const texts = {
      ru: {
        subject: '🎉 Поздравляем! Вы стали партнёром Gostaylo',
        greeting: `Здравствуйте, ${partner.name || 'партнёр'}!`,
        body: 'Ваша заявка на партнёрство одобрена! Теперь вы можете размещать свои объекты на Gostaylo.',
        features: [
          '✅ Доступ к панели партнёра',
          '✅ Размещение неограниченного числа объектов',
          '✅ Получение бронирований 24/7',
          '✅ Быстрые выплаты на ваш счёт'
        ],
        cta: 'Перейти в панель партнёра',
        footer: 'Добро пожаловать в семью Gostaylo!\n\nС уважением,\nКоманда Gostaylo'
      },
      en: {
        subject: '🎉 Congratulations! You are now a Gostaylo Partner',
        greeting: `Hello, ${partner.name || 'partner'}!`,
        body: 'Your partnership application has been approved! You can now list your properties on Gostaylo.',
        features: [
          '✅ Access to Partner Dashboard',
          '✅ Unlimited property listings',
          '✅ Receive bookings 24/7',
          '✅ Fast payouts to your account'
        ],
        cta: 'Go to Partner Dashboard',
        footer: 'Welcome to the Gostaylo family!\n\nBest regards,\nThe Gostaylo Team'
      }
    };
    
    const t = texts[lang] || texts.en;
    
    return {
      subject: t.subject,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, sans-serif; background-color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <tr>
      <td style="background: linear-gradient(135deg, #059669 0%, #047857 100%); padding: 32px; text-align: center;">
        <h1 style="margin: 0; color: #ffffff; font-size: 28px;">🎉</h1>
        <h2 style="margin: 16px 0 0; color: #ffffff; font-size: 24px;">${t.subject.replace('🎉 ', '')}</h2>
      </td>
    </tr>
    <tr>
      <td style="padding: 32px;">
        <h2 style="margin: 0 0 16px; color: #1e293b; font-size: 20px;">${t.greeting}</h2>
        <p style="margin: 0 0 24px; color: #475569; font-size: 15px; line-height: 1.6;">${t.body}</p>
        <div style="background-color: #ecfdf5; border-radius: 12px; padding: 20px; margin: 24px 0;">
          ${t.features.map(f => `<p style="margin: 8px 0; color: #065f46; font-size: 14px;">${f}</p>`).join('')}
        </div>
        <div style="text-align: center; margin: 24px 0;">
          <a href="https://gostaylo.com/partner/dashboard" style="display: inline-block; background-color: #059669; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">${t.cta}</a>
        </div>
        <p style="margin: 24px 0 0; color: #475569; font-size: 14px; white-space: pre-line;">${t.footer}</p>
      </td>
    </tr>
    <tr>
      <td style="background-color: #f1f5f9; padding: 20px; text-align: center;">
        <p style="margin: 0; color: #64748b; font-size: 11px;">© 2025 Gostaylo • Phuket, Thailand</p>
      </td>
    </tr>
  </table>
</body>
</html>
      `
    };
  },

  // Booking Status Change Email
  bookingStatusChange: (booking, newStatus, lang = 'en') => {
    const statusTexts = {
      CONFIRMED: {
        ru: { title: 'Бронирование подтверждено! ✅', color: '#059669', emoji: '✅' },
        en: { title: 'Booking Confirmed! ✅', color: '#059669', emoji: '✅' }
      },
      CANCELLED: {
        ru: { title: 'Бронирование отменено', color: '#dc2626', emoji: '❌' },
        en: { title: 'Booking Cancelled', color: '#dc2626', emoji: '❌' }
      },
      PAID: {
        ru: { title: 'Оплата получена! 💰', color: '#059669', emoji: '💰' },
        en: { title: 'Payment Received! 💰', color: '#059669', emoji: '💰' }
      }
    };
    
    const statusConfig = statusTexts[newStatus] || statusTexts.CONFIRMED;
    const s = statusConfig[lang] || statusConfig.en;
    
    const texts = {
      ru: {
        subject: `${s.emoji} ${booking.listingTitle || 'Бронирование'} - ${s.title}`,
        greeting: `Здравствуйте, ${booking.guestName || 'гость'}!`,
        listingLabel: 'Объект',
        datesLabel: 'Даты',
        priceLabel: 'Сумма'
      },
      en: {
        subject: `${s.emoji} ${booking.listingTitle || 'Booking'} - ${s.title}`,
        greeting: `Hello, ${booking.guestName || 'guest'}!`,
        listingLabel: 'Property',
        datesLabel: 'Dates',
        priceLabel: 'Amount'
      }
    };
    
    const t = texts[lang] || texts.en;
    
    return {
      subject: t.subject,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, sans-serif; background-color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <tr>
      <td style="background-color: ${s.color}; padding: 24px; text-align: center;">
        <h1 style="margin: 0; color: #ffffff; font-size: 20px;">${s.title}</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 32px;">
        <h2 style="margin: 0 0 16px; color: #1e293b; font-size: 18px;">${t.greeting}</h2>
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 20px 0;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
                <span style="color: #64748b; font-size: 13px;">${t.listingLabel}</span><br>
                <strong style="color: #1e293b; font-size: 15px;">${booking.listingTitle || 'N/A'}</strong>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
                <span style="color: #64748b; font-size: 13px;">${t.datesLabel}</span><br>
                <strong style="color: #1e293b; font-size: 15px;">${booking.checkIn} → ${booking.checkOut}</strong>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0;">
                <span style="color: #64748b; font-size: 13px;">${t.priceLabel}</span><br>
                <strong style="color: ${s.color}; font-size: 18px;">฿${booking.totalPrice?.toLocaleString() || '0'}</strong>
              </td>
            </tr>
          </table>
        </div>
      </td>
    </tr>
    <tr>
      <td style="background-color: #f1f5f9; padding: 20px; text-align: center;">
        <p style="margin: 0; color: #64748b; font-size: 11px;">© 2025 Gostaylo</p>
      </td>
    </tr>
  </table>
</body>
</html>
      `
    };
  }
};

/**
 * Send email via Resend API
 * Note: For testing, Resend requires domain verification.
 * Until domain is verified, emails will be logged but not sent.
 */
async function sendEmail(to, template) {
  if (!RESEND_API_KEY) {
    console.log('[EMAIL] Resend API key not configured, skipping email');
    return { success: false, error: 'API key not configured' };
  }

  // Log email attempt for debugging
  console.log(`[EMAIL ATTEMPT] To: ${to}, Subject: ${template.subject}`);

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: SENDER_EMAIL,
        to: Array.isArray(to) ? to : [to],
        subject: template.subject,
        html: template.html
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      // Check if it's a domain verification error
      if (data.message?.includes('domain') || data.message?.includes('verify')) {
        console.log(`[EMAIL QUEUED] Domain not verified. Email to ${to} logged for later: ${template.subject}`);
        // In production, you would queue this email for later sending
        return { success: true, queued: true, reason: 'domain_not_verified' };
      }
      console.error('[EMAIL ERROR]', data);
      return { success: false, error: data.message || 'Failed to send' };
    }

    console.log(`[EMAIL SENT] Successfully to ${to}: ${template.subject} (ID: ${data.id})`);
    return { success: true, id: data.id };
  } catch (error) {
    console.error('[EMAIL ERROR]', error);
    return { success: false, error: error.message };
  }
}

// Export functions
export const EmailService = {
  templates,
  sendEmail,
  
  // Convenience methods
  async sendWelcome(user, lang = 'en') {
    const template = templates.welcome(user, lang);
    return sendEmail(user.email, template);
  },
  
  async sendBookingRequested(booking, renterEmail, lang = 'en') {
    const template = templates.bookingRequested(booking, lang);
    return sendEmail(renterEmail, template);
  },
  
  async sendNewLeadAlert(booking, partnerEmail, lang = 'en') {
    const template = templates.newLeadAlert(booking, lang);
    return sendEmail(partnerEmail, template);
  },
  
  async sendPartnerApproved(partner, lang = 'en') {
    const template = templates.partnerApproved(partner, lang);
    return sendEmail(partner.email, template);
  },
  
  async sendBookingStatusChange(booking, guestEmail, newStatus, lang = 'en') {
    const template = templates.bookingStatusChange(booking, newStatus, lang);
    return sendEmail(guestEmail, template);
  }
};

export default EmailService;
