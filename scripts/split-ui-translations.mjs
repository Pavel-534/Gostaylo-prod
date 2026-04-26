// DEPRECATED after Stage 61.0: `ui.js` is `coreUi` only; chat lives in `slices/chat-ui.js`. Do not run blindly.
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const uiPath = path.join(root, 'lib/translations/ui.js')
const raw = fs.readFileSync(uiPath, 'utf8')
const lines = raw.split(/\r?\n/)

// Line 1-based: chatUi starts line 8, ends before "export const coreUi" (Stage 61.0)
const startIdx = 7 // 0-based line 8
const uiUiIdx = lines.findIndex((l, i) => i > startIdx && l.startsWith('export const coreUi'))
if (uiUiIdx < 0) throw new Error('coreUi export not found')
const chatBlock = lines.slice(startIdx, uiUiIdx).join('\n') + '\n'
const head = `/**
 * Chat + messenger + admin-bulk surface strings (loaded with /messages via register-chat-slice).
 * Split from former ui.js for smaller initial JS on home / checkout.
 */
${chatBlock}`

const surfaceHead =
  `/**
 * UI translations — app chrome, profile, marketing (non-chat bundle).
 * Chat: slices/chat-ui.js — merged at runtime for /messages.
 */
` + lines.slice(uiUiIdx).join('\n') + '\n'

const slicePath = path.join(root, 'lib/translations/slices/chat-ui.js')
const surfacePath = path.join(root, 'lib/translations/ui.js')
fs.writeFileSync(slicePath, head, 'utf8')
fs.writeFileSync(surfacePath, surfaceHead, 'utf8')
console.log('Wrote', slicePath, 'and', surfacePath)
