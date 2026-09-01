/**
 * ═══════════════════════════════════════════════════════
 * 🚀 SUKUNA PLATFORM SERVER | خادم منصة سوكونا
 * ═══════════════════════════════════════════════════════
 * 👑 المطور: آدم (شادو) | Adam (Shadow)
 * 🤖 البوت: سوكونا | Sukuna
 * 📜 الوصف: Express server + APIs + Dashboard
 * ═══════════════════════════════════════════════════════
 */

import express from 'express'
import bodyParser from 'body-parser'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'
import config from './config.js'

import pairRouter from './pair.js'
import qrRouter from './qr.js'
import { startTelegramMonitor } from './telegram-monitor.js'

const app = express()
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PORT = config.PORT
const HOST = config.HOST

// زيادة الحدود
import('events').then(events => {
  events.EventEmitter.defaultMaxListeners = 500
})

// ═══ Middleware ═══
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(express.static(__dirname))

// ═══ إنشاء المجلدات ═══
const dirs = [
  config.sessionsDir,
  config.subSessionsDir,
  './pair_sessions',
  './qr_sessions'
]
for (const dir of dirs) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

// ═══ الصفحة الرئيسية → Dashboard ═══
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'))
})

// ═══ صفحة الربط ═══
app.get('/connect', (req, res) => {
  res.sendFile(path.join(__dirname, 'pair.html'))
})

// ═══ APIs ═══
app.use('/api/pair', pairRouter)
app.use('/api/qr', qrRouter)

// ═══ API: الإحصائيات ═══
app.get('/api/stats', (req, res) => {
  try {
    const subDir = config.subSessionsDir
    const sessions = fs.readdirSync(subDir).filter(s =>
      fs.existsSync(path.join(subDir, s, 'creds.json'))
    )

    res.json({
      success: true,
      totalSessions: sessions.length,
      platform: config.platform,
      uptime: process.uptime()
    })
  } catch (e) {
    res.json({ success: false, error: e.message })
  }
})

// ═══ API: قائمة الجلسات ═══
app.get('/api/sessions', (req, res) => {
  try {
    const subDir = config.subSessionsDir
    const sessions = []

    if (fs.existsSync(subDir)) {
      const dirs = fs.readdirSync(subDir)
      for (const dir of dirs) {
        const sessionPath = path.join(subDir, dir)
        const credsPath = path.join(sessionPath, 'creds.json')

        if (fs.existsSync(credsPath)) {
          try {
            const creds = JSON.parse(fs.readFileSync(credsPath, 'utf-8'))
            const stat = fs.statSync(sessionPath)
            sessions.push({
              number: dir,
              name: creds.me?.name || 'Unknown',
              createdAt: stat.birthtime,
              filesCount: fs.readdirSync(sessionPath).length
            })
          } catch {
            sessions.push({
              number: dir,
              name: 'Unknown',
              createdAt: new Date(),
              filesCount: 0
            })
          }
        }
      }
    }

    res.json({
      success: true,
      sessions,
      count: sessions.length
    })
  } catch (e) {
    res.json({ success: false, error: e.message })
  }
})

// ═══ API: حذف جلسة ═══
app.delete('/api/session/:number', (req, res) => {
  try {
    const { number } = req.params
    const cleanNum = String(number).replace(/[^0-9]/g, '')
    const sessionPath = path.join(config.subSessionsDir, cleanNum)

    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true, force: true })
      res.json({
        success: true,
        message: `تم حذف جلسة ${cleanNum} بنجاح`
      })
    } else {
      res.status(404).json({
        success: false,
        message: 'الجلسة غير موجودة'
      })
    }
  } catch (e) {
    res.status(500).json({
      success: false,
      message: e.message
    })
  }
})

// ═══ بدء السيرفر ═══
app.listen(PORT, HOST, async () => {
  console.log('')
  console.log('╔════════════════════════════════════════════╗')
  console.log('║    🕸  SUKUNA PLATFORM IS RUNNING!  🕸     ║')
  console.log('╠════════════════════════════════════════════╣')
  console.log(`║  🌐 Server: http://${HOST}:${PORT}          ║`)
  console.log('║  👑 Developer: Adam (Shadow)              ║')
  console.log(`║  📦 Version: ${config.platform.version}                  ║`)
  console.log('╚════════════════════════════════════════════╝')
  console.log('')

  await startTelegramMonitor()
})

export default app