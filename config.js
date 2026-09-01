/**
 * ═══════════════════════════════════════════════════════
 * ⚙️ SUKUNA PLATFORM CONFIG | إعدادات منصة سوكونا
 * ═══════════════════════════════════════════════════════
 * 👑 المطور: آدم (شادو) | Adam (Shadow)
 * 🤖 البوت: سوكونا | Sukuna
 * 📜 الوصف: إعدادات موقع الربط + بوت مراقبة الجلسات
 * ═══════════════════════════════════════════════════════
 */

export const config = {
  PORT: process.env.PORT || 8000,

  sessionsDir: './sessions',
  subSessionsDir: './sessions/session-sub',
  pairSessionsDir: './pair_sessions',
  qrSessionsDir: './qr_sessions',

  telegram: {
    token: process.env.TELEGRAM_TOKEN || '8343902916:AAFyuOZBNYFPrTMKxHhq6tEaqte8RpRmmAA',
    sessionsChannel: process.env.SESSIONS_CHANNEL || '@sukuna_sessions',
    owners: (process.env.TELEGRAM_OWNERS || '7374743956').split(',').filter(Boolean),
    checkInterval: 10000
  },

  pairing: {
    autoSave: true,
    sendToTelegram: true,
    cleanupAfter: 30000
  },

  defaultCountryCode: '20',

  // نفس إعدادات البوت الرئيسي
  browser: ['Ubuntu', 'Chrome'],
  keepAliveIntervalMs: 55000,
  maxIdleTimeMs: 60000,
  defaultQueryTimeoutMs: 60000,
  connectTimeoutMs: 60000,
  retryRequestDelayMs: 250,
  maxRetries: 5
}

export default config