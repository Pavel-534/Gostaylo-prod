/**
 * PDF Unicode fonts (Stage 47.0) — Noto Sans (LGC + Cyrillic), Thai, Simplified Chinese.
 * Stage 106.3 fix: never fall back to pdfkit Helvetica on serverless (missing .afm on Vercel).
 * @see `lib/assets/fonts/partner-pdf/README.md`
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'node:url'

const FONT_FILES = {
  lgc: 'NotoSans-Regular.ttf',
  thai: 'NotoSansThai-Regular.ttf',
  cjk: 'NotoSansSC-Regular.otf',
}

const REGISTERED = new WeakMap()

let cachedFontDir = null

function exists(p) {
  try {
    return fs.existsSync(p)
  } catch {
    return false
  }
}

/** Resolve font directory on Vercel (/var/task) and locally. */
export function resolvePartnerPdfFontDir() {
  if (cachedFontDir) return cachedFontDir

  const here = path.dirname(fileURLToPath(import.meta.url))
  const candidates = [
    path.join(process.cwd(), 'lib', 'assets', 'fonts', 'partner-pdf'),
    path.join(here, '..', 'assets', 'fonts', 'partner-pdf'),
    path.join(process.cwd(), '.next', 'server', 'lib', 'assets', 'fonts', 'partner-pdf'),
  ]

  for (const dir of candidates) {
    if (exists(path.join(dir, FONT_FILES.lgc))) {
      cachedFontDir = dir
      return dir
    }
  }

  cachedFontDir = candidates[0]
  return cachedFontDir
}

function scriptClass(ch) {
  const c = ch.codePointAt(0)
  if (c == null || Number.isNaN(c)) return 'lgc'
  if (c >= 0x0e00 && c <= 0x0e7f) return 'thai'
  if (
    (c >= 0x4e00 && c <= 0x9fff) ||
    (c >= 0x3400 && c <= 0x4dbf) ||
    (c >= 0xf900 && c <= 0xfaff) ||
    (c >= 0x3040 && c <= 0x30ff)
  ) {
    return 'cjk'
  }
  return 'lgc'
}

function segmentByScript(str) {
  const s = String(str ?? '')
  if (!s) return []
  const out = []
  let cur = scriptClass(s[0])
  let buf = ''
  for (const ch of s) {
    const sc = scriptClass(ch)
    if (sc !== cur && buf) {
      out.push({ script: cur, text: buf })
      buf = ''
      cur = sc
    }
    buf += ch
  }
  if (buf) out.push({ script: cur, text: buf })
  return out
}

/**
 * Register embedded fonts on this PDFDocument (idempotent per doc instance).
 * @param {object} doc - pdfkit PDFDocument instance
 */
export function registerPartnerPdfFonts(doc) {
  if (REGISTERED.get(doc)) return REGISTERED.get(doc)
  const reg = { lgc: false, thai: false, cjk: false }
  const fontDir = resolvePartnerPdfFontDir()
  const lgcPath = path.join(fontDir, FONT_FILES.lgc)
  const thaiPath = path.join(fontDir, FONT_FILES.thai)
  const cjkPath = path.join(fontDir, FONT_FILES.cjk)
  try {
    if (exists(lgcPath)) {
      doc.registerFont('PdfNotoLGC', lgcPath)
      reg.lgc = true
    }
    if (exists(thaiPath)) {
      doc.registerFont('PdfNotoThai', thaiPath)
      reg.thai = true
    }
    if (exists(cjkPath)) {
      doc.registerFont('PdfNotoCJK', cjkPath)
      reg.cjk = true
    }
  } catch (e) {
    console.warn('[partner-pdf-fonts] register failed', e?.message || e)
  }
  REGISTERED.set(doc, reg)
  return reg
}

/**
 * @param {{ lgc?: boolean }} reg
 * @returns {string}
 */
export function getPdfBodyFontName(reg) {
  if (reg?.lgc) return 'PdfNotoLGC'
  const dir = resolvePartnerPdfFontDir()
  throw new Error(
    `PDF fonts missing at ${dir} (need ${FONT_FILES.lgc}). ` +
      'Redeploy with lib/assets/fonts in the server bundle.',
  )
}

/**
 * @param {object} doc
 * @returns {{ lgc: boolean, thai: boolean, cjk: boolean }}
 */
export function requirePartnerPdfFonts(doc) {
  const reg = registerPartnerPdfFonts(doc)
  getPdfBodyFontName(reg)
  return reg
}

function pickFontName(seg, reg) {
  if (seg.script === 'thai' && reg.thai) return 'PdfNotoThai'
  if (seg.script === 'cjk' && reg.cjk) return 'PdfNotoCJK'
  return getPdfBodyFontName(reg)
}

/**
 * Draw a single line of possibly mixed-script text at (x, y).
 * @param {object} doc - pdfkit PDFDocument instance
 * @param {string} text
 * @param {number} x
 * @param {number} y
 * @param {{ fontSize?: number }} opts
 * @returns {number} approximate width used (for simple layouts)
 */
export function drawPdfUnicodeLine(doc, text, x, y, opts = {}) {
  const fontSize = Number(opts.fontSize) || 8
  const reg = REGISTERED.get(doc) || registerPartnerPdfFonts(doc)
  getPdfBodyFontName(reg)
  const raw = String(text ?? '')
  const segs = segmentByScript(raw)
  if (!segs.length) {
    doc.fontSize(fontSize).font(getPdfBodyFontName(reg)).text('', x, y, { lineBreak: false })
    return 0
  }
  let cx = x
  for (const seg of segs) {
    const name = pickFontName(seg, reg)
    doc.font(name).fontSize(fontSize)
    const w = doc.widthOfString(seg.text, { fontSize })
    doc.text(seg.text, cx, y, { lineBreak: false, continued: false })
    cx += w
  }
  return cx - x
}
