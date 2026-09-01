/**
 * ═══════════════════════════════════════════════════════
 * 🚀 SUKUNA PLATFORM | منصة سوكونا الاحترافية
 * ═══════════════════════════════════════════════════════
 * 👑 المطور: آدم (شادو) | Adam (Shadow)
 * 🤖 البوت: سوكونا | Sukuna
 * 🏷️ الحقوق: ${global.author}
 * 📜 الوصف: موقع تنصيب احترافي + لوحة تحكم + API شامل
 * ═══════════════════════════════════════════════════════
 */

import express from 'express'
import bodyParser from 'body-parser'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'
import chalk from 'chalk'
import config from './config.js'
import { listSessions, countSessions } from './lib/session-utils.js'

import pairRouter from './pair.js'
import qrRouter from './qr.js'

const app = express()
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PORT = config.PORT

// ═══ زيادة حد Event Listeners ═══
import('events').then(events => {
  events.EventEmitter.defaultMaxListeners = 500
})

// ═══ إنشاء المجلدات ═══
const requiredDirs = [
  config.sessions.mainDir,
  config.sessions.subDir,
  config.sessions.pairTemp,
  config.sessions.qrTemp,
  path.join(__dirname, 'public')
]

for (const dir of requiredDirs) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

// ═══ Middleware ═══
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(express.static(__dirname))
app.use('/public', express.static(path.join(__dirname, 'public')))

// ═══ صفحة Dashboard الرئيسية ═══
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'))
})

// ═══ صفحة ربط Pair ═══
app.get('/pair', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pair.html'))
})

// ═══ صفحة ربط QR ═══
app.get('/qr', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'qr.html'))
})

// ═══ صفحة الجلسات ═══
app.get('/sessions', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'sessions.html'))
})

// ═══ صفحة الفريق ═══
app.get('/team', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'team.html'))
})

// ═══ APIs ═══
app.use('/pair', pairRouter)
app.use('/qr', qrRouter)

app.get('/api/stats', (req, res) => {
  try {
    const sessions = listSessions()
    res.json({
      success: true,
      data: {
        totalSessions: sessions.length,
        sessions: sessions,
        uptime: process.uptime(),
        platform: config.platform
      }
    })
  } catch (e) {
    res.json({ success: false, error: e.message })
  }
})

app.get('/api/sessions', (req, res) => {
  try {
    const sessions = listSessions()
    res.json({ success: true, sessions, count: sessions.length })
  } catch (e) {
    res.json({ success: false, sessions: [], count: 0, error: e.message })
  }
})

app.delete('/api/session/:number', (req, res) => {
  try {
    const num = req.params.number
    const sessionPath = path.join(config.sessions.subDir, num)
    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true, force: true })
      res.json({ success: true, message: `تم حذف جلسة ${num}` })
    } else {
      res.json({ success: false, message: 'الجلسة غير موجودة' })
    }
  } catch (e) {
    res.json({ success: false, message: e.message })
  }
})

// ═══ 404 ═══
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'))
})

// ═══ تشغيل السيرفر ═══
app.listen(PORT, config.HOST, async () => {
  console.log('')
  console.log(chalk.cyan('╔═══════════════════════════════════════════════════════╗'))
  console.log(chalk.cyan('║') + chalk.magenta.bold('  🕸 SUKUNA PLATFORM IS LIVE! 🕸  ') + chalk.cyan('              ║'))
  console.log(chalk.cyan('╠═══════════════════════════════════════════════════════╣'))
  console.log(chalk.cyan('║') + chalk.white(`  🌐 URL: http://localhost:${PORT}`) + chalk.cyan('                 ║'))
  console.log(chalk.cyan('║') + chalk.white(`  📦 Sessions: ${countSessions()}`) + chalk.cyan('                          ║'))
  console.log(chalk.cyan('║') + chalk.yellow(`  👑 Developer: ${config.platform.developer}`) + chalk.cyan('          ║'))
  console.log(chalk.cyan('║') + chalk.green(`  🤖 Bot: ${config.platform.botName}`) + chalk.cyan('                          ║'))
  console.log(chalk.cyan('╚═══════════════════════════════════════════════════════╝'))
  console.log('')

  // تشغيل بوت مراقبة الجلسات
  try {
    const { startTelegramMonitor } = await import('./telegram-monitor.js')
    await startTelegramMonitor()
  } catch (e) {
    console.log(chalk.yellow('⚠️ Telegram monitor not configured'))
  }
})

export default app