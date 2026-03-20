/**
 * iCal export URL token (HMAC) — shared helper.
 * Next.js route files may only export HTTP handlers + config; helpers live here.
 */

import crypto from 'crypto';

export function generateExportToken(listingId) {
  const secret = process.env.JWT_SECRET || 'gostaylo-secret';
  return crypto
    .createHmac('sha256', secret)
    .update(`ical-export-${listingId}`)
    .digest('hex')
    .slice(0, 32);
}
