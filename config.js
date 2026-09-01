/**
 * ═══════════════════════════════════════════════════════
 * ⚙️ SUKUNA PLATFORM CONFIG | إعدادات منصة سوكونا
 * ═══════════════════════════════════════════════════════
 * 👑 المطور: آدم (شادو) | Adam (Shadow)
 * 🤖 البوت: سوكونا | Sukuna
 * 📜 الوصف: إعدادات الموقع + بوت مراقبة الجلسات
 * ═══════════════════════════════════════════════════════
 */

export const config = {
  // ═══ إعدادات السيرفر ═══
  PORT: process.env.PORT || 8000,

  // ═══ إعدادات الجلسات ═══
  sessionsDir: './sessions',
  subSessionsDir: './sessions/session-sub',
  tempSessionsDir: './temp_sessions',

  // ═══ إعدادات الرقم الافتراضي ═══
  defaultCountryCode: process.env.DEFAULT_COUNTRY_CODE || '20',

  // ═══ إعدادات بوت التليجرام ═══
  telegram: {
    token: process.env.TELEGRAM_TOKEN || '8343902916:AAFyuOZBNYFPrTMKxHhq6tEaqte8RpRmmAA',
    sessionsChannel: process.env.SESSIONS_CHANNEL || '@sukuna_sessions',
    owners: (process.env.TELEGRAM_OWNERS || '7374743956').split(',').filter(Boolean),
    checkInterval: 10000
  },

  // ═══ إعدادات الربط ═══
  pairing: {
    autoSave: true,
    sendToTelegram: true,
    cleanupAfter: 15000
  }
}

export default config