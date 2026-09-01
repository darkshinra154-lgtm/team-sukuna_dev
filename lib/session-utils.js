/**
 * ═══════════════════════════════════════════════════════
 * 🛠️ SESSION UTILS | أدوات إدارة الجلسات
 * ═══════════════════════════════════════════════════════
 * 👑 المطور: آدم (شادو) | Adam (Shadow)
 * 🤖 البوت: سوكونا | Sukuna
 * 🏷️ الحقوق: ${global.author}
 * 📜 الوصف: دوال مشتركة لنسخ وحفظ وحذف جلسات البوتات الفرعية
 * ═══════════════════════════════════════════════════════
 */

import fs from 'fs'
import path from 'path'
import pino from 'pino'
import {
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
  Browsers
} from '@whiskeysockets/baileys'
import config from '../config.js'

// ═══ إنشاء socketOptions بنفس مواصفات البوت الرئيسي ═══
export async function buildSocketOptions(state, sessionId = null) {
  const { version } = await fetchLatestBaileysVersion()
  return {
    version,
    logger: pino({ level: 'silent' }),
    browser: Browsers.ubuntu('Chrome'),
    printQRInTerminal: false,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(
        state.keys,
        pino({ level: 'fatal' }).child({ level: 'fatal' })
      )
    },
    markOnlineOnConnect: config.waSocket.markOnlineOnConnect,
    generateHighQualityLinkPreview: config.waSocket.generateHighQualityLinkPreview,
    syncFullHistory: config.waSocket.syncFullHistory,
    defaultQueryTimeoutMs: config.waSocket.defaultQueryTimeoutMs,
    keepAliveIntervalMs: config.waSocket.keepAliveIntervalMs,
    maxIdleTimeMs: config.waSocket.maxIdleTimeMs,
    connectTimeoutMs: 60000,
    retryRequestDelayMs: 250,
    maxRetries: 5,
    msgRetryCounterCache: new Map(),
    userDevicesCache: new Map()
  }
}

// ═══ حذف ملف أو مجلد ═══
export function removeDir(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) return false
    fs.rmSync(dirPath, { recursive: true, force: true })
    return true
  } catch (e) {
    console.error('Error removing directory:', e.message)
    return false
  }
}

// ═══ حفظ الجلسة في فولدر البوتات الفرعية ═══
export function saveSessionToSub(sourceDir, botNumber) {
  try {
    const credsPath = path.join(sourceDir, 'creds.json')
    if (!fs.existsSync(credsPath)) {
      console.error(`❌ creds.json not found in ${sourceDir}`)
      return null
    }

    const subDir = config.sessions.subDir
    if (!fs.existsSync(subDir)) {
      fs.mkdirSync(subDir, { recursive: true })
    }

    const targetDir = path.join(subDir, botNumber)

    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true })
    }

    fs.mkdirSync(targetDir, { recursive: true })
    const files = fs.readdirSync(sourceDir)
    
    for (const file of files) {
      const srcPath = path.join(sourceDir, file)
      const dstPath = path.join(targetDir, file)
      const stat = fs.statSync(srcPath)
      if (stat.isFile()) {
        fs.copyFileSync(srcPath, dstPath)
      }
    }

    console.log(`✅ Session saved to: ${targetDir}`)
    return targetDir
  } catch (e) {
    console.error('❌ Error saving session:', e.message)
    return null
  }
}

// ═══ قراءة معلومات الجلسة من creds.json ═══
export function readSessionInfo(sessionPath) {
  try {
    const credsPath = path.join(sessionPath, 'creds.json')
    if (!fs.existsSync(credsPath)) return null
    const data = JSON.parse(fs.readFileSync(credsPath, 'utf-8'))
    return {
      number: data?.me?.id?.split(':')[0] || null,
      name: data?.me?.name || null,
      platform: data?.platform || null,
      registered: data?.registered || false
    }
  } catch {
    return null
  }
}

// ═══ قائمة الجلسات الموجودة ═══
export function listSessions() {
  const subDir = config.sessions.subDir
  if (!fs.existsSync(subDir)) return []
  return fs.readdirSync(subDir).filter(s => {
    return fs.existsSync(path.join(subDir, s, 'creds.json'))
  }).map(s => {
    const info = readSessionInfo(path.join(subDir, s))
    return {
      number: s,
      ...info,
      path: path.join(subDir, s)
    }
  })
}

// ═══ عدد الجلسات ═══
export function countSessions() {
  return listSessions().length
}

export default {
  buildSocketOptions,
  removeDir,
  saveSessionToSub,
  readSessionInfo,
  listSessions,
  countSessions
}