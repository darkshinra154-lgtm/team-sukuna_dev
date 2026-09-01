/**
 * ═══════════════════════════════════════════════════════
 * 🔌 SUKUNA SOCKET FACTORY | مصنع اتصالات سوكونا
 * ═══════════════════════════════════════════════════════
 * 👑 المطور: آدم (شادو) | Adam (Shadow)
 * 🤖 البوت: سوكونا | Sukuna
 * 🏷️ الحقوق: ${global.author || 'Adam (Shadow)'}
 * 📜 الوصف: إعدادات اتصال موحدة لكل أنظمة الربط
 * ═══════════════════════════════════════════════════════
 */

import pino from 'pino'
import {
  makeWASocket,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion
} from '@whiskeysockets/baileys'

// ═══ إعدادات الاتصال الموحدة (نفس اللي في بوت سوكونا) ═══
export const SUKUNA_SOCKET_OPTIONS = {
  logger: pino({ level: 'silent' }),
  printQRInTerminal: false,
  browser: ['Ubuntu', 'Chrome'],  // نفس اللي في البوت
  markOnlineOnConnect: false,
  generateHighQualityLinkPreview: true,
  syncFullHistory: false,
  defaultQueryTimeoutMs: undefined,
  keepAliveIntervalMs: 55000,
  maxIdleTimeMs: 60000,
  connectTimeoutMs: 60000,
  retryRequestDelayMs: 250,
  maxRetries: 5
}

// ═══ دالة إنشاء اتصال سوكونا ═══
export async function createSukunaSocket(sessionPath, customOptions = {}) {
  const { state, saveCreds } = await useMultiFileAuthState(sessionPath)
  const { version } = await fetchLatestBaileysVersion()

  const socket = makeWASocket({
    ...SUKUNA_SOCKET_OPTIONS,
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(
        state.keys,
        pino({ level: 'fatal' }).child({ level: 'fatal' })
      )
    },
    ...customOptions
  })

  socket.ev.on('creds.update', saveCreds)

  return { socket, saveCreds, state }
}

// ═══ دالة تنظيف الرقم بنفس طريقة البوت ═══
export function normalizePhone(value = '', defaultCountryCode = '20') {
  let digits = String(value || '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.startsWith('0')) {
    digits = `${defaultCountryCode}${digits.slice(1)}`
  }
  return digits
}

// ═══ دالة تنسيق كود الربط ═══
export function formatPairingCode(code) {
  if (!code) return null
  return code?.match(/.{1,4}/g)?.join('-') || code
}

export default {
  createSukunaSocket,
  normalizePhone,
  formatPairingCode,
  SUKUNA_SOCKET_OPTIONS
}