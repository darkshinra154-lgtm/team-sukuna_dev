/**
 * ═══════════════════════════════════════════════════════
 * 🔢 PAIR CODE ROUTER | راوتر كود الربط
 * ═══════════════════════════════════════════════════════
 * 👑 المطور: آدم (شادو) | Adam (Shadow)
 * 🤖 البوت: سوكونا | Sukuna
 * 📜 الوصف: ربط بنفس طريقة البوت الرئيسي + حفظ الجلسات في session-sub
 * ═══════════════════════════════════════════════════════
 */

import express from 'express'
import fs from 'fs'
import pino from 'pino'
import {
  makeWASocket,
  useMultiFileAuthState,
  delay,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion
} from 'wileys'
import { normalizePhone, removeFile, saveSessionToSubFolder, getBotNumberFromCreds } from './utils.js'
import config from './config.js'

const router = express.Router()

router.get('/', async (req, res) => {
  let num = req.query.number
  const sessionTag = num || `session_${Date.now()}`
  const dirs = `${config.pairSessionsDir}/${sessionTag}`

  // تنظيف المجلد القديم
  await removeFile(dirs)
  if (!fs.existsSync(config.pairSessionsDir)) {
    fs.mkdirSync(config.pairSessionsDir, { recursive: true })
  }

  // ═══ معالجة الرقم بنفس طريقة البوت الرئيسي ═══
  num = normalizePhone(num)
  if (!num || num.length < 8) {
    if (!res.headersSent) {
      return res.status(400).send({
        code: 'رقم الواتساب غير صحيح. اكتب رقم بصيغة دولية بدون + أو مسافات.'
      })
    }
    return
  }

  let responseSent = false

  async function initiateSession() {
    const { state, saveCreds } = await useMultiFileAuthState(dirs)

    try {
      const { version } = await fetchLatestBaileysVersion()

      // ═══ إعدادات السوكيت بنفس طريقة البوت الرئيسي ═══
      const sukuna = makeWASocket({
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
      })

      // ═══ مراقبة حالة الاتصال ═══
      sukuna.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update

        if (connection === 'open') {
          console.log(`✅ [PAIR] Connected successfully for: ${num}`)

          try {
            // ═══ استخراج رقم البوت وحفظ الجلسة ═══
            const botNumber = getBotNumberFromCreds(dirs) || num
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
              console.log('🧹 Temporary pair session cleaned up')
            }, config.pairing.cleanupAfter)

            console.log('🎉 Pair process completed successfully!')
          } catch (error) {
            console.error('❌ Error saving pair session:', error)
            removeFile(dirs)
          }
        }

        if (connection === 'close') {
          const statusCode = lastDisconnect?.error?.output?.statusCode
          if (statusCode === 401) {
            console.log('❌ Logged out. Need new pair code.')
            removeFile(dirs)
          } else if (statusCode !== 401) {
            console.log('🔁 Connection closed — may need to retry...')
          }
        }
      })

      // ═══ طلب كود الربط بنفس طريقة البوت الرئيسي ═══
      if (!sukuna.authState.creds.registered) {
        await delay(3000)
        try {
          let code = await sukuna.requestPairingCode(num)
          code = code?.match(/.{1,4}/g)?.join('-') || code

          if (!responseSent) {
            responseSent = true
            console.log({ num, code })
            await res.send({ code })
          }
        } catch (error) {
          console.error('❌ Error requesting pairing code:', error.message)
          if (!responseSent) {
            responseSent = true
            res.status(503).send({
              code: 'فشل طلب كود الربط. تأكد من الرقم وجرب تاني.'
            })
          }
          removeFile(dirs)
        }
      }

      sukuna.ev.on('creds.update', saveCreds)
    } catch (err) {
      console.error('❌ Error initializing pair session:', err.message)
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