/**
 * iCal export URL token (HMAC) — shared helper.
 * Next.js route files may only export HTTP handlers + config; helpers live here.
 */

import crypto from 'crypto';
import { getJwtSecret } from '@/lib/auth/jwt-secret';

export function generateExportToken(listingId) {
  const secret = getJwtSecret();
  return crypto
    .createHmac('sha256', secret)
    .update(`ical-export-${listingId}`)
    .digest('hex')
    .slice(0, 32);
}
