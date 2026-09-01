/**
 * ═══════════════════════════════════════════════════════
 * 🔳 QR CODE ROUTER | راوتر كود QR (بطريقة البوت الرئيسي)
 * ═══════════════════════════════════════════════════════
 * 👑 المطور: آدم (شادو) | Adam (Shadow)
 * 🤖 البوت: سوكونا | Sukuna
 * 🏷️ الحقوق: ${global.author}
 * 📜 الوصف: توليد QR بنفس إعدادات البوت الرئيسي + حفظ في session-sub
 * ═══════════════════════════════════════════════════════
 */

import express from 'express'
import fs from 'fs'
import path from 'path'
import { useMultiFileAuthState, makeWASocket } from '@whiskeysockets/baileys'
import QRCode from 'qrcode'
import { 
  buildSocketOptions, 
  removeDir, 
  saveSessionToSub 
} from './lib/session-utils.js'
import config from './config.js'

const router = express.Router()

router.get('/', async (req, res) => {
  const sessionId = `qr_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
  const dirs = path.join(config.sessions.qrTemp, sessionId)

  if (!fs.existsSync(config.sessions.qrTemp)) {
    fs.mkdirSync(config.sessions.qrTemp, { recursive: true })
  }

  let responseSent = false
  let qrGenerated = false
  let socket = null

  async function initiateSession() {
    try {
      if (!fs.existsSync(dirs)) fs.mkdirSync(dirs, { recursive: true })
      
      const { state, saveCreds } = await useMultiFileAuthState(dirs)
      const socketOptions = await buildSocketOptions(state, sessionId)
      
      socket = makeWASocket(socketOptions)

      socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update

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

            if (!responseSent) {
              responseSent = true
              console.log(`🟢 [QR] Generated: ${sessionId}`)
              return res.json({
                success: true,
                qr: qrDataURL,
                message: 'تم توليد كود QR بنجاح',
                instructions: [
                  '1️⃣ افتح واتساب على هاتفك',
                  '2️⃣ اذهب إلى الإعدادات ← الأجهزة المرتبطة',
                  '3️⃣ اضغط "ربط جهاز"',
                  '4️⃣ امسح الكود أعلاه'
                ]
              })
            }
          } catch (qrError) {
            console.error('❌ [QR] Generate error:', qrError)
            if (!responseSent) {
              responseSent = true
              return res.status(500).json({ 
                success: false,
                code: 'qr_failed',
                message: 'فشل توليد كود QR'
              })
            }
          }
        }

        if (connection === 'open') {
          console.log(`✅ [QR] Connected: ${sessionId}`)

          try {
            // قراءة رقم البوت من creds
            const credsPath = path.join(dirs, 'creds.json')
            let botNumber = sessionId
            
            if (fs.existsSync(credsPath)) {
              const credsData = JSON.parse(fs.readFileSync(credsPath, 'utf-8'))
              botNumber = credsData?.me?.id?.split(':')[0] || sessionId
            }

            // حفظ في فولدر البوتات الفرعية
            const savedPath = saveSessionToSub(dirs, botNumber)
            
            if (savedPath && config.telegram.token) {
              try {
                const { notifyNewSession } = await import('./telegram-monitor.js')
                await notifyNewSession(botNumber, savedPath)
              } catch (e) {
                console.log('⚠️ Telegram notify failed:', e.message)
              }
            }

            setTimeout(() => {
              removeDir(dirs)
              console.log(`🧹 [QR] Cleaned: ${sessionId}`)
            }, config.sessions.cleanupAfter)

          } catch (error) {
            console.error('❌ [QR] Save error:', error)
            removeDir(dirs)
          }
        }

        if (connection === 'close') {
          const statusCode = lastDisconnect?.error?.output?.statusCode
          if (statusCode === 401) {
            console.log(`🔐 [QR] Logged out: ${sessionId}`)
            removeDir(dirs)
          }
        }
      })

      socket.ev.on('creds.update', saveCreds)

      // Timeout 60 ثانية
      setTimeout(() => {
        if (!responseSent) {
          responseSent = true
          removeDir(dirs)
          return res.status(408).json({ 
            success: false,
            code: 'timeout',
            message: 'انتهت مهلة توليد QR'
          })
        }
      }, 60000)

    } catch (err) {
      console.error('❌ [QR] Init error:', err.message)
      if (!responseSent) {
        responseSent = true
        return res.status(503).json({ 
          success: false,
          code: 'service_unavailable',
          message: 'الخدمة غير متاحة'
        })
      }
      removeDir(dirs)
    }
  }

  await initiateSession()
})

export default router