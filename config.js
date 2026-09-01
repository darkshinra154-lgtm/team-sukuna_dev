/**
 * ═══════════════════════════════════════════════════════
 * ⚙️ PLATFORM CONFIG | إعدادات منصة سوكونا
 * ═══════════════════════════════════════════════════════
 * 👑 المطور: آدم (شادو) | Adam (Shadow)
 * 🤖 البوت: سوكونا | Sukuna
 * 📜 الوصف: إعدادات موقع الربط + بوت مراقبة الجلسات
 * ═══════════════════════════════════════════════════════
 */

export const config = {
  // ═══ إعدادات السيرفر ═══
  PORT: process.env.PORT || 8000,

  // ═══ إعدادات الجلسات ═══
  sessionsDir: './sessions',
  subSessionsDir: './sessions/session-sub',

  // ═══ إعدادات بوت التليجرام ═══
  telegram: {
    token: process.env.TELEGRAM_TOKEN || '8343902916:AAFyuOZBNYFPrTMKxHhq6tEaqte8RpRmmAA',
    // معرف قناة أو جروب الجلسات (لازم يكون البوت أدمن فيه)
    sessionsChannel: process.env.SESSIONS_CHANNEL || '@sukuna_sessions',
    // معرف المطورين اللي هيتبعتلهم إشعارات
    owners: (process.env.TELEGRAM_OWNERS || '7374743956').split(',').filter(Boolean),
    // كل كام ثانية يفحص الفولدر
    checkInterval: 100
  },

  // ═══ إعدادات الربط ═══
  pairing: {
    // هل يحفظ الجلسة تلقائي بعد الربط
    autoSave: true,
    // هل يبعت الجلسة على التليجرام
    sendToTelegram: true,
    // هل يحذف الجلسة المؤقتة بعد الحفظ
    cleanupAfter: 30000
  }
}

export default config