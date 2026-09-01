/**
 * ═══════════════════════════════════════════════════════
 * 🔢 PAIR CODE ROUTER | راوتر كود الربط (بطريقة البوت الرئيسي)
 * ═══════════════════════════════════════════════════════
 * 👑 المطور: آدم (شادو) | Adam (Shadow)
 * 🤖 البوت: سوكونا | Sukuna
 * 🏷️ الحقوق: ${global.author}
 * 📜 الوصف: توليد كود ربط بنفس دوال البوت الرئيسي + حفظ في session-sub
 * ═══════════════════════════════════════════════════════
 */

import express from 'express'
import fs from 'fs'
import path from 'path'
import { useMultiFileAuthState } from '@whiskeysockets/baileys'
import { makeWASocket } from '@whiskeysockets/baileys'
import pn from 'awesome-phonenumber'
import { 
  buildSocketOptions, 
  removeDir, 
  saveSessionToSub 
} from './lib/session-utils.js'
import config from './config.js'

const router = express.Router()

router.get('/', async (req, res) => {
  let num = req.query.number
  if (!num) {
    return res.status(400).json({ 
      success: false, 
      code: 'missing_number',
      message: 'الرقم مطلوب' 
    })
  }

  // تنظيف الرقم
  num = num.replace(/[^0-9]/g, '')
  
  // التحقق من الرقم
  const phone = pn('+' + num)
  if (!phone.isValid()) {
    return res.status(400).json({ 
      success: false, 
      code: 'invalid_number',
      message: 'رقم غير صحيح. أدخل الرقم الدولي بدون +' 
    })
  }

  num = phone.getNumber('e164').replace('+', '')
  const sessionId = `pair_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
  const dirs = path.join(config.sessions.pairTemp, sessionId)

  // تنظيف أي جلسة سابقة
  removeDir(dirs)

  let responseSent = false
  let socket = null

  async function initiateSession() {
    try {
      const { state, saveCreds } = await useMultiFileAuthState(dirs)
      const socketOptions = await buildSocketOptions(state, sessionId)
      
      socket = makeWASocket(socketOptions)
      
      socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, isNewLogin } = update

        if (connection === 'open') {
          console.log(`✅ [PAIR] Connected: ${num}`)

          try {
            // حفظ الجلسة في فولدر البوتات الفرعية
            const savedPath = saveSessionToSub(dirs, num)
            
            if (savedPath && config.telegram.token) {
              try {
                const { notifyNewSession } = await import('./telegram-monitor.js')
                await notifyNewSession(num, savedPath)
              } catch (e) {
                console.log('⚠️ Telegram notify failed:', e.message)
              }
            }

            // حذف الجلسة المؤقتة
            setTimeout(() => {
              removeDir(dirs)
              console.log(`🧹 [PAIR] Cleaned: ${sessionId}`)
            }, config.sessions.cleanupAfter)

          } catch (error) {
            console.error('❌ [PAIR] Save error:', error)
            removeDir(dirs)
          }
        }

        if (connection === 'close') {
          const statusCode = lastDisconnect?.error?.output?.statusCode
          if (statusCode === 401) {
            console.log(`🔐 [PAIR] Logged out: ${num}`)
          } else if (statusCode !== 401) {
            console.log(`🔁 [PAIR] Reconnecting: ${num}`)
          }
        }
      })

      // طلب كود الربط
      if (!socket.authState.creds.registered) {
        await new Promise(r => setTimeout(r, 3000))
        try {
          let code = await socket.requestPairingCode(num)
          code = code?.match(/.{1,4}/g)?.join('-') || code
          
          if (!responseSent) {
            responseSent = true
            console.log(`📱 [PAIR] Code sent: ${num} → ${code}`)
            return res.json({ 
              success: true,
              code, 
              number: num,
              message: 'تم توليد كود الربط بنجاح'
            })
          }
        } catch (error) {
          console.error('❌ [PAIR] Request failed:', error.message)
          if (!responseSent) {
            responseSent = true
            return res.status(503).json({ 
              success: false,
              code: 'pairing_failed',
              message: 'فشل طلب كود الربط. تحقق من الرقم وحاول مرة أخرى.'
            })
          }
        }
      }

      socket.ev.on('creds.update', saveCreds)

    } catch (err) {
      console.error('❌ [PAIR] Init error:', err.message)
      if (!responseSent) {
        responseSent = true
        return res.status(503).json({ 
          success: false,
          code: 'service_unavailable',
          message: 'الخدمة غير متاحة حالياً'
        })
      }
      removeDir(dirs)
    }
  }

  await initiateSession()
})

export default router