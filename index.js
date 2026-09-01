/**
 * ═══════════════════════════════════════════════════════
 * 🚀 SUKUNA PLATFORM | منصة سوكونا الرئيسية
 * ═══════════════════════════════════════════════════════
 * 👑 المطور: آدم (شادو) | Adam (Shadow)
 * 🤖 البوت: سوكونا | Sukuna
 * 📜 الوصف: موقع ربط الواتساب بنفس طريقة البوت الرئيسي
 * ═══════════════════════════════════════════════════════
 */

import express from 'express'
import bodyParser from 'body-parser'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'
import pairRouter from './pair.js'
import qrRouter from './qr.js'
import { startTelegramMonitor } from './telegram-monitor.js'
import config from './config.js'

const app = express()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PORT = config.PORT

// ═══ زيادة حد الـ Event Listeners ═══
import('events').then(events => {
  events.EventEmitter.defaultMaxListeners = 500
})

// ═══ إنشاء المجلدات المطلوبة ═══
const dirs = [
  config.sessionsDir,
  config.subSessionsDir,
  config.pairSessionsDir,
  config.qrSessionsDir
]

for (const dir of dirs) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
    console.log(`📁 Created: ${dir}`)
  }
}

// ═══ Middleware ═══
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(express.static(__dirname))

// ═══ Routes ═══
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'pair.html'))
})

app.use('/pair', pairRouter)
app.use('/qr', qrRouter)

// ═══ API: عرض الجلسات ═══
app.get('/api/sessions', (req, res) => {
  try {
    const subDir = config.subSessionsDir
    const sessions = fs.readdirSync(subDir).filter(s => {
      return fs.existsSync(path.join(subDir, s, 'creds.json'))
    })
    res.json({ sessions, count: sessions.length })
  } catch (e) {
    res.json({ sessions: [], count: 0 })
  }
})

// ═══ API: حذف جلسة ═══
app.delete('/api/session/:number', (req, res) => {
  try {
    const num = req.params.number
    const sessionPath = path.join(config.subSessionsDir, num)
    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true, force: true })
      res.json({ success: true, message: `Session ${num} deleted` })
    } else {
      res.json({ success: false, message: 'Session not found' })
    }
  } catch (e) {
    res.json({ success: false, message: e.message })
  }
})

// ═══ تشغيل السيرفر ═══
app.listen(PORT, async () => {
  console.log('╔════════════════════════════════════════╗')
  console.log('║   🕸 SUKUNA PLATFORM IS RUNNING! 🕸   ║')
  console.log('╠════════════════════════════════════════╣')
  console.log(`║   🌐 Server: http://localhost:${PORT}    ║`)
  console.log('║   👑 Developer: Adam (Shadow)          ║')
  console.log('╚════════════════════════════════════════╝')
  console.log('')

  await startTelegramMonitor()
})

export default app