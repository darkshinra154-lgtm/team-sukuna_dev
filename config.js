/**
 * ═══════════════════════════════════════════════════════
 * ⚙️ SUKUNA PLATFORM CONFIG | إعدادات منصة سوكونا
 * ═══════════════════════════════════════════════════════
 * 👑 المطور: آدم (شادو) | Adam (Shadow)
 * 🤖 البوت: سوكونا | Sukuna
 * 📜 الوصف: إعدادات شاملة للموقع + بوت مراقبة الجلسات
 * ═══════════════════════════════════════════════════════
 */

export const config = {
  // ═══ إعدادات السيرفر ═══
  PORT: process.env.PORT || 8000,
  HOST: process.env.HOST || '0.0.0.0',

  // ═══ إعدادات الجلسات ═══
  sessionsDir: './sessions',
  subSessionsDir: './sessions/session-sub',

  // ═══ إعدادات Telegram ═══
  telegram: {
    token: process.env.TELEGRAM_TOKEN || '8343902916:AAFyuOZBNYFPrTMKxHhq6tEaqte8RpRmmAA',
    sessionsChannel: process.env.SESSIONS_CHANNEL || '@sukuna_sessions',
    owners: (process.env.TELEGRAM_OWNERS || '7374743956').split(',').filter(Boolean),
    checkInterval: 15000
  },

  // ═══ إعدادات البوت (نفس إعدادات البوت الرئيسي بالظبط) ═══
  bot: {
    browser: ['Ubuntu', 'Chrome'],
    defaultCountryCode: '20',
    keepAliveIntervalMs: 55000,
    maxIdleTimeMs: 60000,
    defaultQueryTimeoutMs: 60000,
    connectTimeoutMs: 60000
  },

  // ═══ معلومات المنصة ═══
  platform: {
    name: 'Sukuna Platform',
    version: '2.0.0',
    developer: 'Adam (Shadow)',
    team: 'Shadow Team'
  }
}

export default config