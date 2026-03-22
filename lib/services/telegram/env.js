/** Shared env for Telegram webhook + lazy realtor (Node only). */

export function telegramEnv() {
  return {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    appUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://www.gostaylo.com',
    /** Bucket used by this webhook since v7 (legacy name; aligns with older listings paths). */
    storageBucket: 'listings',
  }
}

export const IMAGE_CONFIG = {
  maxWidth: 1920,
  maxHeight: 1920,
  quality: 80,
  format: 'webp',
}
