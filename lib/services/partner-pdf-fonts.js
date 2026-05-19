/**
 * PDF Unicode fonts (Stage 47.0) — Noto Sans (LGC + Cyrillic), Thai, CJK.
 * Stage 106.3b: Vercel — pdfkit вне webpack-бандла + регистрация шрифтов из Buffer.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const nodeRequire = createRequire(import.meta.url)

/** Runtime require — webpack не должен инлайнить pdfkit (иначе ENOENT Helvetica.afm на Vercel). */
function loadPdfKit() {
  const mod = nodeRequire('pdfkit')
  return mod?.default ?? mod
}

const FONT_FILES = {
  lgc: 'NotoSans-Regular.ttf',
  thai: 'NotoSansThai-Regular.ttf',
  cjk: 'NotoSansSC-Regular.otf',
}

const REGISTERED = new WeakMap()

/** @type {{ lgc: Buffer|null, thai: Buffer|null, cjk: Buffer|null } | null} */
let fontBuffersCache = null

function exists(p) {
  try {
    return fs.existsSync(p)
  } catch {
    return false
  }
}

/**
 * @param {string} fileName
 */
function resolveFontFilePath(fileName) {
  const fromImport = fileURLToPath(new URL(`../assets/fonts/partner-pdf/${fileName}`, import.meta.url))
  const candidates = [
    fromImport,
    path.join(process.cwd(), 'lib', 'assets', 'fonts', 'partner-pdf', fileName),
    path.join(process.cwd(), '.next', 'server', 'lib', 'assets', 'fonts', 'partner-pdf', fileName),
  ]
  try {
    const pkgRoot = path.dirname(nodeRequire.resolve('pdfkit/package.json'))
    candidates.push(path.join(pkgRoot, '..', 'lib', 'assets', 'fonts', 'partner-pdf', fileName))
  } catch {
    /* pdfkit optional */
  }
  for (const p of candidates) {
    if (exists(p)) return p
  }
  return null
}

/** @returns {{ lgc: Buffer|null, thai: Buffer|null, cjk: Buffer|null }} */
function getFontBuffers() {
  if (fontBuffersCache) return fontBuffersCache
  const lgcPath = resolveFontFilePath(FONT_FILES.lgc)
  const thaiPath = resolveFontFilePath(FONT_FILES.thai)
  const cjkPath = resolveFontFilePath(FONT_FILES.cjk)
  fontBuffersCache = {
    lgc: lgcPath ? fs.readFileSync(lgcPath) : null,
    thai: thaiPath ? fs.readFileSync(thaiPath) : null,
    cjk: cjkPath ? fs.readFileSync(cjkPath) : null,
  }
  return fontBuffersCache
}

/** Resolve font directory on Vercel (/var/task) and locally. */
export function resolvePartnerPdfFontDir() {
  const p = resolveFontFilePath(FONT_FILES.lgc)
  return p ? path.dirname(p) : path.join(process.cwd(), 'lib', 'assets', 'fonts', 'partner-pdf')
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
  const buffers = getFontBuffers()
  try {
    if (buffers.lgc?.length) {
      doc.registerFont('PdfNotoLGC', buffers.lgc)
      reg.lgc = true
    }
    if (buffers.thai?.length) {
      doc.registerFont('PdfNotoThai', buffers.thai)
      reg.thai = true
    }
    if (buffers.cjk?.length) {
      doc.registerFont('PdfNotoCJK', buffers.cjk)
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
  const checked = [
    resolveFontFilePath(FONT_FILES.lgc),
    path.join(dir, FONT_FILES.lgc),
    path.join(process.cwd(), 'lib', 'assets', 'fonts', 'partner-pdf', FONT_FILES.lgc),
  ]
    .filter(Boolean)
    .map((p) => `${p}=${exists(p)}`)
    .join('; ')
  throw new Error(
    `PDF fonts missing (Noto). Checked: ${checked || dir}. ` +
      'Redeploy after Stage 106.3b (serverExternalPackages + traced fonts).',
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

/**
 * Создать PDFDocument с уже зарегистрированным Noto (никогда не Helvetica).
 * @param {object} [options]
 */
export function createPartnerPdfDocument(options = {}) {
  const PDFDocument = loadPdfKit()
  const doc = new PDFDocument(options)
  const reg = registerPartnerPdfFonts(doc)
  const font = getPdfBodyFontName(reg)
  doc.font(font)
  return { doc, font, reg }
}

function pickFontName(seg, reg) {
  if (seg.script === 'thai' && reg.thai) return 'PdfNotoThai'
  if (seg.script === 'cjk' && reg.cjk) return 'PdfNotoCJK'
  return getPdfBodyFontName(reg)
}

/**
 * Draw a single line of possibly mixed-script text at (x, y).
 */
export function drawPdfUnicodeLine(doc, text, x, y, opts = {}) {
  const fontSize = Number(opts.fontSize) || 8
  const reg = REGISTERED.get(doc) || registerPartnerPdfFonts(doc)
  const bodyFont = getPdfBodyFontName(reg)
  const raw = String(text ?? '')
  const segs = segmentByScript(raw)
  if (!segs.length) {
    doc.font(bodyFont).fontSize(fontSize).text('', x, y, { lineBreak: false })
    return 0
  }
  let cx = x
  for (const seg of segs) {
    const name = pickFontName(seg, reg)
    doc.font(name).fontSize(fontSize)
    const w = doc.widthOfString(seg.text)
    doc.text(seg.text, cx, y, { lineBreak: false, continued: false })
    cx += w
  }
  return cx - x
}
