/**
 * ═══════════════════════════════════════════════════════
 * 🔳 QR CODE ROUTER | راوتر كود الـ QR
 * ═══════════════════════════════════════════════════════
 * 👑 المطور: آدم (شادو) | Adam (Shadow)
 * 🤖 البوت: سوكونا | Sukuna
 * 📜 الوصف: توليد كود QR + حفظ الجلسة في فولدر البوتات الفرعية
 * ═══════════════════════════════════════════════════════
 */

import express from 'express'
import fs from 'fs'
import path from 'path'
import pino from 'pino'
import {
  makeWASocket,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  Browsers,
  fetchLatestBaileysVersion
} from '@whiskeysockets/baileys'
import QRCode from 'qrcode'
import config from './config.js'

const router = express.Router()

// ═══ دالة حذف ملف أو مجلد ═══
function removeFile(FilePath) {
  try {
    if (!fs.existsSync(FilePath)) return false
    fs.rmSync(FilePath, { recursive: true, force: true })
    return true
  } catch (e) {
    console.error('Error removing file:', e)
    return false
  }
}

// ═══ دالة حفظ الجلسة في فولدر البوتات الفرعية ═══
function saveSessionToSubFolder(sessionDir, botNumber) {
  try {
    const credsPath = path.join(sessionDir, 'creds.json')
    if (!fs.existsSync(credsPath)) {
      console.log('❌ creds.json not found in', sessionDir)
      return null
    }

    const subDir = config.subSessionsDir
    if (!fs.existsSync(subDir)) {
      fs.mkdirSync(subDir, { recursive: true })
    }

    const targetDir = path.join(subDir, botNumber)

    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true })
    }

    fs.mkdirSync(targetDir, { recursive: true })
    const files = fs.readdirSync(sessionDir)
    for (const file of files) {
      fs.copyFileSync(
        path.join(sessionDir, file),
        path.join(targetDir, file)
      )
    }

    console.log(`✅ Session saved to: ${targetDir}`)
    return targetDir
  } catch (e) {
    console.error('❌ Error saving session:', e)
    return null
  }
}

// ═══ الراوتر الرئيسي ═══
router.get('/', async (req, res) => {
  const sessionId = Date.now().toString() + Math.random().toString(36).substr(2, 9)
  const dirs = `./qr_sessions/session_${sessionId}`

  if (!fs.existsSync('./qr_sessions')) {
    fs.mkdirSync('./qr_sessions', { recursive: true })
  }

  async function initiateSession() {
    if (!fs.existsSync(dirs)) fs.mkdirSync(dirs, { recursive: true })
    const { state, saveCreds } = await useMultiFileAuthState(dirs)

    try {
      const { version } = await fetchLatestBaileysVersion()
      let qrGenerated = false
      let responseSent = false

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
              message: 'QR Code Generated! Scan it with your WhatsApp app.',
              instructions: [
                '1. Open WhatsApp on your phone',
                '2. Go to Settings > Linked Devices',
                '3. Tap "Link a Device"',
                '4. Scan the QR code above'
              ]
            })
          }
        } catch (qrError) {
          console.error('Error generating QR code:', qrError)
          if (!responseSent) {
            responseSent = true
            res.status(500).send({ code: 'Failed to generate QR code' })
          }
        }
      }

      const socketConfig = {
        version,
        logger: pino({ level: 'silent' }),
        browser: Browsers.windows('Chrome'),
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(
            state.keys,
            pino({ level: 'fatal' }).child({ level: 'fatal' })
          )
        },
        markOnlineOnConnect: false,
        generateHighQualityLinkPreview: false,
        defaultQueryTimeoutMs: 60000,
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 30000,
        retryRequestDelayMs: 250,
        maxRetries: 5
      }

      let sock = makeWASocket(socketConfig)
      let reconnectAttempts = 0
      const maxReconnectAttempts = 3

      const handleConnectionUpdate = async (update) => {
        const { connection, lastDisconnect, qr } = update

        if (qr && !qrGenerated) {
          await handleQRCode(qr)
        }

        if (connection === 'open') {
          console.log('✅ Connected successfully via QR!')

          try {
            // قراءة الجلسة للحصول على رقم البوت
            const credsData = JSON.parse(fs.readFileSync(path.join(dirs, 'creds.json'), 'utf-8'))
            const botNumber = credsData?.me?.id?.split(':')[0] || sessionId

            // ═══ حفظ الجلسة في فولدر البوتات الفرعية ═══
            const savedPath = saveSessionToSubFolder(dirs, botNumber)

            if (savedPath && config.pairing.sendToTelegram) {
              try {
                const { notifyNewSession } = await import('./telegram-monitor.js')
                await notifyNewSession(botNumber, savedPath)
              } catch (e) {
                console.log('⚠️ Telegram notification failed:', e.message)
              }
            }

            // تنظيف الجلسة المؤقتة
            setTimeout(() => {
              removeFile(dirs)
              console.log('🧹 QR session cleaned up')
            }, config.pairing.cleanupAfter)

          } catch (error) {
            console.error('Error saving QR session:', error)
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
              setTimeout(() => {
                try {
                  sock = makeWASocket(socketConfig)
                  sock.ev.on('connection.update', handleConnectionUpdate)
                  sock.ev.on('creds.update', saveCreds)
                } catch (err) {
                  console.error('Failed to reconnect:', err)
                }
              }, 2000)
            } else {
              if (!responseSent) {
                responseSent = true
                res.status(503).send({ code: 'Connection failed after multiple attempts' })
              }
            }
          }
        }
      }

      sock.ev.on('connection.update', handleConnectionUpdate)
      sock.ev.on('creds.update', saveCreds)

      // Timeout لو الـ QR ما اتعملش
      setTimeout(() => {
        if (!responseSent) {
          responseSent = true
          res.status(408).send({ code: 'QR generation timeout' })
          removeFile(dirs)
        }
      }, 30000)

    } catch (err) {
      console.error('Error initializing QR session:', err)
      if (!res.headersSent) {
        res.status(503).send({ code: 'Service Unavailable' })
      }
      removeFile(dirs)
    }
  }

  await initiateSession()
})

export default router