/**
 * ═══════════════════════════════════════════════════════
 * 🔳 QR CODE ROUTER | راوتر كود الـ QR
 * ═══════════════════════════════════════════════════════
 * 👑 المطور: آدم (شادو) | Adam (Shadow)
 * 🤖 البوت: سوكونا | Sukuna
 * 📜 الوصف: ربط QR بنفس طريقة البوت الرئيسي + حفظ الجلسات في session-sub
 * ═══════════════════════════════════════════════════════
 */

import express from 'express'
import fs from 'fs'
import pino from 'pino'
import {
  makeWASocket,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion
} from 'wileys'
import QRCode from 'qrcode'
import { removeFile, saveSessionToSubFolder, getBotNumberFromCreds } from './utils.js'
import config from './config.js'

const router = express.Router()

router.get('/', async (req, res) => {
  const sessionId = Date.now().toString() + Math.random().toString(36).substr(2, 9)
  const dirs = `${config.qrSessionsDir}/session_${sessionId}`

  if (!fs.existsSync(config.qrSessionsDir)) {
    fs.mkdirSync(config.qrSessionsDir, { recursive: true })
  }

  let qrGenerated = false
  let responseSent = false

  async function initiateSession() {
    if (!fs.existsSync(dirs)) fs.mkdirSync(dirs, { recursive: true })
    const { state, saveCreds } = await useMultiFileAuthState(dirs)

    try {
      const { version } = await fetchLatestBaileysVersion()

      // ═══ إعدادات السوكيت بنفس طريقة البوت الرئيسي ═══
      const socketConfig = {
        version,
        logger: pino({ level: 'silent' }),
        browser: config.browser,
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
        defaultQueryTimeoutMs: config.defaultQueryTimeoutMs,
        connectTimeoutMs: config.connectTimeoutMs,
        keepAliveIntervalMs: config.keepAliveIntervalMs,
        retryRequestDelayMs: config.retryRequestDelayMs,
        maxRetries: config.maxRetries
      }

      let sock = makeWASocket(socketConfig)
      let reconnectAttempts = 0
      const maxReconnectAttempts = 3

      // ═══ معالجة كود QR ═══
      const handleQRCode = async (qr) => {
        if (qrGenerated || responseSent) return
        qrGenerated = true
        console.log('🟢 QR Code Generated!')

        try {
          const qrDataURL = await QRCode.toDataURL(qr, {
            errorCorrectionLevel: 'M',
            type: 'image/png',
            quality: 0.92,
            margin: 1,
            color: { dark: '#000000', light: '#FFFFFF' }
          })

          if (!responseSent) {
            responseSent = true
            await res.send({
              qr: qrDataURL,
              message: 'QR Code Generated! امسحه بكاميرا واتساب.',
              instructions: [
                '1. افتح واتساب على موبايلك',
                '2. روح إلى ⚙️ الإعدادات ← الأجهزة المرتبطة 🔗',
                '3. اضغط "ربط جهاز"',
                '4. امسح الكود اللي فوق'
              ]
            })
          }
        } catch (qrError) {
          console.error('❌ Error generating QR code:', qrError.message)
          if (!responseSent) {
            responseSent = true
            res.status(500).send({ code: 'فشل توليد كود QR' })
          }
        }
      }

      // ═══ مراقبة حالة الاتصال ═══
      const handleConnectionUpdate = async (update) => {
        const { connection, lastDisconnect, qr } = update

        if (qr && !qrGenerated) {
          await handleQRCode(qr)
        }

        if (connection === 'open') {
          console.log('✅ [QR] Connected successfully!')

          try {
            // ═══ استخراج رقم البوت وحفظ الجلسة ═══
            const botNumber = getBotNumberFromCreds(dirs) || sessionId
            const savedPath = saveSessionToSubFolder(dirs, botNumber)

            if (savedPath && config.pairing.sendToTelegram) {
              try {
                const { notifyNewSession } = await import('./telegram-monitor.js')
                await notifyNewSession(botNumber, savedPath)
              } catch (e) {
                console.log('⚠️ Telegram notification failed:', e.message)
              }
            }

            // ═══ تنظيف الجلسة المؤقتة ═══
            setTimeout(() => {
              removeFile(dirs)
              console.log('🧹 QR session cleaned up')
            }, config.pairing.cleanupAfter)

          } catch (error) {
            console.error('❌ Error saving QR session:', error)
            removeFile(dirs)
          }

          reconnectAttempts = 0
        }

        if (connection === 'close') {
          const statusCode = lastDisconnect?.error?.output?.statusCode

          if (statusCode === 401) {
            console.log('🔐 Logged out - need new QR code')
            removeFile(dirs)
          } else if (statusCode === 515 || statusCode === 503) {
            reconnectAttempts++
            if (reconnectAttempts <= maxReconnectAttempts) {
              console.log(`🔄 Reconnect attempt ${reconnectAttempts}/${maxReconnectAttempts}`)
              setTimeout(async () => {
                try {
                  sock = makeWASocket(socketConfig)
                  sock.ev.on('connection.update', handleConnectionUpdate)
                  sock.ev.on('creds.update', saveCreds)
                } catch (err) {
                  console.error('❌ Failed to reconnect:', err.message)
                }
              }, 2000)
            } else {
              if (!responseSent) {
                responseSent = true
                res.status(503).send({ code: 'فشل الاتصال بعد عدة محاولات' })
              }
              removeFile(dirs)
            }
          }
        }
      }

      sock.ev.on('connection.update', handleConnectionUpdate)
      sock.ev.on('creds.update', saveCreds)

      // ═══ Timeout لو الـ QR ما اتعملش ═══
      setTimeout(() => {
        if (!responseSent) {
          responseSent = true
          res.status(408).send({ code: 'QR generation timeout' })
          removeFile(dirs)
        }
      }, 30000)

    } catch (err) {
      console.error('❌ Error initializing QR session:', err.message)
      if (!responseSent) {
        responseSent = true
        res.status(503).send({ code: 'Service Unavailable' })
      }
      removeFile(dirs)
    }
  }

  await initiateSession()
})

export default router