/**
 * GoStayLo - Auth Register API (v2)
 * POST /api/v2/auth/register
 * 
 * Security: bcrypt + JWT + Email verification
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { rateLimitCheck } from '@/lib/rate-limit';
import { getJwtSecret } from '@/lib/auth/jwt-secret';
import { getSiteDisplayName, getPublicSiteUrl } from '@/lib/site-url';
import { PricingService } from '@/lib/services/pricing.service';
import { LegalVersionsService } from '@/lib/services/legal-versions.service.js';
import ReferralGuardService, {
  resolveClientIpFromRequest,
} from '@/lib/services/marketing/referral-guard.service';
import WalletService from '@/lib/services/finance/wallet.service';
import { computeInviteTreeFields } from '@/lib/referral/referral-network.js';
import ReferralAttributionService from '@/lib/referral/attribution.service.js';
import { notifyTeammateJoined } from '@/lib/services/marketing/referral-notification.service.js';
import { AuthErrorCode, authErrorJson } from '@/lib/auth/auth-error-codes';
import { hashPiiForLog } from '@/lib/logging/pii-scrub.js';
import {
  AUTH_PASSWORD_MIN_LENGTH,
  AUTH_PASSWORD_COMPLEXITY_RE,
} from '@/lib/auth/password-policy';
import { EmailService } from '@/lib/services/email.service.js';
import { buildSimplePremiumEmailTemplate } from '@/lib/email/simple-transactional-email.js';
import { NotificationService } from '@/lib/services/notification.service.js';

export const dynamic = 'force-dynamic';

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeReferralCode(profileId) {
  const clean = String(profileId || '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(-6)
    .toUpperCase();
  return `AIR-${clean || Math.floor(100000 + Math.random() * 900000)}`;
}

function generateVerificationToken(userId, email, jwtSecret) {
  return jwt.sign(
    { userId, email, type: 'email_verification' },
    jwtSecret,
    { expiresIn: '24h', algorithm: 'HS256' },
  );
}

/** Stage 200.72 / 201.69 — verification mail via EmailService + premium chrome. */
async function sendVerificationEmail(user, token) {
  const verifyUrl = `${getPublicSiteUrl()}/api/v2/auth/verify?token=${token}`;
  const siteName = getSiteDisplayName();
  const first = user.first_name ? String(user.first_name).trim() : '';
  const subject = `Подтвердите ваш email - ${siteName}`;
  const template = buildSimplePremiumEmailTemplate({
    subject,
    preheader: 'Ссылка действует 24 часа',
    title: 'Подтвердите ваш email',
    paragraphs: [
      `Привет${first ? `, ${first}` : ''}! Для завершения регистрации нажмите кнопку ниже.`,
      `Ссылка действительна 24 часа. Если вы не регистрировались на ${siteName}, просто проигнорируйте это письмо.`,
    ],
    cta: { href: verifyUrl, label: 'Подтвердить email' },
  });

  console.log('[EMAIL] Sending verification to:', hashPiiForLog(user.email));
  const result = await EmailService.sendEmail(user.email, template);
  if (result?.success) {
    return { success: true, mock: Boolean(result.mock) };
  }
  if (result?.error === 'API key not configured') {
    console.error('[EMAIL] RESEND_API_KEY not configured');
    return { success: false, error_code: AuthErrorCode.AUTH_EMAIL_SERVICE_NOT_CONFIGURED };
  }
  console.error('[EMAIL] send failed:', result?.error || 'unknown');
  return { success: false, error_code: AuthErrorCode.AUTH_EMAIL_SEND_FAILED };
}

// Send Telegram notification
async function sendTelegramNotification(user) {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = process.env.TELEGRAM_ADMIN_GROUP_ID;
  
  if (!BOT_TOKEN || !CHAT_ID) {
    console.log('[TELEGRAM] Not configured, skipping');
    return false;
  }
  
  try {
    const message = `🆕 *Новая регистрация*\n\n👤 ${user.first_name || 'Аноним'}\n📧 ${user.email}\n🎫 \`${user.referral_code}\``;
    
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message,
        parse_mode: 'Markdown'
      })
    });
    console.log('[TELEGRAM] Notification sent');
    return true;
  } catch (error) {
    console.error('[TELEGRAM] Error:', error.message);
    return false;
  }
}

export async function POST(request) {
  const rl = await rateLimitCheck(request, 'auth');
  if (rl) {
    return NextResponse.json(rl.body, { status: rl.status, headers: rl.headers });
  }

  console.log('[REGISTER] ====== START ======');

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !serviceKey) {
    return authErrorJson(AuthErrorCode.AUTH_DATABASE_NOT_CONFIGURED, 500);
  }

  let jwtSecret;
  try {
    jwtSecret = getJwtSecret();
  } catch (e) {
    return authErrorJson(AuthErrorCode.AUTH_JWT_NOT_CONFIGURED, 500);
  }
  
  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return authErrorJson(AuthErrorCode.AUTH_INVALID_JSON, 400);
  }
  
  const { email, password, firstName, lastName, phone, referredBy, referralFingerprint, acceptedLegalTerms } =
    body;

  /** Landing/OAuth continuity: client sets `gostaylo_pending_ref` when user hits `/?ref=` (Stage 72.6). */
  let cookieReferralRaw = '';
  try {
    cookieReferralRaw = request.cookies.get('gostaylo_pending_ref')?.value || '';
  } catch {
    cookieReferralRaw = '';
  }
  let cookieReferral = '';
  try {
    cookieReferral = decodeURIComponent(cookieReferralRaw).trim();
  } catch {
    cookieReferral = String(cookieReferralRaw || '').trim();
  }
  let mergedReferralInput = String(referredBy || cookieReferral || '').trim();

  if (!email) {
    return authErrorJson(AuthErrorCode.AUTH_EMAIL_REQUIRED, 400);
  }

  if (!acceptedLegalTerms) {
    return authErrorJson(AuthErrorCode.AUTH_LEGAL_TERMS_NOT_ACCEPTED, 400);
  }

  if (!password || password.length < AUTH_PASSWORD_MIN_LENGTH) {
    return authErrorJson(AuthErrorCode.AUTH_PASSWORD_TOO_SHORT, 400);
  }

  if (!AUTH_PASSWORD_COMPLEXITY_RE.test(password)) {
    return authErrorJson(AuthErrorCode.AUTH_PASSWORD_REQUIREMENTS, 400);
  }
  
  const normalizedEmail = email.toLowerCase().trim();
  const normalizedFingerprintEarly = String(referralFingerprint || '').trim().slice(0, 160);

  if (!mergedReferralInput) {
    try {
      const fromAttribution = await ReferralAttributionService.resolveCodeForSignup({
        request,
        fingerprint: normalizedFingerprintEarly || null,
      });
      if (fromAttribution?.code) {
        mergedReferralInput = fromAttribution.code;
      }
    } catch (attrErr) {
      console.warn('[REGISTER] attribution resolve:', attrErr?.message || attrErr);
    }
  }

  // Check existing
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', normalizedEmail)
    .maybeSingle();
  
  if (existing) {
    return authErrorJson(AuthErrorCode.AUTH_EMAIL_TAKEN, 400);
  }
  
  // Optional referral pre-validation (for onboarding UX + anti-fraud gate).
  const normalizedReferredBy = mergedReferralInput.toUpperCase();
  const normalizedFingerprint = normalizedFingerprintEarly;
  let prevalidatedReferral = null;
  if (normalizedReferredBy) {
    const convertGate = await ReferralAttributionService.assertConvertAllowed({
      request,
      fingerprint: normalizedFingerprint || null,
    });
    if (!convertGate.allowed) {
      return NextResponse.json(
        {
          success: false,
          error_code: convertGate.error || AuthErrorCode.AUTH_REFERRAL_VALIDATION_FAILED,
        },
        { status: convertGate.status || 429 },
      );
    }
    const guard = await ReferralGuardService.validateActivation({
      code: normalizedReferredBy,
      candidateEmail: normalizedEmail,
      request,
      fingerprint: normalizedFingerprint || null,
    });
    if (!guard.success) {
      return NextResponse.json(
        {
          success: false,
          error_code: guard.error || AuthErrorCode.AUTH_REFERRAL_VALIDATION_FAILED,
        },
        { status: guard.status || 400 },
      );
    }
    prevalidatedReferral = guard.data;
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 10);
  const legalAcceptedAt = new Date().toISOString();

  // Generate IDs
  const profileId = `user-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`;
  const refCode = makeReferralCode(profileId);

  // Insert user (NOT verified yet)
  const { data: user, error } = await supabase
    .from('profiles')
    .insert({
      id: profileId,
      email: normalizedEmail,
      password_hash: passwordHash,
      role: 'RENTER',
      first_name: firstName?.trim() || null,
      last_name: lastName?.trim() || null,
      phone: phone?.trim() || null,
      referral_code: refCode,
      referred_by: normalizedReferredBy || null,
      is_verified: false,
      verification_status: 'PENDING',
      preferred_currency: 'THB',
      preferred_payout_currency: 'THB',
      language: 'ru',
      terms_accepted: true,
      terms_accepted_at: legalAcceptedAt,
      legal_terms_accepted_at: legalAcceptedAt,
      terms_version: await LegalVersionsService.getGuestTermsVersion(),
    })
    .select('id, email, role, first_name, last_name, referral_code')
    .single();
  
  if (error) {
    console.error('[REGISTER] DB Error:', error);
    return authErrorJson(AuthErrorCode.AUTH_DATABASE_ERROR, 500);
  }
  
  console.log('[REGISTER] User created:', user.id);
  
  // Generate verification token
  const verificationToken = generateVerificationToken(user.id, user.email, jwtSecret);
  
  // Send verification email
  const emailResult = await sendVerificationEmail(user, verificationToken);

  // Stage 200.74 — welcome via registry (outbox-aware); non-blocking
  void NotificationService.dispatch('USER_WELCOME', {
    user: {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      phone: null,
    },
    lang: 'ru',
  }).catch((err) => console.warn('[REGISTER] USER_WELCOME dispatch:', err?.message || err));
  
  // Send Telegram notification (non-blocking)
  sendTelegramNotification(user).catch(() => {});
  
  // Keep `referral_codes` table in sync for new user.
  try {
    const ownerIp = resolveClientIpFromRequest(request);
    await supabase.from('referral_codes').upsert(
      {
        id: makeId('rfc'),
        user_id: user.id,
        code: refCode,
        is_active: true,
        metadata: { owner_ip: ownerIp || null, source: 'auth_register' },
      },
      { onConflict: 'user_id', ignoreDuplicates: false },
    );
  } catch (syncError) {
    console.warn('[REGISTER] referral_codes sync warning:', syncError?.message || syncError);
  }

  // Handle referral relation using Stage 71 tables (first-touch: never overwrite existing referee).
  const refereeAlreadyReferred = await ReferralAttributionService.refereeAlreadyReferred(user.id);
  if (normalizedReferredBy && prevalidatedReferral?.referrerId && !refereeAlreadyReferred) {
    try {
      const nowIso = new Date().toISOString();
      const tree = await computeInviteTreeFields(supabase, prevalidatedReferral.referrerId);
      await supabase.from('referral_relations').upsert(
        {
          id: makeId('rfr'),
          referrer_id: prevalidatedReferral.referrerId,
          referee_id: user.id,
          referral_code_id: prevalidatedReferral.referralCodeId || null,
          referred_at: nowIso,
          created_at: nowIso,
          network_depth: tree.network_depth,
          ancestor_path: tree.ancestor_path,
          metadata: {
            referral_code: prevalidatedReferral.code,
            referee_email: normalizedEmail,
            referee_ip: resolveClientIpFromRequest(request) || null,
            device_fingerprint: normalizedFingerprint || null,
            fraud_suspicious: prevalidatedReferral?.fraud?.suspicious === true,
            fraud_severity: prevalidatedReferral?.fraud?.severity || 'allow',
            fraud_rule_codes: prevalidatedReferral?.fraud?.rulesTriggered || [],
            trigger: 'register',
          },
        },
        { onConflict: 'referee_id', ignoreDuplicates: false },
      );
      /** teammate_joined → см. триггер `trg_referral_relations_team_joined` (stage73_5). */
      void notifyTeammateJoined({
        referrerId: prevalidatedReferral.referrerId,
        refereeId: user.id,
      });
      void ReferralAttributionService.markConvertedOnSignup({
        profileId: user.id,
        request,
        fingerprint: normalizedFingerprint || null,
      });
    } catch (e) {
      console.warn('[REGISTER] referral relation warning:', e?.message || e);
    }
  }

  // Welcome bonus for referred registrations (available immediately in wallet).
  if (normalizedReferredBy && prevalidatedReferral?.referrerId) {
    try {
      const general = await PricingService.getGeneralPricingSettings();
      const welcomeBonusAmount = Number(
        general?.welcome_bonus_amount ?? general?.welcomeBonusAmount ?? 0,
      );
      if (Number.isFinite(welcomeBonusAmount) && welcomeBonusAmount > 0) {
        const welcomeExpiresAtIso = new Date(Date.now() + 30 * 86400000).toISOString();
        const credit = await WalletService.addFunds(
          user.id,
          welcomeBonusAmount,
          'welcome_bonus',
          `welcome_bonus:${String(user.id)}`,
          {
            trigger: 'register_referred',
            referralCode: normalizedReferredBy,
            referrerId: prevalidatedReferral.referrerId,
          },
          welcomeExpiresAtIso,
        );
        if (credit.success) {
          await WalletService.syncWelcomeBonusGrant(user.id, welcomeBonusAmount, welcomeExpiresAtIso);
        }
      }
    } catch (e) {
      console.warn('[REGISTER] welcome bonus warning:', e?.message || e);
    }
  }
  
  const res = NextResponse.json({
    success: true,
    requiresVerification: true,
    emailSent: emailResult.success,
    email_error_code: emailResult.error_code || null,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.first_name,
      isVerified: false,
      verificationStatus: 'PENDING',
    },
  });
  res.cookies.set('gostaylo_pending_ref', '', { path: '/', maxAge: 0, sameSite: 'lax' });
  return res;
}

export async function GET() {
  return NextResponse.json({ 
    status: 'ok',
    endpoint: '/api/v2/auth/register',
    timestamp: new Date().toISOString()
  });
}
