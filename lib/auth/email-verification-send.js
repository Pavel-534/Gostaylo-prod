/**
 * Stage 202.13 — shared email verification token + send (register + resend).
 */

import jwt from 'jsonwebtoken'
import { getSiteDisplayName, getPublicSiteUrl } from '@/lib/site-url'
import { EmailService } from '@/lib/services/email.service.js'
import { buildSimplePremiumEmailTemplate } from '@/lib/email/simple-transactional-email.js'
import { AuthErrorCode } from '@/lib/auth/auth-error-codes'
import { hashPiiForLog } from '@/lib/logging/pii-scrub.js'

/**
 * @param {string} userId
 * @param {string} email
 * @param {string} jwtSecret
 */
export function generateEmailVerificationToken(userId, email, jwtSecret) {
  return jwt.sign(
    { userId, email, type: 'email_verification' },
    jwtSecret,
    { expiresIn: '24h', algorithm: 'HS256' },
  )
}

/**
 * @param {{ id?: string, email: string, first_name?: string | null }} user
 * @param {string} token
 * @returns {Promise<{ success: boolean, mock?: boolean, error_code?: string }>}
 */
export async function sendEmailVerificationMessage(user, token) {
  const verifyUrl = `${getPublicSiteUrl()}/api/v2/auth/verify?token=${token}`
  const siteName = getSiteDisplayName()
  const first = user.first_name ? String(user.first_name).trim() : ''
  const subject = `Подтвердите ваш email - ${siteName}`
  const template = buildSimplePremiumEmailTemplate({
    subject,
    preheader: 'Ссылка действует 24 часа',
    title: 'Подтвердите ваш email',
    paragraphs: [
      `Привет${first ? `, ${first}` : ''}! Для завершения регистрации нажмите кнопку ниже.`,
      `Ссылка действительна 24 часа. Если вы не регистрировались на ${siteName}, просто проигнорируйте это письмо.`,
    ],
    cta: { href: verifyUrl, label: 'Подтвердить email' },
  })

  console.log('[EMAIL] Sending verification to:', hashPiiForLog(user.email))
  const result = await EmailService.sendEmail(user.email, template)
  if (result?.success) {
    return { success: true, mock: Boolean(result.mock) }
  }
  if (result?.error === 'API key not configured') {
    console.error('[EMAIL] RESEND_API_KEY not configured')
    return { success: false, error_code: AuthErrorCode.AUTH_EMAIL_SERVICE_NOT_CONFIGURED }
  }
  console.error('[EMAIL] send failed:', result?.error || 'unknown')
  return { success: false, error_code: AuthErrorCode.AUTH_EMAIL_SEND_FAILED }
}
