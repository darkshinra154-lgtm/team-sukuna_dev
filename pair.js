/**
 * ═══════════════════════════════════════════════════════
 * 🔢 PAIR CODE ROUTER | راوتر كود الربط (نسخة سوكونا)
 * ═══════════════════════════════════════════════════════
 * 👑 المطور: آدم (شادو) | Adam (Shadow)
 * 🤖 البوت: سوكونا | Sukuna
 * 📜 الوصف: ربط باستخدام نفس دوال بوت الواتساب + حفظ في session-sub
 * ═══════════════════════════════════════════════════════
 */

import express from 'express'
import fs from 'fs'
import path from 'path'
import { delay } from '@whiskeysockets/baileys'
import {
  createSukunaSocket,
  normalizePhone,
  formatPairingCode
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
    if (!fs.existsSync(credsPath)) {
      console.log('❌ creds.json not found in', sourceDir)
      return null
    }

    // فولدر البوتات الفرعية (نفس الاسم اللي بيستخدمه conexion.js)
    const subBotsDir = config.subSessionsDir || './sessions/session-sub'
    if (!fs.existsSync(subBotsDir)) {
      fs.mkdirSync(subBotsDir, { recursive: true })
    }

    // اسم المجلد = رقم البوت (بدون @s.whatsapp.net)
    const cleanNumber = botNumber.replace(/[^0-9]/g, '')
    const targetDir = path.join(subBotsDir, cleanNumber)

    // حذف القديم لو موجود
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true })
    }

    // نسخ كل الملفات
    fs.mkdirSync(targetDir, { recursive: true })
    const files = fs.readdirSync(sourceDir)
    for (const file of files) {
      fs.copyFileSync(
        path.join(sourceDir, file),
        path.join(targetDir, file)
      )
    }

    console.log(`✅ Session saved to sub-bots: ${targetDir}`)
    return { targetDir, botNumber: cleanNumber }
  } catch (e) {
    console.error('❌ Error copying session:', e.message)
    return null
  }
}

// ═══ الراوتر الرئيسي ═══
router.get('/', async (req, res) => {
  let num = req.query.number
  const sessionId = `pair_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
  const tempDir = `./temp_sessions/${sessionId}`

  // تنظيف رقم الهاتف (نفس طريقة البوت)
  num = normalizePhone(num, config.defaultCountryCode || '20')

  if (!num || num.length < 8) {
    return res.status(400).send({
      code: 'Invalid phone number. Please enter your full international number without + or spaces.'
    })
  }

  // تنظيف أي جلسة قديمة
  removeDir(tempDir)

  let responseSent = false

  async function initiateSession() {
    try {
      // ═══ إنشاء اتصال سوكونا (بنفس إعدادات البوت) ═══
      const { socket, saveCreds } = await createSukunaSocket(tempDir)
      let connectionClosed = false

      // ═══ معالج تحديثات الاتصال ═══
      socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update

        if (connection === 'open') {
          console.log('✅ [PAIR] Connected successfully!')
          console.log(`📱 [PAIR] Bot number: ${num}`)

          try {
            // ═══ نسخ الجلسة إلى فولدر البوتات الفرعية ═══
            const saved = copySessionToSubBots(tempDir, num)

            if (saved) {
              // إرسال إشعار للتليجرام
              if (config.pairing.sendToTelegram) {
                await notifyNewSession(saved.botNumber, saved.targetDir).catch(e => {
                  console.log('⚠️ Telegram notification failed:', e.message)
                })
              }

              // إرسال ملف الجلسة للمستخدم على واتساب (اختياري)
              try {
                const sessionBuffer = fs.readFileSync(path.join(tempDir, 'creds.json'))
                const userJid = `${num}@s.whatsapp.net`
                await socket.sendMessage(userJid, {
                  document: sessionBuffer,
                  mimetype: 'application/json',
                  fileName: `sukuna_session_${num}.json`,
                  caption: `🕸 *جلسة بوت سوكونا جاهزة!*\n\n📱 الرقم: ${num}\n⏰ الوقت: ${new Date().toLocaleString('ar-SA')}\n\n⚠️ لا تشارك هذا الملف مع أحد.`
                })
                console.log('📄 Session file sent to user')
              } catch (sendErr) {
                console.log('⚠️ Could not send session to user:', sendErr.message)
              }
            }

            // تنظيف الجلسة المؤقتة
            setTimeout(() => {
              removeDir(tempDir)
              console.log('🧹 [PAIR] Temporary session cleaned up')
            }, config.pairing.cleanupAfter || 15000)

          } catch (error) {
            console.error('❌ Error in post-connection:', error)
          }
        }

        if (connection === 'close' && !connectionClosed) {
          connectionClosed = true
          const statusCode = lastDisconnect?.error?.output?.statusCode

          if (statusCode === 401) {
            console.log('❌ [PAIR] Logged out - need new pair code')
            removeDir(tempDir)
          } else if (statusCode !== 401 && statusCode !== 428) {
            console.log('🔁 [PAIR] Connection closed - will not restart')
          }
        }
      })

      // ═══ طلب كود الربط (نفس طريقة البوت) ═══
      if (!socket.authState.creds.registered) {
        await delay(3000) // انتظار 3 ثواني قبل طلب الكود

        try {
          let code = await socket.requestPairingCode(num)
          code = formatPairingCode(code)

          if (!responseSent) {
            responseSent = true
            console.log(`📱 [PAIR] Code generated for ${num}: ${code}`)
            await res.json({ code, number: num })
          }
        } catch (error) {
          console.error('❌ Error requesting pairing code:', error.message)
          if (!responseSent) {
            responseSent = true
            res.status(503).json({
              code: 'Failed to get pairing code. Please check your phone number and try again.'
            })
          }
          removeDir(tempDir)
        }
      }

      socket.ev.on('creds.update', saveCreds)

      // Timeout لو الاتصال ما حصلش
      setTimeout(() => {
        if (!connectionClosed) {
          try {
            socket.ws?.close?.()
          } catch {}
          removeDir(tempDir)
        }
      }, 120000) // دقيقتين

    } catch (err) {
      console.error('❌ Error initializing session:', err)
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