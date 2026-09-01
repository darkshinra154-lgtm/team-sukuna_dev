/**
 * ═══════════════════════════════════════════════════════
 * 🔳 QR CODE ROUTER | نظام ربط QR
 * ═══════════════════════════════════════════════════════
 * 👑 المطور: آدم (شادو) | Adam (Shadow)
 * 🤖 البوت: سوكونا | Sukuna
 * 📜 الوصف: ربط QR بنفس دوال البوت الرئيسي
 *          وحفظ الجلسة تلقائياً في session-sub/{number}
 * ═══════════════════════════════════════════════════════
 */

import express from 'express'
import fs from 'fs'
import path from 'path'
import pino from 'pino'
import QRCode from 'qrcode'
import {
  makeWASocket,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion
} from '@whiskeysockets/baileys'
import config from './config.js'

const router = express.Router()

// ═══ دوال مساعدة ═══
function removeSession(sessionPath) {
  try {
    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true, force: true })
    }
  } catch (e) {
    console.error('[QR] Error:', e.message)
  }
}

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

async function notifySessionReady(number, sessionPath) {
  try {
    const monitor = await import('./telegram-monitor.js').catch(() => null)
    if (monitor?.notifyNewSession) {
      await monitor.notifyNewSession(number, sessionPath)
    }
  } catch {}
}

// ═══ المسار الرئيسي ═══
router.get('/', async (req, res) => {
  const sessionId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const tempSessionPath = path.join('./qr_sessions', `qr_${sessionId}`)

  fs.mkdirSync('./qr_sessions', { recursive: true })
  removeSession(tempSessionPath)
  fs.mkdirSync(tempSessionPath, { recursive: true })

  let socket = null
  let responseSent = false
  let qrGenerated = false
  let finalNumber = null

  const safeSend = (data, status = 200) => {
    if (responseSent) return
    responseSent = true
    res.status(status).json(data)
  }

  try {
    const { state, saveCreds } = await useMultiFileAuthState(tempSessionPath)
    const { version } = await fetchLatestBaileysVersion()

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
      defaultQueryTimeoutMs: config.bot.defaultQueryTimeoutMs,
      keepAliveIntervalMs: config.bot.keepAliveIntervalMs
    })

    socket.ev.on('creds.update', saveCreds)

    socket.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update
      const statusCode = lastDisconnect?.error?.output?.statusCode

      // ═══ توليد QR ═══
      if (qr && !qrGenerated) {
        qrGenerated = true
        try {
          const qrDataURL = await QRCode.toDataURL(qr, {
            errorCorrectionLevel: 'M',
            type: 'image/png',
            quality: 0.92,
            margin: 1,
            color: { dark: '#000000', light: '#FFFFFF' }
          })

          safeSend({
            success: true,
            stage: 'qr_ready',
            qr: qrDataURL,
            sessionId,
            message: 'امسح الكود بكاميرا واتساب خلال دقيقة.',
            instructions: [
              'افتح واتساب على هاتفك',
              'الإعدادات ⚙️ ← الأجهزة المرتبطة 🔗',
              'اضغط "ربط جهاز" وامسح الكود'
            ]
          })
        } catch (e) {
          safeSend({
            success: false,
            error: 'qr_failed',
            message: 'فشل توليد كود QR'
          }, 500)
        }
      }

      // ═══ الاتصال نجح ═══
      if (connection === 'open') {
        console.log('[QR] ✅ Connected!')

        // استخراج رقم البوت من الـ creds
        const credsPath = path.join(tempSessionPath, 'creds.json')
        let botNumber = null

        if (fs.existsSync(credsPath)) {
          try {
            const creds = JSON.parse(fs.readFileSync(credsPath, 'utf-8'))
            const meId = creds?.me?.id || ''
            botNumber = meId.split(':')[0].split('@')[0]
          } catch {}
        }

        if (!botNumber) {
          botNumber = sessionId
        }

        finalNumber = botNumber

        // ═══ نقل الجلسة إلى session-sub ═══
        const finalPath = path.join(config.subSessionsDir, botNumber)
        removeSession(finalPath)
        fs.mkdirSync(config.subSessionsDir, { recursive: true })

        // نسخ كل ملفات الجلسة
        try {
          const files = fs.readdirSync(tempSessionPath)
          for (const file of files) {
            fs.copyFileSync(
              path.join(tempSessionPath, file),
              path.join(finalPath, file)
            )
          }
          console.log(`[QR] 💾 Session moved to: ${finalPath}`)

          await notifySessionReady(botNumber, finalPath)

          // إرسال إشعار للـ client (polling)
          fs.writeFileSync(
            path.join(tempSessionPath, 'STATUS'),
            JSON.stringify({ status: 'connected', number: botNumber })
          )
        } catch (e) {
          console.error('[QR] Error moving session:', e.message)
        }

        try {
          socket.ws?.close?.()
          socket.ev.removeAllListeners()
        } catch {}
      }

      // ═══ فشل الاتصال ═══
      if (connection === 'close') {
        if (statusCode === 401) {
          console.log('[QR] ❌ Logged out')
          removeSession(tempSessionPath)
        }
      }
    })

    // ═══ Timeout ═══
    setTimeout(() => {
      if (!responseSent) {
        safeSend({
          success: false,
          error: 'timeout',
          message: 'انتهت مهلة توليد QR'
        }, 408)
        removeSession(tempSessionPath)
      }

      // إغلاق socket بعد 90 ثانية بأي حال
      setTimeout(() => {
        try {
          socket?.ws?.close?.()
          socket?.ev.removeAllListeners()
        } catch {}
      }, 90000)
    }, 30000)

  } catch (err) {
    console.error('[QR] ❌ Error:', err.message)
    removeSession(tempSessionPath)
    safeSend({
      success: false,
      error: 'init_failed',
      message: err.message
    }, 500)
  }
})

// ═══ Endpoint للـ polling لمعرفة حالة الاتصال ═══
router.get('/status/:sessionId', (req, res) => {
  const { sessionId } = req.params
  const statusFile = path.join('./qr_sessions', `qr_${sessionId}`, 'STATUS')

  if (fs.existsSync(statusFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(statusFile, 'utf-8'))
      res.json({ success: true, ...data })

      // تنظيف بعد النجاح
      if (data.status === 'connected') {
        setTimeout(() => {
          const qrPath = path.join('./qr_sessions', `qr_${sessionId}`)
          removeSession(qrPath)
        }, 5000)
      }
    } catch {
      res.json({ success: false, status: 'pending' })
    }
  } else {
    res.json({ success: false, status: 'pending' })
  }
})

export default router