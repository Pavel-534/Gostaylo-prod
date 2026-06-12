/**
 * Geo helpers — country from edge headers (Vercel / Cloudflare) + RU flag for OAuth gating.
 */

import type { NextRequest } from 'next/server';

export const IS_RUSSIA_COOKIE = 'gostaylo_is_russia';
export const IS_RUSSIA_HEADER = 'x-gostaylo-is-russia';

type HeaderLike = { get(name: string): string | null | undefined };

/** ISO 3166-1 alpha-2 from proxy headers, or null if unknown. */
export function getCountryCodeFromHeaders(headers: HeaderLike): string | null {
  const raw =
    headers.get('cf-ipcountry') ||
    headers.get('x-vercel-ip-country') ||
    headers.get('x-country-code') ||
    '';
  const code = String(raw).trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

export function isRussiaCountry(country: string | null | undefined): boolean {
  return String(country || '').toUpperCase() === 'RU';
}

/** True when edge headers indicate Russia (Vercel / Cloudflare). */
export function isRussia(req: NextRequest | Request | { headers: HeaderLike }): boolean {
  const headers = 'headers' in req ? req.headers : req;
  return isRussiaCountry(getCountryCodeFromHeaders(headers));
}

export function isRussiaFromCookieValue(value: string | null | undefined): boolean {
  return String(value || '').trim() === '1';
}

/** Parse document.cookie on the client. */
export function readIsRussiaCookieClient(): boolean | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)gostaylo_is_russia=([^;]*)/);
  if (!match) return null;
  return isRussiaFromCookieValue(match[1]);
}

/**
 * Server / RSC: header from middleware → cookie → raw geo headers.
 */
export function getIsRussiaFromRequest(opts: {
  headers?: HeaderLike;
  cookieValue?: string | null;
} = {}): boolean {
  const { headers, cookieValue } = opts;
  if (headers?.get(IS_RUSSIA_HEADER) === '1') return true;
  if (cookieValue != null && cookieValue !== '') {
    return isRussiaFromCookieValue(cookieValue);
  }
  if (headers) return isRussia({ headers });
  return false;
}

export const GEO_COOKIE_MAX_AGE_SEC = 60 * 60 * 24;
