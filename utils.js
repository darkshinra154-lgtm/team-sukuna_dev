/**
 * ═══════════════════════════════════════════════════════
 * 🛠️ SHARED UTILS | دوال مشتركة من بوت الواتساب
 * ═══════════════════════════════════════════════════════
 * 👑 المطور: آدم (شادو) | Adam (Shadow)
 * 🤖 البوت: سوكونا | Sukuna
 * 📜 الوصف: نفس الدوال المستخدمة في البوت الرئيسي
 * ═══════════════════════════════════════════════════════
 */

import fs from 'fs'
import config from '../config.js'

// ═══ معالجة الأرقام بنفس طريقة البوت الرئيسي ═══
const cleanDigits = (value = '') => String(value || '').replace(/\D/g, '')

export const normalizePhone = (value = '') => {
  let digits = cleanDigits(value)
  if (!digits) return ''
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.startsWith('0')) {
    digits = `${config.defaultCountryCode || '20'}${digits.slice(1)}`
  }
  return digits
}

// ═══ حذف ملف أو مجلد ═══
export function removeFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return false
    fs.rmSync(filePath, { recursive: true, force: true })
    return true
  } catch (e) {
    console.error('❌ Error removing file:', e.message)
    return false
  }
}

// ═══ نسخ ملفات الجلسة من مجلد لآخر ═══
export function copySessionFiles(sourceDir, targetDir) {
  try {
    if (!fs.existsSync(sourceDir)) return false
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true })
    }
    
    const files = fs.readdirSync(sourceDir)
    for (const file of files) {
      fs.copyFileSync(
        `${sourceDir}/${file}`,
        `${targetDir}/${file}`
      )
    }
    return true
  } catch (e) {
    console.error('❌ Error copying session files:', e.message)
    return false
  }
}

// ═══ حفظ الجلسة في فولدر البوتات الفرعية ═══
export function saveSessionToSubFolder(sourceDir, botNumber) {
  try {
    const credsPath = `${sourceDir}/creds.json`
    if (!fs.existsSync(credsPath)) {
      console.log('❌ creds.json not found in', sourceDir)
      return null
    }

    const subDir = config.subSessionsDir
    if (!fs.existsSync(subDir)) {
      fs.mkdirSync(subDir, { recursive: true })
    }

    const targetDir = `${subDir}/${botNumber}`

    // حذف القديم لو موجود
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true })
    }

    fs.mkdirSync(targetDir, { recursive: true })
    
    if (copySessionFiles(sourceDir, targetDir)) {
      console.log(`✅ Session saved to: ${targetDir}`)
      return targetDir
    }
    return null
  } catch (e) {
    console.error('❌ Error saving session:', e.message)
    return null
  }
}

// ═══ قراءة رقم البوت من creds.json ═══
export function getBotNumberFromCreds(sessionDir) {
  try {
    const credsPath = `${sessionDir}/creds.json`
    if (!fs.existsSync(credsPath)) return null
    
    const credsData = JSON.parse(fs.readFileSync(credsPath, 'utf-8'))
    const meId = credsData?.me?.id || ''
    if (!meId) return null
    
    // format: number:device@s.whatsapp.net
    return meId.split(':')[0].split('@')[0]
  } catch (e) {
    console.error('❌ Error reading bot number from creds:', e.message)
    return null
  }
}