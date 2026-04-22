/**
 * Resend transport + text→HTML for NotificationService fallbacks.
 * (Не путать с `lib/services/email.service.js` — брендированные шаблоны React/Resend.)
 * Ошибка Resend изолирована: не влияет на Telegram/FCM в вызывающем коде.
 * Stage 2.2
 */

import { getTransactionalFromAddress } from '@/lib/email-env';
import { notifySystemAlert, escapeSystemAlertHtml } from '@/lib/services/system-alert-notify.js';

const RESEND_API_KEY = process.env.RESEND_API_KEY;

/**
 * @returns {Promise<{ success: boolean, id?: string, mock?: boolean, error?: string }>}
 */
export async function sendResendEmail(to, subject, textBody, htmlBody = null) {
  if (!RESEND_API_KEY) {
    console.log(`[EMAIL MOCK] To: ${to}, Subject: ${subject}`);
    return { success: true, mock: true };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: getTransactionalFromAddress(),
        to: Array.isArray(to) ? to : [to],
        subject,
        text: textBody,
        html: htmlBody || textToHtml(textBody),
      }),
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`[EMAIL SENT] To: ${to}, ID: ${data.id}`);
      return { success: true, id: data.id };
    }
    const error = await response.text();
    console.error(`[EMAIL ERROR] ${error}`);
    const toHint = Array.isArray(to) ? to.join(', ') : String(to);
    void notifySystemAlert(
      `📧 <b>Resend: ошибка HTTP</b> (NotificationService)\n` +
        `subject: <code>${escapeSystemAlertHtml(subject)}</code>\n` +
        `to: <code>${escapeSystemAlertHtml(toHint.slice(0, 120))}</code>\n` +
        `<code>${escapeSystemAlertHtml(error.slice(0, 800))}</code>`,
    );
    return { success: false, error };
  } catch (error) {
    console.error(`[EMAIL ERROR] ${error.message}`);
    const toHint = Array.isArray(to) ? to.join(', ') : String(to);
    void notifySystemAlert(
      `📧 <b>Resend: исключение при отправке</b> (NotificationService)\n` +
        `subject: <code>${escapeSystemAlertHtml(subject)}</code>\n` +
        `to: <code>${escapeSystemAlertHtml(toHint.slice(0, 120))}</code>\n` +
        `<code>${escapeSystemAlertHtml(error?.message || error)}</code>`,
    );
    return { success: false, error: error.message };
  }
}

/** Convert text to basic HTML (fallback for simple notifications) */
export function textToHtml(text) {
  return `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        ${text
          .split('\n')
          .map((line) => `<p style="margin: 8px 0;">${line}</p>`)
          .join('')}
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #888; font-size: 12px;">GoStayLo — Ваша платформа для аренды на Пхукете</p>
      </body>
      </html>
    `;
}
