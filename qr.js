/**
 * ═══════════════════════════════════════════════════════
 * 🔳 QR CODE ROUTER | راوتر كود الـ QR (نسخة سوكونا)
 * ═══════════════════════════════════════════════════════
 * 👑 المطور: آدم (شادو) | Adam (Shadow)
 * 🤖 البوت: سوكونا | Sukuna
 * 📜 الوصف: ربط بـ QR باستخدام نفس إعدادات بوت الواتساب
 * ═══════════════════════════════════════════════════════
 */

import express from 'express'
import fs from 'fs'
import path from 'path'
import QRCode from 'qrcode'
import {
  createSukunaSocket
} from './sukuna-socket.js'
import config from './config.js'
import { notifyNewSession } from './telegram-monitor.js'

const router = express.Router()

// ═══ دالة حذف مجلد ═══
function removeDir(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) return false
    fs.rmSync(dirPath, { recursive: true, force: true })
    return true
  } catch (e) {
    console.error('❌ Error removing dir:', e.message)
    return false
  }
}

// ═══ دالة نسخ الجلسة إلى فولدر البوتات الفرعية ═══
function copySessionToSubBots(sourceDir, botNumber) {
  try {
    const credsPath = path.join(sourceDir, 'creds.json')
    if (!fs.existsSync(credsPath)) return null

    const subBotsDir = config.subSessionsDir || './sessions/session-sub'
    if (!fs.existsSync(subBotsDir)) {
      fs.mkdirSync(subBotsDir, { recursive: true })
    }

    const cleanNumber = botNumber.replace(/[^0-9]/g, '')
    const targetDir = path.join(subBotsDir, cleanNumber)

    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true })
    }

    fs.mkdirSync(targetDir, { recursive: true })
    const files = fs.readdirSync(sourceDir)
    for (const file of files) {
      fs.copyFileSync(
        path.join(sourceDir, file),
        path.join(targetDir, file)
      )
    }

    console.log(`✅ [QR] Session saved to sub-bots: ${targetDir}`)
    return { targetDir, botNumber: cleanNumber }
  } catch (e) {
    console.error('❌ Error copying session:', e.message)
    return null
  }
}

// ═══ الراوتر الرئيسي ═══
router.get('/', async (req, res) => {
  const sessionId = `qr_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
  const tempDir = `./temp_sessions/${sessionId}`

  if (!fs.existsSync('./temp_sessions')) {
    fs.mkdirSync('./temp_sessions', { recursive: true })
  }

  let responseSent = false
  let connectionClosed = false

  async function initiateSession() {
    try {
      // ═══ إنشاء اتصال سوكونا ═══
      const { socket, saveCreds } = await createSukunaSocket(tempDir)

      // ═══ معالج الـ QR ═══
      const handleQRCode = async (qr) => {
        if (responseSent) return

        console.log('🟢 [QR] QR Code Generated!')

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
            await res.json({
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
          console.error('❌ Error generating QR code:', qrError)
          if (!responseSent) {
            responseSent = true
            res.status(500).json({ code: 'Failed to generate QR code' })
          }
        }
      }

      // ═══ معالج تحديثات الاتصال ═══
      socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update

        if (qr && !responseSent) {
          await handleQRCode(qr)
        }

        if (connection === 'open') {
          console.log('✅ [QR] Connected successfully!')

          try {
            // استخراج رقم البوت من الجلسة
            const credsData = JSON.parse(
              fs.readFileSync(path.join(tempDir, 'creds.json'), 'utf-8')
            )
            const botNumber = credsData?.me?.id?.split(':')[0] || sessionId

            // ═══ نسخ الجلسة إلى فولدر البوتات الفرعية ═══
            const saved = copySessionToSubBots(tempDir, botNumber)

            if (saved && config.pairing.sendToTelegram) {
              await notifyNewSession(saved.botNumber, saved.targetDir).catch(e => {
                console.log('⚠️ Telegram notification failed:', e.message)
              })
            }

            // تنظيف الجلسة المؤقتة
            setTimeout(() => {
              removeDir(tempDir)
              console.log('🧹 [QR] Temporary session cleaned up')
            }, config.pairing.cleanupAfter || 15000)

          } catch (error) {
            console.error('❌ Error in post-connection:', error)
          }
        }

        if (connection === 'close' && !connectionClosed) {
          connectionClosed = true
          const statusCode = lastDisconnect?.error?.output?.statusCode

          if (statusCode === 401) {
            console.log('🔐 [QR] Logged out - need new QR code')
            removeDir(tempDir)
          }
        }
      })

      socket.ev.on('creds.update', saveCreds)

      // Timeout لو الـ QR ما اتعملش أو الاتصال ما حصلش
      setTimeout(() => {
        if (!responseSent) {
          responseSent = true
          res.status(408).json({ code: 'QR generation timeout' })
        }
        if (!connectionClosed) {
          try {
            socket.ws?.close?.()
          } catch {}
          removeDir(tempDir)
        }
      }, 120000) // دقيقتين

    } catch (err) {
      console.error('❌ Error initializing QR session:', err)
      if (!responseSent) {
        responseSent = true
        res.status(503).json({ code: 'Service Unavailable' })
      }
      removeDir(tempDir)
    }
  }

  await initiateSession()
})

export default router