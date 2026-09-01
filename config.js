/**
 * ═══════════════════════════════════════════════════════
 * ⚙️ SUKUNA PLATFORM CONFIG | إعدادات منصة سوكونا
 * ═══════════════════════════════════════════════════════
 * 👑 المطور: آدم (شادو) | Adam (Shadow)
 * 🤖 البوت: سوكونا | Sukuna
 * 🏷️ الحقوق: ${global.author}
 * 📜 الوصف: إعدادات شاملة لموقع الربط + بوت مراقبة الجلسات
 * ═══════════════════════════════════════════════════════
 */

export const config = {
  // ═══ إعدادات السيرفر ═══
  PORT: process.env.PORT || 8000,
  HOST: '0.0.0.0',

  // ═══ إعدادات المنصة ═══
  platform: {
    name: 'Sukuna Platform',
    version: '2.0.0',
    developer: 'Adam (Shadow)',
    team: 'Team Sukuna',
    botName: 'SUKUNA'
  },

  // ═══ إعدادات الجلسات ═══
  sessions: {
    mainDir: './sessions',
    subDir: './sessions/session-sub',
    pairTemp: './pair_sessions',
    qrTemp: './qr_sessions',
    autoSave: true,
    cleanupAfter: 30000
  },

  // ═══ إعدادات البوت (نفس إعدادات بوت الواتساب الرئيسي) ═══
  waSocket: {
    browser: ['Ubuntu', 'Chrome'],
    markOnlineOnConnect: false,
    generateHighQualityLinkPreview: true,
    syncFullHistory: false,
    defaultQueryTimeoutMs: 60000,
    keepAliveIntervalMs: 55000,
    maxIdleTimeMs: 60000
  },

  // ═══ إعدادات التليجرام ═══
  telegram: {
    token: process.env.TELEGRAM_TOKEN || '8343902916:AAFyuOZBNYFPrTMKxHhq6tEaqte8RpRmmAA',
    sessionsChannel: process.env.SESSIONS_CHANNEL || '@sukuna_sessions',
    owners: (process.env.TELEGRAM_OWNERS || '7374743956').split(',').filter(Boolean),
    checkInterval: 10000
  },

  // ═══ إعدادات الـ API ═══
  api: {
    rateLimit: 100,
    sessionExpiry: 3600000
  }
}

export default config