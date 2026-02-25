/**
 * Telegram Bridge - Mock Implementation
 * Logs messages to console for development
 * Replace with real Telegram Bot API in production
 */

export async function sendTelegramMessage(chatId, message) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    console.log('\n🔔 [TELEGRAM MOCK] No bot token configured');
    console.log('📱 Would send to chat:', chatId);
    console.log('💬 Message:', message);
    console.log('---\n');
    return { success: false, mock: true, reason: 'No bot token' };
  }

  // Mock sending logic - in production, call Telegram API
  console.log('\n✅ [TELEGRAM SENT]');
  console.log('📱 Chat ID:', chatId);
  console.log('💬 Message:', message);
  console.log('🔑 Bot Token:', `${botToken.slice(0, 10)}...`);
  console.log('---\n');

  return {
    success: true,
    mock: true,
    messageId: `mock_msg_${Date.now()}`,
  };
}

export function generateTelegramLinkCode() {
  // Generate a 6-digit code for linking Telegram account
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function getBotLink() {
  // In production, this would be the real bot link
  return 'https://t.me/FunnyRentBot';
}
