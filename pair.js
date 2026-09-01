/**
 * ═══════════════════════════════════════════════════════
 * 🔢 PAIR CODE ROUTER | راوتر كود الربط
 * ═══════════════════════════════════════════════════════
 * 👑 المطور: آدم (شادو) | Adam (Shadow)
 * 🤖 البوت: سوكونا | Sukuna
 * 📜 الوصف: توليد كود الربط + حفظ الجلسة في فولدر البوتات الفرعية
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
  Browsers,
  fetchLatestBaileysVersion
} from '@whiskeysockets/baileys'
import pn from 'awesome-phonenumber'
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

    // إنشاء مجلد الجلسات الفرعية لو مش موجود
    const subDir = config.subSessionsDir
    if (!fs.existsSync(subDir)) {
      fs.mkdirSync(subDir, { recursive: true })
    }

    // اسم المجلد = رقم البوت
    const targetDir = path.join(subDir, botNumber)

    // لو المجلد موجود بالفعل، احذفه الأول
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true })
    }

    // انسخ كل ملفات الجلسة
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
  let num = req.query.number
  let dirs = './pair_sessions/' + (num || `session_${Date.now()}`)

  // حذف أي جلسة قديمة
  await removeFile(dirs)

  // تنظيف رقم الهاتف
  num = num.replace(/[^0-9]/g, '')

  // التحقق من صحة الرقم
  const phone = pn('+' + num)
  if (!phone.isValid()) {
    if (!res.headersSent) {
      return res.status(400).send({
        code: 'Invalid phone number. Please enter your full international number without + or spaces.'
      })
    }
    return
  }

  // تحويل الرقم لصيغة E.164
  num = phone.getNumber('e164').replace('+', '')

  async function initiateSession() {
    const { state, saveCreds } = await useMultiFileAuthState(dirs)

    try {
      const { version } = await fetchLatestBaileysVersion()
      let responseSent = false

      const sukuna = makeWASocket({
        version,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(
            state.keys,
            pino({ level: 'fatal' }).child({ level: 'fatal' })
          )
        },
        printQRInTerminal: false,
        logger: pino({ level: 'fatal' }).child({ level: 'fatal' }),
        browser: Browsers.windows('Chrome'),
        markOnlineOnConnect: false,
        generateHighQualityLinkPreview: false,
        defaultQueryTimeoutMs: 60000,
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 30000,
        retryRequestDelayMs: 250,
        maxRetries: 5
      })

      sukuna.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update

        if (connection === 'open') {
          console.log('✅ Connected successfully!')
          console.log(`📱 Saving session for: ${num}`)

          try {
            // ═══ حفظ الجلسة في فولدر البوتات الفرعية ═══
            const savedPath = saveSessionToSubFolder(dirs, num)

            if (savedPath && config.pairing.sendToTelegram) {
              // إرسال إشعار لبوت التليجرام
              try {
                const { notifyNewSession } = await import('./telegram-monitor.js')
                await notifyNewSession(num, savedPath)
              } catch (e) {
                console.log('⚠️ Telegram notification failed:', e.message)
              }
            }

            // حذف الجلسة المؤقتة بعد الحفظ
            setTimeout(() => {
              removeFile(dirs)
              console.log('🧹 Temporary session cleaned up')
            }, config.pairing.cleanupAfter)

            console.log('🎉 Process completed successfully!')
          } catch (error) {
            console.error('❌ Error saving session:', error)
            removeFile(dirs)
          }
        }

        if (connection === 'close') {
          const statusCode = lastDisconnect?.error?.output?.statusCode
          if (statusCode === 401) {
            console.log('❌ Logged out. Need new pair code.')
          } else if (statusCode !== 401) {
            console.log('🔁 Connection closed — restarting...')
            if (!responseSent) {
              initiateSession()
            }
          }
        }
      })

      // طلب كود الربط
      if (!sukuna.authState.creds.registered) {
        await delay(3000)
        try {
          let code = await sukuna.requestPairingCode(num)
          code = code?.match(/.{1,4}/g)?.join('-') || code
          if (!res.headersSent) {
            responseSent = true
            console.log({ num, code })
            await res.send({ code })
          }
        } catch (error) {
          console.error('Error requesting pairing code:', error)
          if (!res.headersSent) {
            responseSent = true
            res.status(503).send({
              code: 'Failed to get pairing code. Please try again.'
            })
          }
        }
      }

      sukuna.ev.on('creds.update', saveCreds)
    } catch (err) {
      console.error('Error initializing session:', err)
      if (!res.headersSent) {
        res.status(503).send({ code: 'Service Unavailable' })
      }
    }
  }

  await initiateSession()
})

export default router