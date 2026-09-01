/**
 * ═══════════════════════════════════════════════════════
 * 🔢 PAIR CODE ROUTER | نظام كود الربط
 * ═══════════════════════════════════════════════════════
 * 👑 المطور: آدم (شادو) | Adam (Shadow)
 * 🤖 البوت: سوكونا | Sukuna
 * 📜 الوصف: ربط الواتساب بنفس دوال البوت الرئيسي
 *          وحفظ الجلسة تلقائياً في session-sub/{number}
 * ═══════════════════════════════════════════════════════
 */

import express from 'express'
import fs from 'fs'
import path from 'path'
import pino from 'pino'
import {
  makeWASocket,
  useMultiFileAuthState,
  delay,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion
} from '@whiskeysockets/baileys'
import pn from 'awesome-phonenumber'
import config from './config.js'

const router = express.Router()

// ═══ دالة تنظيف رقم الهاتف ═══
function normalizePhone(value = '') {
  let digits = String(value || '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.startsWith('0')) {
    digits = `${config.bot.defaultCountryCode}${digits.slice(1)}`
  }
  return digits
}

// ═══ دالة إزالة جلسة قديمة ═══
function removeSession(sessionPath) {
  try {
    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true, force: true })
      return true
    }
    return false
  } catch (e) {
    console.error('[PAIR] Error removing session:', e.message)
    return false
  }
}

// ═══ دالة التحقق من اكتمال الجلسة ═══
function isSessionComplete(sessionPath) {
  try {
    const credsPath = path.join(sessionPath, 'creds.json')
    if (!fs.existsSync(credsPath)) return false
    const creds = JSON.parse(fs.readFileSync(credsPath, 'utf-8'))
    return !!(creds && creds.me && creds.me.id)
  } catch {
    return false
  }
}

// ═══ إرسال إشعار الجلسة الجديدة ═══
async function notifySessionReady(number, sessionPath) {
  try {
    const monitor = await import('./telegram-monitor.js').catch(() => null)
    if (monitor && typeof monitor.notifyNewSession === 'function') {
      await monitor.notifyNewSession(number, sessionPath)
    }
  } catch (e) {
    console.log('[PAIR] Telegram notification skipped:', e.message)
  }
}

// ═══ المسار الرئيسي ═══
router.get('/', async (req, res) => {
  let rawNumber = req.query.number || ''
  const number = normalizePhone(rawNumber)

  // ═══ التحقق من صحة الرقم ═══
  if (!number || number.length < 8) {
    return res.status(400).json({
      success: false,
      error: 'invalid_number',
      message: 'رقم الواتساب غير صحيح. أدخل الرقم بالصيغة الدولية بدون +.'
    })
  }

  const phone = pn('+' + number)
  if (!phone.isValid()) {
    return res.status(400).json({
      success: false,
      error: 'invalid_phone',
      message: 'رقم الهاتف غير صالح. تأكد من كود الدولة.'
    })
  }

  // ═══ إنشاء مسار الجلسة داخل فولدر البوتات الفرعية ═══
  const sessionPath = path.join(config.subSessionsDir, number)

  // إزالة أي جلسة قديمة لنفس الرقم
  removeSession(sessionPath)
  fs.mkdirSync(sessionPath, { recursive: true })

  // ═══ بدء جلسة البوت بنفس طريقة البوت الرئيسي ═══
  const { state, saveCreds } = await useMultiFileAuthState(sessionPath)

  let socket = null
  let responseSent = false
  let pairingTimeout = null
  let connectionTimeout = null

  // ═══ إرسال الرد بأمان ═══
  const safeSend = (data, status = 200) => {
    if (responseSent) return
    responseSent = true
    clearTimeout(pairingTimeout)
    clearTimeout(connectionTimeout)
    res.status(status).json(data)
  }

  try {
    const { version } = await fetchLatestBaileysVersion()

    // ═══ إعدادات socket مطابقة للبوت الرئيسي ═══
    socket = makeWASocket({
      version,
      logger: pino({ level: 'silent' }),
      browser: config.bot.browser,
      printQRInTerminal: false,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(
          state.keys,
          pino({ level: 'fatal' }).child({ level: 'fatal' })
        )
      },
      markOnlineOnConnect: false,
      generateHighQualityLinkPreview: false,
      syncFullHistory: false,
      defaultQueryTimeoutMs: config.bot.defaultQueryTimeoutMs,
      connectTimeoutMs: config.bot.connectTimeoutMs,
      keepAliveIntervalMs: config.bot.keepAliveIntervalMs,
      maxIdleTimeMs: config.bot.maxIdleTimeMs
    })

    // ═══ حفظ الـ credentials باستمرار ═══
    socket.ev.on('creds.update', saveCreds)

    // ═══ معالجة تحديثات الاتصال ═══
    socket.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, isNewLogin } = update
      const statusCode = lastDisconnect?.error?.output?.statusCode

      // ═══ الاتصال نجح ═══
      if (connection === 'open') {
        console.log(`[PAIR] ✅ Connected successfully: ${number}`)

        // التحقق من اكتمال الجلسة
        if (isSessionComplete(sessionPath)) {
          console.log(`[PAIR] 💾 Session saved at: ${sessionPath}`)

          // إرسال إشعار لبوت التليجرام
          await notifySessionReady(number, sessionPath)

          safeSend({
            success: true,
            stage: 'connected',
            number,
            message: 'تم الربط بنجاح! البوت الفرعي جاهز للتشغيل.',
            sessionPath
          })

          // إغلاق socket بعد النجاح
          try {
            socket.ws?.close?.()
            socket.ev.removeAllListeners()
          } catch {}
        }
      }

      // ═══ الاتصال فشل ═══
      if (connection === 'close') {
        if (statusCode === 401) {
          console.log(`[PAIR] ❌ Logged out: ${number}`)
          removeSession(sessionPath)
          if (!responseSent) {
            safeSend({
              success: false,
              error: 'logged_out',
              message: 'تم تسجيل الخروج. حاول مرة أخرى.'
            }, 401)
          }
        } else if (statusCode === 428 || statusCode === 408) {
          // Timeout - ممكن نعيد المحاولة
          console.log(`[PAIR] ⏰ Timeout for ${number}, will retry...`)
        }
      }
    })

    // ═══ طلب كود الربط ═══
    await delay(2500)

    try {
      let code = await socket.requestPairingCode(number)
      code = code?.match(/.{1,4}/g)?.join('-') || code

      console.log(`[PAIR] 📱 Pairing code for ${number}: ${code}`)

      safeSend({
        success: true,
        stage: 'code_ready',
        number,
        code,
        message: 'تم توليد كود الربط بنجاح.',
        instructions: [
          'افتح واتساب على هاتفك',
          'اذهب إلى: الإعدادات ⚙️ ← الأجهزة المرتبطة 🔗',
          'اضغط على "ربط جهاز" ثم "الربط برقم الهاتف"',
          'أدخل الكود أعلاه'
        ]
      })
    } catch (pairErr) {
      console.error('[PAIR] ❌ Failed to get pairing code:', pairErr.message)
      removeSession(sessionPath)
      safeSend({
        success: false,
        error: 'pairing_failed',
        message: `فشل توليد كود الربط: ${pairErr.message}`
      }, 503)
    }

    // ═══ Timeout للحماية من التعليق ═══
    connectionTimeout = setTimeout(() => {
      if (!responseSent) {
        console.log(`[PAIR] ⏰ Connection timeout for ${number}`)
        removeSession(sessionPath)
        safeSend({
          success: false,
          error: 'timeout',
          message: 'انتهت المهلة. حاول مرة أخرى.'
        }, 408)

        try {
          socket.ws?.close?.()
          socket.ev.removeAllListeners()
        } catch {}
      }
    }, 90000)

  } catch (err) {
    console.error('[PAIR] ❌ Session initialization error:', err.message)
    removeSession(sessionPath)
    safeSend({
      success: false,
      error: 'init_failed',
      message: `فشل بدء الجلسة: ${err.message}`
    }, 500)
  }
})

export default router