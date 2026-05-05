/**
 * SSOT выдачи приложенческого JWT после успешной аутентификации (email login, OAuth sync).
 */
import jwt from 'jsonwebtoken';
import { stripLegacyModeratorMarker } from '@/lib/auth/display-name';

export function profileRowToAuthUser(profileRow) {
  const role = String(profileRow.role || 'RENTER').toUpperCase();
  const displayLast = stripLegacyModeratorMarker(profileRow.last_name);
  const rawAvatar = profileRow.avatar && String(profileRow.avatar).trim();
  return {
    id: profileRow.id,
    email: profileRow.email,
    role,
    firstName: profileRow.first_name,
    lastName: displayLast,
    name: `${profileRow.first_name || ''} ${displayLast}`.trim(),
    phone: profileRow.phone || null,
    avatar: rawAvatar || null,
    referralCode: profileRow.referral_code,
    isVerified: profileRow.is_verified,
    preferredCurrency: profileRow.preferred_currency,
    preferredPayoutCurrency:
      profileRow.preferred_payout_currency || profileRow.preferred_currency || 'THB',
    telegram_id: profileRow.telegram_id || null,
    telegram_username: profileRow.telegram_username || null,
    isModerator: role === 'MODERATOR',
    legalTermsAcceptedAt: profileRow.legal_terms_accepted_at || null,
  };
}

export function signJwtForProfile(profileRow, jwtSecret) {
  const role = String(profileRow.role || 'RENTER').toUpperCase();
  return jwt.sign(
    {
      userId: profileRow.id,
      email: profileRow.email,
      role,
      firstName: profileRow.first_name,
    },
    jwtSecret,
    { expiresIn: '30d' },
  );
}

/**
 * Host-only cookie (без `domain`) — только текущий хост.
 * `secure: true` на Vercel / production; на http://localhost — false (иначе браузер не примет куку).
 * @param {import('next/server').NextResponse} response
 */
export function attachGostayloSessionCookie(response, token) {
  const secureCookie =
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL === '1' ||
    process.env.FORCE_SECURE_COOKIES === 'true';
  response.cookies.set('gostaylo_session', token, {
    httpOnly: true,
    secure: secureCookie,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  });
}
